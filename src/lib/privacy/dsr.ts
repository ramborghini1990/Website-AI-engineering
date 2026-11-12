import { z } from "zod";

import { deletionDate } from "./retention.ts";
import { normalizeEmail, type PrivacyStore } from "./store.ts";

/**
 * Data subject requests by email address (P4.3): `export` answers an access
 * request (art. 15 GDPR), `delete` an erasure request (art. 17). The command
 * line (`scripts/privacy/dsr.mjs`) only supplies the database and the terminal;
 * everything decided here is testable without either.
 *
 * Rules the code keeps:
 * - Only `inquiries` rows are read or removed (see `store.ts`). Consent receipts
 *   are anonymous proof and stay.
 * - `delete` does nothing without `--confirm`: the first run is a count.
 * - The address and the row contents never go to stderr: it carries counts and
 *   instructions only. The export document goes to stdout or to `--out`.
 * - A database error is reported by its class only: its message can quote the
 *   query parameters, which include the address.
 *
 * Relative imports with `.ts`: plain Node loads this file (see `store.ts`).
 */

export const USAGE = [
  "Usage:",
  "  dsr export <email> [--out <file>]   access request (art. 15): the inquiries stored for this address, as JSON",
  "  dsr delete <email> [--confirm]      erasure request (art. 17): without --confirm only counts, with it deletes",
  "",
  "Only inquiries are read or deleted. Consent receipts are kept as proof (art. 7(1)).",
  "Needs DATABASE_URL in the environment (the database the rows are in).",
].join("\n");

export type DsrDeps = {
  store: PrivacyStore;
  now: () => Date;
  /** Shown to the person as when each row would be deleted anyway. */
  retentionDays: number;
  /** Writes a NEW file (fails if it exists). Only used by `export --out`. */
  writeFile: (path: string, content: string) => Promise<void>;
};

export type DsrResult = {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
};

/** What the tool does not cover. Printed after every export and delete. */
const NOT_COVERED = [
  "Not covered by this tool (do these by hand, docs/DSR.md §4):",
  "  - the notification emails in the inbox that receives inquiries, and the provider's sent-mail log",
  "  - a booking made through the calendar provider",
  "  - database backups (they age out at the provider's retention period)",
].join("\n");

const emailSchema = z.email().max(254);

const fail = (exitCode: 1 | 2, message: string): DsrResult => ({
  exitCode,
  stdout: "",
  stderr: `${message}\n`,
});

const errorClass = (error: unknown): string =>
  error instanceof Error ? error.name : typeof error;

type Parsed =
  | { ok: true; command: "export"; email: string; out: string | undefined }
  | { ok: true; command: "delete"; email: string; confirm: boolean }
  | { ok: false; message: string };

function parse(argv: readonly string[]): Parsed {
  const command = argv.at(0);
  const address = argv.at(1);
  const flags = argv.slice(2);
  if (command !== "export" && command !== "delete") {
    return { ok: false, message: USAGE };
  }
  const email = emailSchema.safeParse(address?.trim());
  if (!email.success) {
    return { ok: false, message: `Not a valid email address.\n\n${USAGE}` };
  }

  let out: string | undefined;
  let confirm = false;
  for (let i = 0; i < flags.length; i += 1) {
    const flag = flags[i];
    if (command === "delete" && flag === "--confirm" && !confirm) {
      confirm = true;
    } else if (
      command === "export" &&
      flag === "--out" &&
      out === undefined &&
      i + 1 < flags.length
    ) {
      out = flags[i + 1];
      i += 1;
    } else {
      return { ok: false, message: `Unknown or repeated option.\n\n${USAGE}` };
    }
  }

  return command === "export"
    ? { ok: true, command, email: email.data, out }
    : { ok: true, command, email: email.data, confirm };
}

export async function runDsr(
  argv: readonly string[],
  deps: DsrDeps,
): Promise<DsrResult> {
  const args = parse(argv);
  if (!args.ok) return fail(2, args.message);

  try {
    if (args.command === "export") return await exportInquiries(args, deps);
    return await deleteInquiries(args, deps);
  } catch (error) {
    return fail(1, `Failed (${errorClass(error)}). Nothing was changed.`);
  }
}

async function exportInquiries(
  args: { email: string; out: string | undefined },
  deps: DsrDeps,
): Promise<DsrResult> {
  const rows = await deps.store.findByEmail(args.email);
  const document = {
    generatedAt: deps.now().toISOString(),
    subject: normalizeEmail(args.email),
    inquiries: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      deletionDue: deletionDate(
        row.createdAt,
        deps.retentionDays,
      ).toISOString(),
      locale: row.locale,
      need: row.need,
      description: row.description,
      budget: row.budget,
      timeline: row.timeline,
      name: row.name,
      email: row.email,
      company: row.company,
      marketingConsent: row.marketingConsent,
      consentVersion: row.consentVersion,
      status: row.status,
    })),
    notes: [
      "Consent receipts (cookie choices) are anonymous: they hold no email or other identifier, so none can be tied to this address and none is included.",
      "deletionDue is when the scheduled purge deletes the row; you can ask for earlier erasure.",
    ],
  };
  const json = `${JSON.stringify(document, null, 2)}\n`;
  const summary = `${String(rows.length)} inquiry row(s) found.`;

  if (args.out === undefined) {
    return {
      exitCode: 0,
      stdout: json,
      stderr: `${summary}\n${NOT_COVERED}\n`,
    };
  }
  try {
    await deps.writeFile(args.out, json);
  } catch {
    return fail(
      1,
      "Could not write the output file (it must not exist yet). Nothing was exported.",
    );
  }
  return {
    exitCode: 0,
    stdout: "",
    stderr: `${summary} Written to the file given with --out.\n${NOT_COVERED}\n`,
  };
}

async function deleteInquiries(
  args: { email: string; confirm: boolean },
  deps: DsrDeps,
): Promise<DsrResult> {
  if (!args.confirm) {
    const found = await deps.store.findByEmail(args.email);
    return {
      exitCode: 0,
      stdout: "",
      stderr: `Dry run: ${String(found.length)} inquiry row(s) would be deleted. Export them first if the person asked for a copy, then run again with --confirm.\n`,
    };
  }
  const deleted = await deps.store.deleteByEmail(args.email);
  return {
    exitCode: 0,
    stdout: "",
    stderr: `Deleted ${String(deleted)} inquiry row(s). Consent receipts were not touched.\n${NOT_COVERED}\n`,
  };
}
