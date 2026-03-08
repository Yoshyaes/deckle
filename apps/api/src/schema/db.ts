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
  index,
} from 'drizzle-orm/pg-core';

export const planEnum = pgEnum('plan', ['free', 'starter', 'pro', 'enterprise']);
export const inputTypeEnum = pgEnum('input_type', ['html', 'template', 'react']);
export const statusEnum = pgEnum('status', ['queued', 'processing', 'completed', 'failed']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  clerkId: varchar('clerk_id', { length: 255 }).unique(),
  plan: planEnum('plan').notNull().default('free'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(),
  keyPrefix: varchar('key_prefix', { length: 16 }).notNull(),
  name: varchar('name', { length: 255 }).notNull().default('Default'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.keyPrefix),
  userIdIdx: index('api_keys_user_id_idx').on(table.userId),
}));

export const templates = pgTable('templates', {
  id: varchar('id', { length: 64 }).primaryKey(), // tmpl_xxx
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  htmlContent: text('html_content').notNull(),
  schema: jsonb('schema').$type<Record<string, unknown>>(),
  version: integer('version').notNull().default(1),
  isPublic: boolean('is_public').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('templates_user_id_idx').on(table.userId),
  isPublicIdx: index('templates_is_public_idx').on(table.isPublic),
}));

export const templateVersions = pgTable('template_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  templateId: varchar('template_id', { length: 64 })
    .references(() => templates.id, { onDelete: 'cascade' })
    .notNull(),
  version: integer('version').notNull(),
  htmlContent: text('html_content').notNull(),
  schema: jsonb('schema').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  templateIdIdx: index('template_versions_template_id_idx').on(table.templateId),
}));

export const generations = pgTable('generations', {
  id: varchar('id', { length: 64 }).primaryKey(), // gen_xxx
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  templateId: varchar('template_id', { length: 64 }).references(() => templates.id, { onDelete: 'set null' }),
  inputType: inputTypeEnum('input_type').notNull(),
  status: statusEnum('status').notNull().default('queued'),
  pdfUrl: text('pdf_url'),
  fileSizeBytes: integer('file_size_bytes'),
  pages: integer('pages'),
  generationTimeMs: integer('generation_time_ms'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('generations_user_id_idx').on(table.userId),
  createdAtIdx: index('generations_created_at_idx').on(table.createdAt),
}));

export const usageDaily = pgTable(
  'usage_daily',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    date: date('date').notNull(),
    generationCount: integer('generation_count').notNull().default(0),
    totalPages: integer('total_pages').notNull().default(0),
    totalBytes: bigint('total_bytes', { mode: 'number' }).notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.date] }),
  }),
);

// --- Stripe billing tables ---

export const stripeCustomers = pgTable('stripe_customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('stripe_customers_user_id_idx').on(table.userId),
  stripeCustomerIdIdx: index('stripe_customers_stripe_id_idx').on(table.stripeCustomerId),
}));

export const stripeSubscriptions = pgTable('stripe_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).notNull().unique(),
  stripePriceId: varchar('stripe_price_id', { length: 255 }).notNull(),
  status: varchar('status', { length: 50 }).notNull(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('stripe_subs_user_id_idx').on(table.userId),
  stripeSubIdIdx: index('stripe_subs_stripe_id_idx').on(table.stripeSubscriptionId),
}));

// --- Custom fonts table ---

export const customFonts = pgTable('custom_fonts', {
  id: varchar('id', { length: 64 }).primaryKey(), // font_xxx
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  family: varchar('family', { length: 255 }).notNull(),
  format: varchar('format', { length: 20 }).notNull(),
  storageKey: varchar('storage_key', { length: 512 }).notNull(),
  fileSizeBytes: integer('file_size_bytes').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('custom_fonts_user_id_idx').on(table.userId),
}));
