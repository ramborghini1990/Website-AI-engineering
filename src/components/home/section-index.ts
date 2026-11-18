import type { Work } from "@/lib/content/schemas";

/**
 * The demos Home features: interactive demos only (case studies live in
 * /work). HomeDemos renders nothing when this is empty, so the section
 * numbering must be computed from the same predicate.
 */
export function featuredDemos<T extends { data: Work }>(
  published: readonly T[],
): T[] {
  return published.filter(({ data }) => data.kind === "demo");
}

export type HomeSectionIndexes = {
  proof: number;
  services: number;
  /** `null` when the demos section does not render. */
  demos: number | null;
  process: number;
};

/** Consecutive section numbers, with no gap when the demos section is absent. */
export function homeSectionIndexes(demosRendered: boolean): HomeSectionIndexes {
  return {
    proof: 1,
    services: 2,
    demos: demosRendered ? 3 : null,
    process: demosRendered ? 4 : 3,
  };
}
