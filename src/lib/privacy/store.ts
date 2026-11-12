import { lt, sql, type SQL } from "drizzle-orm";

import { inquiries } from "../db/schema.ts";

/**
 * The only database access of the privacy tooling (P4.3): find, delete and
 * purge rows of the `inquiries` table. Nothing else.
 *
 * `consent_receipts` is deliberately out of reach. A receipt is the proof that a
 * visitor made a cookie choice (art. 7(1) GDPR); it holds no email or any other
 * identifier, so there is nothing to look up or erase for a person, and erasing
 * one would destroy the evidence the controller must be able to show. This
 * module does not import the receipts table, and `store.test.ts` fails if it ever
 * does.
 *
 * Imports are relative with a `.ts` extension on purpose: the command-line tool
 * (`scripts/privacy/dsr.mjs`) loads this file with plain Node, which does not
 * know the `@/` alias.
 */

/** One stored inquiry, as the owner would hand it to the person it is about. */
export type InquiryExportRow = {
  id: string;
  createdAt: Date;
  locale: string;
  need: string;
  description: string;
  budget: string;
  timeline: string;
  name: string;
  email: string;
  company: string | null;
  marketingConsent: boolean;
  consentVersion: string;
  status: string;
};

export type PrivacyStore = {
  /** Every inquiry written with this email address (any letter case), oldest first. */
  findByEmail(email: string): Promise<InquiryExportRow[]>;
  /** Deletes them; answers how many rows went. */
  deleteByEmail(email: string): Promise<number>;
  /** Deletes inquiries created before `cutoff`; answers how many rows went. */
  deleteCreatedBefore(cutoff: Date): Promise<number>;
};

/** Addresses are stored as typed, so matching ignores case and surrounding spaces. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const emailMatches = (email: string): SQL =>
  sql`lower(${inquiries.email}) = ${normalizeEmail(email)}`;

/** The part of a Drizzle database the store uses, so tests can pass a fake. */
export type PrivacyDb = {
  select: () => {
    from: (table: typeof inquiries) => {
      where: (condition: SQL) => PromiseLike<InquiryExportRow[]>;
    };
  };
  delete: (table: typeof inquiries) => {
    where: (condition: SQL) => {
      returning: (fields: {
        id: typeof inquiries.id;
      }) => PromiseLike<Array<{ id: string }>>;
    };
  };
};

export function createDrizzlePrivacyStore(db: PrivacyDb): PrivacyStore {
  return {
    async findByEmail(email) {
      const rows = await db.select().from(inquiries).where(emailMatches(email));
      return [...rows].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
    },
    async deleteByEmail(email) {
      const gone = await db
        .delete(inquiries)
        .where(emailMatches(email))
        .returning({ id: inquiries.id });
      return gone.length;
    },
    async deleteCreatedBefore(cutoff) {
      const gone = await db
        .delete(inquiries)
        .where(lt(inquiries.createdAt, cutoff))
        .returning({ id: inquiries.id });
      return gone.length;
    },
  };
}

/** Local development and tests: rows kept in this process only. */
export function createMemoryPrivacyStore(
  initial: readonly InquiryExportRow[] = [],
): PrivacyStore & { rows: InquiryExportRow[] } {
  const rows = [...initial];
  const remove = (keep: (row: InquiryExportRow) => boolean): number => {
    const before = rows.length;
    const kept = rows.filter(keep);
    rows.length = 0;
    rows.push(...kept);
    return before - rows.length;
  };
  return {
    rows,
    findByEmail(email) {
      const wanted = normalizeEmail(email);
      return Promise.resolve(
        rows
          .filter((row) => normalizeEmail(row.email) === wanted)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
      );
    },
    deleteByEmail(email) {
      const wanted = normalizeEmail(email);
      return Promise.resolve(
        remove((row) => normalizeEmail(row.email) !== wanted),
      );
    },
    deleteCreatedBefore(cutoff) {
      return Promise.resolve(
        remove((row) => row.createdAt.getTime() >= cutoff.getTime()),
      );
    },
  };
}
