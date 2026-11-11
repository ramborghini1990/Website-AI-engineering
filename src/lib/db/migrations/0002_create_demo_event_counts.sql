-- 0002: demo analytics counters (P3.5). Apply once per database (EU region):
--   psql "$DATABASE_URL" -f src/lib/db/migrations/0002_create_demo_event_counts.sql
-- Keep in step with src/lib/db/schema.ts. Aggregate only: one row per UTC day,
-- demo and event. No identifier, no ip, no timestamp finer than the day.

CREATE TABLE IF NOT EXISTS "demo_event_counts" (
  "day" date NOT NULL,
  "demo" text NOT NULL,
  "event" text NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  PRIMARY KEY ("day", "demo", "event")
);
