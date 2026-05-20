import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  bigint,
  boolean,
  jsonb,
  pgEnum,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';

// Re-declare schema inline to avoid cross-workspace import issues
export const planEnum = pgEnum('plan', ['free', 'starter', 'pro', 'enterprise']);
export const roleEnum = pgEnum('role', ['user', 'admin']);
export const inputTypeEnum = pgEnum('input_type', ['html', 'template']);
export const statusEnum = pgEnum('status', ['queued', 'processing', 'completed', 'failed']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  clerkId: varchar('clerk_id', { length: 255 }).unique(),
  plan: planEnum('plan').notNull().default('free'),
  role: roleEnum('role').notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
  name: varchar('name', { length: 255 }).notNull().default('Default'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const templates = pgTable('templates', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  htmlContent: text('html_content').notNull(),
  schema: jsonb('schema').$type<Record<string, unknown>>(),
  version: integer('version').notNull().default(1),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const templateVersions = pgTable('template_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: varchar('template_id', { length: 64 })
    .references(() => templates.id, { onDelete: 'cascade' })
    .notNull(),
  version: integer('version').notNull(),
  htmlContent: text('html_content').notNull(),
  schema: jsonb('schema').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const generations = pgTable('generations', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  templateId: varchar('template_id', { length: 64 }).references(() => templates.id),
  inputType: inputTypeEnum('input_type').notNull(),
  status: statusEnum('status').notNull().default('queued'),
  pdfUrl: text('pdf_url'),
  fileSizeBytes: integer('file_size_bytes'),
  pages: integer('pages'),
  generationTimeMs: integer('generation_time_ms'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usageDaily = pgTable(
  'usage_daily',
  {
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    date: date('date').notNull(),
    generationCount: integer('generation_count').notNull().default(0),
    totalPages: integer('total_pages').notNull().default(0),
    totalBytes: bigint('total_bytes', { mode: 'number' }).notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.date] }),
  }),
);

export const apiErrors = pgTable('api_errors', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  apiKeyPrefix: varchar('api_key_prefix', { length: 16 }),
  method: varchar('method', { length: 10 }).notNull(),
  path: varchar('path', { length: 255 }).notNull(),
  errorCode: varchar('error_code', { length: 64 }).notNull(),
  errorMessage: text('error_message').notNull(),
  statusCode: integer('status_code').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const templateReportReasonEnum = pgEnum('template_report_reason', [
  'spam',
  'malicious',
  'copyright',
  'inappropriate',
  'other',
]);

export const templateReportStatusEnum = pgEnum('template_report_status', [
  'open',
  'auto_actioned',
  'dismissed',
  'actioned',
]);

export const templateReports = pgTable('template_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: varchar('template_id', { length: 64 })
    .references(() => templates.id, { onDelete: 'cascade' })
    .notNull(),
  reporterId: uuid('reporter_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  reason: templateReportReasonEnum('reason').notNull(),
  notes: text('notes'),
  status: templateReportStatusEnum('status').notNull().default('open'),
  resolverId: uuid('resolver_id').references(() => users.id, { onDelete: 'set null' }),
  resolverNotes: text('resolver_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, {
  schema: {
    users,
    apiKeys,
    templates,
    templateVersions,
    generations,
    usageDaily,
    apiErrors,
    templateReports,
  },
});
