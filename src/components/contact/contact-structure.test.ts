// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Executable form of the privacy and security rules for the inquiry funnel
 * (CLAUDE.md §6 and §10, docs/GDPR_CHECKLIST.md §5-§6): where code may touch
 * third parties, storage and logs.
 */

const root = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

const code = (file: string) =>
  readFileSync(path.join(root, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const production = (dirs: string[]) =>
  dirs
    .flatMap(walk)
    .filter(
      (file) => /\.(ts|tsx)$/.test(file) && !/\.test\.(ts|tsx)$/.test(file),
    );

const funnelDirs = [
  "src/components/contact",
  "src/app/[locale]/contact",
  "src/lib/inquiry",
  "src/lib/email",
  "src/lib/db",
];
const funnelFiles = [
  ...production(funnelDirs),
  "src/lib/security/rate-limit.ts",
  "src/lib/security/rate-limit.upstash.ts",
  "src/lib/security/turnstile.ts",
];

describe("the inquiry funnel keeps its promises", () => {
  it("finds the files it is meant to guard", () => {
    const names = funnelFiles.map((file) => file.replace(/\\/g, "/"));
    expect(names).toEqual(
      expect.arrayContaining([
        "src/components/contact/inquiry-form.tsx",
        "src/app/[locale]/contact/actions.ts",
        "src/lib/inquiry/process.ts",
        "src/lib/email/resend.ts",
        "src/lib/db/schema.ts",
      ]),
    );
  });

  it("writes no log line except through the redacting logger", () => {
    for (const file of funnelFiles) {
      expect(code(file), file).not.toMatch(/\bconsole\./);
    }
  });

  it("the Cloudflare script origin appears in the widget and nowhere else in the components", () => {
    const holders = production(["src/components"])
      .filter((file) => code(file).includes("challenges.cloudflare.com"))
      .map((file) => path.basename(file));

    expect(holders).toEqual(["turnstile-widget.tsx"]);
  });

  it("nothing relies on a <noscript> element: React renders no children inside it, so the text never reaches the HTML", () => {
    for (const file of production(["src/components"])) {
      expect(code(file), file).not.toMatch(/<noscript\b/);
    }
  });

  it("the form stores nothing in the browser: no cookie, localStorage or sessionStorage", () => {
    for (const file of production(["src/components/contact"])) {
      expect(code(file), file).not.toMatch(
        /localStorage|sessionStorage|document\.cookie|indexedDB/,
      );
    }
  });

  it("the browser form never imports server code: database, email, rate limiting, the orchestrator", () => {
    const form = code("src/components/contact/inquiry-form.tsx");

    for (const forbidden of [
      "@/lib/db",
      "@/lib/email",
      "@/lib/security",
      "@/lib/inquiry/process",
      "@/lib/inquiry/store",
      "@/lib/inquiry/deps",
      "@/lib/inquiry/runtime",
      "@/lib/env",
    ]) {
      expect(form, forbidden).not.toContain(forbidden);
    }
  });

  it("server-side services start with the server-only guard", () => {
    for (const file of [
      "src/lib/db/client.ts",
      "src/lib/email/resend.ts",
      "src/lib/inquiry/deps.ts",
      "src/lib/inquiry/runtime.ts",
      "src/lib/security/rate-limit.upstash.ts",
    ]) {
      expect(readFileSync(path.join(root, file), "utf8"), file).toMatch(
        /^import "server-only";/m,
      );
    }
  });

  it("the Server Action validates through the shared pipeline and never reads the environment itself", () => {
    const action = code("src/app/[locale]/contact/actions.ts");

    expect(action).toContain("processInquiry(");
    expect(action).not.toMatch(/process\.env|@\/lib\/env"/);
  });

  it("the stored record has no field for the address, the browser or the bot token", () => {
    const schema = code("src/lib/db/schema.ts");

    expect(schema).not.toMatch(
      /\b(ip|ipAddress|userAgent|turnstile|token|cookie)\b/i,
    );
  });
});
