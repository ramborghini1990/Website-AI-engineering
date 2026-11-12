// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildSecurityTxt, expiresAt } from "@/lib/security/security-txt";

const ORIGIN = "https://www.example.eu";
const NOW = new Date("2026-11-12T10:30:00Z"); // fixed clock

describe("expiresAt (RFC 9116: required, less than a year away)", () => {
  it("is the last second of the month six months ahead, in UTC", () => {
    expect(expiresAt(NOW)).toBe("2027-05-31T23:59:59Z");
  });

  it("crosses a year end and handles February", () => {
    expect(expiresAt(new Date("2026-09-30T00:00:00Z"))).toBe(
      "2027-03-31T23:59:59Z",
    );
    expect(expiresAt(new Date("2026-08-31T23:59:59Z"))).toBe(
      "2027-02-28T23:59:59Z",
    );
  });

  it("is always in the future and under a year ahead, for every day of a year", () => {
    for (let day = 0; day < 366; day++) {
      const now = new Date(Date.UTC(2027, 0, 1 + day, 12));
      const expires = Date.parse(expiresAt(now));

      expect(expires, now.toISOString()).toBeGreaterThan(now.getTime());
      expect(expires - now.getTime(), now.toISOString()).toBeLessThan(
        365 * 24 * 3600 * 1000,
      );
    }
  });
});

describe("buildSecurityTxt", () => {
  it("has the required fields: Contact and Expires, plus Canonical", () => {
    const text = buildSecurityTxt({ origin: ORIGIN, now: NOW });

    expect(text).toContain(`Contact: ${ORIGIN}/en/contact\n`);
    expect(text).toContain("Expires: 2027-05-31T23:59:59Z\n");
    expect(text).toContain(`Canonical: ${ORIGIN}/.well-known/security.txt\n`);
    expect(text).toContain("Preferred-Languages: en, it\n");
    expect(text.endsWith("\n")).toBe(true);
  });

  it("lists the email first (most preferred) when one is configured", () => {
    const lines = buildSecurityTxt({
      origin: ORIGIN,
      contactEmail: "security@example.eu",
      now: NOW,
    }).split("\n");

    expect(lines[0]).toBe("Contact: mailto:security@example.eu");
    expect(lines[1]).toBe(`Contact: ${ORIGIN}/en/contact`);
  });

  it("never prints an unset email as the string 'undefined'", () => {
    const text = buildSecurityTxt({
      origin: ORIGIN,
      contactEmail: undefined,
      now: NOW,
    });

    expect(text).not.toMatch(/undefined|mailto/);
  });

  it("uses LF line endings and no blank or comment lines", () => {
    const text = buildSecurityTxt({ origin: ORIGIN, now: NOW });

    expect(text).not.toContain("\r");
    expect(text.trimEnd().split("\n").every(Boolean)).toBe(true);
  });
});
