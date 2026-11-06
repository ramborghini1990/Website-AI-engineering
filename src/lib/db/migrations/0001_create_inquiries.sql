-- 0001: inquiries (P2.5). Apply once per database (Neon/Supabase, EU region):
--   psql "$DATABASE_URL" -f src/lib/db/migrations/0001_create_inquiries.sql
-- Keep in step with src/lib/db/schema.ts (src/lib/db/schema.test.ts checks the columns).

CREATE TABLE IF NOT EXISTS "inquiries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "locale" text NOT NULL,
  "need" text NOT NULL,
  "description" text NOT NULL,
  "budget" text NOT NULL,
  "timeline" text NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "company" text,
  "marketing_consent" boolean DEFAULT false NOT NULL,
  "consent_version" text NOT NULL,
  "status" text DEFAULT 'new' NOT NULL
);

-- Retention and pipeline queries filter on these.
CREATE INDEX IF NOT EXISTS "inquiries_created_at_idx" ON "inquiries" ("created_at");
CREATE INDEX IF NOT EXISTS "inquiries_email_idx" ON "inquiries" ("email");
