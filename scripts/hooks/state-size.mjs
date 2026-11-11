#!/usr/bin/env node
/**
 * Keeps PROJECT_STATE.md small (it is imported into every session).
 *   - PostToolUse hook for Edit|Write|MultiEdit: warns Claude (exit 2) when the file passes the cap.
 *   - CLI: `node scripts/hooks/state-size.mjs --cli` (exit 1 over the cap), e.g. as `pnpm state:check`.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CAP = 8 * 1024;
// Repo root = two levels above scripts/hooks/, so the CLI works from any cwd (and on Windows).
const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const FILE = path.join(ROOT, "PROJECT_STATE.md");
const cli = process.argv.includes("--cli");

if (!cli) {
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    process.exit(0);
  }
  const file = String(input.tool_input?.file_path ?? "");
  if (!/(^|[\\/])PROJECT_STATE\.md$/.test(file)) process.exit(0);
  const abs = path.isAbsolute(file)
    ? file
    : path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), file);
  const size = existsSync(abs) ? statSync(abs).size : 0;
  if (size > CAP) {
    process.stderr.write(
      `PROJECT_STATE.md is ${(size / 1024).toFixed(1)} KB (cap 8 KB). Move task history to docs/state/tasks/<TASK>.md and decisions to docs/state/DECISIONS.md, then trim this file.\n`,
    );
    process.exit(2);
  }
  process.exit(0);
}

const size = existsSync(FILE) ? statSync(FILE).size : 0;
console.log(
  `PROJECT_STATE.md: ${(size / 1024).toFixed(1)} KB (cap ${CAP / 1024} KB)`,
);
process.exit(size > CAP ? 1 : 0);
