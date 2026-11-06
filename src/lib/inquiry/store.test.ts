// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import { inquiries } from "@/lib/db/schema";
import { parseInquiry, type RawInquiry } from "@/lib/inquiry/schema";
import {
  CONSENT_VERSION,
  createDrizzleStore,
  createMemoryStore,
  toRecord,
} from "@/lib/inquiry/store";

const raw: RawInquiry = {
  need: "ai-agents",
  description:
    "A synthetic description that is long enough to pass validation.",
  budget: "5k-15k",
  timeline: "asap",
  name: "Anna Test",
  email: "anna.test@example.com",
  company: "",
  marketingConsent: false,
};

function input() {
  const parsed = parseInquiry(raw);
  if (!parsed.ok) throw new Error("fixture must be valid");
  return parsed.data;
}

describe("toRecord", () => {
  it("builds exactly the stored fields, nothing else (no ip, token, user agent)", () => {
    const record = toRecord(input(), "it");

    expect(Object.keys(record).sort()).toEqual(
      [
        "budget",
        "company",
        "consentVersion",
        "description",
        "email",
        "locale",
        "marketingConsent",
        "name",
        "need",
        "timeline",
      ].sort(),
    );
    expect(record.company).toBeNull();
    expect(record.consentVersion).toBe(CONSENT_VERSION);
  });

  it("never copies a stray key from the input (negative)", () => {
    const polluted = {
      ...input(),
      ip: "203.0.113.42",
      turnstileToken: "tok",
      website: "x",
    };

    const record = toRecord(polluted, "en");

    expect(JSON.stringify(record)).not.toMatch(/203\.0|tok|website/);
  });

  it("keeps the marketing consent exactly as given: unticked is false", () => {
    expect(toRecord(input(), "it").marketingConsent).toBe(false);
    const ticked = parseInquiry({ ...raw, marketingConsent: true });
    expect(ticked.ok && toRecord(ticked.data, "it").marketingConsent).toBe(
      true,
    );
  });
});

describe("every record field is a column", () => {
  it("the record keys are columns of the table (and the table has no column the record forgets, except the defaults)", () => {
    const columns = Object.keys(getTableColumns(inquiries));
    const keys = Object.keys(toRecord(input(), "it"));

    for (const key of keys) expect(columns, key).toContain(key);
    expect(columns.filter((c) => !keys.includes(c)).sort()).toEqual([
      "createdAt",
      "id",
      "status",
    ]);
  });

  it("the SQL migration creates exactly the columns of the Drizzle schema", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "src/lib/db/migrations/0001_create_inquiries.sql",
      ),
      "utf8",
    );
    const body =
      /CREATE TABLE IF NOT EXISTS "inquiries" \(([\s\S]*?)\n\);/.exec(
        sql,
      )?.[1] ?? "";
    const sqlColumns = [...body.matchAll(/^\s*"([a-z_]+)"/gm)]
      .map((m) => m[1])
      .sort();
    const schemaColumns = Object.values(getTableColumns(inquiries))
      .map((column) => column.name)
      .sort();

    expect(sqlColumns).toEqual(schemaColumns);
  });

  it("the table has no column for an ip, a user agent or a token", () => {
    for (const name of Object.keys(getTableColumns(inquiries))) {
      expect(name).not.toMatch(
        /^(ip|ip_.*|.*_ip|user_?agent|.*token.*|cookie.*|referrer)$/i,
      );
    }
  });
});

describe("createDrizzleStore", () => {
  it("inserts the record as given and returns the new id", async () => {
    const returning = vi.fn(() => Promise.resolve([{ id: "uuid-1" }]));
    const values = vi.fn(() => ({ returning }));
    const insert = vi.fn(() => ({ values }));
    const store = createDrizzleStore({ insert });
    const record = toRecord(input(), "it");

    expect(await store.insert(record)).toEqual({ id: "uuid-1" });

    expect(insert).toHaveBeenCalledWith(inquiries);
    expect(values).toHaveBeenCalledWith(record);
  });

  it("throws when the database returns no row, so the caller can tell the visitor (negative)", async () => {
    const store = createDrizzleStore({
      insert: () => ({
        values: () => ({ returning: () => Promise.resolve([]) }),
      }),
    });

    await expect(store.insert(toRecord(input(), "it"))).rejects.toThrow();
  });

  it("lets a database error through (the caller handles it)", async () => {
    const store = createDrizzleStore({
      insert: () => ({
        values: () => ({
          returning: () => Promise.reject(new Error("connection refused")),
        }),
      }),
    });

    await expect(store.insert(toRecord(input(), "it"))).rejects.toThrow(
      "connection refused",
    );
  });
});

describe("createMemoryStore", () => {
  it("keeps records in memory with a fresh id each", async () => {
    const store = createMemoryStore();
    const a = await store.insert(toRecord(input(), "it"));
    const b = await store.insert(toRecord(input(), "en"));

    expect(a.id).not.toBe(b.id);
    expect(store.rows.map((row) => row.locale)).toEqual(["it", "en"]);
  });
});
