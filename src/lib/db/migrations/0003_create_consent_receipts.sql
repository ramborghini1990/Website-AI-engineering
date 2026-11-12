-- 0003: consent receipts (P4.1). Apply once per database (EU region):
--   psql "$DATABASE_URL" -f src/lib/db/migrations/0003_create_consent_receipts.sql
-- Keep in step with src/lib/db/schema.ts. Proof of a cookie choice (art. 7(1)):
-- a random id, the time, the wording version, how it was given and what was
-- allowed. No ip, no user agent, no account: nothing that identifies a person.

CREATE TABLE IF NOT EXISTS "consent_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "policy_version" text NOT NULL,
  "method" text NOT NULL,
  "booking" boolean NOT NULL
);
