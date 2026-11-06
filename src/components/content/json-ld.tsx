import { jsonLdString } from "@/lib/structured-data";

/**
 * Structured data for crawlers. A `application/ld+json` block is data, not
 * script: the browser never executes it, so it needs no CSP nonce and adds no
 * client JavaScript. The string is escaped by `jsonLdString`.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  );
}
