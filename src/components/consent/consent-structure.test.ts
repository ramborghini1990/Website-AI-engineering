// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { consentCategories, thirdParties } from "@/lib/consent/registry";

/**
 * CLAUDE.md §10 as a gate: third-party scripts and embeds load only through
 * `<ConsentGate>`, and every third party is registered (so the cookie and
 * privacy notices, P4.2, can be generated from one list).
 */

const root = process.cwd();
const walk = (dir: string): string[] =>
  readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });

const production = walk("src").filter(
  (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
);
const code = (file: string) =>
  readFileSync(path.join(root, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const norm = (file: string) => file.replace(/\\/g, "/");

describe("third parties are gated and registered", () => {
  it("finds the files it is meant to guard", () => {
    const names = production.map(norm);
    expect(names).toEqual(
      expect.arrayContaining([
        "src/components/consent/consent-gate.tsx",
        "src/components/booking/cal-embed.tsx",
        "src/components/contact/booking-section.tsx",
      ]),
    );
  });

  it("an <iframe> exists only in the booking embed", () => {
    const holders = production
      .filter((file) => /<iframe\b/.test(code(file)))
      .map(norm);

    expect(holders).toEqual(["src/components/booking/cal-embed.tsx"]);
  });

  it("the embed is only ever a child of <ConsentGate>", () => {
    const users = production
      .filter((file) => /<CalEmbed\b/.test(code(file)))
      .map(norm);

    expect(users).toEqual(["src/components/contact/booking-section.tsx"]);
    expect(code("src/components/contact/booking-section.tsx")).toMatch(
      /<ConsentGate[\s\S]*<CalEmbed[\s\S]*<\/ConsentGate>/,
    );
  });

  it("next/script is not used anywhere: a third-party script needs a decision, a gate and a registry entry", () => {
    for (const file of production) {
      expect(code(file), file).not.toMatch(/next\/script|<Script\b/);
    }
  });

  it("no component or page hard-codes a booking provider URL: it comes from the validated environment (negative)", () => {
    for (const file of production) {
      expect(code(file), file).not.toMatch(
        /https?:\/\/(?:app\.)?cal\.(?:eu|com)/,
      );
    }
  });

  it("the gate keeps the choice nowhere: no cookie, localStorage or sessionStorage", () => {
    expect(code("src/components/consent/consent-gate.tsx")).not.toMatch(
      /localStorage|sessionStorage|document\.cookie|indexedDB/,
    );
  });

  it("every category used with a gate is registered, and every registered third party uses a known category", () => {
    for (const file of production) {
      for (const match of code(file).matchAll(
        /<ConsentGate[^>]*?category="([a-z-]+)"/g,
      )) {
        expect(
          consentCategories as readonly string[],
          `${file}: ${match[1]}`,
        ).toContain(match[1]);
      }
    }
    for (const party of thirdParties) {
      expect(consentCategories as readonly string[]).toContain(party.category);
    }
    expect(new Set(thirdParties.map((party) => party.id)).size).toBe(
      thirdParties.length,
    );
  });

  it("every registered third party loads on the visitor's click and names its CSP rule and what it receives", () => {
    expect(thirdParties.length).toBeGreaterThan(0);
    for (const party of thirdParties) {
      expect(party.trigger).toBe("visitor-click");
      expect(party.dataSent.length).toBeGreaterThan(0);
      expect(party.csp.directive).toBe("frame-src");
    }
  });
});
