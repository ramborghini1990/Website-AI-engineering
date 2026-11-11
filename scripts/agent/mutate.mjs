#!/usr/bin/env node
/**
 * Scripted mutation checks ("prove the gate"): apply one source mutation at a time,
 * run the check that must catch it, restore the file. Prints one line per mutation.
 *
 *   node scripts/agent/mutate.mjs scripts/agent/mutations/P3.1.json
 *
 * JSON: [{ "id": "demo-no-fetch", "file": "src/lib/demos/instagram/engine.ts",
 *          "find": "exact text (must occur once)", "replace": "mutated text",
 *          "check": "pnpm exec vitest run src/lib/demos/structure.test.ts" }]
 * "check" may be any command (e.g. "pnpm build" for the env/client guard).
 * Exit 1 if any mutation SURVIVES (its check still passed), 2 on a bad spec.
 * Originals are backed up first and restored on exit, Ctrl+C, or the next run after a crash.
 */
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const LOG_DIR = ".agent-logs/mutate";
const BACKUP = `${LOG_DIR}/backup`;
mkdirSync(BACKUP, { recursive: true });
// Backup names are the repo-relative POSIX path, URL-encoded, so a spec written with
// "src/a.ts" or "src\\a.ts" maps to the same backup on Windows and elsewhere.
const norm = (f) =>
  path.relative(process.cwd(), path.resolve(f)).replace(/\\/g, "/");
const enc = (f) => encodeURIComponent(norm(f));

// Crash recovery: restore anything a previous run left mutated.
for (const b of readdirSync(BACKUP)) {
  const file = path.resolve(decodeURIComponent(b));
  writeFileSync(file, readFileSync(`${BACKUP}/${b}`));
  rmSync(`${BACKUP}/${b}`);
  console.log(`restored ${file} from an interrupted run`);
}

const specPath = process.argv[2];
if (!specPath || !existsSync(specPath)) {
  console.error("usage: mutate.mjs <mutations.json>");
  process.exit(2);
}
const mutations = JSON.parse(readFileSync(specPath, "utf8"));

let current = null;
const restore = () => {
  if (!current) return;
  writeFileSync(current.file, current.original);
  rmSync(`${BACKUP}/${enc(current.file)}`, { force: true });
  current = null;
};
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
process.on("exit", restore);

let survived = 0;
for (const m of mutations) {
  m.file = path.resolve(m.file);
  const original = readFileSync(m.file, "utf8");
  const hits = original.split(m.find).length - 1;
  if (hits !== 1) {
    console.log(
      `! ${m.id}: "find" occurs ${hits} times in ${norm(m.file)} (must be exactly 1)`,
    );
    process.exitCode = 2;
    continue;
  }
  writeFileSync(`${BACKUP}/${enc(m.file)}`, original);
  current = { file: m.file, original };
  writeFileSync(m.file, original.replace(m.find, m.replace));
  const t = Date.now();
  const r = spawnSync(m.check, {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  writeFileSync(
    `${LOG_DIR}/${m.id}.log`,
    `$ ${m.check}\n\n${r.stdout ?? ""}${r.stderr ?? ""}`,
  );
  restore();
  const killed = r.status !== 0;
  if (!killed) survived++;
  console.log(
    `${killed ? "✓ killed  " : "✗ SURVIVED"} ${m.id} (${((Date.now() - t) / 1000).toFixed(1)}s)${killed ? "" : ` · log ${LOG_DIR}/${m.id}.log`}`,
  );
}
console.log(`${mutations.length} mutations, ${survived} survived`);
if (survived) process.exitCode = 1;
