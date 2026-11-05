import { defineConfig, devices } from "@playwright/test";

const prodPort = 3100;
const devPort = 3200;
const prodURL = `http://localhost:${String(prodPort)}`;
const devURL = `http://localhost:${String(devPort)}`;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      // What users get: the production build.
      name: "chromium",
      testIgnore: /gallery\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: prodURL },
    },
    {
      // The UI gallery exists only under `next dev` (it is a 404 in production).
      name: "chromium-dev",
      testMatch: /gallery\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: devURL },
    },
  ],
  webServer: [
    {
      // Production build: no dev overlay, and what users actually get is what axe scans.
      command: `pnpm build && pnpm start --port ${String(prodPort)}`,
      url: prodURL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
    {
      // Next 16 writes dev output to .next/dev, so this can run next to `next build`.
      command: `pnpm exec next dev --port ${String(devPort)}`,
      url: devURL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  ],
});
