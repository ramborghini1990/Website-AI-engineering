import { beforeEach, describe, expect, it, vi } from "vitest";

import { CONSENT_POLICY_VERSION } from "@/lib/consent/registry";
import { hasNoValidConsent } from "@/lib/consent/server";
import {
  acceptAll,
  CONSENT_COOKIE,
  rejectAll,
  serializeDecision,
  type ConsentDecision,
} from "@/lib/consent/state";

// `value` becomes the consent cookie; `raw` replaces the whole Cookie header.
const jar = vi.hoisted(() => ({
  value: undefined as string | undefined,
  raw: undefined as string | undefined,
}));

vi.mock("next/headers", () => ({
  headers: () => {
    const header =
      jar.raw ?? (jar.value === undefined ? "" : `consent=${jar.value}`);
    return Promise.resolve(
      new Headers(header === "" ? {} : { cookie: header }),
    );
  },
}));

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

const decision = (over: Partial<ConsentDecision> = {}): ConsentDecision => ({
  version: CONSENT_POLICY_VERSION,
  decidedAt: NOW - DAY,
  choices: rejectAll(),
  id: null,
  ...over,
});

describe("hasNoValidConsent (the server asks the same question as the browser)", () => {
  beforeEach(() => {
    jar.value = undefined;
    jar.raw = undefined;
  });

  it("finds the cookie among others, in any position", async () => {
    const good = serializeDecision(decision());
    for (const header of [
      `consent=${good}; theme=dark`,
      `a=1; consent=${good}; b=2`,
      `a=1;consent=${good}`,
    ]) {
      jar.raw = header;
      expect(await hasNoValidConsent(NOW), header).toBe(false);
    }
  });

  it("ignores cookies that merely look like it (negative)", async () => {
    const good = serializeDecision(decision());
    for (const header of [
      `xconsent=${good}`,
      `consent_old=${good}`,
      `a=consent=${good}`,
      `consent${good}`,
      "consent",
      "=consent",
    ]) {
      jar.raw = header;
      expect(await hasNoValidConsent(NOW), header).toBe(true);
    }
  });

  it("is true without a cookie: the banner is rendered in the HTML", async () => {
    expect(await hasNoValidConsent(NOW)).toBe(true);
  });

  it("is false for a valid decision, whichever way the cookie value arrives", async () => {
    const encoded = serializeDecision(decision({ choices: acceptAll() }));
    jar.value = encoded;
    expect(await hasNoValidConsent(NOW)).toBe(false);
    // Some runtimes hand over the URL-decoded value.
    jar.value = decodeURIComponent(encoded);
    expect(await hasNoValidConsent(NOW)).toBe(false);
  });

  it("is true for a decision about another wording version", async () => {
    jar.value = serializeDecision(decision({ version: "1999-01-01" }));
    expect(await hasNoValidConsent(NOW)).toBe(true);
  });

  it("is true once the decision is older than six months", async () => {
    jar.value = serializeDecision(decision({ decidedAt: NOW - 183 * DAY }));
    expect(await hasNoValidConsent(NOW)).toBe(true);
    jar.value = serializeDecision(decision({ decidedAt: NOW - 181 * DAY }));
    expect(await hasNoValidConsent(NOW)).toBe(false);
  });

  it("is true for a decision dated in the future", async () => {
    jar.value = serializeDecision(decision({ decidedAt: NOW + 3 * DAY }));
    expect(await hasNoValidConsent(NOW)).toBe(true);
  });

  it.each([
    ["not JSON", "garbage"],
    ["a JSON array", encodeURIComponent("[1,2,3]")],
    ["an unknown key", encodeURIComponent('{"v":"x","t":1,"c":[0,0],"z":1}')],
    ["an oversized value", "a".repeat(401)],
    ["an empty value", ""],
  ])(
    "is true for a malformed cookie (%s): ask again, assume nothing",
    async (_n, raw) => {
      jar.value = raw;
      expect(await hasNoValidConsent(NOW)).toBe(true);
    },
  );

  it("reads the cookie the browser writes (same name)", () => {
    expect(CONSENT_COOKIE).toBe("consent");
  });
});
