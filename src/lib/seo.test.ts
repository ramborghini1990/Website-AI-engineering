import { describe, expect, it } from "vitest";

import { localeAlternates } from "@/lib/seo";

describe("localeAlternates", () => {
  it("points canonical at the current locale and lists every locale", () => {
    expect(localeAlternates("it", "/")).toEqual({
      canonical: "/it",
      languages: { it: "/it", en: "/en", "x-default": "/it" },
    });
    expect(localeAlternates("en", "/")).toEqual({
      canonical: "/en",
      languages: { it: "/it", en: "/en", "x-default": "/it" },
    });
  });

  it("keeps the path for inner pages", () => {
    expect(localeAlternates("en", "/services/ai-agents")).toEqual({
      canonical: "/en/services/ai-agents",
      languages: {
        it: "/it/services/ai-agents",
        en: "/en/services/ai-agents",
        "x-default": "/it/services/ai-agents",
      },
    });
  });

  it("always sends x-default to the default locale, whatever the current one", () => {
    expect(localeAlternates("en", "/work").languages?.["x-default"]).toBe(
      "/it/work",
    );
  });

  it("rejects a pathname without a leading slash (negative)", () => {
    expect(() => localeAlternates("it", "work")).toThrow(/must start with/);
  });
});
