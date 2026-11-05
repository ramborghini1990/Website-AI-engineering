// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * CLAUDE.md §6: the environment is read in exactly two modules. The ESLint rule
 * (`no-restricted-syntax` in eslint.config.mjs) enforces it on every lint run;
 * this is the same check as a unit test, so it also runs under `pnpm test`.
 */

const SRC = fileURLToPath(new URL("../", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const isTest = (file: string) =>
  /\.test\.tsx?$/.test(file) ||
  file.includes(`${path.sep}test-utils${path.sep}`);

const files = new Map(
  walk(SRC)
    .filter((file) => /\.(ts|tsx)$/.test(file) && !isTest(file))
    .map((file) => [file, readFileSync(file, "utf8")] as const),
);

const ALLOWED = ["env.ts", "env.client.ts"].map((name) =>
  path.join(SRC, "lib", name),
);

const READS_ENV = /\bprocess\.env\b/;

/** Code without comments: documenting `process.env` is fine, reading it is not. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("process.env is read only by the env modules", () => {
  it("no other source file reads it", () => {
    const readers = [...files]
      .filter(
        ([file, source]) =>
          READS_ENV.test(withoutComments(source)) && !ALLOWED.includes(file),
      )
      .map(([file]) => path.relative(SRC, file));

    expect(readers).toEqual([]);
  });

  it("the two env modules are the readers (not vacuous)", () => {
    for (const file of ALLOWED) {
      expect(READS_ENV.test(withoutComments(files.get(file) ?? ""))).toBe(true);
    }
  });

  it("negative control: a read in another file IS detected; a mention in a comment is not", () => {
    const reads = (code: string) => READS_ENV.test(withoutComments(code));

    expect(reads("export const x = process.env.SECRET; // read")).toBe(true);
    expect(reads("const { env } = process;\nexport const y = env.X;")).toBe(
      false,
    ); // aliasing is not caught here: the ESLint rule and code review cover it
    expect(
      reads("// no process.env here\n/* process.env */ export const z = 1;"),
    ).toBe(false);
  });
});
