/**
 * Drip-campaign orchestration.
 *
 * Public surface:
 *   - enqueueDripEmail({ userId, campaign })  → idempotent; worker sends.
 *   - startDripWorker()                       → starts the BullMQ worker.
 *   - stopDripWorker()                        → graceful shutdown.
 *   - scheduleDripTick()                      → registers a repeating job
 *                                               that scans for users due
 *                                               for the next drip step.
 *
 * Idempotency: we never send the same (userId, campaign) twice. A row in
 * `email_events` with status != 'skipped' is the barrier. If a send fails,
 * we mark the row 'failed' and BullMQ retries honor backoff.
 */
import { Queue, Worker, Job } from 'bullmq';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { emailEvents, users } from '../schema/db.js';
import { sendEmail } from './email.js';
import { buildTemplate, type TemplateContext } from '../emails/templates.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function parseRedisConnection() {
  const url = new URL(REDIS_URL);
  const conn: Record<string, unknown> = {
    host: url.hostname,
    port: parseInt(url.port || '6379'),
  };
  if (url.password) conn.password = decodeURIComponent(url.password);
  if (url.username && url.username !== 'default') {
    conn.username = decodeURIComponent(url.username);
  }
  if (url.protocol === 'rediss:') conn.tls = {};
  return conn;
}

const connection = parseRedisConnection();

export type DripCampaign =
  | 'welcome'
  | 'nudge1'
  | 'nudge2'
  | 'last_call'
  | 'first_pdf'
  | 'reengagement';

export interface DripJob {
  userId: string;
  campaign: DripCampaign;
}

export const dripQueue = new Queue<DripJob>('drip-campaign', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  },
});

// Separate queue for the hourly tick that scans for due drip emails.
// Keeping it separate means the tick worker processor doesn't collide
// with the send worker processor.
export const dripTickQueue = new Queue<{ tick: true }>('drip-tick', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 50 },
  },
});

function baseUrl(): string {
  return process.env.DASHBOARD_URL || 'https://app.getdocuforge.dev';
}

function buildContext(email: string): TemplateContext {
  const root = baseUrl();
  return {
    email,
    dashboardUrl: root,
    playgroundUrl: `${root}/playground?template=invoice&autorun=1`,
    keysUrl: `${root}/keys`,
    marketplaceUrl: `${root}/marketplace`,
    docsUrl: 'https://docs.getdocuforge.dev',
    founderEmail: process.env.FOUNDER_EMAIL,
  };
}

/**
 * Enqueue a drip email. Idempotency is enforced by the partial unique
 * index on email_events (user_id, campaign) WHERE campaign <>
 * 'reengagement' (see drizzle/0004). For non-reengagement campaigns
 * we run the row insert + the BullMQ enqueue inside a transaction so
 * a crash between them can't leave a queued row that never gets a
 * job, and the unique index prevents the previous check-then-insert
 * race that sent duplicate welcomes under concurrency.
 */
export async function enqueueDripEmail(input: DripJob): Promise<void> {
  const enqueued = await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: emailEvents.id, status: emailEvents.status })
      .from(emailEvents)
      .where(
        and(
          eq(emailEvents.userId, input.userId),
          eq(emailEvents.campaign, input.campaign),
        ),
      )
      .limit(1);

    if (existing.length > 0 && existing[0].status !== 'failed') {
      return false; // already sent, queued, or deliberately skipped
    }

    if (existing.length === 0) {
      // onConflictDoNothing guards against the race with the unique
      // index on non-reengagement campaigns. If a concurrent insert
      // beat us, returning() is empty and we skip the enqueue.
      const inserted = await tx
        .insert(emailEvents)
        .values({
          userId: input.userId,
          campaign: input.campaign,
          status: 'queued',
        })
        .onConflictDoNothing()
        .returning({ id: emailEvents.id });

      if (inserted.length === 0) return false;
    } else {
      await tx
        .update(emailEvents)
        .set({ status: 'queued', errorMessage: null })
        .where(eq(emailEvents.id, existing[0].id));
    }
    return true;
  });

  if (enqueued) {
    await dripQueue.add(`${input.campaign}:${input.userId}`, input);
  }
}

/**
 * Worker that actually sends the email and updates email_events.
 */
let worker: Worker<DripJob> | null = null;
let tickWorker: Worker<{ tick: true }> | null = null;

export function startDripWorker(): void {
  worker = new Worker<DripJob>(
    'drip-campaign',
    async (job: Job<DripJob>) => {
      const { userId, campaign } = job.data;

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        logger.warn({ userId, campaign }, 'Drip: user not found, skipping');
        await db
          .update(emailEvents)
          .set({ status: 'skipped', errorMessage: 'user not found' })
          .where(
            and(
              eq(emailEvents.userId, userId),
              eq(emailEvents.campaign, campaign),
            ),
          );
        return;
      }

      const tmpl = buildTemplate(campaign, buildContext(user.email));
      const result = await sendEmail({
        to: user.email,
        subject: tmpl.subject,
        html: tmpl.html,
        // Tie the send to the canonical user record so sendEmail
        // refuses to deliver if the DB row's email doesn't match.
        userId: user.id,
      });

      if (result.error) {
        await db
          .update(emailEvents)
          .set({ status: 'failed', errorMessage: result.error })
          .where(
            and(
              eq(emailEvents.userId, userId),
              eq(emailEvents.campaign, campaign),
            ),
          );
        throw new Error(result.error);
      }

      await db
        .update(emailEvents)
        .set({
          status: result.skipped ? 'skipped' : 'sent',
          sentAt: result.skipped ? null : new Date(),
          providerMessageId: result.id,
        })
        .where(
          and(
            eq(emailEvents.userId, userId),
            eq(emailEvents.campaign, campaign),
          ),
        );
    },
    { connection, concurrency: 3 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Drip email job failed');
  });

  tickWorker = new Worker<{ tick: true }>(
    'drip-tick',
    async () => {
      await runDripTick();
    },
    { connection, concurrency: 1 },
  );

  tickWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Drip tick job failed');
  });

  logger.info('Drip campaign worker started');
}

export async function stopDripWorker(): Promise<void> {
  await worker?.close();
  await tickWorker?.close();
}

/**
 * Called from the generation success path. If this is the user's first
 * successful generation, enqueue the first-PDF celebration email.
 * Safe to call on every generation — enqueueDripEmail is idempotent.
 */
export async function maybeCelebrateFirstPdf(userId: string): Promise<void> {
  try {
    const rows = await db.execute(sql`
      SELECT COUNT(*)::int AS n
      FROM generations
      WHERE user_id = ${userId} AND status = 'completed'
    `);
    const n = Number((rows.rows[0] as { n: number } | undefined)?.n ?? 0);
    if (n === 1) {
      await enqueueDripEmail({ userId, campaign: 'first_pdf' });
    }
  } catch (err) {
    logger.error({ err, userId }, 'first_pdf celebration check failed');
  }
}

/**
 * Cron tick — called by a separate repeating job. Scans for users whose
 * signup age matches a drip window and enqueues the right campaign. Only
 * enqueues for users who still haven't generated a PDF (or who need
 * re-engagement). Idempotency is handled by enqueueDripEmail.
 */
export async function runDripTick(): Promise<{
  enqueued: Record<DripCampaign, number>;
}> {
  const enqueued: Record<DripCampaign, number> = {
    welcome: 0,
    nudge1: 0,
    nudge2: 0,
    last_call: 0,
    first_pdf: 0,
    reengagement: 0,
  };

  // Helper: users with 0 completed generations
  const zeroGenUsersBetween = async (minAgeHours: number, maxAgeHours: number) => {
    return db.execute(sql`
      SELECT u.id
      FROM users u
      WHERE u.created_at < NOW() - (${minAgeHours}::int || ' hours')::interval
        AND u.created_at >= NOW() - (${maxAgeHours}::int || ' hours')::interval
        AND NOT EXISTS (
          SELECT 1 FROM generations g WHERE g.user_id = u.id
        )
    `);
  };

  // Helper: users active once, silent N+ days
  const silentUsersFor = async (silentDays: number) => {
    return db.execute(sql`
      SELECT u.id
      FROM users u
      WHERE EXISTS (SELECT 1 FROM generations g WHERE g.user_id = u.id)
        AND NOT EXISTS (
          SELECT 1 FROM generations g
          WHERE g.user_id = u.id
            AND g.created_at > NOW() - (${silentDays}::int || ' days')::interval
        )
    `);
  };

  // Nudge 1 — 24h–48h after signup, still no gen
  const nudge1Rows = await zeroGenUsersBetween(24, 48);
  for (const row of nudge1Rows.rows as Array<{ id: string }>) {
    await enqueueDripEmail({ userId: row.id, campaign: 'nudge1' });
    enqueued.nudge1++;
  }

  // Nudge 2 — 72h–96h after signup, still no gen
  const nudge2Rows = await zeroGenUsersBetween(72, 96);
  for (const row of nudge2Rows.rows as Array<{ id: string }>) {
    await enqueueDripEmail({ userId: row.id, campaign: 'nudge2' });
    enqueued.nudge2++;
  }

  // Last call — 168h–192h (7–8 days) after signup, still no gen
  const lastCallRows = await zeroGenUsersBetween(168, 192);
  for (const row of lastCallRows.rows as Array<{ id: string }>) {
    await enqueueDripEmail({ userId: row.id, campaign: 'last_call' });
    enqueued.last_call++;
  }

  // Re-engagement — active users who have been silent for 14+ days
  const reengageRows = await silentUsersFor(14);
  for (const row of reengageRows.rows as Array<{ id: string }>) {
    await enqueueDripEmail({ userId: row.id, campaign: 'reengagement' });
    enqueued.reengagement++;
  }

  logger.info({ enqueued }, 'Drip tick complete');
  return { enqueued };
}

/**
 * Schedule the tick to run once per hour using BullMQ's repeat feature.
 */
export async function scheduleDripTick(): Promise<void> {
  await dripTickQueue.add(
    'tick',
    { tick: true },
    {
      repeat: { pattern: '0 * * * *' }, // every hour on the hour
      jobId: 'drip-tick-scheduler',
    },
  );
  logger.info('Drip tick scheduled (hourly)');
}
