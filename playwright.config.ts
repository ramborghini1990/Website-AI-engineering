import { defineConfig, devices } from "@playwright/test";

import {
  bookingURL,
  devPort,
  devURL,
  prodPort,
  prodURL,
} from "./e2e/support/servers";

const isCI = Boolean(process.env.CI);
// Set by scripts/agent/gate.mjs: dot progress + a JSON report it summarises, instead of 500+ "list" lines.
const isAgent = process.env.AGENT_E2E === "1";
// Which web servers to start: "prod" | "dev" | "all" (default). The agent gate derives it from the
// spec files it was given, so a single production spec no longer boots `next dev` and its warm-up.
const servers = process.env.E2E_SERVERS ?? "all";
const DEV_SPECS = /(gallery|motion|fx)\.spec\.ts/; // keep in sync with scripts/agent/gate.mjs

const prodServer = {
  // Production build: no dev overlay, and what users actually get is what axe scans.
  command: `pnpm build && pnpm start --port ${String(prodPort)}`,
  // Canonical and hreflang URLs come from the configured site URL, so the
  // test server must be told its own origin (see src/lib/env.ts).
  env: {
    NEXT_PUBLIC_SITE_URL: prodURL,
    // The test server ENFORCES the CSP (the default is report-only), so a
    // script, style or request the policy would block fails these tests
    // instead of only logging a report. See e2e/security.spec.ts.
    CSP_MODE: "enforce",
    // Turns the booking section on (and its origin in the CSP). The page is
    // never reached: no request to it may happen before a click, and the
    // test that clicks intercepts the request.
    NEXT_PUBLIC_CAL_URL: bookingURL,
  },
  url: prodURL,
  reuseExistingServer: !isCI,
  timeout: 180_000,
};

const devServer = {
  // Next 16 writes dev output to .next/dev, so this can run next to `next build`.
  command: `pnpm exec next dev --port ${String(devPort)}`,
  url: devURL,
  reuseExistingServer: !isCI,
  timeout: 180_000,
};

const prodProject = {
  // What users get: the production build.
  name: "chromium",
  testIgnore: DEV_SPECS,
  use: { ...devices["Desktop Chrome"], baseURL: prodURL },
};

const devProject = {
  // The UI gallery, the motion test page and the FX showcase exist only under `next dev`
  // (they are a 404 in production).
  name: "chromium-dev",
  testMatch: DEV_SPECS,
  use: { ...devices["Desktop Chrome"], baseURL: devURL },
};

export default defineConfig({
  testDir: "./e2e",
  // Compiles each dev-only route once, sequentially, before any test (see the file).
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI
    ? [["github"], ["html", { open: "never" }]]
    : isAgent
      ? [["dot"], ["json", { outputFile: ".agent-logs/e2e-results.json" }]]
      : "list",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    ...(servers === "dev" ? [] : [prodProject]),
    ...(servers === "prod" ? [] : [devProject]),
  ],
  webServer: [
    ...(servers === "dev" ? [] : [prodServer]),
    ...(servers === "prod" ? [] : [devServer]),
  ],
});
