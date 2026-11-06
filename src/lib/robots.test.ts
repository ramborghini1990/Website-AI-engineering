// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildRobots } from "@/lib/robots";

describe("buildRobots", () => {
  it("a production site allows crawling, blocks the dev tools in every language and names the sitemap", () => {
    const robots = buildRobots({
      origin: "https://example.test",
      indexable: true,
    });

    expect(robots.rules).toEqual([
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/*/_dev/", "/*/dev-tools/"],
      },
    ]);
    expect(robots.sitemap).toBe("https://example.test/sitemap.xml");
  });

  it("does not block public marketing routes", () => {
    const [rule] = buildRobots({
      origin: "https://example.test",
      indexable: true,
    }).rules as Array<{ disallow: string[] }>;

    for (const path of ["/it", "/en/services", "/it/work", "/en/contact"]) {
      expect(
        rule.disallow.some((blocked) =>
          path.startsWith(blocked.replace("/*", "")),
        ),
      ).toBe(false);
    }
  });

  it("keeps the confirmation page crawlable so its noindex can be read", () => {
    const text = JSON.stringify(
      buildRobots({ origin: "https://example.test", indexable: true }),
    );

    expect(text).not.toContain("thanks");
  });

  it("a preview or any other deployment disallows everything and lists no sitemap (negative)", () => {
    const robots = buildRobots({
      origin: "https://preview.example.test",
      indexable: false,
    });

    expect(robots.rules).toEqual([{ userAgent: "*", disallow: "/" }]);
    expect(robots.sitemap).toBeUndefined();
  });

  it("tolerates a trailing slash on the origin", () => {
    expect(
      buildRobots({ origin: "https://example.test/", indexable: true }).sitemap,
    ).toBe("https://example.test/sitemap.xml");
  });
});
