// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  pageSchema,
  serviceSchema,
  slugSchema,
  workSchema,
} from "@/lib/content/schemas";

/** Synthetic entries only. */
const service = {
  title: "Test service",
  summary: "A summary of the service that is long enough to be a real sentence.",
  seoTitle: "A test service title",
  description:
    "A description of the test service that is comfortably longer than the minimum and shorter than the maximum.",
  order: 1,
  idealFor: ["First audience for the service", "Second audience for the service"],
  outcomes: ["First outcome of the service", "Second outcome of the service", "Third outcome of the service"],
  deliverables: ["First deliverable item", "Second deliverable item", "Third deliverable item"],
  stack: ["TypeScript"],
  demo: null,
};

const demo = {
  title: "A demo for the tests",
  summary: "A summary of the demo that is long enough to be a real sentence.",
  seoTitle: "Demo for the tests",
  description:
    "A description of the demo that is comfortably longer than the minimum and shorter than the maximum.",
  kind: "demo",
  status: "planned",
  draft: true,
  clientConsent: false,
  sector: "Testing",
  stack: ["TypeScript"],
  service: "test-service",
};

const project = {
  ...demo,
  title: "A client project for the tests",
  kind: "project",
  status: "live",
  draft: false,
  clientConsent: true,
  client: "Synthetic Client Ltd",
  outcomes: [{ label: "Hours saved", value: "synthetic" }],
  publishedAt: "2026-01-15",
};

function issuePaths(schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } } }, value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? [] : (result.error?.issues ?? []).map((i) => i.path.join("."));
}

describe("slugSchema", () => {
  it.each(["ai-agents", "a", "web-applications", "demo-2"])("accepts %s", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each(["AI-agents", "ai_agents", "ai agents", "-ai", "ai-", "ai--agents", "", "è"])(
    "rejects %j (negative)",
    (slug) => {
      expect(slugSchema.safeParse(slug).success).toBe(false);
    },
  );
});

describe("serviceSchema", () => {
  it("accepts a complete service", () => {
    expect(serviceSchema.safeParse(service).success).toBe(true);
  });

  it("accepts a demo slug", () => {
    expect(serviceSchema.safeParse({ ...service, demo: "some-demo" }).success).toBe(true);
  });

  it.each([
    ["an unknown key", { ...service, extra: 1 }, "(root)"],
    ["a missing title", { ...service, title: undefined }, "title"],
    ["a too-long SEO title", { ...service, seoTitle: "x".repeat(53) }, "seoTitle"],
    ["a too-short description", { ...service, description: "short" }, "description"],
    ["a too-long description", { ...service, description: "x".repeat(161) }, "description"],
    ["only one outcome", { ...service, outcomes: ["Only one outcome here"] }, "outcomes"],
    ["order zero", { ...service, order: 0 }, "order"],
    ["a fractional order", { ...service, order: 1.5 }, "order"],
    ["a bad demo slug", { ...service, demo: "Bad Slug" }, "demo"],
    ["a missing demo (must be explicit null)", { ...service, demo: undefined }, "demo"],
  ])("rejects %s (negative)", (_name, value, path) => {
    const paths = issuePaths(serviceSchema, value);
    expect(path === "(root)" ? paths.length > 0 : paths.includes(path)).toBe(true);
  });

  it("trims whitespace, so a title of spaces cannot pass", () => {
    expect(serviceSchema.safeParse({ ...service, title: "          " }).success).toBe(false);
  });
});

describe("workSchema: a planned demo", () => {
  it("is valid as a draft", () => {
    expect(workSchema.safeParse(demo).success).toBe(true);
  });

  it("defaults to no outcomes", () => {
    const parsed = workSchema.parse(demo);

    expect(parsed.outcomes).toEqual([]);
  });

  it("cannot be published until it is live (negative)", () => {
    expect(issuePaths(workSchema, { ...demo, draft: false })).toContain("draft");
  });

  it("can be published once it is live", () => {
    expect(workSchema.safeParse({ ...demo, draft: false, status: "live" }).success).toBe(true);
  });

  it.each([
    ["a client name", { client: "Some Client" }, "client"],
    ["client results", { outcomes: [{ label: "Saved", value: "x" }] }, "outcomes"],
    ["client consent", { clientConsent: true }, "clientConsent"],
  ])("a demo has no %s (negative)", (_name, patch, path) => {
    const paths = issuePaths(workSchema, { ...demo, ...patch, clientConsent: path === "clientConsent" });
    expect(paths).toContain(path);
  });
});

describe("workSchema: a client project (CLAUDE.md §12)", () => {
  it("is valid with consent, a client, results and a date", () => {
    expect(workSchema.safeParse(project).success).toBe(true);
  });

  it("a client name needs clientConsent: true (negative)", () => {
    expect(issuePaths(workSchema, { ...project, clientConsent: false })).toContain("client");
  });

  it("client results need clientConsent: true even without a name (negative)", () => {
    expect(issuePaths(workSchema, { ...project, client: undefined, clientConsent: false })).toContain(
      "outcomes",
    );
  });

  it("an anonymous project (no name, no figures) is fine without consent", () => {
    const anonymous = { ...project, client: undefined, outcomes: [], clientConsent: false };

    expect(workSchema.safeParse(anonymous).success).toBe(true);
  });

  it("a project must be live (negative)", () => {
    expect(issuePaths(workSchema, { ...project, status: "planned" })).toContain("status");
  });

  it("a published project needs a date (negative)", () => {
    expect(issuePaths(workSchema, { ...project, publishedAt: undefined })).toContain("publishedAt");
  });

  it("a date must be a real ISO date (negative)", () => {
    expect(issuePaths(workSchema, { ...project, publishedAt: "15/01/2026" })).toContain("publishedAt");
    expect(issuePaths(workSchema, { ...project, publishedAt: "2026-02-31" })).toContain("publishedAt");
  });

  it("at most four metrics (negative)", () => {
    const metrics = Array.from({ length: 5 }, (_, i) => ({ label: `Metric ${String(i)}`, value: "x" }));

    expect(issuePaths(workSchema, { ...project, outcomes: metrics })).toContain("outcomes");
  });

  it("rejects an unknown key such as a misspelt consent flag (negative)", () => {
    expect(workSchema.safeParse({ ...project, clientconsent: true }).success).toBe(false);
  });
});

describe("pageSchema", () => {
  it("accepts a heading and a lead", () => {
    expect(
      pageSchema.safeParse({
        heading: "A page heading",
        lead: "A lead paragraph that is long enough to be a real opening sentence.",
      }).success,
    ).toBe(true);
  });

  it("rejects a missing lead and unknown keys (negative)", () => {
    expect(pageSchema.safeParse({ heading: "A page heading" }).success).toBe(false);
    expect(
      pageSchema.safeParse({
        heading: "A page heading",
        lead: "A lead paragraph that is long enough to be a real opening sentence.",
        title: "x",
      }).success,
    ).toBe(false);
  });
});
