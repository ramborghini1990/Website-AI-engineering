// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseSentryDsn } from "@/lib/observability/dsn";

describe("parseSentryDsn", () => {
  it("accepts an EU DSN and derives the envelope endpoint", () => {
    expect(
      parseSentryDsn("https://abc123@o4500.ingest.de.sentry.io/4501"),
    ).toEqual({
      endpoint: "https://o4500.ingest.de.sentry.io/api/4501/envelope/",
      key: "abc123",
    });
  });

  it.each([
    ["US region", "https://abc@o1.ingest.sentry.io/2"],
    ["US region, regional host", "https://abc@o1.ingest.us.sentry.io/2"],
    ["suffix trick", "https://abc@o1.ingest.de.sentry.io.evil.example/2"],
    ["prefix trick", "https://abc@de.sentry.io.evil.example/2"],
    ["plain http", "http://abc@o1.ingest.de.sentry.io/2"],
    ["no key", "https://o1.ingest.de.sentry.io/2"],
    ["a password", "https://abc:def@o1.ingest.de.sentry.io/2"],
    ["a port", "https://abc@o1.ingest.de.sentry.io:8443/2"],
    ["a query", "https://abc@o1.ingest.de.sentry.io/2?x=1"],
    ["a path prefix", "https://abc@o1.ingest.de.sentry.io/a/2"],
    ["a non-numeric project", "https://abc@o1.ingest.de.sentry.io/two"],
    ["not a URL", "o1.ingest.de.sentry.io"],
    ["empty", ""],
  ])("refuses %s (negative)", (_name, dsn) => {
    expect(parseSentryDsn(dsn)).toBeNull();
  });
});
