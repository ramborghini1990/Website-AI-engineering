import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import type { Locale } from "@/i18n/routing";
import { defaultContentRoot, type Entry } from "@/lib/content/read";
import { parseContent } from "@/lib/content/frontmatter";
import {
  legalSchema,
  type LegalFrontmatter,
  type LegalKey,
} from "@/lib/legal/documents";

/**
 * One legal document in one language (`content/legal/<locale>/<key>.mdx`),
 * validated like every other content file: a missing file or a bad field throws
 * and fails the build of the page. The reader is `readFileSync` on a fixed
 * name taken from the closed `LegalKey` list, never from a request.
 */
export function getLegalDocument(
  locale: Locale,
  key: LegalKey,
  root: string = defaultContentRoot(),
): Entry<LegalFrontmatter> {
  const file = path.join(
    /*turbopackIgnore: true*/ root,
    "legal",
    locale,
    `${key}.mdx`,
  );
  const { data, body } = parseContent(
    readFileSync(/*turbopackIgnore: true*/ file, "utf8"),
    legalSchema,
    file,
  );
  return { slug: key, data, body, file };
}
