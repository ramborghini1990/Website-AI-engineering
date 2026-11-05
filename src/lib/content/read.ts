import "server-only";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import type { z } from "zod";

import type { Locale } from "@/i18n/routing";
import { parseContent } from "@/lib/content/frontmatter";
import {
  pageSchema,
  serviceSchema,
  workSchema,
  type PageContent,
  type Service,
  type Work,
} from "@/lib/content/schemas";
import type { Collection } from "@/lib/content/site-map";

/**
 * Reads the MDX collections from `content/` at build or request time, on the
 * server only. Every file is validated with its schema: an invalid file throws
 * a `ContentError` naming the file and the field, which fails the build of any
 * page that reads it (and `pnpm test`, see `collections.test.ts`).
 *
 * It returns the Markdown body as TEXT. Rendering it (MDX) arrives with the
 * pages in P2.3. When pages read this at runtime on Vercel, add
 * `outputFileTracingIncludes: { "/**": ["./content/**"] }` to next.config.ts so
 * the files are shipped with the function.
 */

export type Entry<T> = { slug: string; data: T; body: string; file: string };

/** `content/` at the repository root. */
export function defaultContentRoot(): string {
  return path.join(process.cwd(), "content");
}

function readCollection<S extends z.ZodType>(
  collection: Collection,
  locale: Locale,
  schema: S,
  root: string = defaultContentRoot(),
): Array<Entry<z.output<S>>> {
  const dir = path.join(root, collection, locale);
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".mdx"));
  } catch {
    return [];
  }
  return names.sort().map((name) => {
    const file = path.join(dir, name);
    const { data, body } = parseContent(
      readFileSync(file, "utf8"),
      schema,
      file,
    );
    return { slug: name.replace(/\.mdx$/, ""), data, body, file };
  });
}

/** Services in display order. */
export function getServices(
  locale: Locale,
  root?: string,
): Array<Entry<Service>> {
  return readCollection("services", locale, serviceSchema, root).sort(
    (a, b) => a.data.order - b.data.order,
  );
}

/** Work entries; drafts only when asked (previews, tests). */
export function getWork(
  locale: Locale,
  options: { includeDrafts?: boolean; root?: string } = {},
): Array<Entry<Work>> {
  return readCollection("work", locale, workSchema, options.root).filter(
    (entry) => options.includeDrafts === true || !entry.data.draft,
  );
}

/** One long-form page, or null when it does not exist. */
export function getPage(
  locale: Locale,
  key: string,
  root?: string,
): Entry<PageContent> | null {
  return (
    readCollection("pages", locale, pageSchema, root).find(
      (entry) => entry.slug === key,
    ) ?? null
  );
}

