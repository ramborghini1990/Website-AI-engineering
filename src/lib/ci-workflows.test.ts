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
  "lighthouse.yml": read(".github/workflows/lighthouse.yml"),
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

describe("gitleaks is the free pinned binary (P4.6)", () => {
  const security = workflows["security.yml"];

  it("never uses the licensed action or asks for a licence key", () => {
    expect(security).not.toMatch(/gitleaks\/gitleaks-action/);
    expect(security).not.toMatch(/GITLEAKS_LICENSE/);
  });

  it("downloads a pinned release and verifies its SHA-256 before running it", () => {
    expect(security).toMatch(/GITLEAKS_VERSION:\s*"\d+\.\d+\.\d+"/);
    expect(security).toMatch(/GITLEAKS_SHA256:\s*"[0-9a-f]{64}"/);
    expect(security).toContain("sha256sum --check --strict");
    expect(security).toMatch(/gitleaks git --redact/);
  });

  it("scans the full history", () => {
    expect(security).toMatch(/fetch-depth:\s*0/);
  });

  it("passes the repository config explicitly", () => {
    expect(security).toMatch(/gitleaks git [^\n]*--config \.gitleaks\.toml/);
  });
});

describe(".gitleaks.toml keeps the default rules and only narrow exceptions", () => {
  const toml = read(".gitleaks.toml");
  // Blocks between `[[allowlists]]` headers; comments stripped.
  const code = lines(toml)
    .filter((l) => !/^\s*#/.test(l))
    .join("\n");
  const blocks = code.split("[[allowlists]]").slice(1);

  it("extends the default rule set", () => {
    expect(code).toMatch(/\[extend\]\s*\n\s*useDefault\s*=\s*true/);
  });

  it("has no global allowlist and no disabled rules", () => {
    expect(code).not.toMatch(/^\[allowlist\]/m);
    expect(code).not.toMatch(/disabledRules|^\[\[rules\]\]/m);
  });

  it("scopes every exception to a rule, a path and an exact value, all required", () => {
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(b).toMatch(/condition\s*=\s*"AND"/);
      expect(b).toMatch(/targetRules\s*=\s*\["[a-z-]+"\]/);
      expect(b).toMatch(/paths\s*=\s*\['''\^[^']+\$'''\]/);
      expect(b).toMatch(/regexes\s*=\s*\['''\^[^']+\$'''\]/);
    }
  });

  it("only exempts the logger redaction test and one historical task report", () => {
    const paths = [...code.matchAll(/paths\s*=\s*\['''([^']+)'''\]/g)].map(
      (m) => m[1],
    );
    expect(new Set(paths)).toEqual(
      new Set([
        "^src/lib/logger\\.test\\.ts$",
        "^docs/state/tasks/P4\\.7\\.md$",
      ]),
    );
  });

  it("pins every exception outside the logger test to one full commit hash", () => {
    // The logger test is exempt in every commit because it must keep looking
    // like a secret. A document is never exempt "everywhere": only the one
    // pushed commit that quoted the fixture, so any other commit, or a later
    // version of the file, that quotes it again is still reported.
    for (const b of blocks) {
      const isLoggerTest = /logger\\\.test\\\.ts/.test(b);
      const commits = [...b.matchAll(/commits\s*=\s*\[([^\]]*)\]/g)];
      if (isLoggerTest) {
        expect(commits, "the logger test block needs no commit pin").toEqual(
          [],
        );
      } else {
        expect(commits).toHaveLength(1);
        expect(commits[0]?.[1]?.trim()).toMatch(/^"[0-9a-f]{40}"$/);
      }
    }
  });

  it("is a real commit pin: the pinned commit is a full SHA, not a range or a prefix", () => {
    for (const m of code.matchAll(/commits\s*=\s*\[([^\]]*)\]/g)) {
      const entries = m[1].split(",").map((s) => s.trim());
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatch(/^"[0-9a-f]{40}"$/);
    }
  });
});

describe("Lighthouse CI budgets (P4.6)", () => {
  interface Rc {
    ci: {
      collect: {
        url: string[];
        numberOfRuns: number;
        startServerCommand: string;
      };
      assert: {
        aggregationMethod: string;
        assertions: Record<
          string,
          [string, Record<string, number>] | undefined
        >;
      };
      upload: { target: string };
    };
  }
  const rc = JSON.parse(read("lighthouserc.json")) as Rc;
  const a = rc.ci.assert.assertions;
  const lighthouse = workflows["lighthouse.yml"];

  it("audits the key routes: home, services, work, a demo and contact", () => {
    const paths = rc.ci.collect.url.map((u) => new URL(u).pathname);
    expect(paths).toEqual([
      "/it",
      "/it/services",
      "/it/work",
      "/it/work/instagram-lead-agent",
      "/it/contact",
    ]);
  });

  it("requires performance >= 90 and accessibility >= 95, as errors", () => {
    expect(a["categories:performance"]?.[0]).toBe("error");
    expect(a["categories:performance"]?.[1].minScore).toBeGreaterThanOrEqual(
      0.9,
    );
    expect(a["categories:accessibility"]?.[0]).toBe("error");
    expect(a["categories:accessibility"]?.[1].minScore).toBeGreaterThanOrEqual(
      0.95,
    );
  });

  it("caps LCP, CLS, TBT and script weight, as errors", () => {
    const max = (id: string) => a[id]?.[1].maxNumericValue;
    expect(a["largest-contentful-paint"]?.[0]).toBe("error");
    expect(max("largest-contentful-paint")).toBeLessThanOrEqual(2500);
    expect(max("cumulative-layout-shift")).toBeLessThanOrEqual(0.1);
    expect(max("total-blocking-time")).toBeLessThanOrEqual(200);
    expect(max("resource-summary:script:size")).toBeLessThanOrEqual(300_000);
    for (const [id, rule] of Object.entries(a)) {
      expect(rule?.[0], `${id} must fail the build, not warn`).toBe("error");
    }
  });

  it("asserts the median of five runs, not the best one", () => {
    // Five, not three: Lighthouse's simulated LCP occasionally jumps for one run
    // on localhost (a script ran before the first paint in the observed trace),
    // and a median of three let two such runs fail the gate (P4.7).
    expect(rc.ci.collect.numberOfRuns).toBeGreaterThanOrEqual(5);
    expect(rc.ci.assert.aggregationMethod).toBe("median-run");
  });

  it("keeps reports on the runner (no public upload)", () => {
    expect(rc.ci.upload.target).toBe("filesystem");
  });

  it("starts the production server on the port the workflow expects", () => {
    expect(rc.ci.collect.startServerCommand).toBe("pnpm start --port 3300");
    expect(
      rc.ci.collect.url.every((u) => u.startsWith("http://localhost:3300/")),
    ).toBe(true);
    expect(lighthouse).toContain("NEXT_PUBLIC_SITE_URL: http://localhost:3300");
  });

  it("builds before auditing, and runs the pnpm script", () => {
    const build = lighthouse.indexOf("run: pnpm build");
    const audit = lighthouse.indexOf("pnpm lighthouse");
    expect(build).toBeGreaterThan(-1);
    expect(audit).toBeGreaterThan(build);
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.lighthouse).toBe("lhci autorun");
  });

  it("is documented as a check that is not (yet) required", () => {
    const doc = read("docs/DEPLOYMENT.md");
    const start = doc.indexOf("## 4b.");
    const section = doc.slice(start, doc.indexOf("\n## 5.", start));
    expect(section).toContain("`lighthouse`");
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
