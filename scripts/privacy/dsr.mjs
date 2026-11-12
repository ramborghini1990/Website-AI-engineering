// Data subject requests by email address (P4.3, docs/DSR.md):
//   pnpm dsr:export <email> [--out <file>]    access request, art. 15 GDPR
//   pnpm dsr:delete <email> [--confirm]       erasure request, art. 17 GDPR
//
// Runs on plain Node 24 (it loads the TypeScript in src/lib/privacy natively),
// against the database named by DATABASE_URL. It never starts a server and never
// reads an env file by itself: to use the production database, pass its URL for
// this one command (docs/DSR.md §3). The email and the row contents are never
// written to stderr; the export goes to stdout or to the file given with --out.
// All decisions live in src/lib/privacy/dsr.ts, which has the tests.
import { writeFile } from "node:fs/promises";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { runDsr, USAGE } from "../../src/lib/privacy/dsr.ts";
import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
} from "../../src/lib/privacy/retention.ts";
import { createDrizzlePrivacyStore } from "../../src/lib/privacy/store.ts";

function stop(message, code) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

const args = process.argv.slice(2);
if (args[0] !== "export" && args[0] !== "delete") stop(USAGE, 2);

const databaseUrl = process.env.DATABASE_URL?.trim();
if (
  databaseUrl === undefined ||
  databaseUrl === "" ||
  !/^postgres(ql)?:\/\//.test(databaseUrl) ||
  !URL.canParse(databaseUrl)
) {
  stop(
    "DATABASE_URL is not set to a postgres:// URL. Nothing was done.\nSee docs/DSR.md §3.",
    2,
  );
}

const retentionDays = Number(
  process.env.INQUIRY_RETENTION_DAYS?.trim() || DEFAULT_RETENTION_DAYS,
);
if (
  !Number.isInteger(retentionDays) ||
  retentionDays < MIN_RETENTION_DAYS ||
  retentionDays > MAX_RETENTION_DAYS
) {
  stop(
    `INQUIRY_RETENTION_DAYS must be a whole number from ${MIN_RETENTION_DAYS} to ${MAX_RETENTION_DAYS}.`,
    2,
  );
}

// Which database this is, so a wrong DATABASE_URL is seen before --confirm. Host only: no credentials.
process.stderr.write(`Database host: ${new URL(databaseUrl).host}\n`);

const client = postgres(databaseUrl, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});

try {
  const result = await runDsr(args, {
    store: createDrizzlePrivacyStore(drizzle(client)),
    now: () => new Date(),
    retentionDays,
    // "wx": refuse to overwrite; "0o600": only the operator can read the export.
    writeFile: (path, content) =>
      writeFile(path, content, { flag: "wx", mode: 0o600 }),
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} finally {
  await client.end({ timeout: 5 });
}
