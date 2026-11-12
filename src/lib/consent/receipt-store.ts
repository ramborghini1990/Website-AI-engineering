import { consentReceipts, type ConsentReceiptRow } from "@/lib/db/schema";

/**
 * Where receipts are kept. Insert only: a receipt is never edited (a changed
 * choice is a new receipt), and nothing here reads one back for display.
 */
export type ReceiptRecord = {
  policyVersion: string;
  method: string;
  booking: boolean;
};

export type ReceiptStore = {
  insert(record: ReceiptRecord): Promise<{ id: string }>;
};

/** The part of a Drizzle database the store uses, so tests can pass a fake. */
type InsertCapable = {
  insert: (table: typeof consentReceipts) => {
    values: (row: ConsentReceiptRow) => {
      returning: (fields: {
        id: typeof consentReceipts.id;
      }) => Promise<Array<{ id: string }>>;
    };
  };
};

export function createDrizzleReceiptStore(db: InsertCapable): ReceiptStore {
  return {
    async insert(record) {
      const rows = await db
        .insert(consentReceipts)
        .values({
          policyVersion: record.policyVersion,
          method: record.method,
          booking: record.booking,
        })
        .returning({ id: consentReceipts.id });
      const first = rows.at(0);
      if (first === undefined) throw new Error("insert returned no row");
      return { id: first.id };
    },
  };
}

/**
 * Local development, tests and CI: kept in this process only, gone on restart.
 * PENDING a real Postgres (B13): until the migration is applied on an EU
 * database, receipts made outside a deployment live only in this memory.
 */
export function createMemoryReceiptStore(): ReceiptStore & {
  rows: ReceiptRecord[];
} {
  const rows: ReceiptRecord[] = [];
  return {
    rows,
    insert(record) {
      rows.push({ ...record });
      return Promise.resolve({ id: crypto.randomUUID() });
    },
  };
}
