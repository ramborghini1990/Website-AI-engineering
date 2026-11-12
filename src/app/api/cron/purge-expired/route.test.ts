// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PurgeDeps } from "@/lib/privacy/cron";
import { createMemoryPrivacyStore } from "@/lib/privacy/store";

const SECRET = "a-long-random-cron-secret-with-32-or-more-characters";

const state = vi.hoisted(() => ({ deps: null as PurgeDeps | null }));

vi.mock("@/lib/privacy/runtime", () => ({
  getPurgeDeps: () => state.deps,
}));

const route = await import("@/app/api/cron/purge-expired/route");

const URL_ = "http://localhost:3000/api/cron/purge-expired";

beforeEach(() => {
  state.deps = {
    secret: SECRET,
    store: createMemoryPrivacyStore([
      {
        id: crypto.randomUUID(),
        createdAt: new Date("2020-01-01T00:00:00Z"),
        locale: "it",
        need: "agent",
        description: "Synthetic description for a test.",
        budget: "10-25k",
        timeline: "q1",
        name: "Test Person",
        email: "old@example.it",
        company: null,
        marketingConsent: false,
        consentVersion: "2026-11-v1",
        status: "new",
      },
    ]),
    retentionDays: 730,
    now: () => new Date("2026-11-12T03:17:00Z"),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
});

describe("GET /api/cron/purge-expired", () => {
  it("purges for the scheduler (Bearer CRON_SECRET) and answers the counts", async () => {
    const response = await route.GET(
      new Request(URL_, { headers: { authorization: `Bearer ${SECRET}` } }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ purged: 1, retentionDays: 730 });
  });

  it("negative: a request with no credentials is 401", async () => {
    const response = await route.GET(new Request(URL_));

    expect(response.status).toBe(401);
  });

  it("exports GET only: no other method can trigger a purge", () => {
    expect(Object.keys(route).sort()).toEqual(["GET"]);
  });
});
