import type { InquiryRow } from "@/lib/db/schema";
import { inquiries } from "@/lib/db/schema";
import type { InquiryInput } from "@/lib/inquiry/schema";

/**
 * Where an inquiry is kept. The record is built field by field (never by
 * spreading the input), so a stray key can never become a column, and it holds
 * exactly the columns the owner needs (see `db/schema.ts`).
 */

/**
 * Version of the marketing-consent wording shown next to the checkbox. Change it
 * whenever `contact.form.consent.marketing` changes in messages: it is stored
 * with each record as proof of what the visitor agreed to (art. 7(1)).
 */
export const CONSENT_VERSION = "2026-11-v1";

export type InquiryRecord = {
  locale: "it" | "en";
  need: string;
  description: string;
  budget: string;
  timeline: string;
  name: string;
  email: string;
  company: string | null;
  marketingConsent: boolean;
  consentVersion: string;
};

export function toRecord(
  input: InquiryInput,
  locale: "it" | "en",
): InquiryRecord {
  return {
    locale,
    need: input.need,
    description: input.description,
    budget: input.budget,
    timeline: input.timeline,
    name: input.name,
    email: input.email,
    company: input.company ?? null,
    marketingConsent: input.marketingConsent,
    consentVersion: CONSENT_VERSION,
  };
}

export type InquiryStore = {
  insert(record: InquiryRecord): Promise<{ id: string }>;
};

/** The part of a Drizzle database the store uses, so tests can pass a fake. */
type InsertCapable = {
  insert: (table: typeof inquiries) => {
    values: (row: InquiryRow) => {
      returning: (fields: {
        id: typeof inquiries.id;
      }) => Promise<Array<{ id: string }>>;
    };
  };
};

export function createDrizzleStore(db: InsertCapable): InquiryStore {
  return {
    async insert(record) {
      const rows = await db
        .insert(inquiries)
        .values(record)
        .returning({ id: inquiries.id });
      const first = rows.at(0);
      if (first === undefined) throw new Error("insert returned no row");
      return { id: first.id };
    },
  };
}

/** Local development, tests and CI: kept in this process only, gone on restart. */
export function createMemoryStore(): InquiryStore & { rows: InquiryRecord[] } {
  const rows: InquiryRecord[] = [];
  return {
    rows,
    insert(record) {
      rows.push(record);
      return Promise.resolve({ id: crypto.randomUUID() });
    },
  };
}
