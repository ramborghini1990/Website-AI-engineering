import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    // Seeded/mocked inputs only: no real network in unit tests (CLAUDE.md §11).
    restoreMocks: true,
    // next-intl's middleware imports `next/server` without a file extension,
    // which Node's strict ESM resolver rejects; let Vite resolve it instead.
    server: { deps: { inline: ["next-intl"] } },
  },
});
