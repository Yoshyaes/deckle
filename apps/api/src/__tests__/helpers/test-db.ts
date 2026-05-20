/**
 * Test-database helpers.
 *
 * Backs integration tests with a real Postgres so they exercise actual
 * SQL, foreign keys, and transactions instead of mocked Drizzle calls.
 * The cost of a mocked DB is missing exactly the bugs we care about:
 * a missing FK, a partial commit, a constraint violation.
 *
 * Usage:
 *   const { db, reset, close } = await setupTestDatabase();
 *   beforeEach(reset);
 *   afterAll(close);
 *
 * Connection strategy:
 *   1. `TEST_DATABASE_URL` if set — full URL including database name.
 *   2. Else the local dev compose stack (`postgresql://docuforge:
 *      docuforge_local@localhost:5432/postgres`) which is created by
 *      the project's `docker-compose.yml`.
 *   3. If neither reaches a server, `setupTestDatabase()` throws a
 *      tagged error so the caller can mark its tests `it.skipIf(...)`.
 *
 * The database name is always `docuforge_test`. We DROP + CREATE it
 * on each suite startup so every run begins from a clean slate.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../../schema/db.js';

const DEFAULT_TEST_DB_NAME = 'docuforge_test';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = resolve(moduleDir, '../../../drizzle');

function getAdminUrl(): string {
  // If the caller specified TEST_DATABASE_URL, point at its server but
  // override the database name to "postgres" for admin operations.
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) {
    const u = new URL(explicit);
    u.pathname = '/postgres';
    return u.toString();
  }
  return 'postgresql://docuforge:docuforge_local@localhost:5432/postgres';
}

function getTestDbUrl(dbName: string): string {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) {
    const u = new URL(explicit);
    u.pathname = `/${dbName}`;
    return u.toString();
  }
  return `postgresql://docuforge:docuforge_local@localhost:5432/${dbName}`;
}

export interface TestDatabase {
  db: NodePgDatabase<typeof schema>;
  pool: pg.Pool;
  url: string;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export class TestDbUnavailableError extends Error {
  readonly tag = 'TEST_DB_UNAVAILABLE';
  constructor(cause: unknown) {
    super(
      `Postgres for tests is unreachable. Either start the local stack ` +
        `(\`docker compose up -d postgres\`) or set TEST_DATABASE_URL to a ` +
        `reachable server. Underlying error: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
    );
  }
}

/**
 * Probe the configured Postgres server. Returns true if we can connect
 * to the admin database, false otherwise. Used by callers to decide
 * whether to skip integration tests gracefully.
 */
export async function isTestDbReachable(): Promise<boolean> {
  const adminPool = new pg.Pool({
    connectionString: getAdminUrl(),
    connectionTimeoutMillis: 1500,
    max: 1,
  });
  try {
    await adminPool.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await adminPool.end().catch(() => undefined);
  }
}

/**
 * Recreate the test database from scratch and run the project's
 * migrations against it. Returns a drizzle handle ready for use.
 *
 * @param suiteName Optional unique-per-test-file slug. Vitest runs
 *   integration test files in parallel — each one calling
 *   setupTestDatabase() with the same name would race on the
 *   DROP / CREATE. Pass a slug like 'moderation' or 'stripe' so each
 *   file owns its own database.
 */
export async function setupTestDatabase(suiteName?: string): Promise<TestDatabase> {
  // Sanitize suite name to a safe Postgres identifier (lowercase
  // [a-z0-9_], max 30 chars). Postgres DB names are case-sensitive
  // when quoted, but unquoted identifiers fold to lowercase, so we
  // normalize on the way in.
  const safeSuite =
    suiteName && /^[a-zA-Z0-9_]{1,30}$/.test(suiteName) ? suiteName.toLowerCase() : null;
  const dbName = safeSuite ? `${DEFAULT_TEST_DB_NAME}_${safeSuite}` : DEFAULT_TEST_DB_NAME;

  // Phase 1: drop + recreate the database via the admin connection.
  const adminPool = new pg.Pool({
    connectionString: getAdminUrl(),
    connectionTimeoutMillis: 5_000,
    max: 1,
  });

  try {
    // FORCE disconnects any lingering connections (e.g., from a prior
    // crashed run holding sessions open).
    await adminPool.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await adminPool.query(`CREATE DATABASE ${dbName}`);
  } catch (err) {
    await adminPool.end().catch(() => undefined);
    throw new TestDbUnavailableError(err);
  }
  await adminPool.end();

  // Phase 2: connect to the fresh database and run migrations.
  const pool = new pg.Pool({
    connectionString: getTestDbUrl(dbName),
    connectionTimeoutMillis: 5_000,
    max: 5,
  });
  const db = drizzle(pool, { schema });

  // Apply the SQL migrations in lexicographic order. We deliberately
  // don't use drizzle-orm's migrate() because the project's drizzle/
  // folder is hand-curated SQL (no meta/_journal.json). Each file is
  // idempotent (CREATE TABLE IF NOT EXISTS, DO $$ ... EXCEPTION blocks)
  // so re-application is safe.
  try {
    const entries = await readdir(MIGRATIONS_FOLDER);
    const sqlFiles = entries
      .filter((f) => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));
    for (const file of sqlFiles) {
      const text = await readFile(join(MIGRATIONS_FOLDER, file), 'utf8');
      // pg supports multi-statement strings in simple-query mode.
      await pool.query(text);
    }
  } catch (err) {
    await pool.end().catch(() => undefined);
    throw err;
  }

  // Cache the list of tables so reset() can target them precisely. Skipping
  // drizzle's own __drizzle_migrations bookkeeping table keeps the migration
  // state intact between tests.
  const userTablesRes = await pool.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename NOT LIKE '__drizzle%'`,
  );
  const tableList = userTablesRes.rows.map((r) => `"${r.tablename}"`).join(', ');

  async function reset(): Promise<void> {
    if (tableList.length === 0) return;
    // RESTART IDENTITY rewinds serial sequences so id values are
    // deterministic across tests; CASCADE handles FK ordering.
    await pool.query(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
  }

  async function close(): Promise<void> {
    await pool.end().catch(() => undefined);
  }

  return { db, pool, url: getTestDbUrl(dbName), reset, close };
}

/** Re-export `sql` so test files have one import for raw queries. */
export { sql };
