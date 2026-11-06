import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { parseContent } from "../../src/lib/content/frontmatter";
import { serviceSchema, type Service } from "../../src/lib/content/schemas";

/**
 * The services collection as the tests need it: read with the pure parser (the
 * server-only reader cannot be imported outside a Server Component), validated
 * by the same schema the site uses.
 */
export function readServices(
  locale: "it" | "en",
): Array<{ slug: string; data: Service }> {
  const dir = path.join(process.cwd(), "content", "services", locale);
  return readdirSync(dir)
    .filter((name) => name.endsWith(".mdx"))
    .map((name) => {
      const file = path.join(dir, name);
      const { data } = parseContent(
        readFileSync(file, "utf8"),
        serviceSchema,
        file,
      );
      return { slug: name.replace(/\.mdx$/, ""), data };
    })
    .sort((a, b) => a.data.order - b.data.order);
}
