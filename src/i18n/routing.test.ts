import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";

describe("routing", () => {
  it("supports Italian (default) and English, in that order", () => {
    expect([...routing.locales]).toEqual(["it", "en"]);
    expect(routing.defaultLocale).toBe("it");
  });

  it("always prefixes the locale (/it, /en)", () => {
    expect(routing.localePrefix).toBe("always");
  });

  it("stores nothing about the visitor: no locale cookie (GDPR data minimisation)", () => {
    expect(routing.localeCookie).toBe(false);
  });

  it("emits hreflang from the HTML metadata only, not as a Link header", () => {
    expect(routing.alternateLinks).toBe(false);
  });
});
