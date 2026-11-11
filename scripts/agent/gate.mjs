#!/usr/bin/env node
/**
 * Agent-facing verification commands with short output.
 *
 *   node scripts/agent/gate.mjs check [paths...]   typecheck + eslint + vitest, scoped to changed files (or paths)
 *   node scripts/agent/gate.mjs e2e [playwright args...]   chosen specs; starts only the servers they need
 *   node scripts/agent/gate.mjs full [--no-e2e]    = pnpm verify + knip + format:check + full e2e
 *
 * Every step's full output goes to .agent-logs/<step>.log. The terminal (and so Claude's
 * context) gets one line per passing step and a capped excerpt per failing step.
 * Exit code is non-zero when anything fails, so the gate is as strict as the raw commands.
 * Cross-platform (Windows PowerShell, macOS, Linux): Node built-ins only.
 */
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

const LOG_DIR = ".agent-logs";
mkdirSync(`${LOG_DIR}/scratch`, { recursive: true });

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;
const DEV_SPEC = /(gallery|motion|fx)\.spec\.ts/; // keep in sync with playwright.config.ts
const LINTABLE = /\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/;
const MAX_EXCERPT = 40;

const IS_WIN = process.platform === "win32";
// spawn(..., { shell: true }) uses cmd.exe on Windows and /bin/sh elsewhere; quote for the one in use.
const quote = (a) => {
  if (!/[\s"'&|<>^()%!]/.test(a)) return a;
  return IS_WIN
    ? `"${a.replace(/"/g, '""')}"`
    : `'${a.replace(/'/g, "'\\''")}'`;
};
// Paths in summaries are always repo-relative with forward slashes, whatever the OS.
const toPosix = (p) => p.replace(/\\/g, "/");
const rel = (p) =>
  toPosix(path.isAbsolute(p) ? path.relative(process.cwd(), p) : p);
const CWD = process.cwd();
const clean = (s) =>
  s
    .replace(ANSI, "")
    .replace(/\r/g, "")
    .split(CWD + "/")
    .join("")
    .split(CWD + "\\")
    .join("");
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

/** Run a shell command, tee everything to a log file, return {ok, code, out, ms}. */
function run(name, cmd, env = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const logPath = `${LOG_DIR}/${name}.log`;
    const log = createWriteStream(logPath);
    log.write(`$ ${cmd}\n\n`);
    let out = "";
    const child = spawn(cmd, {
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...env },
    });
    const onData = (d) => {
      const s = d.toString();
      out += s;
      log.write(s);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (code) => {
      log.end();
      resolve({
        ok: code === 0,
        code,
        out: clean(out),
        ms: Date.now() - started,
        logPath,
      });
    });
  });
}

/** Pick the lines that explain a failure, capped. */
function excerpt(step, out) {
  // Drop blank lines and stack frames from dependencies: they explain nothing and cost the most.
  const lines = out
    .split("\n")
    .filter(
      (l) =>
        l.trim() !== "" && !/^\s+at\s/.test(l) && !/❯ .*node_modules/.test(l),
    );
  let picked;
  if (step === "typecheck") {
    picked = lines.filter((l) => /error TS\d+/.test(l));
    if (picked.length > MAX_EXCERPT) {
      const n = picked.length;
      picked = [
        ...picked.slice(0, MAX_EXCERPT),
        `… ${n - MAX_EXCERPT} more TS errors`,
      ];
    }
  } else if (step.startsWith("lint")) {
    // eslint "stylish": a file path line, then indented "line:col  error  message  rule" lines
    picked = lines.filter(
      (l) =>
        /^\S.*\.(m|c)?[jt]sx?$/.test(l) ||
        /^\s+\d+:\d+\s+(error|warning)/.test(l) ||
        /problems?\s*\(/.test(l),
    );
  } else if (step.startsWith("unit")) {
    picked = lines.filter((l) =>
      /(FAIL|×|✗|AssertionError|Error:|Expected|Received|❯ .*:\d+:\d+|Test Files|Tests\s+\d)/.test(
        l,
      ),
    );
  } else {
    picked = lines.filter((l) =>
      /(error|failed|fail\b|✗|×|cannot|unexpected|warn)/i.test(l),
    );
  }
  if (picked.length === 0) picked = lines.slice(-MAX_EXCERPT);
  if (picked.length > MAX_EXCERPT + 1)
    picked = [
      ...picked.slice(0, MAX_EXCERPT),
      `… (${picked.length - MAX_EXCERPT} more lines in the log)`,
    ];
  return picked.map((l) => `    ${l.slice(0, 300)}`).join("\n");
}

function vitestCounts(out) {
  const files = out.match(/Test Files\s+(.+?)\n/);
  const tests = out.match(/\n\s*Tests\s+(.+?)\n/);
  return [
    files && `files ${files[1].trim()}`,
    tests && `tests ${tests[1].trim()}`,
  ]
    .filter(Boolean)
    .join(", ");
}

const results = [];
async function step(name, cmd, env) {
  const r = await run(name, cmd, env);
  results.push({ name, ...r });
  if (r.ok) {
    const extra = name.startsWith("unit") ? vitestCounts(r.out) : "";
    console.log(`✓ ${name} ${secs(r.ms)}${extra ? ` (${extra})` : ""}`);
  } else {
    console.log(
      `✗ ${name} exit ${r.code} ${secs(r.ms)} · full log: ${r.logPath}`,
    );
    if (!name.startsWith("e2e")) console.log(excerpt(name, r.out));
  }
  return r;
}

function changedFiles() {
  try {
    const opts = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };
    const tracked = execSync(
      "git diff --name-only --diff-filter=ACMR HEAD",
      opts,
    );
    const untracked = execSync(
      "git ls-files --others --exclude-standard",
      opts,
    );
    return [
      ...new Set(
        `${tracked}\n${untracked}`
          .split("\n")
          .map((s) => toPosix(s.trim()))
          .filter(Boolean),
      ),
    ].filter((f) => existsSync(f));
  } catch {
    return null; // not a git checkout: caller falls back to the whole project
  }
}

// ---------- Playwright summary ----------
function summariseE2E(jsonPath, r) {
  if (!existsSync(jsonPath)) {
    console.log(
      "  no JSON report (the run did not start: web server or config error). Excerpt:",
    );
    console.log(excerpt("e2e", r.out));
    return;
  }
  const report = JSON.parse(readFileSync(jsonPath, "utf8"));
  const s = report.stats ?? {};
  console.log(
    `  e2e: ${s.expected ?? 0} passed, ${s.unexpected ?? 0} failed, ${s.flaky ?? 0} flaky, ${s.skipped ?? 0} skipped in ${secs(s.duration ?? 0)}`,
  );
  const bad = [];
  const walk = (suite, trail) => {
    const here =
      suite.title && !/\.spec\.ts$/.test(suite.title)
        ? [...trail, suite.title]
        : trail;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        if (t.status === "unexpected" || t.status === "flaky") {
          const last =
            [...(t.results ?? [])]
              .reverse()
              .find((x) => x.error || x.errors?.length) ?? {};
          const err = last.error ?? last.errors?.[0] ?? {};
          bad.push({
            status: t.status,
            where: `${rel(spec.file)}:${spec.line}`,
            project: t.projectName,
            title: [...here, spec.title].join(" › "),
            message: clean(err.message ?? "(no message)")
              .split("Call log:")[0]
              .split("\n")
              .filter((l) => l.trim())
              .slice(0, 8),
            loc: err.location
              ? `${rel(err.location.file)}:${err.location.line}`
              : "",
          });
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  for (const e of report.errors ?? [])
    bad.push({
      status: "error",
      where: "(global)",
      project: "",
      title: "run error",
      message: clean(e.message ?? "")
        .split("\n")
        .slice(0, 10),
      loc: "",
    });

  const shown = bad.slice(0, 15);
  for (const b of shown) {
    console.log(
      `  ${b.status === "flaky" ? "~ FLAKY" : "✗"} [${b.project}] ${b.where} › ${b.title}${b.loc ? `  (at ${b.loc})` : ""}`,
    );
    for (const l of b.message) console.log(`      ${l.slice(0, 240)}`);
  }
  if (bad.length > shown.length)
    console.log(
      `  … ${bad.length - shown.length} more; Grep "\\"status\\": \\"unexpected\\"" ${jsonPath}`,
    );
  if ((s.unexpected ?? 0) > 0)
    console.log(
      "  next: fix, then `pnpm agent:e2e --last-failed` (not the full suite)",
    );
}

async function e2e(rawArgs) {
  // Playwright reads file filters as regexes over forward-slash paths, so `e2e\home.spec.ts`
  // (Windows tab-completion) must become `e2e/home.spec.ts`. Values of -g/--grep are left alone.
  const VALUE_FLAGS = new Set([
    "-g",
    "--grep",
    "--grep-invert",
    "--project",
    "-j",
    "--workers",
    "--reporter",
    "--repeat-each",
    "--retries",
    "--timeout",
    "--shard",
  ]);
  const args = rawArgs.map((a, i) =>
    !a.startsWith("-") &&
    !VALUE_FLAGS.has(rawArgs[i - 1] ?? "") &&
    /spec|e2e[\\/]/.test(a)
      ? toPosix(a)
      : a,
  );
  const specArgs = args.filter(
    (a) => !a.startsWith("-") && /spec|e2e[\\/]/.test(a),
  );
  let servers = "all";
  if (specArgs.length && !args.includes("--last-failed")) {
    const dev = specArgs.some((a) => DEV_SPEC.test(a));
    const prod = specArgs.some((a) => !DEV_SPEC.test(a));
    servers = dev && prod ? "all" : dev ? "dev" : "prod";
  }
  const jsonPath = `${LOG_DIR}/e2e-results.json`;
  rmSync(jsonPath, { force: true }); // a stale report must never be summarised as this run
  const r = await step(
    "e2e",
    ["pnpm exec playwright test", ...args.map(quote)].join(" "),
    { AGENT_E2E: "1", E2E_SERVERS: servers },
  );
  summariseE2E(jsonPath, r);
  return r;
}

async function check(paths) {
  let lintTargets;
  let unitCmd;
  if (paths.length) {
    lintTargets = paths.map(toPosix);
    unitCmd = `pnpm exec vitest run --passWithNoTests ${paths.map(quote).join(" ")}`;
  } else {
    const changed = changedFiles();
    if (changed === null) {
      lintTargets = ["."];
      unitCmd = "pnpm exec vitest run";
    } else {
      lintTargets = changed.filter((f) => LINTABLE.test(f));
      const src = changed.filter(
        (f) => f.startsWith("src/") && LINTABLE.test(f),
      );
      unitCmd = src.length
        ? `pnpm exec vitest related --run --passWithNoTests ${src.map(quote).join(" ")}`
        : null;
      console.log(
        `  scope: ${changed.length} changed file(s), ${lintTargets.length} lintable, ${src.length} under src/`,
      );
    }
  }
  await step("typecheck", "pnpm typecheck");
  if (lintTargets.length)
    await step(
      "lint",
      `pnpm exec eslint --max-warnings=0 --no-warn-ignored ${lintTargets.map(quote).join(" ")}`,
    );
  else console.log("- lint skipped (no lintable changes)");
  if (unitCmd) await step("unit", unitCmd);
  else console.log("- unit skipped (no changes under src/)");
}

async function full(flags) {
  // Same checks as `pnpm verify` + CI's knip/format, run step by step so each has its own log.
  for (const [name, cmd] of [
    ["typecheck", "pnpm typecheck"],
    ["lint", "pnpm lint"],
    ["unit", "pnpm test"],
    ["knip", "pnpm knip"],
    ["format", "pnpm format:check"],
  ]) {
    await step(name, cmd);
  }
  if (results.some((r) => !r.ok)) {
    console.log("- build and e2e skipped: fix the failures above first");
    return;
  }
  const b = await step("build", "pnpm build");
  if (b.ok && !flags.includes("--no-e2e")) await e2e([]);
}

const [mode, ...rest] = process.argv.slice(2);
const started = Date.now();
if (mode === "check") await check(rest);
else if (mode === "e2e") await e2e(rest);
else if (mode === "full") await full(rest);
else {
  console.error(
    "usage: gate.mjs check [paths...] | e2e [playwright args...] | full [--no-e2e]",
  );
  process.exit(2);
}
const failed = results.filter((r) => !r.ok).map((r) => r.name);
const verdict = failed.length ? `FAIL (${failed.join(", ")})` : "PASS";
const line = `${mode.toUpperCase()} ${verdict} in ${secs(Date.now() - started)}`;
console.log(line);
writeFileSync(
  `${LOG_DIR}/last-${mode}.txt`,
  `${new Date().toISOString()} ${line}\n`,
);
process.exit(failed.length ? 1 : 0);
