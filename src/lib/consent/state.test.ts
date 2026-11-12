import { describe, expect, it } from "vitest";

import { CONSENT_POLICY_VERSION } from "@/lib/consent/registry";
import {
  CONSENT_MAX_AGE_SECONDS,
  acceptAll,
  isReceiptId,
  parseDecision,
  rejectAll,
  serializeDecision,
  type ConsentDecision,
} from "@/lib/consent/state";

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const ID = "3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b";

const decision = (over: Partial<ConsentDecision> = {}): ConsentDecision => ({
  version: CONSENT_POLICY_VERSION,
  decidedAt: NOW - DAY,
  choices: { booking: true },
  id: ID,
  ...over,
});

const cookie = (value: unknown) => encodeURIComponent(JSON.stringify(value));

describe("the consent cookie value", () => {
  it("round-trips a decision, with and without a receipt code", () => {
    expect(parseDecision(serializeDecision(decision()), NOW)).toEqual(
      decision(),
    );
    expect(
      parseDecision(serializeDecision(decision({ id: null })), NOW),
    ).toEqual(decision({ id: null }));
  });

  it("round-trips a rejection and keeps it a rejection", () => {
    const parsed = parseDecision(
      serializeDecision(decision({ choices: rejectAll() })),
      NOW,
    );
    expect(parsed?.choices).toEqual({ booking: false });
    expect(acceptAll()).toEqual({ booking: true });
  });

  it("stores no personal or technical identifier: only version, time, flags and the receipt code", () => {
    const decoded = JSON.parse(
      decodeURIComponent(serializeDecision(decision())),
    ) as Record<string, unknown>;

    expect(Object.keys(decoded).sort()).toEqual(["c", "i", "t", "v"]);
  });

  it("is a valid cookie value: no semicolon, comma, space or quote", () => {
    expect(serializeDecision(decision())).toMatch(/^[A-Za-z0-9%._~-]+$/);
  });
});

describe("a stored choice that must not be trusted (negative)", () => {
  const good = {
    v: CONSENT_POLICY_VERSION,
    t: NOW - DAY,
    c: [1],
    i: ID,
  };

  it("asks again when there is nothing", () => {
    expect(parseDecision(undefined, NOW)).toBeNull();
    expect(parseDecision("", NOW)).toBeNull();
  });

  it("asks again for another wording version: the conditions changed", () => {
    expect(parseDecision(cookie({ ...good, v: "2025-01-v0" }), NOW)).toBeNull();
  });

  it("asks again after 6 months, and not before", () => {
    const limit = CONSENT_MAX_AGE_SECONDS * 1000;
    expect(
      parseDecision(cookie({ ...good, t: NOW - limit + DAY }), NOW),
    ).not.toBeNull();
    expect(
      parseDecision(cookie({ ...good, t: NOW - limit - 1 }), NOW),
    ).toBeNull();
    // 6 months really is about half a year
    expect(CONSENT_MAX_AGE_SECONDS / 86400).toBeGreaterThanOrEqual(181);
  });

  it("asks again for a date in the future", () => {
    expect(
      parseDecision(cookie({ ...good, t: NOW + 3 * DAY }), NOW),
    ).toBeNull();
  });

  it("asks again for anything malformed, forged or oversized", () => {
    for (const raw of [
      "not-json",
      "%E0%A4%A", // broken percent-encoding
      cookie(null),
      cookie([1]),
      cookie("accept"),
      cookie({ ...good, c: [2] }),
      cookie({ ...good, c: ["1"] }),
      cookie({ ...good, c: [1, 1] }), // a category this wording never named
      cookie({ ...good, c: [] }),
      cookie({ ...good, t: "yesterday" }),
      cookie({ ...good, t: Number.NaN }),
      cookie({ ...good, i: "not-a-uuid" }),
      cookie({ ...good, extra: 1 }),
      cookie({ ...good, i: `${ID}"; Path=/` }),
      "x".repeat(401),
    ]) {
      expect(parseDecision(raw, NOW), raw.slice(0, 40)).toBeNull();
    }
  });

  it("never turns a missing flag into a yes", () => {
    expect(parseDecision(cookie({ ...good, c: [0] }), NOW)?.choices).toEqual({
      booking: false,
    });
  });
});

describe("receipt codes", () => {
  it("accepts a UUID and nothing else", () => {
    expect(isReceiptId(ID)).toBe(true);
    for (const value of ["", "abc", null, 5, `${ID}x`, ` ${ID}`]) {
      expect(isReceiptId(value)).toBe(false);
    }
  });
});
