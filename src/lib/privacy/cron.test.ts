// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { handlePurge, isAuthorized, type PurgeDeps } from "@/lib/privacy/cron";
import {
  createMemoryPrivacyStore,
  type InquiryExportRow,
  type PrivacyStore,
} from "@/lib/privacy/store";

const SECRET = "a-long-random-cron-secret-with-32-or-more-characters";
const NOW = new Date("2026-11-12T03:17:00.000Z");
const URL_ = "http://localhost:3000/api/cron/purge-expired";

const row = (email: string, createdAt: string): InquiryExportRow => ({
  id: crypto.randomUUID(),
  createdAt: new Date(createdAt),
  locale: "en",
  need: "agent",
  description: "Synthetic description for a test.",
  budget: "10-25k",
  timeline: "q1",
  name: "Test Person",
  email,
  company: null,
  marketingConsent: false,
  consentVersion: "2026-11-v1",
  status: "new",
});

function setup(over: Partial<PurgeDeps> = {}) {
  const store = createMemoryPrivacyStore([
    row("old1@example.it", "2024-01-01T00:00:00Z"),
    row("old2@example.it", "2024-11-12T03:16:59Z"), // 1 s past the 730 days
    row("edge@example.it", "2024-11-12T03:17:00Z"), // exactly 730 days: stays
    row("new@example.it", "2026-10-01T00:00:00Z"),
  ]);
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const deps: PurgeDeps = {
    secret: SECRET,
    store,
    retentionDays: 730,
    now: () => NOW,
    log,
    ...over,
  };
  return { store, log, deps };
}

const call = (deps: PurgeDeps, authorization?: string) =>
  handlePurge(
    new Request(URL_, {
      headers: authorization === undefined ? {} : { authorization },
    }),
    deps,
  );

describe("isAuthorized", () => {
  it("accepts exactly `Bearer <secret>`", () => {
    expect(isAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("negative: anything else is refused", () => {
    for (const header of [
      null,
      "",
      SECRET,
      `bearer ${SECRET}`,
      `Bearer ${SECRET} `,
      `Bearer ${SECRET}x`,
      `Bearer ${SECRET.slice(0, -1)}`,
      `Basic ${SECRET}`,
      "Bearer ",
    ]) {
      expect(isAuthorized(header, SECRET), String(header)).toBe(false);
    }
  });
});

describe("handlePurge", () => {
  it("with the secret it deletes inquiries older than the retention period and answers only the counts", async () => {
    const { deps, store } = setup();

    const response = await call(deps, `Bearer ${SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ purged: 2, retentionDays: 730 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(store.rows.map((r) => r.email)).toEqual([
      "edge@example.it",
      "new@example.it",
    ]);
  });

  it("uses the configured retention period", async () => {
    const { deps, store } = setup({ retentionDays: 90 });

    const response = await call(deps, `Bearer ${SECRET}`);

    expect(await response.json()).toEqual({ purged: 3, retentionDays: 90 });
    expect(store.rows.map((r) => r.email)).toEqual(["new@example.it"]);
  });

  it("logs the event, route, status, count and duration and nothing about the rows", async () => {
    const { deps, log } = setup();

    await call(deps, `Bearer ${SECRET}`);

    expect(log.info).toHaveBeenCalledWith("cron.purge.done", {
      route: "/api/cron/purge-expired",
      status: 200,
      count: 2,
      durationMs: 0,
    });
    expect(JSON.stringify(log.info.mock.calls)).not.toContain("example.it");
  });

  it("negative: no header, a wrong secret or the wrong scheme is 401 and deletes nothing", async () => {
    for (const header of [
      undefined,
      "Bearer wrong",
      SECRET,
      `Bearer ${SECRET}!`,
    ]) {
      const { deps, store, log } = setup();

      const response = await call(deps, header);

      expect(response.status, String(header)).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).toBe("");
      expect(store.rows).toHaveLength(4);
      expect(log.warn).toHaveBeenCalledWith(
        "cron.purge.unauthorized",
        expect.objectContaining({ status: 401 }),
      );
      expect(JSON.stringify(log.warn.mock.calls)).not.toContain("wrong");
    }
  });

  it("negative: with no CRON_SECRET configured it is 503 whatever the caller sends, even `Bearer undefined` or `Bearer `", async () => {
    for (const header of [undefined, "Bearer undefined", "Bearer ", "Bearer"]) {
      const { deps, store, log } = setup({ secret: undefined });

      const response = await call(deps, header);

      expect(response.status, String(header)).toBe(503);
      expect(store.rows).toHaveLength(4);
      expect(log.error).toHaveBeenCalledWith(
        "cron.purge.unconfigured",
        expect.anything(),
      );
    }
  });

  it("negative: a deployed site without a database is 503 and purges nothing", async () => {
    const { deps, log } = setup({ store: null });

    const response = await call(deps, `Bearer ${SECRET}`);

    expect(response.status).toBe(503);
    expect(log.error).toHaveBeenCalledWith(
      "cron.purge.unavailable",
      expect.anything(),
    );
  });

  it("negative: a retention period outside the bounds is a 500 and deletes nothing", async () => {
    for (const retentionDays of [0, 1, -5, Number.NaN]) {
      const { deps, store } = setup({ retentionDays });

      const response = await call(deps, `Bearer ${SECRET}`);

      expect(response.status, String(retentionDays)).toBe(500);
      expect(store.rows).toHaveLength(4);
    }
  });

  it("negative: a database failure is a plain 500, logged by class only (its message may quote data)", async () => {
    const failing: PrivacyStore = {
      findByEmail: () => Promise.resolve([]),
      deleteByEmail: () => Promise.resolve(0),
      deleteCreatedBefore: () =>
        Promise.reject(
          new TypeError("password authentication failed for x@y.it"),
        ),
    };
    const { deps, log } = setup({ store: failing });

    const response = await call(deps, `Bearer ${SECRET}`);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("");
    expect(log.error).toHaveBeenCalledWith("cron.purge.failed", {
      route: "/api/cron/purge-expired",
      status: 500,
      errorClass: "TypeError",
    });
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("x@y.it");
  });
});
