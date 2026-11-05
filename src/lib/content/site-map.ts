/**
 * Information architecture (P2.1, docs/CONTENT.md): the pages of the site and
 * the collections behind them. This is the list the content tests check, so a
 * page cannot ship without a localized title and description.
 *
 * Paths are locale-less and identical in both languages for now (the i18n
 * `Link` adds `/it` or `/en`). Localized slugs (`/it/servizi`) are a possible
 * later SEO step, see docs/CONTENT.md "Decisions".
 */
export const pageKeys = [
  "home",
  "services",
  "work",
  "process",
  "about",
  "contact",
] as const;

export type PageKey = (typeof pageKeys)[number];

export const pagePaths = {
  home: "/",
  services: "/services",
  work: "/work",
  process: "/process",
  about: "/about",
  contact: "/contact",
} as const satisfies Record<PageKey, string>;

/** Collections stored under `content/<collection>/<locale>/<slug>.mdx`. */
export const collections = ["services", "work", "pages"] as const;
export type Collection = (typeof collections)[number];

/** Pages whose long-form body is an MDX document (`content/pages/<locale>/<key>.mdx`). */
export const mdxPageKeys = ["about"] as const satisfies readonly PageKey[];

/**
 * Message-driven lists, in display order. Pages iterate these arrays, never the
 * JSON key order, and `collections.test.ts` checks that every key exists in
 * both languages. Adding an item = add its key here and its copy to both files.
 */
export const homeProofKeys = ["owner", "quality", "human", "privacy"] as const;
export const processStepKeys = [
  "discover",
  "prototype",
  "build",
  "launch",
] as const;
export const processPrincipleKeys = [
  "measurable",
  "transparent",
  "handover",
] as const;
export const contactPrepareKeys = ["context", "goal", "constraints"] as const;
export const contactNextKeys = ["reply", "call", "proposal"] as const;
