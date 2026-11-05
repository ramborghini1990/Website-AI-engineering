// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { publicEnvKeys } from "@/lib/env-schema";

/**
 * The two modules that touch `process.env`, loaded for real against a
 * controlled environment. Each test starts from a clean module registry so the
 * import-time validation runs again.
 */

// (`resetModules` re-imports env-schema too, so `instanceof EnvValidationError` would
// compare two different copies of the class: assert on the error's name instead.)
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** A clean slate: every declared variable unset, then the test's own values. */
function stub(values: Record<string, string>) {
  for (const key of [
    ...publicEnvKeys,
    "NODE_ENV",
    "NEXT_PHASE",
    "SKIP_ENV_VALIDATION",
    "CSP_MODE",
    "DEMOS_LIVE_ENABLED",
    "ANTHROPIC_API_KEY",
    "DATABASE_URL",
    "VERCEL_ENV",
    "VERCEL_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
  ]) {
    vi.stubEnv(key, undefined);
  }
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
}

const loadServerEnv = () => import("@/lib/env");
const loadPublicEnv = () => import("@/lib/env.client");

describe("src/lib/env.ts (server)", () => {
  it("validates at import and exports the typed env, the dev flag and the site URL", async () => {
    stub({ NODE_ENV: "test", NEXT_PUBLIC_SITE_URL: "https://www.example.eu" });

    const { env, isDevelopment, siteUrl } = await loadServerEnv();

    expect(env.CSP_MODE).toBe("report-only");
    expect(isDevelopment).toBe(false);
    expect(siteUrl.origin).toBe("https://www.example.eu");
  });

  it("isDevelopment is true only for NODE_ENV=development", async () => {
    stub({ NODE_ENV: "development" });

    expect((await loadServerEnv()).isDevelopment).toBe(true);
  });

  it("an invalid variable makes the import FAIL (which is what fails `next build`) (negative)", async () => {
    stub({ NODE_ENV: "test", NEXT_PUBLIC_SITE_URL: "not a url" });

    await expect(loadServerEnv()).rejects.toMatchObject({
      name: "EnvValidationError",
    });
    await expect(loadServerEnv()).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("a half-configured service fails the import, naming what is missing (negative)", async () => {
    stub({ NODE_ENV: "test", DEMOS_LIVE_ENABLED: "true" });

    await expect(loadServerEnv()).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  describe("SKIP_ENV_VALIDATION", () => {
    const broken = { NEXT_PUBLIC_SITE_URL: "not a url", DATABASE_URL: "nope" };

    it("lets `next build` through with a broken environment, dropping the bad values", async () => {
      stub({
        NODE_ENV: "test",
        SKIP_ENV_VALIDATION: "1",
        NEXT_PHASE: "phase-production-build",
        ...broken,
      });

      const { env, siteUrl } = await loadServerEnv();

      expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
      expect(env.DATABASE_URL).toBeUndefined();
      expect(siteUrl.origin).toBe("http://localhost:3000"); // falls back, never emits garbage
    });

    it("is IGNORED at runtime: the same flag does not rescue a broken production start (negative)", async () => {
      stub({
        NODE_ENV: "test",
        SKIP_ENV_VALIDATION: "1",
        NEXT_PHASE: "phase-production-server",
        ...broken,
      });

      await expect(loadServerEnv()).rejects.toMatchObject({
        name: "EnvValidationError",
      });
    });

    it("is ignored when NEXT_PHASE is not set at all (negative)", async () => {
      stub({ NODE_ENV: "test", SKIP_ENV_VALIDATION: "true", ...broken });

      await expect(loadServerEnv()).rejects.toMatchObject({
        name: "EnvValidationError",
      });
    });
  });
});

describe("src/lib/env.client.ts (browser)", () => {
  it("exposes the public variables and nothing else", async () => {
    stub({
      NEXT_PUBLIC_SITE_URL: "https://www.example.eu",
      DATABASE_URL: "postgresql://user:pass@localhost/db",
      ANTHROPIC_API_KEY: "synthetic-secret",
    });

    const { publicEnv } = await loadPublicEnv();

    expect(publicEnv.NEXT_PUBLIC_SITE_URL).toBe("https://www.example.eu");
    expect(Object.keys(publicEnv).sort()).toEqual([...publicEnvKeys].sort());
    expect(JSON.stringify(publicEnv)).not.toContain("synthetic-secret");
    expect(JSON.stringify(publicEnv)).not.toContain("postgresql");
  });

  it("never throws in the browser: a bad value is dropped", async () => {
    stub({ NEXT_PUBLIC_SITE_URL: "not a url" });

    expect(
      (await loadPublicEnv()).publicEnv.NEXT_PUBLIC_SITE_URL,
    ).toBeUndefined();
  });

  it("references every public variable LITERALLY (Next only inlines `process.env.NEXT_PUBLIC_X`, never a dynamic lookup)", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./env.client.ts", import.meta.url)),
      "utf8",
    );

    for (const key of publicEnvKeys) {
      expect(source, key).toContain(`process.env.${key}`);
    }
    expect(source).not.toMatch(/process\.env\[/);
    expect(source).not.toMatch(/process\.env[^.]/);
  });

  it("does not import the server module, directly or by name", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./env.client.ts", import.meta.url)),
      "utf8",
    );

    expect(source).not.toMatch(/from ["']@\/lib\/env["']/);
    expect(source).not.toContain("server-only");
  });
});

describe("the server module is guarded", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./env.ts", import.meta.url)),
    "utf8",
  );

  it('starts with `import "server-only"`, so a client import is a build error', () => {
    expect(source.trimStart().startsWith('import "server-only";')).toBe(true);
  });
});
