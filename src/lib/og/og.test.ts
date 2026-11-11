// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { getServices, getWork } from "@/lib/content/read";
import { OgCard, titleFontSize } from "@/lib/og/card";
import { resolveOgContent } from "@/lib/og/content";
import palette from "@/lib/og/palette.json";
import enMessages from "../../../messages/en.json";
import itMessages from "../../../messages/it.json";

describe("palette.json follows the design tokens", () => {
  const css = readFileSync(
    path.join(process.cwd(), "src/app/globals.css"),
    "utf8",
  );
  // The first `--color-*` block is the dark theme (docs/DESIGN.md: dark-first).
  const dark = css.slice(css.indexOf("--color-bg:"));
  const token = (name: string) =>
    new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(dark)?.[1];

  it.each([
    ["bg", "bg"],
    ["surface2", "surface-2"],
    ["borderSubtle", "border-subtle"],
    ["borderStrong", "border-strong"],
    ["text", "text"],
    ["textSecondary", "text-secondary"],
    ["textMuted", "text-muted"],
    ["accent", "accent"],
  ] as const)("%s equals --color-%s in the dark theme", (key, name) => {
    expect(palette[key]).toBe(token(name));
  });

  it("contains nothing but the colours the card uses", () => {
    expect(Object.keys(palette).filter((k) => !k.startsWith("_"))).toHaveLength(
      8,
    );
  });
});

describe("resolveOgContent", () => {
  const host = "example.test";

  it.each([
    ["it", ["home"], itMessages.home.hero.headline, "example.test/it"],
    ["en", ["home"], enMessages.home.hero.headline, "example.test/en"],
    ["it", ["services"], itMessages.services.title, "example.test/it/services"],
    ["en", ["work"], enMessages.work.title, "example.test/en/work"],
    ["it", ["contact"], itMessages.contact.title, "example.test/it/contact"],
  ] as const)(
    "%s %j: the page's own h1 and its address",
    (locale, key, title, footer) => {
      expect(resolveOgContent(locale, key, host)).toMatchObject({
        title,
        footer,
      });
    },
  );

  it("a service shows its title in the page's language", () => {
    for (const locale of ["it", "en"] as const) {
      for (const { slug, data } of getServices(locale)) {
        expect(
          resolveOgContent(locale, ["services", slug], host),
        ).toMatchObject({
          title: data.title,
          footer: `example.test/${locale}/services/${slug}`,
        });
      }
    }
  });

  it("the eyebrow is the brand, from the one place that holds it", () => {
    expect(resolveOgContent("it", ["home"], host)?.eyebrow).toBe(
      "AI Solutions & Engineering",
    );
  });

  it.each([
    ["an unknown section", ["nope"]],
    ["no key", []],
    ["an unknown service", ["services", "does-not-exist"]],
    ["a path trick", ["services", "..%2F..%2Fpackage"]],
    ["a slug with markup", ["services", "<script>"]],
    ["too many segments", ["services", "ai-agents", "extra"]],
    ["a section that has no detail page", ["contact", "ai-agents"]],
    ["home with a slug", ["home", "x"]],
    ["the confirmation page", ["contact", "thanks"]],
    ["the dev tools", ["dev-tools", "work"]],
  ])("is null for %s (negative)", (_name, key) => {
    expect(resolveOgContent("it", key, host)).toBeNull();
  });

  it("is null for every draft work entry and for a work slug that is not published: a planned demo has no share image (negative)", () => {
    // P3.4 published the last draft demo, so there may be no draft in the content: an unpublished slug stands in for it.
    const drafts = getWork("it", { includeDrafts: true }).filter(
      (entry) => entry.data.draft,
    );

    for (const { slug } of drafts) {
      expect(resolveOgContent("it", ["work", slug], host)).toBeNull();
    }
    expect(
      resolveOgContent("it", ["work", "planned-demo-not-published"], host),
    ).toBeNull();
  });
});

describe("the card", () => {
  it("scales the headline down as the title grows, never below a readable size", () => {
    const sizes = [
      "x".repeat(10),
      "x".repeat(40),
      "x".repeat(60),
      "x".repeat(100),
    ].map(titleFontSize);

    expect(sizes).toEqual([104, 84, 68, 56]);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(56);
  });

  it("uses only palette colours (no value of its own)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/lib/og/card.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it("shortens an overlong title instead of overflowing", () => {
    const element = OgCard({
      eyebrow: "e",
      title: "x".repeat(300),
      footer: "f",
      locale: "it",
    });
    const text = JSON.stringify(element);

    expect(text).toContain("…");
    expect(text).not.toContain("x".repeat(120));
  });
});
