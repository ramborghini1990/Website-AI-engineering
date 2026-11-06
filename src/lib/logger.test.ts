// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ALLOWED_FIELDS,
  buildEntry,
  errorClass,
  logger,
  newRequestId,
  redactString,
} from "@/lib/logger";

const NOW = new Date("2026-01-15T10:00:00.000Z");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("redactString: personal-looking text never survives", () => {
  it.each([
    ["an email", "write to anna.rossi+test@example.com now", "example.com"],
    ["an email in capitals", "ANNA@EXAMPLE.IT", "EXAMPLE.IT"],
    ["an IPv4 address", "from 203.0.113.42 today", "203.0.113.42"],
    ["an IPv6 address", "from 2001:db8:85a3::8a2e:370:7334", "2001:db8"],
    ["an Italian mobile number", "call +39 347 123 4567 please", "347"],
    ["a phone number with dots", "tel 011.123.4567", "011.123"],
    ["an IBAN", "IT60 X054 2811 1010 0000 0123 456", "0123"],
    ["an Italian fiscal code", "RSSMRA85T10A562S", "RSSMRA"],
    ["a bearer token", "Authorization: Bearer abcdef1234567890", "abcdef1234"],
  ])("removes %s", (_name, input, leaked) => {
    const output = redactString(input);

    expect(output).not.toContain(leaked);
    expect(output).toContain("[redacted:");
  });

  it("leaves ordinary text alone", () => {
    expect(redactString("inquiry stored")).toBe("inquiry stored");
    expect(redactString("step 3 of 4")).toBe("step 3 of 4");
  });
});

describe("buildEntry: only allowed fields are written", () => {
  it("writes time, level, event and the allowed fields", () => {
    expect(
      buildEntry(
        "info",
        "inquiry.stored",
        { route: "/contact", status: 200, durationMs: 12, requestId: "abc" },
        NOW,
      ),
    ).toEqual({
      time: "2026-01-15T10:00:00.000Z",
      level: "info",
      event: "inquiry.stored",
      route: "/contact",
      status: 200,
      durationMs: 12,
      requestId: "abc",
    });
  });

  it("drops every field that is not on the allow-list: bodies, names, emails, IPs (negative)", () => {
    const entry = buildEntry(
      "error",
      "inquiry.failed",
      {
        body: { name: "Anna Rossi", email: "anna@example.com" },
        email: "anna@example.com",
        name: "Anna Rossi",
        ip: "203.0.113.42",
        message: "something with anna@example.com inside",
        headers: { cookie: "a=b" },
        code: "unavailable",
      },
      NOW,
    );

    expect(Object.keys(entry).sort()).toEqual(
      ["code", "event", "level", "time"].sort(),
    );
    expect(JSON.stringify(entry)).not.toMatch(/anna|203\.0|cookie/i);
  });

  it("scrubs an allowed field that carries personal text anyway (second layer)", () => {
    const entry = buildEntry(
      "warn",
      "inquiry.odd",
      { code: "failed for anna@example.com from 203.0.113.42" },
      NOW,
    );

    expect(entry["code"]).toBe(
      "failed for [redacted:email] from [redacted:ip]",
    );
  });

  it("scrubs the event name too and caps lengths", () => {
    const entry = buildEntry(
      "info",
      `event anna@example.com ${"x".repeat(500)}`,
      { code: "y".repeat(500) },
      NOW,
    );

    expect(String(entry["event"])).not.toContain("anna");
    expect(String(entry["event"]).length).toBeLessThanOrEqual(200);
    expect(String(entry["code"]).length).toBeLessThanOrEqual(200);
  });

  it("ignores values of the wrong type and non-finite numbers", () => {
    const entry = buildEntry(
      "info",
      "e",
      { status: Number.NaN, route: { nested: true }, durationMs: Infinity },
      NOW,
    );

    expect(Object.keys(entry).sort()).toEqual(["event", "level", "time"]);
  });

  it("the allow-list holds no field that could carry a person's data", () => {
    for (const field of ALLOWED_FIELDS) {
      expect(field).not.toMatch(
        /email|name|phone|ip|body|message|text|input|prompt|token|cookie|header/i,
      );
    }
  });
});

describe("logger", () => {
  it("writes one JSON line per call to the right console method", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    logger.info("a", { route: "/x" });
    logger.warn("b");
    logger.error("c", { errorClass: "TypeError" });

    expect(info).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    const line = JSON.parse(String(info.mock.calls[0]?.[0])) as Record<
      string,
      unknown
    >;
    expect(line["event"]).toBe("a");
    expect(line["route"]).toBe("/x");
  });

  it("never writes a body or an email even when a caller passes one (negative)", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.info("inquiry.received", {
      body: "name=Anna&email=anna@example.com",
    } as never);

    expect(String(info.mock.calls[0]?.[0])).not.toMatch(/anna|example/i);
  });
});

describe("helpers", () => {
  it("newRequestId is a fresh uuid each time", () => {
    const a = newRequestId();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(newRequestId()).not.toBe(a);
  });

  it("errorClass gives the class, never the message", () => {
    expect(errorClass(new TypeError("secret anna@example.com"))).toBe(
      "TypeError",
    );
    expect(errorClass("text")).toBe("string");
  });
});
