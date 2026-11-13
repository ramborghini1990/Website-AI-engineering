// @vitest-environment node
// Guards the supply-chain properties of the CI workflows (P4.6): pinned
// actions, least privilege, bounded jobs, and that the status checks named in
// docs/DEPLOYMENT.md (branch protection) are the ones the workflows produce.
// Text-based on purpose: no YAML dependency, and the files are small and flat.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../${path}`, import.meta.url)),
    "utf8",
  );

const lines = (text: string) => text.split(/\r?\n/);

/** `uses:` values that are not `owner/repo@<40 hex> # vX` (local and docker refs included). */
function unpinnedActions(workflow: string): string[] {
  return lines(workflow)
    .filter((l) => /^\s*-?\s*uses:/.test(l))
    .filter(
      (l) =>
        !/^\s*-?\s*uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d/.test(l),
    );
}

interface Job {
  id: string;
  name: string | undefined;
  runsOn: string | undefined;
  hasTimeout: boolean;
  body: string;
}

/** Jobs of a flat workflow: ids sit at two-space indent under `jobs:`. */
function jobsOf(workflow: string): Job[] {
  const all = lines(workflow);
  const start = all.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start === -1) return [];
  const rest = all.slice(start + 1);
  const end = rest.findIndex((l) => /^\S/.test(l));
  const section = end === -1 ? rest : rest.slice(0, end);
  const out: Job[] = [];
  let current: { id: string; body: string[] } | undefined;
  for (const l of section) {
    const m = /^ {2}([A-Za-z][\w-]*):\s*$/.exec(l);
    if (m) {
      if (current) out.push(finish(current));
      current = { id: m[1], body: [] };
    } else current?.body.push(l);
  }
  if (current) out.push(finish(current));
  return out;
}

function finish(j: { id: string; body: string[] }): Job {
  const body = j.body.join("\n");
  return {
    id: j.id,
    name: /^ {4}name:\s*(.+?)\s*$/m.exec(body)?.[1],
    runsOn: /^ {4}runs-on:\s*(\S+)/m.exec(body)?.[1],
    hasTimeout: /^ {4}timeout-minutes:\s*\d+/m.test(body),
    body,
  };
}

/** Everything that would widen the token or run untrusted input with it. */
function riskyConstructs(workflow: string): string[] {
  const code = lines(workflow)
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
  const found: string[] = [];
  if (/\bpull_request_target\b/.test(code)) found.push("pull_request_target");
  if (/\bworkflow_run\b/.test(code)) found.push("workflow_run");
  if (/continue-on-error:\s*true/.test(code)) found.push("continue-on-error");
  if (/:\s*write(-all)?\s*$/m.test(code)) found.push("write permission");
  if (/permissions:\s*write-all/.test(code)) found.push("write-all");
  // Attacker-controlled context values must never be interpolated into a script.
  if (/\$\{\{\s*github\.(event\.|head_ref)/.test(code))
    found.push("event context interpolation");
  return found;
}

/** The top-level `permissions:` block, or undefined when the workflow has none. */
function topLevelPermissions(workflow: string): string[] | undefined {
  const all = lines(workflow);
  const i = all.findIndex((l) => /^permissions:\s*$/.test(l));
  if (i === -1) return undefined;
  const block: string[] = [];
  for (const l of all.slice(i + 1)) {
    if (!/^\s+\S/.test(l)) break;
    block.push(l.trim());
  }
  return block;
}

const workflows = {
  "ci.yml": read(".github/workflows/ci.yml"),
  "security.yml": read(".github/workflows/security.yml"),
};

describe.each(Object.entries(workflows))("%s", (file, text) => {
  it("pins every action to a full commit SHA with a version comment", () => {
    expect(unpinnedActions(text)).toEqual([]);
  });

  it("grants the token read access to contents only", () => {
    expect(topLevelPermissions(text)).toEqual(["contents: read"]);
    expect(
      jobsOf(text).filter((j) => /^ {4}permissions:/m.test(j.body)),
    ).toEqual([]);
  });

  it("has no privileged triggers, write scopes or event interpolation", () => {
    expect(riskyConstructs(text)).toEqual([]);
  });

  it("bounds every job in time and pins the runner image", () => {
    const jobs = jobsOf(text);
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) {
      expect(j.hasTimeout, `${file}:${j.id} timeout-minutes`).toBe(true);
      expect(j.runsOn, `${file}:${j.id} runs-on`).toMatch(/^ubuntu-\d+\.\d+$/);
    }
  });

  it("never persists the checkout token", () => {
    const checkouts = text.match(/uses:\s*actions\/checkout@/g) ?? [];
    const safe = text.match(/persist-credentials:\s*false/g) ?? [];
    expect(safe).toHaveLength(checkouts.length);
  });

  it("runs on pull requests and on pushes to main", () => {
    expect(text).toMatch(/^ {2}pull_request:/m);
    expect(text).toMatch(/^ {2}push:\s*\n\s+branches:\s*\[main\]/m);
  });

  it("cancels superseded pull request runs only", () => {
    expect(text).toContain(
      "cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
    );
  });
});

describe("ci.yml runs the whole gate", () => {
  const ci = workflows["ci.yml"];
  const runs = lines(ci)
    .map((l) => /^\s*(?:-\s*)?run:\s*(.+?)\s*$/.exec(l)?.[1])
    .filter(Boolean);

  it("covers install, typecheck/lint/unit/build, knip, format and e2e", () => {
    expect(runs).toEqual(
      expect.arrayContaining([
        "pnpm install --frozen-lockfile",
        "pnpm verify",
        "pnpm knip",
        "pnpm format:check",
        "pnpm test:e2e",
      ]),
    );
  });

  it("lets the e2e job validate a fresh clone (no SKIP_ENV_VALIDATION)", () => {
    const e2e = jobsOf(ci).find((j) => j.id === "e2e");
    expect(e2e).toBeDefined();
    const code = lines(e2e?.body ?? "")
      .filter((l) => !/^\s*#/.test(l))
      .join("\n");
    expect(code).not.toContain("SKIP_ENV_VALIDATION");
  });

  it("keeps the verify script and the lint warning budget strict", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.lint).toContain("--max-warnings=0");
    for (const step of ["typecheck", "lint", "test", "build"]) {
      expect(pkg.scripts.verify).toContain(`pnpm ${step}`);
    }
  });
});

describe("required status checks (docs/DEPLOYMENT.md §4b)", () => {
  const required = ["verify", "e2e", "gitleaks"];
  const jobs = Object.values(workflows).flatMap((t) => jobsOf(t));

  it("exist as job names, equal to the job id", () => {
    for (const name of required) {
      const job = jobs.find((j) => j.name === name);
      expect(job, `job named ${name}`).toBeDefined();
      expect(job?.id).toBe(name);
    }
  });

  it("are listed in the branch protection section", () => {
    const doc = read("docs/DEPLOYMENT.md");
    const start = doc.indexOf("## 4b.");
    expect(start).toBeGreaterThan(-1);
    const section = doc.slice(start, doc.indexOf("\n## 5.", start));
    for (const name of required) expect(section).toContain(`\`${name}\``);
  });
});

describe("dependabot keeps the pinned actions current", () => {
  it("watches the github-actions ecosystem", () => {
    expect(read(".github/dependabot.yml")).toMatch(
      /package-ecosystem:\s*github-actions/,
    );
  });
});

describe("the checks reject what they are meant to reject", () => {
  const sha = "3d3c42e5aac5ba805825da76410c181273ba90b1";

  it("flags tag, branch, short-SHA, docker and local references", () => {
    for (const ref of [
      "actions/checkout@v4",
      "actions/checkout@main",
      "actions/checkout@3d3c42e",
      "docker://alpine:3",
      "./.github/actions/x",
    ]) {
      expect(unpinnedActions(`      - uses: ${ref}`), ref).toHaveLength(1);
    }
  });

  it("flags a pinned action that lacks a version comment", () => {
    expect(
      unpinnedActions(`      - uses: actions/checkout@${sha}`),
    ).toHaveLength(1);
  });

  it("accepts a pinned action with a version comment", () => {
    expect(
      unpinnedActions(`      - uses: actions/checkout@${sha} # v7.0.1`),
    ).toEqual([]);
  });

  it("flags write scopes, privileged triggers and event interpolation", () => {
    expect(riskyConstructs("permissions:\n  contents: write\n")).toContain(
      "write permission",
    );
    expect(riskyConstructs("permissions: write-all\n")).toContain("write-all");
    expect(riskyConstructs("on:\n  pull_request_target:\n")).toContain(
      "pull_request_target",
    );
    expect(riskyConstructs("on:\n  workflow_run:\n")).toContain("workflow_run");
    expect(riskyConstructs("continue-on-error: true\n")).toContain(
      "continue-on-error",
    );
    expect(
      riskyConstructs('run: echo "${{ github.event.pull_request.title }}"\n'),
    ).toContain("event context interpolation");
    expect(riskyConstructs('run: echo "${{ github.head_ref }}"\n')).toContain(
      "event context interpolation",
    );
  });

  it("does not mistake github.event_name for event data, nor comments for code", () => {
    expect(
      riskyConstructs(
        "# pull_request_target is forbidden\ncancel-in-progress: ${{ github.event_name == 'pull_request' }}\n",
      ),
    ).toEqual([]);
  });

  it("reads a missing, widened or job-level permissions block", () => {
    expect(topLevelPermissions("name: x\njobs:\n")).toBeUndefined();
    expect(
      topLevelPermissions(
        "permissions:\n  contents: read\n  id-token: write\n",
      ),
    ).toEqual(["contents: read", "id-token: write"]);
  });

  it("parses jobs, and sees a job without a timeout or with a floating runner", () => {
    const jobs = jobsOf(
      "jobs:\n  a:\n    name: a\n    runs-on: ubuntu-latest\n    steps: []\n  b:\n    name: b\n    runs-on: ubuntu-24.04\n    timeout-minutes: 5\n",
    );
    expect(jobs.map((j) => [j.id, j.hasTimeout, j.runsOn])).toEqual([
      ["a", false, "ubuntu-latest"],
      ["b", true, "ubuntu-24.04"],
    ]);
  });
});
