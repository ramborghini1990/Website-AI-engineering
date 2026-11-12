// @vitest-environment node
import { describe, expect, it } from "vitest";

import { scrubError, type SafeErrorReport } from "@/lib/observability/scrub";
import { buildEnvelope, createErrorSink } from "@/lib/observability/sink";

const DSN = "https://pubkey123@o4500.ingest.de.sentry.io/4501";
const NOW = new Date("2026-11-12T10:00:00.000Z");
const EVENT_ID = "0123456789abcdef0123456789abcdef";
const report: SafeErrorReport = {
  errorClass: "TypeError",
  digest: "99",
  route: "/[locale]/work/[slug]",
  routeType: "render",
  method: "GET",
  frames: [{ function: "render", filename: "page.tsx", lineno: 3, colno: 4 }],
};

type Call = { url: string; init: RequestInit };

/** A fake `fetch` that records what it was given and answers with `status`. */
function fakeFetch(status = 200) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = (url, init) => {
    calls.push({
      url: typeof url === "string" ? url : "(not a string)",
      init: init ?? {},
    });
    return Promise.resolve(new Response("{}", { status }));
  };
  return { fetchImpl, calls };
}

function makeSink(fetchImpl: typeof fetch) {
  const sink = createErrorSink({
    dsn: DSN,
    environment: "production",
    fetchImpl,
    now: () => NOW,
    newId: () => EVENT_ID,
  });
  if (sink === null) throw new Error("sink should exist");
  return sink;
}

const bodyOf = (call: Call | undefined) =>
  typeof call?.init.body === "string" ? call.init.body : "";

describe("createErrorSink", () => {
  it("POSTs one envelope to the EU ingest host with the key in the auth header", async () => {
    const { fetchImpl, calls } = fakeFetch();

    const ok = await makeSink(fetchImpl).capture(report);

    expect(ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://o4500.ingest.de.sentry.io/api/4501/envelope/",
    );
    expect(calls[0]?.init.method).toBe("POST");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/x-sentry-envelope");
    expect(headers["x-sentry-auth"]).toContain("sentry_key=pubkey123");
    expect(calls[0]?.init).toMatchObject({
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
    });
    // The key travels in the header only, never in the body.
    expect(bodyOf(calls[0])).not.toContain("pubkey123");
  });

  it("the envelope has exactly the safe fields and no user, request or message", () => {
    const lines = buildEnvelope(report, {
      eventId: EVENT_ID,
      now: NOW,
      environment: "production",
    }).split("\n");
    const event = JSON.parse(lines[2] ?? "{}") as Record<string, unknown>;

    expect(JSON.parse(lines[0] ?? "{}")).toEqual({
      event_id: EVENT_ID,
      sent_at: NOW.toISOString(),
    });
    expect(JSON.parse(lines[1] ?? "{}")).toEqual({ type: "event" });
    expect(Object.keys(event).sort()).toEqual([
      "environment",
      "event_id",
      "exception",
      "level",
      "platform",
      "tags",
      "timestamp",
    ]);
    expect(event).not.toHaveProperty("user");
    expect(event).not.toHaveProperty("request");
    expect(event).not.toHaveProperty("server_name");
    expect(lines[2]).toContain("[message withheld]");
  });

  it("an error full of personal data reaches the tracker without it (end to end)", async () => {
    const error = Object.assign(
      new Error("anna.rossi@example.com 203.0.113.42 +39 347 123 4567"),
      { digest: "7" },
    );
    error.stack = `Error: anna.rossi@example.com\n    at go (/home/annarossi/x/route.ts:1:2)`;
    const { fetchImpl, calls } = fakeFetch();
    // What Next passes: the real URL with personal data in the query. Not read.
    const request = { method: "GET", path: "/it?email=anna.rossi@example.com" };

    await makeSink(fetchImpl).capture(
      scrubError(error, request, { routePath: "/[locale]" }),
    );

    const body = bodyOf(calls[0]);
    expect(body).toContain("route.ts");
    for (const leaked of [
      "anna",
      "rossi",
      "example.com",
      "203.0.113",
      "347",
      "annarossi",
    ]) {
      expect(body).not.toContain(leaked);
    }
  });

  it("returns false, and never throws, when the tracker fails or refuses", async () => {
    const rejecting: typeof fetch = () => Promise.reject(new Error("offline"));
    const refusing = fakeFetch(429).fetchImpl;

    await expect(makeSink(rejecting).capture(report)).resolves.toBe(false);
    await expect(makeSink(refusing).capture(report)).resolves.toBe(false);
  });

  it("passes a timeout signal to fetch", async () => {
    const { fetchImpl, calls } = fakeFetch();

    await makeSink(fetchImpl).capture(report);

    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it("refuses a non-EU DSN: no sink at all (negative)", () => {
    expect(
      createErrorSink({
        dsn: "https://k@o1.ingest.sentry.io/2",
        environment: "production",
      }),
    ).toBeNull();
  });
});
