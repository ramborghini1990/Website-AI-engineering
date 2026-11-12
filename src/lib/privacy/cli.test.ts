// @vitest-environment node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const SCRIPT = join(root, "scripts", "privacy", "dsr.mjs");

/** Runs the real command line under plain Node, as `pnpm dsr:*` does. No server, no network. */
function run(args: string[], env: Record<string, string> = {}) {
  const base = { ...process.env };
  delete base.DATABASE_URL;
  delete base.INQUIRY_RETENTION_DAYS;
  const result = spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...base, ...env },
    encoding: "utf8",
    timeout: 30_000,
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

// Each case starts a real Node process that loads the TypeScript, which is slow
// when the whole suite runs in parallel: the 5 s default is not enough.
describe("scripts/privacy/dsr.mjs", { timeout: 30_000 }, () => {
  it("loads the TypeScript under plain Node and prints the usage when asked for nothing", () => {
    const result = run([]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage:");
    expect(result.stderr).toContain("export <email>");
    expect(result.stdout).toBe("");
  });

  it("negative: without a postgres DATABASE_URL it stops before doing anything", () => {
    const cases: Array<Record<string, string>> = [
      {},
      { DATABASE_URL: "" },
      { DATABASE_URL: "https://example.eu/db" },
      { DATABASE_URL: "not a url" },
    ];
    for (const env of cases) {
      const result = run(["delete", "anna@example.it", "--confirm"], env);

      expect(result.status, JSON.stringify(env)).toBe(2);
      expect(result.stderr).toContain("DATABASE_URL");
      expect(result.stderr).not.toContain("anna@example.it");
    }
  });

  it("negative: an out-of-range INQUIRY_RETENTION_DAYS is refused", () => {
    const result = run(["export", "anna@example.it"], {
      DATABASE_URL: "postgresql://u:p@127.0.0.1:1/db",
      INQUIRY_RETENTION_DAYS: "5",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("INQUIRY_RETENTION_DAYS");
  });

  it("with an unreachable database it fails by error class, shows the host but never the password or the address", () => {
    const result = run(["delete", "anna@example.it", "--confirm"], {
      DATABASE_URL: "postgresql://someone:hunter2-synthetic@127.0.0.1:1/db",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Database host: 127.0.0.1:1");
    expect(result.stderr).toContain("Nothing was changed");
    expect(result.stderr).not.toContain("hunter2-synthetic");
    expect(result.stderr).not.toContain("someone");
    expect(result.stderr).not.toContain("anna@example.it");
    expect(result.stdout).toBe("");
  }, 30_000);

  it("a bad address is refused before any connection is tried", () => {
    const result = run(["export", "not-an-email"], {
      DATABASE_URL: "postgresql://u:p@127.0.0.1:1/db",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Not a valid email address");
  });
});

describe("wiring", () => {
  it("package.json has the two commands the procedure names", () => {
    const scripts = (
      JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
        scripts: Record<string, string>;
      }
    ).scripts;

    expect(scripts["dsr:export"]).toBe("node scripts/privacy/dsr.mjs export");
    expect(scripts["dsr:delete"]).toBe("node scripts/privacy/dsr.mjs delete");
  });

  it("vercel.json schedules the purge route daily, and that route exists", () => {
    const config = JSON.parse(
      readFileSync(join(root, "vercel.json"), "utf8"),
    ) as { crons?: Array<{ path: string; schedule: string }> };

    expect(config.crons).toHaveLength(1);
    const cron = config.crons?.at(0);
    expect(cron?.path).toBe("/api/cron/purge-expired");
    // Five fields, a fixed minute and hour, every day: once a day, never more often.
    expect(cron?.schedule).toMatch(/^\d{1,2} \d{1,2} \* \* \*$/);
    expect(
      existsSync(
        join(root, "src", "app", "api", "cron", "purge-expired", "route.ts"),
      ),
    ).toBe(true);
  });
});
