#!/usr/bin/env node
/**
 * PreToolUse hook for Bash and PowerShell. Blocks the commands that flood Claude's context
 * and tells it what to run instead (exit 2 = block, stderr goes back to Claude).
 * Override for one command, only when the user explicitly asked for raw output:
 * append the comment `# agent-allow`.
 */
import { readFileSync } from "node:fs";

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0); // never break the session on a malformed payload
}
const cmd = String(input.tool_input?.command ?? "");
if (!cmd || /#\s*agent-allow\b/.test(cmd)) process.exit(0);

const rules = [
  [
    /\bgrep\s+(-[a-zA-Z]*[rR]|--recursive)|\brg\s|\bfind\s+\.(\s|$)|\bls\s+-[a-zA-Z]*R|\btree\b|\bdir\s+\/s\b/i,
    "Repo-wide shell search. Use the Grep tool (with `path` and `glob`) or Glob instead: they skip node_modules, .next and gitignored files.",
  ],
  [
    /Get-ChildItem\b[^|;]*-Recurse|\bgci\b[^|;]*-r\b|\bls\b[^|;]*-Recurse|Select-String\b[^|;]*-Recurse/i,
    "Recursive PowerShell listing/search. Use the Grep or Glob tool with a path and glob.",
  ],
  [
    /\bpnpm\s+(run\s+)?(verify|build)\b|\bnext\s+build\b/,
    "Use `pnpm agent:gate` (end of task) or `pnpm agent:check` (during work). Full output is in .agent-logs/.",
  ],
  [
    /\bpnpm\s+(run\s+)?test(:watch)?(\s|$)|(^|[;&|]\s*|\bexec\s+)vitest(\s|$)/,
    "Use `pnpm agent:check` (changed files) or `pnpm agent:check <path>` (scoped). Watch mode never ends.",
  ],
  [
    /\bpnpm\s+(run\s+)?test:e2e\b|\bplaywright\s+test\b/,
    "Use `pnpm agent:e2e <spec files>` or `pnpm agent:e2e --last-failed`. The full suite runs only inside `pnpm agent:gate`.",
  ],
  [/\bnpx\s/, "Use `pnpm exec` (CLAUDE.md §4); never npm/npx."],
  [
    /Start-Process[^|;]*(pnpm|node|next)|\bnohup\b|\bpnpm\s+(start|dev)\b.*&\s*$/i,
    "Don't start servers by hand: Playwright's webServer starts and stops them (`pnpm agent:e2e`).",
  ],
  [
    /\b(cat|type|Get-Content|gc|more|less)\s+[^|;]*(PROJECT_STATE|DECISIONS\.md|messages[\\/]|DESIGN\.md|pnpm-lock|\.agent-logs[\\/].*\.(log|json))/i,
    "Large file. Grep for what you need, then Read with offset/limit.",
  ],
];

for (const [re, msg] of rules) {
  if (re.test(cmd)) {
    process.stderr.write(
      `Blocked by token guard: ${msg}\n(If the user explicitly asked for this exact command, append \`# agent-allow\`.)\n`,
    );
    process.exit(2);
  }
}
process.exit(0);
