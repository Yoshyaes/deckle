-- DocuForge initial schema migration
-- Run with: psql $DATABASE_URL -f drizzle/0000_init.sql

DO $$ BEGIN
  CREATE TYPE "plan" AS ENUM('free', 'starter', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "input_type" AS ENUM('html', 'template');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "status" AS ENUM('queued', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255) NOT NULL UNIQUE,
  "clerk_id" varchar(255) UNIQUE,
  "plan" "plan" DEFAULT 'free' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "key_hash" varchar(255) NOT NULL,
  "key_prefix" varchar(16) NOT NULL,
  "name" varchar(255) DEFAULT 'Default' NOT NULL,
  "last_used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "templates" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL,
  "html_content" text NOT NULL,
  "schema" jsonb,
  "version" integer DEFAULT 1 NOT NULL,
  "is_public" boolean DEFAULT false NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "generations" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "template_id" varchar(64) REFERENCES "templates"("id"),
  "input_type" "input_type" NOT NULL,
  "status" "status" DEFAULT 'queued' NOT NULL,
  "pdf_url" text,
  "file_size_bytes" integer,
  "pages" integer,
  "generation_time_ms" integer,
  "error" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "usage_daily" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "generation_count" integer DEFAULT 0 NOT NULL,
  "total_pages" integer DEFAULT 0 NOT NULL,
  "total_bytes" bigint DEFAULT 0 NOT NULL,
  PRIMARY KEY ("user_id", "date")
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS "idx_api_keys_prefix" ON "api_keys" ("key_prefix");
CREATE INDEX IF NOT EXISTS "idx_api_keys_user" ON "api_keys" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_generations_user" ON "generations" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_generations_created" ON "generations" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_templates_user" ON "templates" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_usage_daily_user_date" ON "usage_daily" ("user_id", "date");
CREATE INDEX IF NOT EXISTS "idx_users_clerk" ON "users" ("clerk_id");
