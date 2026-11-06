// @vitest-environment node
import { describe, expect, it } from "vitest";

import { workSchema, type Work } from "@/lib/content/schemas";
import {
  filterOptions,
  filterWork,
  parseWorkFilters,
  withFilter,
  workHref,
} from "@/lib/content/work-filter";

const base = {
  summary: "A synthetic summary that is long enough to be a real sentence.",
  seoTitle: "A synthetic title",
  description:
    "A synthetic description that is comfortably long enough to pass the length rule of the schema.",
  status: "live",
  draft: false,
  clientConsent: false,
  service: "ai-agents",
};

function entry(slug: string, extra: Record<string, unknown>): {
  slug: string;
  data: Work;
} {
  return {
    slug,
    data: workSchema.parse({
      ...base,
      title: `Entry ${slug} for the tests`,
      kind: "demo",
      sector: "Retail",
      stack: ["TypeScript"],
      ...extra,
    }),
  };
}

const entries = [
  entry("a", { sector: "Retail", stack: ["TypeScript", "Next.js"] }),
  entry("b", { sector: "Legal", stack: ["TypeScript", "PostgreSQL"] }),
  entry("c", {
    kind: "project",
    sector: "Retail",
    stack: ["Next.js"],
    publishedAt: "2026-01-15",
  }),
];
const options = filterOptions(entries);

describe("filterOptions", () => {
  it("lists only what the published entries offer, sorted and without duplicates", () => {
    expect(options).toEqual({
      kind: ["demo", "project"],
      sector: ["Legal", "Retail"],
      stack: ["Next.js", "PostgreSQL", "TypeScript"],
    });
  });

  it("offers nothing for no entries", () => {
    expect(filterOptions([])).toEqual({ kind: [], sector: [], stack: [] });
  });

  it("offers only the kinds that exist", () => {
    expect(filterOptions(entries.slice(0, 2)).kind).toEqual(["demo"]);
  });
});

describe("parseWorkFilters", () => {
  it("accepts valid values", () => {
    expect(
      parseWorkFilters(
        { kind: "demo", sector: "Retail", stack: "Next.js" },
        options,
      ),
    ).toEqual({ kind: "demo", sector: "Retail", stack: "Next.js" });
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseWorkFilters({ sector: ["Legal", "Retail"] }, options)).toEqual({
      sector: "Legal",
    });
  });

  it.each([
    ["an unknown kind", { kind: "everything" }],
    ["a kind no published entry has", { kind: "Demo" }],
    ["an unknown sector", { sector: "Nope" }],
    ["an unknown technology", { stack: "COBOL" }],
    ["an empty value", { sector: "" }],
    ["a very long value", { sector: "x".repeat(500) }],
    ["markup", { sector: "<script>alert(1)</script>" }],
    ["unknown keys", { admin: "true", __proto__: "x" }],
    ["an empty array", { sector: [] }],
    ["undefined", { sector: undefined }],
  ])("ignores %s (negative)", (_name, raw) => {
    expect(parseWorkFilters(raw as Record<string, string>, options)).toEqual({});
  });

  it("ignores a kind that exists in general but not among the published entries", () => {
    expect(
      parseWorkFilters({ kind: "project" }, filterOptions(entries.slice(0, 2))),
    ).toEqual({});
  });
});

describe("filterWork", () => {
  const slugs = (filters: Parameters<typeof filterWork>[1]) =>
    filterWork(entries, filters).map((item) => item.slug);

  it("returns everything without filters", () => {
    expect(slugs({})).toEqual(["a", "b", "c"]);
  });

  it("filters by type, sector and technology", () => {
    expect(slugs({ kind: "demo" })).toEqual(["a", "b"]);
    expect(slugs({ kind: "project" })).toEqual(["c"]);
    expect(slugs({ sector: "Retail" })).toEqual(["a", "c"]);
    expect(slugs({ stack: "Next.js" })).toEqual(["a", "c"]);
    expect(slugs({ stack: "PostgreSQL" })).toEqual(["b"]);
  });

  it("combines filters with AND", () => {
    expect(slugs({ sector: "Retail", kind: "demo" })).toEqual(["a"]);
    expect(slugs({ sector: "Legal", stack: "Next.js" })).toEqual([]);
  });
});

describe("workHref and withFilter", () => {
  it("builds a stable URL: fixed key order, encoded values", () => {
    expect(workHref({})).toBe("/work");
    expect(workHref({ stack: "Next.js", kind: "demo" })).toBe(
      "/work?kind=demo&stack=Next.js",
    );
    expect(workHref({ sector: "Marketing e vendite" })).toBe(
      "/work?sector=Marketing+e+vendite",
    );
    expect(workHref({ kind: "demo" }, "/_dev/work")).toBe("/_dev/work?kind=demo");
  });

  it("changes one group and keeps the others", () => {
    expect(withFilter({ kind: "demo", sector: "Retail" }, "sector", "Legal")).toEqual({
      kind: "demo",
      sector: "Legal",
    });
    expect(withFilter({ kind: "demo", sector: "Retail" }, "kind", undefined)).toEqual({
      sector: "Retail",
    });
  });

  it("does not mutate its input and refuses an invalid kind", () => {
    const filters = { kind: "demo" } as const;
    const next = withFilter(filters, "sector", "Retail");

    expect(filters).toEqual({ kind: "demo" });
    expect(next).toEqual({ kind: "demo", sector: "Retail" });
    expect(withFilter({}, "kind", "everything")).toEqual({});
  });

  it("a built URL parses back to the same filters", () => {
    const filters = { kind: "demo", sector: "Retail", stack: "Next.js" } as const;
    const query = Object.fromEntries(
      new URLSearchParams(workHref(filters).split("?")[1]),
    );

    expect(parseWorkFilters(query, options)).toEqual(filters);
  });
});
