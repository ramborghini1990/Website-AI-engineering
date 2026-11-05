// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { bezier, duration, ease, reducedFade } from "@/lib/motion/tokens";

const css = readFileSync(
  fileURLToPath(new URL("../../app/globals.css", import.meta.url)),
  "utf8",
);

/** --name: value; from the CSS (first definition wins; the theme block comes first). */
function cssToken(name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`token not found in globals.css: ${name}`);
  return match[1].trim();
}

describe("GSAP motion tokens mirror the CSS tokens", () => {
  const camelToKebab = (s: string) =>
    s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

  it.each(Object.entries(duration))("duration %s", (name, seconds) => {
    const value = cssToken(`--duration-${name}`); // e.g. "160ms"
    expect(value).toMatch(/^\d+ms$/);
    expect(seconds).toBeCloseTo(parseInt(value, 10) / 1000, 5);
  });

  it.each(Object.entries(bezier))("easing %s", (name, points) => {
    const value = cssToken(`--ease-${camelToKebab(name)}`);
    const inner = /^cubic-bezier\((.+)\)$/.exec(value)?.[1];
    expect(inner, `--ease-${name} is a cubic-bezier`).toBeDefined();
    const normalise = (s: string) => s.split(",").map((n) => Number(n.trim()));
    expect(normalise(points)).toEqual(normalise(inner ?? ""));
  });

  it("covers every CSS duration and easing token (nothing added in CSS only)", () => {
    const cssDurations = [...css.matchAll(/--duration-([a-z]+):/g)].map(
      (m) => m[1],
    );
    expect(cssDurations.sort()).toEqual(Object.keys(duration).sort());

    const cssEases = [...css.matchAll(/--ease-([a-z-]+):\s*cubic-bezier/g)].map(
      (m) => m[1].replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
    );
    expect(cssEases.sort()).toEqual(Object.keys(bezier).sort());
  });

  it("gives every bezier a GSAP ease name, and the linear ease is GSAP's `none`", () => {
    for (const name of Object.keys(bezier)) expect(ease).toHaveProperty(name);
    expect(ease.linear).toBe("none");
  });

  it("keeps the reduced-motion fade within the 160ms budget of docs/DESIGN.md §6.4", () => {
    expect(reducedFade).toBeLessThanOrEqual(0.16);
  });
});
