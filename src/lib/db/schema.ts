import {
  boolean,
  date,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * The inquiries table (P2.5, decision D5: EU-hosted Postgres). Only what is
 * needed to answer a request and to prove the marketing choice:
 *
 * - NO ip, user agent, bot token, referrer or cookie id: not needed, so not kept.
 * - `marketing_consent` is the visitor's separate, optional choice (GDPR art.
 *   7(4)); `consent_version` names the consent text that was on screen, and
 *   `created_at` is the time it was given (proof, art. 7(1)).
 * - `created_at` also drives retention (proposal: delete 24 months after the
 *   last contact, docs/GDPR_CHECKLIST.md §5).
 *
 * The SQL in `migrations/` is hand-written to match (no drizzle-kit dependency
 * yet); `schema.test.ts` fails if the two drift apart.
 */
export const inquiries = pgTable("inquiries", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  /** Language of the page the visitor used: the language to answer in. */
  locale: text("locale").notNull(),
  need: text("need").notNull(),
  description: text("description").notNull(),
  budget: text("budget").notNull(),
  timeline: text("timeline").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  company: text("company"),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  consentVersion: text("consent_version").notNull(),
  /** Pipeline status for the owner: new, replied, closed. */
  status: text("status").notNull().default("new"),
});

export type InquiryRow = typeof inquiries.$inferInsert;

/**
 * Demo analytics (P3.5): one counter per UTC day, demo and event. AGGREGATE
 * ONLY: there is no row per event or per visitor, so no timestamp finer than the
 * day, no ip, no user agent, no id, and nothing that could be linked back to a
 * person. The counter is raised in place (`count = count + 1`).
 */
export const demoEventCounts = pgTable(
  "demo_event_counts",
  {
    day: date("day", { mode: "string" }).notNull(),
    demo: text("demo").notNull(),
    event: text("event").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.day, table.demo, table.event] })],
);

export type DemoEventCountRow = typeof demoEventCounts.$inferInsert;
