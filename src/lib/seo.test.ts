import { describe, expect, it } from "vitest";

import { business } from "@/lib/business";
import {
  localeAlternates,
  OG_SIZE,
  ogImagePath,
  pageMetadata,
} from "@/lib/seo";

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

describe("pageMetadata", () => {
  const base = {
    locale: "it" as const,
    path: "/services/ai-agents",
    ogKey: "services/ai-agents",
    title: "Agenti AI autonomi su misura",
    description: "A description of the page that is long enough to be one.",
  };

  it("gives the page title, description, canonical and every language alternate", () => {
    const metadata = pageMetadata(base);

    expect(metadata.title).toBe("Agenti AI autonomi su misura");
    expect(metadata.description).toBe(base.description);
    expect(metadata.alternates).toEqual(
      localeAlternates("it", "/services/ai-agents"),
    );
  });

  it("an absolute title (Home) carries the brand itself", () => {
    const metadata = pageMetadata({ ...base, path: "/", absolute: true });

    expect(metadata.title).toEqual({
      absolute: `${base.title} | ${business.brand.name}`,
    });
  });

  it("Open Graph repeats the canonical URL, names the language and its alternate, and points at the page's own image", () => {
    const og = pageMetadata(base).openGraph as Record<string, unknown>;

    expect(og).toMatchObject({
      type: "website",
      siteName: business.brand.name,
      title: `${base.title} | ${business.brand.name}`,
      url: "/it/services/ai-agents",
      locale: "it_IT",
      alternateLocale: ["en_GB"],
      images: [
        {
          url: "/it/og/services/ai-agents",
          width: 1200,
          height: 630,
          alt: `${base.title} | ${business.brand.name}`,
        },
      ],
    });
  });

  it("the English page declares English and the Italian alternate", () => {
    const og = pageMetadata({ ...base, locale: "en" }).openGraph as Record<
      string,
      unknown
    >;

    expect(og["locale"]).toBe("en_GB");
    expect(og["alternateLocale"]).toEqual(["it_IT"]);
    expect(og["url"]).toBe("/en/services/ai-agents");
  });

  it("Twitter uses the large image card with the same image", () => {
    expect(pageMetadata(base).twitter).toMatchObject({
      card: "summary_large_image",
      images: [{ url: "/it/og/services/ai-agents" }],
    });
  });

  it("the image path is the locale and the key, nothing from the request", () => {
    expect(ogImagePath("en", "home")).toBe("/en/og/home");
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  });
});
