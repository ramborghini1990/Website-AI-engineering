import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseContent } from "../../src/lib/content/frontmatter";
import {
  serviceSchema,
  workSchema,
  type Service,
  type Work,
} from "../../src/lib/content/schemas";

/**
 * The content collections as the tests need them: read with the pure parser
 * (the server-only reader cannot be imported outside a Server Component),
 * validated by the same schemas the site uses.
 */
function readCollection<T>(
  collection: "services" | "work",
  locale: "it" | "en",
  parse: (raw: string, file: string) => T,
): Array<{ slug: string; data: T }> {
  const dir = path.join(process.cwd(), "content", collection, locale);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdx"))
    .sort()
    .map((name) => {
      const file = path.join(dir, name);
      return {
        slug: name.replace(/\.mdx$/, ""),
        data: parse(readFileSync(file, "utf8"), file),
      };
    });
}

export function readServices(
  locale: "it" | "en",
): Array<{ slug: string; data: Service }> {
  return readCollection("services", locale, (raw, file) => {
    return parseContent(raw, serviceSchema, file).data;
  }).sort((a, b) => a.data.order - b.data.order);
}

/** Every work entry on disk, drafts included; the tests decide what must be public. */
export function readWork(
  locale: "it" | "en",
): Array<{ slug: string; data: Work }> {
  return readCollection("work", locale, (raw, file) => {
    return parseContent(raw, workSchema, file).data;
  });
}
