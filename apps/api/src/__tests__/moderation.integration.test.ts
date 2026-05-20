/**
 * Marketplace moderation integration tests.
 *
 * Hit a real Postgres so the unique-index dedup, the partial unique on
 * (reporter_id, template_id) WHERE open/auto_actioned, and the inside-
 * transaction auto-action threshold logic are actually exercised — not
 * mocked.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import { isTestDbReachable, setupTestDatabase, type TestDatabase } from './helpers/test-db.js';

// Redis is touched only by the rate-limit guard; mock it out so we don't
// need a live Redis to run these tests. The mocked client behaves as if
// the rate limit is never tripped.
const redisZremrangebyscoreMock = vi.fn().mockResolvedValue(0);
const redisZcardMock = vi.fn().mockResolvedValue(0);
const redisZaddMock = vi.fn();
const redisExpireMock = vi.fn();
const redisPipelineMock = vi.fn(() => ({
  zadd: redisZaddMock.mockReturnThis(),
  expire: redisExpireMock.mockReturnThis(),
  exec: () => Promise.resolve([]),
}));
vi.mock('../lib/redis.js', () => ({
  redis: {
    zremrangebyscore: redisZremrangebyscoreMock,
    zcard: redisZcardMock,
    pipeline: redisPipelineMock,
  },
}));

const reachable = await isTestDbReachable();

let testDb: TestDatabase | null = null;
let templates: typeof import('../schema/db.js').templates;
let users: typeof import('../schema/db.js').users;
let templateReports: typeof import('../schema/db.js').templateReports;
let createTemplateReport: typeof import('../services/moderation.js').createTemplateReport;
let listOpenReports: typeof import('../services/moderation.js').listOpenReports;
let dismissReport: typeof import('../services/moderation.js').dismissReport;
let actionReport: typeof import('../services/moderation.js').actionReport;
let getModerationStats: typeof import('../services/moderation.js').getModerationStats;

beforeAll(async () => {
  if (!reachable) return;
  testDb = await setupTestDatabase('moderation');
  vi.doMock('../lib/db.js', () => ({
    pool: testDb!.pool,
    db: testDb!.db,
  }));

  const schema = await import('../schema/db.js');
  templates = schema.templates;
  users = schema.users;
  templateReports = schema.templateReports;
  const moderation = await import('../services/moderation.js');
  createTemplateReport = moderation.createTemplateReport;
  listOpenReports = moderation.listOpenReports;
  dismissReport = moderation.dismissReport;
  actionReport = moderation.actionReport;
  getModerationStats = moderation.getModerationStats;
}, 60_000);

beforeEach(async () => {
  if (!testDb) return;
  await testDb.reset();
  redisZcardMock.mockClear().mockResolvedValue(0);
  redisZremrangebyscoreMock.mockClear().mockResolvedValue(0);
});

afterAll(async () => {
  if (testDb) await testDb.close();
});

async function seedUser(id: string, email: string, role: 'user' | 'admin' = 'user'): Promise<void> {
  await testDb!.pool.query(
    `INSERT INTO users (id, email, role, plan) VALUES ($1, $2, $3, 'free')`,
    [id, email, role],
  );
}

async function seedPublicTemplate(opts: {
  id: string;
  ownerId: string;
  name?: string;
}): Promise<void> {
  await testDb!.pool.query(
    `INSERT INTO templates (id, user_id, name, html_content, is_public)
     VALUES ($1, $2, $3, $4, true)`,
    [opts.id, opts.ownerId, opts.name ?? 'Public template', '<p>hello</p>'],
  );
}

describe.skipIf(!reachable)(
  'createTemplateReport — happy path',
  () => {
    it('inserts a report with status=open and does NOT auto-action on the first report', async () => {
      const owner = '00000000-0000-0000-0000-000000000a01';
      const reporter = '00000000-0000-0000-0000-000000000a02';
      await seedUser(owner, 'owner@example.com');
      await seedUser(reporter, 'reporter@example.com');
      await seedPublicTemplate({ id: 'tmpl_a1', ownerId: owner });

      const result = await createTemplateReport({
        templateId: 'tmpl_a1',
        reporterId: reporter,
        reason: 'spam',
        notes: 'looks shady',
      });

      expect(result.autoActioned).toBe(false);

      const [row] = await testDb!.db
        .select()
        .from(templateReports)
        .where(eq(templateReports.id, result.reportId));
      expect(row?.reason).toBe('spam');
      expect(row?.status).toBe('open');
      expect(row?.notes).toBe('looks shady');

      // Template stays public.
      const [tmpl] = await testDb!.db.select().from(templates).where(eq(templates.id, 'tmpl_a1'));
      expect(tmpl?.isPublic).toBe(true);
    });

    it('auto-unpublishes the template once 3 independent reports land', async () => {
      const owner = '00000000-0000-0000-0000-000000000b01';
      const r1 = '00000000-0000-0000-0000-000000000b02';
      const r2 = '00000000-0000-0000-0000-000000000b03';
      const r3 = '00000000-0000-0000-0000-000000000b04';
      await seedUser(owner, 'owner-b@example.com');
      await seedUser(r1, 'reporter-1@example.com');
      await seedUser(r2, 'reporter-2@example.com');
      await seedUser(r3, 'reporter-3@example.com');
      await seedPublicTemplate({ id: 'tmpl_b1', ownerId: owner });

      const a = await createTemplateReport({ templateId: 'tmpl_b1', reporterId: r1, reason: 'spam' });
      const b = await createTemplateReport({ templateId: 'tmpl_b1', reporterId: r2, reason: 'malicious' });
      const c = await createTemplateReport({ templateId: 'tmpl_b1', reporterId: r3, reason: 'inappropriate' });

      expect(a.autoActioned).toBe(false);
      expect(b.autoActioned).toBe(false);
      expect(c.autoActioned).toBe(true);

      const [tmpl] = await testDb!.db.select().from(templates).where(eq(templates.id, 'tmpl_b1'));
      expect(tmpl?.isPublic).toBe(false);

      // All three reports flipped to auto_actioned.
      const rows = await testDb!.db
        .select()
        .from(templateReports)
        .where(eq(templateReports.templateId, 'tmpl_b1'));
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.status === 'auto_actioned')).toBe(true);
    });
  },
);

describe.skipIf(!reachable)(
  'createTemplateReport — refusals',
  () => {
    it('refuses self-reports', async () => {
      const owner = '00000000-0000-0000-0000-000000000c01';
      await seedUser(owner, 'owner-c@example.com');
      await seedPublicTemplate({ id: 'tmpl_c1', ownerId: owner });

      await expect(
        createTemplateReport({
          templateId: 'tmpl_c1',
          reporterId: owner,
          reason: 'spam',
        }),
      ).rejects.toThrow(/own template/);
    });

    it('refuses reports on private templates', async () => {
      const owner = '00000000-0000-0000-0000-000000000d01';
      const reporter = '00000000-0000-0000-0000-000000000d02';
      await seedUser(owner, 'owner-d@example.com');
      await seedUser(reporter, 'reporter-d@example.com');
      await testDb!.pool.query(
        `INSERT INTO templates (id, user_id, name, html_content, is_public)
         VALUES ($1, $2, 'Private', '<p>x</p>', false)`,
        ['tmpl_d1', owner],
      );

      await expect(
        createTemplateReport({
          templateId: 'tmpl_d1',
          reporterId: reporter,
          reason: 'spam',
        }),
      ).rejects.toThrow(/not found/i);
    });

    it('collapses duplicate reports from the same user', async () => {
      const owner = '00000000-0000-0000-0000-000000000e01';
      const reporter = '00000000-0000-0000-0000-000000000e02';
      await seedUser(owner, 'owner-e@example.com');
      await seedUser(reporter, 'reporter-e@example.com');
      await seedPublicTemplate({ id: 'tmpl_e1', ownerId: owner });

      await createTemplateReport({ templateId: 'tmpl_e1', reporterId: reporter, reason: 'spam' });
      await expect(
        createTemplateReport({ templateId: 'tmpl_e1', reporterId: reporter, reason: 'malicious' }),
      ).rejects.toThrow(/already reported/i);

      // Only one row exists.
      const rows = await testDb!.db
        .select()
        .from(templateReports)
        .where(eq(templateReports.templateId, 'tmpl_e1'));
      expect(rows).toHaveLength(1);
    });

    it('honors the Redis rate limit', async () => {
      const owner = '00000000-0000-0000-0000-000000000f01';
      const reporter = '00000000-0000-0000-0000-000000000f02';
      await seedUser(owner, 'owner-f@example.com');
      await seedUser(reporter, 'reporter-f@example.com');
      await seedPublicTemplate({ id: 'tmpl_f1', ownerId: owner });

      redisZcardMock.mockResolvedValueOnce(20); // at the per-day cap

      await expect(
        createTemplateReport({ templateId: 'tmpl_f1', reporterId: reporter, reason: 'spam' }),
      ).rejects.toThrow(/24 hours/);
    });
  },
);

describe.skipIf(!reachable)(
  'listOpenReports / dismissReport / actionReport',
  () => {
    it('listOpenReports returns only open + auto_actioned rows, newest first', async () => {
      const owner = '00000000-0000-0000-0000-000000001001';
      const r1 = '00000000-0000-0000-0000-000000001002';
      const r2 = '00000000-0000-0000-0000-000000001003';
      const mod = '00000000-0000-0000-0000-000000001004';
      await seedUser(owner, 'owner-1@example.com');
      await seedUser(r1, 'r1@example.com');
      await seedUser(r2, 'r2@example.com');
      await seedUser(mod, 'mod@example.com', 'admin');
      await seedPublicTemplate({ id: 'tmpl_l1', ownerId: owner });
      await seedPublicTemplate({ id: 'tmpl_l2', ownerId: owner, name: 'second' });

      const first = await createTemplateReport({ templateId: 'tmpl_l1', reporterId: r1, reason: 'spam' });
      await createTemplateReport({ templateId: 'tmpl_l2', reporterId: r2, reason: 'malicious' });

      // Close the first one — it should drop out of the queue.
      await dismissReport(first.reportId, mod);

      const list = await listOpenReports({});
      expect(list.map((r) => r.templateId)).toEqual(['tmpl_l2']);
    });

    it('dismissReport on an auto-actioned report restores the template', async () => {
      const owner = '00000000-0000-0000-0000-000000002001';
      const mod = '00000000-0000-0000-0000-000000002099';
      await seedUser(owner, 'owner-2@example.com');
      await seedUser(mod, 'mod-2@example.com', 'admin');

      // Quickly seed three reporters and produce an auto-action.
      const reporterIds = [
        '00000000-0000-0000-0000-000000002002',
        '00000000-0000-0000-0000-000000002003',
        '00000000-0000-0000-0000-000000002004',
      ];
      for (const [i, id] of reporterIds.entries()) {
        await seedUser(id, `r${i + 1}-2@example.com`);
      }
      await seedPublicTemplate({ id: 'tmpl_auto1', ownerId: owner });
      await createTemplateReport({ templateId: 'tmpl_auto1', reporterId: reporterIds[0], reason: 'spam' });
      await createTemplateReport({ templateId: 'tmpl_auto1', reporterId: reporterIds[1], reason: 'spam' });
      const finalReport = await createTemplateReport({
        templateId: 'tmpl_auto1',
        reporterId: reporterIds[2],
        reason: 'spam',
      });
      expect(finalReport.autoActioned).toBe(true);

      // Moderator overrides the auto-action.
      await dismissReport(finalReport.reportId, mod, 'looked harmless on review');

      const [tmpl] = await testDb!.db
        .select()
        .from(templates)
        .where(eq(templates.id, 'tmpl_auto1'));
      expect(tmpl?.isPublic).toBe(true);

      const rows = await testDb!.db
        .select()
        .from(templateReports)
        .where(eq(templateReports.templateId, 'tmpl_auto1'));
      expect(rows.every((r) => r.status === 'dismissed')).toBe(true);
    });

    it('actionReport unpublishes the template and closes every open report on it', async () => {
      const owner = '00000000-0000-0000-0000-000000003001';
      const r1 = '00000000-0000-0000-0000-000000003002';
      const r2 = '00000000-0000-0000-0000-000000003003';
      const mod = '00000000-0000-0000-0000-000000003099';
      await seedUser(owner, 'owner-3@example.com');
      await seedUser(r1, 'r1-3@example.com');
      await seedUser(r2, 'r2-3@example.com');
      await seedUser(mod, 'mod-3@example.com', 'admin');
      await seedPublicTemplate({ id: 'tmpl_act1', ownerId: owner });

      const a = await createTemplateReport({ templateId: 'tmpl_act1', reporterId: r1, reason: 'spam' });
      await createTemplateReport({ templateId: 'tmpl_act1', reporterId: r2, reason: 'malicious' });

      await actionReport(a.reportId, mod, 'confirmed');

      const [tmpl] = await testDb!.db
        .select()
        .from(templates)
        .where(eq(templates.id, 'tmpl_act1'));
      expect(tmpl?.isPublic).toBe(false);

      const rows = await testDb!.db
        .select()
        .from(templateReports)
        .where(eq(templateReports.templateId, 'tmpl_act1'));
      expect(rows.every((r) => r.status === 'actioned')).toBe(true);
    });

    it('refuses to resolve an already-resolved report', async () => {
      const owner = '00000000-0000-0000-0000-000000004001';
      const r1 = '00000000-0000-0000-0000-000000004002';
      const mod = '00000000-0000-0000-0000-000000004099';
      await seedUser(owner, 'owner-4@example.com');
      await seedUser(r1, 'r1-4@example.com');
      await seedUser(mod, 'mod-4@example.com', 'admin');
      await seedPublicTemplate({ id: 'tmpl_idem', ownerId: owner });

      const a = await createTemplateReport({ templateId: 'tmpl_idem', reporterId: r1, reason: 'spam' });
      await dismissReport(a.reportId, mod);
      await expect(dismissReport(a.reportId, mod)).rejects.toThrow(/resolved/);
      await expect(actionReport(a.reportId, mod)).rejects.toThrow(/resolved/);
    });

    it('getModerationStats counts open and auto_actioned separately', async () => {
      const owner = '00000000-0000-0000-0000-000000005001';
      await seedUser(owner, 'owner-5@example.com');
      const reporters = [
        '00000000-0000-0000-0000-000000005002',
        '00000000-0000-0000-0000-000000005003',
        '00000000-0000-0000-0000-000000005004',
        '00000000-0000-0000-0000-000000005005',
      ];
      for (const [i, id] of reporters.entries()) {
        await seedUser(id, `r${i + 1}-5@example.com`);
      }
      await seedPublicTemplate({ id: 'tmpl_s1', ownerId: owner });
      await seedPublicTemplate({ id: 'tmpl_s2', ownerId: owner, name: 'two' });

      // One report on s1 (stays open). Three on s2 (auto-actioned).
      await createTemplateReport({ templateId: 'tmpl_s1', reporterId: reporters[0], reason: 'spam' });
      await createTemplateReport({ templateId: 'tmpl_s2', reporterId: reporters[1], reason: 'spam' });
      await createTemplateReport({ templateId: 'tmpl_s2', reporterId: reporters[2], reason: 'spam' });
      await createTemplateReport({ templateId: 'tmpl_s2', reporterId: reporters[3], reason: 'spam' });

      const stats = await getModerationStats();
      expect(stats.open).toBe(1);
      expect(stats.autoActioned).toBe(3);
    });
  },
);
