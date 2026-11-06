// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildSitemap, type SitemapPage } from "@/lib/sitemap";

const pages: SitemapPage[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  {
    path: "/work/some-case",
    changeFrequency: "monthly",
    priority: 0.5,
    lastModified: "2026-01-15",
  },
];

describe("buildSitemap", () => {
  const entries = buildSitemap("https://example.test", pages);

  it("lists every page once per language, in page order", () => {
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://example.test/it",
      "https://example.test/en",
      "https://example.test/it/work/some-case",
      "https://example.test/en/work/some-case",
    ]);
  });

  it("each entry lists all its language versions and x-default, the same for both entries of a page", () => {
    const expected = {
      it: "https://example.test/it/work/some-case",
      en: "https://example.test/en/work/some-case",
      "x-default": "https://example.test/it/work/some-case",
    };

    expect(entries[2]?.alternates?.languages).toEqual(expected);
    expect(entries[3]?.alternates?.languages).toEqual(expected);
  });

  it("home has no trailing slash, like its canonical URL", () => {
    expect(entries[0]?.alternates?.languages).toEqual({
      it: "https://example.test/it",
      en: "https://example.test/en",
      "x-default": "https://example.test/it",
    });
  });

  it("carries the change frequency and priority of the page", () => {
    expect(entries[0]).toMatchObject({
      changeFrequency: "weekly",
      priority: 1,
    });
    expect(entries[2]).toMatchObject({
      changeFrequency: "monthly",
      priority: 0.5,
    });
  });

  it("states a date only when one is known (never an invented one)", () => {
    expect(entries[0]).not.toHaveProperty("lastModified");
    expect(entries[2]?.lastModified).toBe("2026-01-15");
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(buildSitemap("https://example.test/", pages)[0]?.url).toBe(
      "https://example.test/it",
    );
  });

  it("is empty for no pages", () => {
    expect(buildSitemap("https://example.test", [])).toEqual([]);
  });
});
