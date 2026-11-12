// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * P4.5: nothing sends telemetry from the browser, and nothing is added by
 * accident later. Vercel Web Analytics and Speed Insights are OFF (they are
 * not installed, so there is nothing to switch on); the only analytics option
 * is the cookieless, consent-free demo counters and an optional Plausible
 * origin (docs/ANALYTICS.md). The browser-side error pages carry no reporter.
 */

const srcRoot = fileURLToPath(new URL("../../", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));

const FORBIDDEN_PACKAGES =
  /^(?:@vercel\/(?:analytics|speed-insights)|@sentry\/.+|@datadog\/.+|posthog-.+|react-ga4?|@segment\/.+|mixpanel.*|@amplitude\/.+|logrocket|@fullstory\/.+|hotjar.*|@microsoft\/clarity)$/;

function sourceFiles(): string[] {
  return readdirSync(srcRoot, { recursive: true, encoding: "utf8" })
    .map((p) => p.replace(/\\/g, "/"))
    .filter((p) => /\.(?:tsx?|css|mdx?)$/.test(p) && !/\.test\./.test(p));
}
const read = (relative: string) =>
  readFileSync(new URL(`../../${relative}`, import.meta.url), "utf8");

describe("no telemetry SDK, no Vercel Analytics or Speed Insights", () => {
  it("package.json lists no analytics, session-replay or error-tracking SDK", () => {
    const pkg = JSON.parse(
      readFileSync(`${root}package.json`, "utf8"),
    ) as Record<string, Record<string, string> | undefined>;
    const names = [
      ...Object.keys(pkg["dependencies"] ?? {}),
      ...Object.keys(pkg["devDependencies"] ?? {}),
    ];

    expect(names.filter((name) => FORBIDDEN_PACKAGES.test(name))).toEqual([]);
  });

  it("no source file imports one, or loads Vercel's insights script", () => {
    const files = sourceFiles();
    expect(files).toContain("app/[locale]/layout.tsx");

    const offenders = files.filter((file) =>
      /@vercel\/(?:analytics|speed-insights)|@sentry\/|_vercel\/(?:insights|speed-insights)|vitals\.vercel-insights/.test(
        read(file),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it("the CSP never allows a Vercel insights origin", () => {
    expect(read("lib/security/csp.ts")).not.toMatch(
      /vercel-insights|vercel-scripts/,
    );
  });
});

describe("the browser-side error pages report nothing", () => {
  for (const file of ["app/global-error.tsx", "app/[locale]/error.tsx"]) {
    it(`${file}: no reporter, no logger, no console, no fetch`, () => {
      const source = read(file);

      expect(source).not.toMatch(
        /observability|@\/lib\/logger|\bconsole\.|\bfetch\(|sendBeacon|XMLHttpRequest/,
      );
    });
  }
});
