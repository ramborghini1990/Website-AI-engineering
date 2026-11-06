import type { Work } from "@/lib/content/schemas";

/**
 * The ONLY way work components read what a client agreed to publish
 * (CLAUDE.md §12: client names, logos and metrics appear only with
 * `clientConsent: true`).
 *
 * The schema already refuses a file that names a client without consent, so
 * the content on disk cannot get here. This is the second lock, for data that
 * did not come through the schema (a future CMS, a test, a copy-paste into a
 * component): without consent the answer is "nothing", whatever the object
 * holds. `work-structure.test.ts` fails if a work component reads `client` or
 * `outcomes` any other way. There is no logo field; if one is ever added it
 * belongs here too.
 */
export type ClientDisclosure = {
  client: string | null;
  outcomes: ReadonlyArray<{ label: string; value: string }>;
};

export function clientDisclosure(
  work: Pick<Work, "clientConsent" | "client" | "outcomes" | "kind">,
): ClientDisclosure {
  if (!work.clientConsent || work.kind !== "project") {
    return { client: null, outcomes: [] };
  }
  return { client: work.client ?? null, outcomes: work.outcomes };
}
