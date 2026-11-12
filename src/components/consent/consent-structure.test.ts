// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  consentCategories,
  storedKeys,
  thirdParties,
} from "@/lib/consent/registry";

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

  it("the gate itself writes nothing: no cookie, localStorage or sessionStorage (the choice lives in lib/consent/client.ts)", () => {
    expect(code("src/components/consent/consent-gate.tsx")).not.toMatch(
      /localStorage|sessionStorage|document\.cookie|indexedDB/,
    );
  });

  it("only the consent client touches document.cookie, and browser storage is used only by the theme and the business demo: nothing is stored that the cookie policy would not list", () => {
    const cookieUsers = production
      .filter((file) => /document\.cookie/.test(code(file)))
      .map(norm);
    expect(cookieUsers).toEqual(["src/lib/consent/client.ts"]);

    const storageUsers = production
      .filter(
        (file) =>
          // the registry only NAMES the kind of key it lists
          norm(file) !== "src/lib/consent/registry.ts" &&
          /\b(?:localStorage|sessionStorage|indexedDB)\b/.test(code(file)),
      )
      .map(norm)
      .sort();
    // 'only the theme' above is now: the theme and the business demo's own database
    expect(storageUsers).toEqual([
      "src/lib/demos/business/storage.ts",
      "src/lib/theme.ts",
    ]);

    // every key the registry lists names a file that really is the one using it
    for (const key of storedKeys) {
      expect(production.map(norm), key.name).toContain(key.owner);
    }
    expect(storedKeys.map((key) => key.name).sort()).toEqual([
      "consent",
      "demo-business-suite",
      "theme",
    ]);
  });

  it("the banner has no scroll, wheel or global click handler: scrolling is never consent", () => {
    for (const file of production.filter((name) =>
      norm(name).startsWith("src/components/consent/"),
    )) {
      expect(code(file), file).not.toMatch(
        /["'](?:scroll|wheel|touchmove|beforeunload|visibilitychange)["']|onScroll|IntersectionObserver/,
      );
    }
    expect(code("src/lib/consent/client.ts")).not.toMatch(
      /["'](?:scroll|wheel|touchmove|click)["']/,
    );
  });

  it("every registered category has its text in the banner, in both languages", () => {
    for (const locale of ["it", "en"]) {
      const messages = JSON.parse(
        readFileSync(path.join(root, `messages/${locale}.json`), "utf8"),
      ) as {
        consent: { categories: Partial<Record<string, { label: string }>> };
      };
      for (const category of consentCategories) {
        expect(
          messages.consent.categories[category]?.label,
          `${locale}: ${category}`,
        ).toBeTruthy();
      }
    }
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

  it("every registered third party loads only on the visitor's act (a click, or a stored yes) and names its CSP rule and what it receives", () => {
    expect(thirdParties.length).toBeGreaterThan(0);
    for (const party of thirdParties) {
      expect(["visitor-click", "stored-consent"]).toContain(party.trigger);
      expect(party.dataSent.length).toBeGreaterThan(0);
      expect(party.csp.directive).toBe("frame-src");
    }
  });
});
