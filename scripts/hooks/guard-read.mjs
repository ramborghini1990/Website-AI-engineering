#!/usr/bin/env node
/**
 * PreToolUse hook for Read. Blocks whole-file reads of large text files; ranged reads pass.
 */
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const LIMIT_BYTES = 40_000;
const BINARY = /\.(png|jpe?g|gif|webp|avif|svg|pdf|ico|woff2?|ipynb)$/i;

let input = {};
try {
  input = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}
const { file_path: file, limit } = input.tool_input ?? {};
if (!file || limit || BINARY.test(file)) process.exit(0);
let size = 0;
try {
  // Read normally passes an absolute path; resolve a relative one against the project root.
  const abs = path.isAbsolute(file)
    ? file
    : path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), file);
  size = statSync(abs).size;
} catch {
  process.exit(0); // missing file: let Read report it
}
if (size > LIMIT_BYTES) {
  process.stderr.write(
    `Blocked by token guard: ${file} is ${Math.round(size / 1024)} KB. Grep for the symbol/heading you need, then Read with offset and limit (≤ 300 lines).\n`,
  );
  process.exit(2);
}
process.exit(0);
