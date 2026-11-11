/**
 * The work entries that have an interactive demo on their page. A `demo` entry
 * without an item here is just text; an item here must be a real work slug (a
 * test checks). The page for a slug renders its demo between the summary and
 * the facts.
 */
export const interactiveDemos = [
  "instagram-lead-agent",
  "linkedin-assisted-outreach",
] as const;
export type InteractiveDemo = (typeof interactiveDemos)[number];

export function isInteractiveDemo(slug: string): slug is InteractiveDemo {
  return (interactiveDemos as readonly string[]).includes(slug);
}
