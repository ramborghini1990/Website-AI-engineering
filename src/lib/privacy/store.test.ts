// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import {
  createDrizzlePrivacyStore,
  createMemoryPrivacyStore,
  normalizeEmail,
  type InquiryExportRow,
  type PrivacyDb,
} from "@/lib/privacy/store";

const row = (
  over: Partial<InquiryExportRow> & Pick<InquiryExportRow, "email">,
): InquiryExportRow => ({
  id: crypto.randomUUID(),
  createdAt: new Date("2025-03-01T09:00:00.000Z"),
  locale: "it",
  need: "agent",
  description: "Synthetic description for a test.",
  budget: "10-25k",
  timeline: "q1",
  name: "Test Person",
  company: null,
  marketingConsent: false,
  consentVersion: "2026-11-v1",
  status: "new",
  ...over,
});

type Call = { op: string; table: string; sql: string; params: unknown[] };

/** A Drizzle stand-in that records the statement each call would send. */
function fakeDb(selected: InquiryExportRow[] = []) {
  const calls: Call[] = [];
  const dialect = new PgDialect();
  const record = (op: string, table: object, condition: SQL) => {
    const { sql, params } = dialect.sqlToQuery(condition);
    calls.push({
      op,
      table: getTableName(table as Parameters<typeof getTableName>[0]),
      sql,
      params,
    });
  };
  const db: PrivacyDb = {
    select: () => ({
      from: (table) => ({
        where: (condition) => {
          record("select", table, condition);
          return Promise.resolve(selected);
        },
      }),
    }),
    delete: (table) => ({
      where: (condition) => ({
        returning: () => {
          record("delete", table, condition);
          return Promise.resolve([{ id: "a" }, { id: "b" }, { id: "c" }]);
        },
      }),
    }),
  };
  return { db, calls };
}

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Anna.Rossi@Example.IT ")).toBe(
      "anna.rossi@example.it",
    );
  });
});

describe("createDrizzlePrivacyStore: the statements it sends", () => {
  it("find: a case-insensitive match on the normalised address, on inquiries only", async () => {
    const { db, calls } = fakeDb();

    await createDrizzlePrivacyStore(db).findByEmail("  Anna@Example.IT ");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe("inquiries");
    expect(calls[0]?.sql).toMatch(/lower\(.*"email".*\) = \$1/);
    expect(calls[0]?.params).toEqual(["anna@example.it"]);
  });

  it("find: returns the rows oldest first", async () => {
    const newer = row({
      email: "a@example.it",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const older = row({
      email: "a@example.it",
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
    const { db } = fakeDb([newer, older]);

    const found =
      await createDrizzlePrivacyStore(db).findByEmail("a@example.it");

    expect(found).toEqual([older, newer]);
  });

  it("delete by email: the same match, a delete on inquiries, answers the number of rows", async () => {
    const { db, calls } = fakeDb();

    const count =
      await createDrizzlePrivacyStore(db).deleteByEmail("Anna@Example.IT");

    expect(count).toBe(3);
    expect(calls[0]).toMatchObject({
      op: "delete",
      table: "inquiries",
      params: ["anna@example.it"],
    });
    expect(calls[0]?.sql).toMatch(/lower\(.*"email".*\) = \$1/);
  });

  it("purge: deletes rows created strictly before the cutoff, nothing else", async () => {
    const { db, calls } = fakeDb();
    const cutoff = new Date("2024-11-12T03:17:00.000Z");

    const count =
      await createDrizzlePrivacyStore(db).deleteCreatedBefore(cutoff);

    expect(count).toBe(3);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.op).toBe("delete");
    expect(calls[0]?.table).toBe("inquiries");
    expect(calls[0]?.sql).toMatch(/"created_at" < \$1/);
    expect(new Date(calls[0]?.params[0] as string | Date).toISOString()).toBe(
      cutoff.toISOString(),
    );
  });

  it("negative: every operation targets the inquiries table, never consent receipts", async () => {
    const { db, calls } = fakeDb();
    const store = createDrizzlePrivacyStore(db);

    await store.findByEmail("a@example.it");
    await store.deleteByEmail("a@example.it");
    await store.deleteCreatedBefore(new Date());

    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((call) => call.table))).toEqual(
      new Set(["inquiries"]),
    );
  });
});

describe("createMemoryPrivacyStore", () => {
  const anna = row({ email: "Anna@Example.it" });
  const luca = row({ email: "luca@example.it" });

  it("matches an address whatever its letter case and removes only that person's rows", async () => {
    const store = createMemoryPrivacyStore([anna, luca]);

    expect(await store.findByEmail("ANNA@example.IT")).toEqual([anna]);
    expect(await store.deleteByEmail(" anna@EXAMPLE.it ")).toBe(1);
    expect(store.rows).toEqual([luca]);
  });

  it("negative: a similar address is not a match", async () => {
    const store = createMemoryPrivacyStore([anna]);

    expect(await store.findByEmail("anna@example.it.evil.test")).toEqual([]);
    expect(await store.deleteByEmail("anna@example.i")).toBe(0);
    expect(store.rows).toHaveLength(1);
  });

  it("purges strictly older than the cutoff: a row at the cutoff stays", async () => {
    const cutoff = new Date("2025-03-01T09:00:00.000Z");
    const store = createMemoryPrivacyStore([
      row({
        email: "old@example.it",
        createdAt: new Date(cutoff.getTime() - 1),
      }),
      row({ email: "edge@example.it", createdAt: cutoff }),
      row({
        email: "new@example.it",
        createdAt: new Date(cutoff.getTime() + 1),
      }),
    ]);

    expect(await store.deleteCreatedBefore(cutoff)).toBe(1);
    expect(store.rows.map((r) => r.email)).toEqual([
      "edge@example.it",
      "new@example.it",
    ]);
  });
});

/**
 * Consent receipts are legal proof and anonymous. The privacy tooling must not
 * be able to reach them, so it must not even name the table: this reads the
 * code (comments removed) of everything the tooling is made of.
 */
describe("consent receipts are out of reach", () => {
  const strip = (source: string) =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const dir = join(process.cwd(), "src", "lib", "privacy");
  const files = [
    ...readdirSync(dir)
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => join(dir, name)),
    join(process.cwd(), "scripts", "privacy", "dsr.mjs"),
    join(
      process.cwd(),
      "src",
      "app",
      "api",
      "cron",
      "purge-expired",
      "route.ts",
    ),
  ];

  it("finds the files it is meant to check", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it("no privacy file mentions the receipts table or its store", () => {
    for (const file of files) {
      expect(strip(readFileSync(file, "utf8")), file).not.toMatch(
        /consentReceipts|consent_receipts|receipt-store|lib\/consent/i,
      );
    }
  });

  it("negative control: the check does see a mention in code", () => {
    expect(strip('import { consentReceipts } from "../db/schema.ts";')).toMatch(
      /consentReceipts/,
    );
    expect(strip("// consentReceipts is only named in a comment")).not.toMatch(
      /consentReceipts/,
    );
  });
});
