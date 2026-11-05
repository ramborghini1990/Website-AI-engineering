// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Static guard for CLAUDE.md §6 / §10, fast enough to run in every `pnpm test`.
 * `next build` is the real enforcement (`import "server-only"`), but it takes a
 * minute; this finds the same mistake in milliseconds and names the file.
 *
 *  1. No client module may reach a server-only module, directly or through
 *     other imports.
 *  (The rule that process.env is read only by the env modules is checked in
 *  env.process-env.test.ts and by an ESLint rule.)
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
const sourceFiles = walk(SRC).filter((file) => /\.(ts|tsx)$/.test(file));
const files = new Map(
  sourceFiles
    .filter((file) => !isTest(file))
    .map((file) => [file, readFileSync(file, "utf8")] as const),
);

type Graph = Map<string, string>;

const startsWithDirective = (source: string, directive: string) =>
  new RegExp(
    `^(\\s*(//[^\\n]*|/\\*[\\s\\S]*?\\*/)\\s*)*["']${directive}["']`,
  ).test(source);

/** Resolve an import specifier to a file in `graph`, or undefined (package or unknown). */
function resolve(
  from: string,
  specifier: string,
  graph: Graph,
): string | undefined {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(SRC, specifier.slice(2));
  else if (specifier.startsWith("."))
    base = path.resolve(path.dirname(from), specifier);
  else return undefined;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (graph.has(candidate)) return candidate;
  }
  return undefined;
}

/** Specifiers of static imports, `export ... from`, and dynamic `import("...")`. */
function importsOf(source: string): string[] {
  return [
    ...source.matchAll(
      /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/g,
    ),
    ...source.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g),
    ...source.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g),
  ].map((match) => match[1]);
}

const isServerOnly = (source: string) =>
  /^\s*import\s+["']server-only["']/m.test(source);

/**
 * For every client module, the chain of imports that reaches a server-only
 * module (empty when the code is clean). Dynamic imports count: a lazy client
 * chunk is still shipped to the browser.
 */
function serverLeaks(graph: Graph): string[] {
  const leaks: string[] = [];
  for (const [file, source] of graph) {
    if (!startsWithDirective(source, "use client")) continue;
    const seen = new Set<string>([file]);
    const queue: string[][] = [[file]];
    while (queue.length > 0) {
      const trail = queue.shift() ?? [];
      const current = trail[trail.length - 1] ?? "";
      for (const specifier of importsOf(graph.get(current) ?? "")) {
        if (specifier === "server-only") {
          leaks.push(
            trail.map((p) => path.relative(SRC, p)).join(" -> ") +
              " -> server-only",
          );
          continue;
        }
        const target = resolve(current, specifier, graph);
        if (target === undefined || seen.has(target)) continue;
        seen.add(target);
        if (isServerOnly(graph.get(target) ?? "")) {
          leaks.push(
            [...trail, target].map((p) => path.relative(SRC, p)).join(" -> "),
          );
          continue;
        }
        queue.push([...trail, target]);
      }
    }
  }
  return leaks;
}

describe("client code never reaches server-only code", () => {
  it("finds the modules it is meant to guard (not vacuous)", () => {
    const clients = [...files].filter(([, source]) =>
      startsWithDirective(source, "use client"),
    );
    const serverOnly = [...files].filter(([, source]) => isServerOnly(source));

    expect(clients.length).toBeGreaterThan(10);
    expect(serverOnly.map(([file]) => path.basename(file))).toContain("env.ts");
  });

  it("no client component imports the server env, directly or transitively", () => {
    expect(serverLeaks(files)).toEqual([]);
  });

  it("negative control: the analysis DOES catch a direct import of the server env", () => {
    const envFile = path.join(SRC, "lib", "env.ts");
    const bad = path.join(SRC, "components", "leaky.tsx");
    const graph: Graph = new Map(files);
    graph.set(
      bad,
      '"use client";\nimport { env } from "@/lib/env";\nexport const X = () => env.CSP_MODE;',
    );

    const leaks = serverLeaks(graph);

    expect(leaks).toHaveLength(1);
    expect(leaks[0]).toContain(path.join("components", "leaky.tsx"));
    expect(leaks[0]).toContain(path.relative(SRC, envFile));
  });

  it("negative control: it catches an indirect import through a shared helper", () => {
    const helper = path.join(SRC, "lib", "helper.ts");
    const bad = path.join(SRC, "components", "leaky.tsx");
    const graph: Graph = new Map(files);
    graph.set(
      helper,
      'import { env } from "./env";\nexport const x = env.NODE_ENV;',
    );
    graph.set(
      bad,
      '"use client";\nimport { x } from "@/lib/helper";\nexport const Y = x;',
    );

    expect(serverLeaks(graph)).toHaveLength(1);
  });

  it("negative control: it catches a lazy (dynamic) import and a bare server-only import", () => {
    const lazy = path.join(SRC, "components", "lazy.tsx");
    const bare = path.join(SRC, "components", "bare.tsx");
    const graph: Graph = new Map(files);
    graph.set(
      lazy,
      '"use client";\nexport const L = () => import("@/lib/env");',
    );
    graph.set(bare, '"use client";\nimport "server-only";');

    expect(serverLeaks(graph)).toHaveLength(2);
  });

  it("server components importing the env are fine (not flagged)", () => {
    const page = path.join(SRC, "app", "ok.tsx");
    const graph: Graph = new Map(files);
    graph.set(
      page,
      'import { env } from "@/lib/env";\nexport default function P() { return env.CSP_MODE; }',
    );

    expect(serverLeaks(graph)).toEqual([]);
  });
});
