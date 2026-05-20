-- Marketplace abuse reporting + moderation flow.
--
-- One row per (reporter, template) report. The combination of
-- reporter + template is UNIQUE so a single user can't bury a
-- template under repeated reports. Auto-unpublish triggers off
-- the open-report count via application logic (services/moderation.ts).

DO $$ BEGIN
  CREATE TYPE "template_report_reason" AS ENUM(
    'spam',
    'malicious',
    'copyright',
    'inappropriate',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "template_report_status" AS ENUM(
    'open',          -- awaiting moderator review
    'auto_actioned', -- crossed the auto-unpublish threshold; awaiting confirmation
    'dismissed',     -- moderator reviewed and found no abuse
    'actioned'       -- moderator unpublished the template
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "template_reports" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "template_id"   varchar(64) NOT NULL REFERENCES "templates"("id") ON DELETE CASCADE,
  "reporter_id"   uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "reason"        "template_report_reason" NOT NULL,
  "notes"         text,
  "status"        "template_report_status" NOT NULL DEFAULT 'open',
  "resolver_id"   uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "resolver_notes" text,
  "created_at"    timestamp DEFAULT now() NOT NULL,
  "resolved_at"   timestamp
);

-- One open report per (reporter, template). A reporter can re-report
-- after a prior report is closed (dismissed/actioned), so the UNIQUE
-- is partial — it only covers the open and auto_actioned states.
CREATE UNIQUE INDEX IF NOT EXISTS "template_reports_reporter_template_open_idx"
  ON "template_reports" ("reporter_id", "template_id")
  WHERE "status" IN ('open', 'auto_actioned');

CREATE INDEX IF NOT EXISTS "template_reports_template_idx"
  ON "template_reports" ("template_id");

CREATE INDEX IF NOT EXISTS "template_reports_status_created_at_idx"
  ON "template_reports" ("status", "created_at" DESC);
