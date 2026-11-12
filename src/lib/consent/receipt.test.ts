// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  CONSENT_LIMIT,
  receiptSchema,
  recordConsent,
  type ReceiptDeps,
} from "@/lib/consent/receipt";
import { buildConsentRuntime } from "@/lib/consent/receipt-deps";
import {
  createDrizzleReceiptStore,
  createMemoryReceiptStore,
} from "@/lib/consent/receipt-store";
import { CONSENT_POLICY_VERSION } from "@/lib/consent/registry";
import { consentReceipts } from "@/lib/db/schema";
import { createMemoryLimiter } from "@/lib/security/rate-limit";

const good = {
  policyVersion: CONSENT_POLICY_VERSION,
  method: "accept_all",
  choices: { booking: true },
};

function deps(over: Partial<ReceiptDeps> = {}) {
  const store = createMemoryReceiptStore();
  const log = { error: vi.fn() };
  const value: ReceiptDeps = {
    limiter: createMemoryLimiter(CONSENT_LIMIT),
    store,
    log,
    ...over,
  };
  return { deps: value, store, log };
}

describe("the receipt schema", () => {
  it("accepts every method, with the booking choice either way", () => {
    for (const method of ["accept_all", "reject_all", "custom", "close"]) {
      for (const booking of [true, false]) {
        expect(
          receiptSchema.safeParse({ ...good, method, choices: { booking } })
            .success,
        ).toBe(true);
      }
    }
  });

  it("negative: refuses extra keys, so no ip, agent or identifier can be sent in", () => {
    for (const extra of [
      { ip: "203.0.113.7" },
      { userAgent: "x" },
      { visitor: "abc" },
      { id: "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b" },
    ]) {
      expect(receiptSchema.safeParse({ ...good, ...extra }).success).toBe(
        false,
      );
    }
    expect(
      receiptSchema.safeParse({
        ...good,
        choices: { booking: true, marketing: true },
      }).success,
    ).toBe(false);
  });

  it("negative: refuses a wrong version, an unknown method and non-boolean choices", () => {
    for (const body of [
      { ...good, policyVersion: "2020-01-v1" },
      { ...good, method: "scroll" },
      { ...good, method: "implied" },
      { ...good, choices: { booking: "yes" } },
      { ...good, choices: {} },
      { ...good, choices: undefined },
      null,
      "accept_all",
      [],
    ]) {
      expect(receiptSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe("recordConsent", () => {
  it("stores one receipt and returns its random id", async () => {
    const { deps: d, store } = deps();

    const result = await recordConsent(good, "client-a", d);

    expect(result.status).toBe("recorded");
    expect(store.rows).toEqual([
      {
        policyVersion: CONSENT_POLICY_VERSION,
        method: "accept_all",
        booking: true,
      },
    ]);
    if (result.status === "recorded") {
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it("every decision is its own receipt with its own id, so a withdrawal never overwrites the proof of the first choice", async () => {
    const { deps: d, store } = deps();

    const first = await recordConsent(good, "client-a", d);
    const second = await recordConsent(
      { ...good, method: "reject_all", choices: { booking: false } },
      "client-a",
      d,
    );

    expect(store.rows).toHaveLength(2);
    expect(store.rows.map((row) => row.booking)).toEqual([true, false]);
    expect(first.status === "recorded" && second.status === "recorded").toBe(
      true,
    );
    if (first.status === "recorded" && second.status === "recorded") {
      expect(first.id).not.toBe(second.id);
    }
  });

  it("holds nothing but the three facts: no ip, no client key, no timestamp from the browser", async () => {
    const { deps: d, store } = deps();

    await recordConsent(good, "client-key-that-must-not-be-stored", d);

    expect(Object.keys(store.rows[0] ?? {}).sort()).toEqual([
      "booking",
      "method",
      "policyVersion",
    ]);
    expect(JSON.stringify(store.rows)).not.toContain("client-key");
  });

  it("negative: invalid input is refused before the limiter or the store are touched", async () => {
    const limit = vi.fn();
    const { deps: d, store } = deps({ limiter: { limit } });

    expect(await recordConsent({ ...good, ip: "1.2.3.4" }, "c", d)).toEqual({
      status: "invalid",
    });
    expect(limit).not.toHaveBeenCalled();
    expect(store.rows).toEqual([]);
  });

  it("negative: a client over the limit is refused (not silently dropped) and nothing is stored", async () => {
    const { deps: d, store } = deps();
    let last = await recordConsent(good, "flood", d);
    for (let i = 0; i < CONSENT_LIMIT.requests; i += 1) {
      last = await recordConsent(good, "flood", d);
    }

    expect(last.status).toBe("limited");
    expect(store.rows).toHaveLength(CONSENT_LIMIT.requests);
    // another client is unaffected
    expect((await recordConsent(good, "someone-else", d)).status).toBe(
      "recorded",
    );
  });

  it("is unavailable without a store, and when the store fails, logging the class only", async () => {
    expect(
      (await recordConsent(good, "c", deps({ store: null }).deps)).status,
    ).toBe("unavailable");

    const log = { error: vi.fn() };
    const failing = {
      insert: () => Promise.reject(new Error("password=secret host=db")),
    };
    const result = await recordConsent(good, "c", {
      ...deps().deps,
      store: failing,
      log,
    });

    expect(result.status).toBe("unavailable");
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("accept_all");
  });
});

describe("the receipt store and runtime", () => {
  it("the Drizzle store inserts field by field and returns the id", async () => {
    const values = vi.fn().mockReturnValue({
      returning: () => Promise.resolve([{ id: "row-id" }]),
    });
    const db = { insert: vi.fn().mockReturnValue({ values }) };

    const result = await createDrizzleReceiptStore(db).insert({
      policyVersion: "v",
      method: "custom",
      booking: false,
      // @ts-expect-error a stray key must never reach the database
      ip: "203.0.113.7",
    });

    expect(result).toEqual({ id: "row-id" });
    expect(values).toHaveBeenCalledWith({
      policyVersion: "v",
      method: "custom",
      booking: false,
    });
  });

  it("not deployed: an in-process store; deployed without a database: none (receipts are dropped, never faked)", () => {
    const local = buildConsentRuntime({
      deployed: false,
      databaseUrl: undefined,
      ipSalt: undefined,
    });
    expect(local.deps.store).not.toBeNull();
    expect(local.ipSalt).not.toBeNull();

    const deployed = buildConsentRuntime({
      deployed: true,
      databaseUrl: undefined,
      ipSalt: undefined,
    });
    expect(deployed.deps.store).toBeNull();
    expect(deployed.memory).toBeNull();
    expect(deployed.ipSalt).toBeNull();
  });

  it("the migration matches the schema and holds no personal column", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "src/lib/db/migrations/0003_create_consent_receipts.sql",
      ),
      "utf8",
    ).replace(/^--.*$/gm, "");

    for (const column of Object.values(getTableColumns(consentReceipts))) {
      expect(sql).toContain(`"${column.name}"`);
    }
    expect(sql).toContain('"id" uuid PRIMARY KEY');
    expect(sql).not.toMatch(
      /\b(ip|user_agent|agent|visitor|session|email|name|account)\b/i,
    );
  });
});
