// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildConsentRuntime,
  type ConsentRuntime,
} from "@/lib/consent/receipt-deps";
import { CONSENT_POLICY_VERSION } from "@/lib/consent/registry";

const state = vi.hoisted(() => ({ runtime: null as ConsentRuntime | null }));

vi.mock("@/lib/consent/receipt-runtime", () => ({
  getConsentRuntime: () => state.runtime,
}));

const { POST } = await import("@/app/api/consent/route");

const URL_ = "http://localhost:3000/api/consent";
const good = {
  policyVersion: CONSENT_POLICY_VERSION,
  method: "accept_all",
  choices: { booking: true },
};

function post(
  body: unknown,
  headers: Record<string, string> = {},
  raw?: string,
) {
  return POST(
    new Request(URL_, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "localhost:3000",
        "x-real-ip": "203.0.113.7",
        ...headers,
      },
      body: raw ?? JSON.stringify(body),
    }),
  );
}

const rows = () => state.runtime?.memory?.rows ?? [];

beforeEach(() => {
  state.runtime = buildConsentRuntime({
    deployed: false,
    databaseUrl: undefined,
    ipSalt: "a-long-random-test-salt-with-at-least-32-characters",
  });
});

describe("POST /api/consent", () => {
  it("stores a valid receipt and answers 201 with only its id, no cookie and no caching", async () => {
    const response = await post(good, { origin: "http://localhost:3000" });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(Object.keys(body)).toEqual(["id"]);
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(rows()).toHaveLength(1);
  });

  it("stores no ip: the row holds exactly the three facts", async () => {
    await post(good);

    expect(JSON.stringify(rows())).not.toContain("203.0.113.7");
    expect(Object.keys(rows()[0] ?? {}).sort()).toEqual([
      "booking",
      "method",
      "policyVersion",
    ]);
  });

  it("negative: another site's origin is refused (403) and nothing is stored", async () => {
    expect((await post(good, { origin: "https://evil.example" })).status).toBe(
      403,
    );
    expect((await post(good, { "sec-fetch-site": "cross-site" })).status).toBe(
      403,
    );
    expect(rows()).toEqual([]);
  });

  it("negative: not JSON, oversized or malformed bodies are refused", async () => {
    expect((await post(good, { "content-type": "text/plain" })).status).toBe(
      415,
    );
    expect((await post(null, {}, "x".repeat(300))).status).toBe(413);
    expect((await post(null, {}, "{not json")).status).toBe(400);
    expect(rows()).toEqual([]);
  });

  it("negative: extra keys, a stale version and an unknown method are 400 and not stored", async () => {
    for (const body of [
      { ...good, ip: "203.0.113.7" },
      { ...good, policyVersion: "2020-01-v1" },
      { ...good, method: "scroll" },
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(rows()).toEqual([]);
  });

  it("negative: over the limit it answers 429 with Retry-After and stores nothing more", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 12; i += 1) last = await post(good);

    expect(last?.status).toBe(429);
    expect(Number(last?.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(rows()).toHaveLength(10);
  });

  it("answers 503 when deployed without a database or salt", async () => {
    state.runtime = buildConsentRuntime({
      deployed: true,
      databaseUrl: undefined,
      ipSalt: undefined,
    });

    expect((await post(good)).status).toBe(503);
  });
});
