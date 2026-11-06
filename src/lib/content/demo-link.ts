/**
 * Which demo a service page may link to. A service names a work entry in its
 * frontmatter (`demo`), but the link is shown only when that entry is
 * PUBLISHED (the caller passes `getWork()`, which leaves drafts out) and the
 * work pages exist. A planned demo is never advertised (docs/CONTENT.md), and
 * a link to a page that does not exist is a 404.
 */
export function demoFor(
  demo: string | null,
  published: ReadonlyArray<{ slug: string; data: { title: string } }>,
  workPageExists: boolean,
): { slug: string; title: string } | null {
  if (demo === null || !workPageExists) return null;
  const entry = published.find((work) => work.slug === demo);
  return entry ? { slug: entry.slug, title: entry.data.title } : null;
}
