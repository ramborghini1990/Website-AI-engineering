import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const isCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${String(port)}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Production build: no dev overlay, and what users actually get is what axe scans.
  webServer: {
    command: `pnpm build && pnpm start --port ${String(port)}`,
    url: `http://localhost:${String(port)}`,
    reuseExistingServer: !isCI,
    timeout: 180_000,
  },
});
