// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAnalyticsRuntime,
  type AnalyticsRuntime,
} from "@/lib/analytics/deps";
import { interactiveDemos } from "@/lib/demos/registry";

const state = vi.hoisted(() => ({ runtime: null as AnalyticsRuntime | null }));

vi.mock("@/lib/analytics/runtime", () => ({
  getAnalyticsRuntime: () => state.runtime,
}));

const { POST } = await import("@/app/api/demo-events/route");

const URL_ = "http://localhost:3000/api/demo-events";
const good = { event: "demo_started", demo: interactiveDemos[0] };

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

const rows = () => state.runtime?.memory?.rows() ?? [];

beforeEach(() => {
  state.runtime = buildAnalyticsRuntime({
    deployed: false,
    databaseUrl: undefined,
    ipSalt: "a-long-random-test-salt-with-at-least-32-characters",
  });
});

describe("POST /api/demo-events", () => {
  it("counts a valid event and answers 204 with no body, no cookie and no caching", async () => {
    const response = await post(good, { origin: "http://localhost:3000" });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(rows()).toHaveLength(1);
    expect(rows()[0]).toMatchObject({ event: "demo_started", count: 1 });
  });

  it("negative: another site's origin is refused (403) and nothing is counted", async () => {
    const response = await post(good, { origin: "https://evil.example" });

    expect(response.status).toBe(403);
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

  it("negative: unknown events, unknown demos and extra keys are 400 and not counted", async () => {
    for (const body of [
      { event: "page_view", demo: interactiveDemos[0] },
      { event: "demo_started", demo: "nope" },
      { ...good, visitor: "x" },
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(rows()).toEqual([]);
  });

  it("negative: a client over the limit is dropped silently (204, no error in the console) and not counted", async () => {
    let last: Response | undefined;
    for (let i = 0; i < 40; i += 1) last = await post(good);

    expect(last?.status).toBe(204);
    expect(last?.headers.get("retry-after")).toBeNull();
    expect(rows()[0]?.count).toBe(30);
    // another client is still counted
    await post(good, { "x-real-ip": "198.51.100.9" });
    expect(rows()[0]?.count).toBe(31);
  });

  it("answers 503 and counts nothing when deployed without a store or salt", async () => {
    state.runtime = buildAnalyticsRuntime({
      deployed: true,
      databaseUrl: undefined,
      ipSalt: undefined,
    });

    expect((await post(good)).status).toBe(503);
  });
});
