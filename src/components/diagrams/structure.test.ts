// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Diagrams are zero-JavaScript Server Components (docs/DESIGN.md §7.1): static
 * scans keep client code and untokenised styling out of them.
 */

const roots = ["components/diagrams/", "lib/diagrams/"];
const srcRoot = fileURLToPath(new URL("../../", import.meta.url));

function files(): string[] {
  return roots.flatMap((root) =>
    readdirSync(srcRoot + root, { recursive: true, encoding: "utf8" })
      .map((p) => `${root}${p.replace(/\\/g, "/")}`)
      .filter((p) => /\.tsx?$/.test(p))
      .filter((p) => !/\.test\.tsx?$/.test(p)),
  );
}

const source = (file: string) => readFileSync(srcRoot + file, "utf8");

describe("diagram code stays free of client JavaScript", () => {
  it("scans the diagram component and data files", () => {
    const found = files();
    expect(found).toContain("components/diagrams/diagram.tsx");
    expect(found).toContain("components/diagrams/hairline-grid.tsx");
    expect(found).toContain("lib/diagrams/hero.ts");
    expect(found).toContain("lib/diagrams/geometry.ts");
  });

  it('has no "use client", gsap, @gsap/react or motion import', () => {
    for (const file of files()) {
      const code = source(file);
      expect(code, file).not.toMatch(/["']use client["']/);
      expect(code, file).not.toMatch(
        /from\s+["'](?:gsap|@gsap\/react|motion|lenis)(?:\/[^"']*)?["']/,
      );
      expect(code, file).not.toMatch(/@\/lib\/motion|@\/components\/fx/);
    }
  });

  it("uses no React hook that needs the browser", () => {
    for (const file of files()) {
      expect(source(file), file).not.toMatch(
        /\buse(?:State|Effect|LayoutEffect|Ref|Reducer|Callback|Memo)\(/,
      );
    }
  });

  it("is imported by no layout (the layout stays light, see layout.imports.test.ts)", () => {
    const layout = readFileSync(srcRoot + "app/[locale]/layout.tsx", "utf8");
    expect(layout).not.toMatch(/components\/diagrams|lib\/diagrams/);
  });
});

/** Class names an SVG element in diagram.tsx may carry: token paint, a few type helpers and the two animations. */
const ALLOWED_SVG_CLASS =
  /^(?:(?:fill|stroke)-(?:bg|surface-[123]|border-subtle|border-strong|text|text-secondary|text-muted|accent|trace|success)|font-mono|uppercase|animate-(?:node-in|packet)|h-auto|w-full)$/;

describe("class names on SVG elements", () => {
  const code = source("components/diagrams/diagram.tsx");

  it("only ever use token paint (fill-*, stroke-*), mono uppercase type and the two diagram animations", () => {
    // Every class name written in a string that Tailwind would see.
    const literals = [...code.matchAll(/["'`]([a-z][a-z0-9 :/-]*)["'`]/g)]
      .map((m) => m[1])
      .filter((value) => /(?:^|\s)(?:fill|stroke)-|animate-/.test(value));
    const classes = literals.flatMap((value) => value.split(/\s+/));

    expect(classes.length).toBeGreaterThan(10);
    expect(classes.filter((name) => !ALLOWED_SVG_CLASS.test(name))).toEqual([]);
  });

  it("every paint class names a semantic colour token, never a palette step or raw value", () => {
    expect(code).not.toMatch(/(?:fill|stroke)-\[/);
    expect(code).not.toMatch(
      /(?:fill|stroke)-(?:white|black|slate|gray|zinc|red|green|blue|amber|orange)/,
    );
  });
});

describe("allow-list (negative cases)", () => {
  it.each([
    "fill-red-500",
    "stroke-[#fff]",
    "shadow-md",
    "blur-sm",
    "fill-foo",
  ])("rejects %s", (name) => {
    expect(ALLOWED_SVG_CLASS.test(name)).toBe(false);
  });

  it.each([
    "fill-surface-2",
    "stroke-trace",
    "animate-packet",
    "fill-text-muted",
  ])("accepts %s", (name) => {
    expect(ALLOWED_SVG_CLASS.test(name)).toBe(true);
  });
});
