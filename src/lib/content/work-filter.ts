import { z } from "zod";

import type { Work } from "@/lib/content/schemas";

/**
 * Filters of the Work index: type (demo / case study), sector and technology.
 * They live in the URL (`/work?kind=demo&sector=...`), so the index works
 * without JavaScript, a filtered view can be linked, and the server renders it.
 *
 * The query string is external input (CLAUDE.md §6): it is parsed with Zod, and
 * a value that is not one of the options the published entries actually offer
 * is dropped, never trusted, never an error.
 */

export type WorkFilters = {
  kind?: Work["kind"];
  sector?: string;
  stack?: string;
};

const filterKeys = ["kind", "sector", "stack"] as const;
export type FilterKey = (typeof filterKeys)[number];

type Entry = { slug: string; data: Work };

export type WorkFilterOptions = {
  kind: Array<Work["kind"]>;
  sector: string[];
  stack: string[];
};

/** What can be filtered on, from the published entries only, in a stable order. */
export function filterOptions(entries: readonly Entry[]): WorkFilterOptions {
  const unique = (values: string[]) =>
    [...new Set(values)].sort((a, b) => a.localeCompare(b));
  return {
    kind: (["demo", "project"] as const).filter((kind) =>
      entries.some(({ data }) => data.kind === kind),
    ),
    sector: unique(entries.map(({ data }) => data.sector)),
    stack: unique(entries.flatMap(({ data }) => data.stack)),
  };
}

const queryValue = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value[0] : value))
  .pipe(z.string().trim().min(1).max(80));

/** Raw `searchParams` in, valid filters out. Unknown keys and unknown values are ignored. */
export function parseWorkFilters(
  raw: Record<string, string | string[] | undefined>,
  options: WorkFilterOptions,
): WorkFilters {
  const read = (key: FilterKey): string | undefined => {
    const parsed = queryValue.safeParse(raw[key]);
    return parsed.success ? parsed.data : undefined;
  };

  const filters: WorkFilters = {};
  const kind = read("kind");
  if (kind === "demo" || kind === "project") {
    if (options.kind.includes(kind)) filters.kind = kind;
  }
  const sector = read("sector");
  if (sector !== undefined && options.sector.includes(sector))
    filters.sector = sector;
  const stack = read("stack");
  if (stack !== undefined && options.stack.includes(stack))
    filters.stack = stack;
  return filters;
}

/** Entries matching every active filter (AND across groups). */
export function filterWork<T extends Entry>(
  entries: readonly T[],
  filters: WorkFilters,
): T[] {
  return entries.filter(
    ({ data }) =>
      (filters.kind === undefined || data.kind === filters.kind) &&
      (filters.sector === undefined || data.sector === filters.sector) &&
      (filters.stack === undefined || data.stack.includes(filters.stack)),
  );
}

/** `base` (default `/work`) with the filters as a query string, in a fixed key order (a stable, linkable URL). */
export function workHref(filters: WorkFilters, base = "/work"): string {
  const query = new URLSearchParams();
  for (const key of filterKeys) {
    const value = filters[key];
    if (value !== undefined) query.set(key, value);
  }
  const text = query.toString();
  return text === "" ? base : `${base}?${text}`;
}

/** The same filters with one group changed (`undefined` clears it). */
export function withFilter(
  filters: WorkFilters,
  key: FilterKey,
  value: string | undefined,
): WorkFilters {
  const rest: WorkFilters = {};
  for (const other of filterKeys) {
    const kept = filters[other];
    if (other !== key && kept !== undefined) Object.assign(rest, { [other]: kept });
  }
  if (value === undefined) return rest;
  if (key === "kind") {
    return value === "demo" || value === "project"
      ? { ...rest, kind: value }
      : rest;
  }
  return { ...rest, [key]: value };
}
