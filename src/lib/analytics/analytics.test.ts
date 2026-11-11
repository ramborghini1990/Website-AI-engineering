// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  createDrizzleCounter,
  createMemoryCounter,
  utcDay,
} from "@/lib/analytics/counter";
import { buildAnalyticsRuntime } from "@/lib/analytics/deps";
import { demoEventSchema } from "@/lib/analytics/event-schema";
import { buildFunnel, type CountRow } from "@/lib/analytics/funnel";
import {
  ANALYTICS_LIMIT,
  isForeignOrigin,
  recordDemoEvent,
  type RecordDeps,
} from "@/lib/analytics/record";
import { demoEventCounts } from "@/lib/db/schema";
import { interactiveDemos } from "@/lib/demos/registry";
import { createMemoryLimiter } from "@/lib/security/rate-limit";

const NOON = new Date("2026-11-11T12:00:00Z");

function deps(over: Partial<RecordDeps> = {}) {
  const counter = createMemoryCounter();
  const log = { error: vi.fn() };
  const built: RecordDeps = {
    limiter: createMemoryLimiter({ requests: 3, windowSeconds: 60 }),
    counter,
    log,
    now: () => NOON,
    ...over,
  };
  return { built, counter, log };
}

describe("demoEventSchema", () => {
  it("accepts each event for each registered demo", () => {
    for (const demo of interactiveDemos) {
      for (const event of ["demo_started", "demo_completed", "cta_clicked"]) {
        expect(demoEventSchema.safeParse({ event, demo }).success).toBe(true);
      }
    }
  });

  it.each([
    ["an unknown event", { event: "page_view", demo: interactiveDemos[0] }],
    ["an unknown demo", { event: "demo_started", demo: "../../etc" }],
    ["a missing demo", { event: "demo_started" }],
    [
      "any extra key (no id, no text, no referrer can ride along)",
      { event: "demo_started", demo: interactiveDemos[0], visitorId: "abc" },
    ],
    ["a string body", "demo_started"],
    ["null", null],
  ])("refuses %s", (_label, body) => {
    expect(demoEventSchema.safeParse(body).success).toBe(false);
  });
});

describe("recordDemoEvent", () => {
  const good = { event: "demo_started", demo: interactiveDemos[0] };

  it("counts a valid event once, under the UTC day, demo and event", async () => {
    const { built, counter } = deps();

    expect(await recordDemoEvent(good, "client-a", built)).toEqual({
      status: "recorded",
    });
    await recordDemoEvent(good, "client-b", built);

    expect(counter.rows()).toEqual([
      {
        day: "2026-11-11",
        demo: interactiveDemos[0],
        event: "demo_started",
        count: 2,
      },
    ]);
  });

  it("stores only aggregates: a row has no field that could name a visitor", async () => {
    const { built, counter } = deps();
    await recordDemoEvent(good, "client-secret-hash", built);

    for (const row of counter.rows()) {
      expect(Object.keys(row).sort()).toEqual([
        "count",
        "day",
        "demo",
        "event",
      ]);
      expect(JSON.stringify(row)).not.toContain("client-secret-hash");
    }
    // and the table has no column for one either
    expect(Object.keys(getTableColumns(demoEventCounts)).sort()).toEqual([
      "count",
      "day",
      "demo",
      "event",
    ]);
  });

  it("negative: an invalid event is refused and nothing is counted or limited", async () => {
    const limit = vi.fn();
    const { built, counter } = deps({ limiter: { limit } });

    expect(
      await recordDemoEvent({ ...good, email: "a@b.it" }, "c", built),
    ).toEqual({ status: "invalid" });
    expect(counter.rows()).toEqual([]);
    expect(limit).not.toHaveBeenCalled();
  });

  it("negative: past the limit a client is refused with a wait time and nothing more is counted", async () => {
    const { built, counter } = deps();

    for (let i = 0; i < 3; i += 1) {
      await recordDemoEvent(good, "same-client", built);
    }
    const blocked = await recordDemoEvent(good, "same-client", built);

    expect(blocked.status).toBe("limited");
    expect(counter.rows()[0]?.count).toBe(3);
    // another client is not affected
    expect((await recordDemoEvent(good, "other", built)).status).toBe(
      "recorded",
    );
  });

  it("has a production limit that fits a person, not a script", () => {
    expect(ANALYTICS_LIMIT.requests).toBeLessThanOrEqual(60);
    expect(ANALYTICS_LIMIT.requests).toBeGreaterThanOrEqual(10);
  });

  it("drops the event when no store is configured", async () => {
    const { built } = deps({ counter: null });

    expect((await recordDemoEvent(good, "c", built)).status).toBe(
      "unavailable",
    );
  });

  it("a failing store is logged by error class only, never with the event or client", async () => {
    const { built, log } = deps({
      counter: {
        increment: () =>
          Promise.reject(new TypeError("connect to user@example.com failed")),
      },
    });

    expect((await recordDemoEvent(good, "c-1", built)).status).toBe(
      "unavailable",
    );
    expect(log.error).toHaveBeenCalledWith("analytics.store_failed", {
      route: "/api/demo-events",
      errorClass: "TypeError",
    });
  });
});

describe("isForeignOrigin", () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it("accepts the same site and requests with no browser origin headers", () => {
    expect(
      isForeignOrigin(
        headers({ origin: "https://site.example", host: "site.example" }),
      ),
    ).toBe(false);
    expect(isForeignOrigin(headers({ "sec-fetch-site": "same-origin" }))).toBe(
      false,
    );
    expect(isForeignOrigin(headers({}))).toBe(false);
  });

  it("negative: refuses another site, a cross-site fetch and a malformed origin", () => {
    expect(
      isForeignOrigin(
        headers({ origin: "https://evil.example", host: "site.example" }),
      ),
    ).toBe(true);
    expect(isForeignOrigin(headers({ "sec-fetch-site": "cross-site" }))).toBe(
      true,
    );
    expect(
      isForeignOrigin(headers({ origin: "not a url", host: "site.example" })),
    ).toBe(true);
  });

  it("uses the forwarded host behind the platform proxy", () => {
    expect(
      isForeignOrigin(
        headers({
          origin: "https://site.example",
          host: "internal:3000",
          "x-forwarded-host": "site.example",
        }),
      ),
    ).toBe(false);
  });
});

describe("counters", () => {
  it("utcDay is the UTC calendar day", () => {
    expect(utcDay(new Date("2026-11-11T23:59:59Z"))).toBe("2026-11-11");
    expect(utcDay(new Date("2026-11-12T00:00:00Z"))).toBe("2026-11-12");
  });

  it("the Drizzle counter upserts one row and raises it in place (no row per event)", async () => {
    const onConflictDoUpdate = vi.fn(() => Promise.resolve());
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    const insert = vi.fn(() => ({ values }));

    await createDrizzleCounter({ insert }).increment(
      "2026-11-11",
      interactiveDemos[1],
      "cta_clicked",
    );

    expect(insert).toHaveBeenCalledWith(demoEventCounts);
    expect(values).toHaveBeenCalledWith({
      day: "2026-11-11",
      demo: interactiveDemos[1],
      event: "cta_clicked",
      count: 1,
    });
    expect(onConflictDoUpdate).toHaveBeenCalledTimes(1);
  });

  it("the migration matches the schema and holds no personal column", () => {
    const sql = readFileSync(
      path.join(
        process.cwd(),
        "src/lib/db/migrations/0002_create_demo_event_counts.sql",
      ),
      "utf8",
    ).replace(/^--.*$/gm, "");

    for (const column of Object.values(getTableColumns(demoEventCounts))) {
      expect(sql).toContain(`"${column.name}"`);
    }
    expect(sql).toContain('PRIMARY KEY ("day", "demo", "event")');
    expect(sql).not.toMatch(
      /\b(ip|user_agent|visitor|session|email|created_at)\b/i,
    );
  });
});

describe("buildAnalyticsRuntime", () => {
  it("not deployed: an in-process counter and a development salt, so it works offline", () => {
    const runtime = buildAnalyticsRuntime({
      deployed: false,
      databaseUrl: undefined,
      ipSalt: undefined,
    });

    expect(runtime.deps.counter).not.toBeNull();
    expect(runtime.memory).not.toBeNull();
    expect(runtime.ipSalt).not.toBeNull();
  });

  it("negative: deployed without a database or salt it drops events, with no fake local counter", () => {
    const runtime = buildAnalyticsRuntime({
      deployed: true,
      databaseUrl: undefined,
      ipSalt: undefined,
    });

    expect(runtime.deps.counter).toBeNull();
    expect(runtime.memory).toBeNull();
    expect(runtime.ipSalt).toBeNull();
  });
});

describe("buildFunnel", () => {
  const row = (
    demo: CountRow["demo"],
    event: CountRow["event"],
    count: number,
    day = "2026-11-11",
  ): CountRow => ({ day, demo, event, count });
  const [first, second] = interactiveDemos;

  it("lists every registered demo, zeros included, in registry order", () => {
    const funnel = buildFunnel([]);

    expect(funnel.map((entry) => entry.demo)).toEqual([...interactiveDemos]);
    expect(funnel[0]).toEqual({
      demo: first,
      started: 0,
      completed: 0,
      ctaClicked: 0,
      completionRate: null,
    });
  });

  it("sums across days per demo and derives the completion rate", () => {
    const funnel = buildFunnel([
      row(first, "demo_started", 10),
      row(first, "demo_started", 10, "2026-11-12"),
      row(first, "demo_completed", 5),
      row(first, "cta_clicked", 2),
      row(second, "demo_started", 4),
    ]);

    expect(funnel[0]).toMatchObject({
      started: 20,
      completed: 5,
      ctaClicked: 2,
      completionRate: 0.25,
    });
    expect(funnel[1]).toMatchObject({ started: 4, completionRate: 0 });
  });

  it("never shows a completion rate above 100% (events can be lost, not invented)", () => {
    const funnel = buildFunnel([
      row(first, "demo_started", 1),
      row(first, "demo_completed", 3),
    ]);

    expect(funnel[0]?.completionRate).toBe(1);
  });
});
