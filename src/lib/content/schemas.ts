import { z } from "zod";

/**
 * Frontmatter schemas for the MDX collections (decision D3, ROADMAP P2.1/P2.4).
 * They are STRICT: an unknown key is an error, so a typo (`clientconsent`)
 * fails the check instead of being ignored. They also encode the honesty rules
 * of CLAUDE.md §12: nothing about a client appears without `clientConsent`, and
 * a demo that is only planned cannot be published.
 *
 * Length limits are for search results and cards, not style preferences: a
 * title or description outside them gets cut off or looks empty.
 */

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Stable identifier and URL segment: the file name, the same in both languages. */
export const slugSchema = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "must be lowercase words joined by hyphens",
  );

/** Title shown in search results: the page part only, the brand is appended. */
const seoTitleSchema = text(12, 52);
/** Meta description. */
const seoDescriptionSchema = text(80, 160);

const techName = text(2, 40);

export const serviceSchema = z.strictObject({
  /** The page heading (h1). */
  title: text(8, 60),
  /** One sentence for cards and lists. */
  summary: text(40, 180),
  seoTitle: seoTitleSchema,
  description: seoDescriptionSchema,
  /** Position in lists; unique per language. */
  order: z.number().int().min(1).max(20),
  idealFor: z.array(text(10, 140)).min(2).max(4),
  outcomes: z.array(text(10, 160)).min(3).max(5),
  deliverables: z.array(text(10, 140)).min(3).max(6),
  /** Technologies actually used, named plainly. */
  stack: z.array(techName).max(10),
  /** Slug of a `work` entry that demonstrates this service, or null. Shown only once that entry is published. */
  demo: slugSchema.nullable(),
});

export type Service = z.infer<typeof serviceSchema>;

const metricSchema = z.strictObject({
  label: text(2, 60),
  value: text(1, 40),
});

export const workSchema = z
  .strictObject({
    title: text(8, 90),
    summary: text(40, 200),
    seoTitle: seoTitleSchema,
    description: seoDescriptionSchema,
    /** `demo`: an interactive simulation. `project`: real client work. */
    kind: z.enum(["demo", "project"]),
    /** A demo can be `planned` (not built yet) or `live`. A project is always `live`. */
    status: z.enum(["planned", "live"]),
    /** Drafts are never listed or linked. */
    draft: z.boolean(),
    /** The client agreed to be named and to have results shown. Required for `client` and `outcomes`. */
    clientConsent: z.boolean(),
    client: text(2, 80).optional(),
    sector: text(3, 60),
    /** Results, only with consent and only for projects. */
    outcomes: z.array(metricSchema).max(4).default([]),
    stack: z.array(techName).max(10),
    /** Slug of the `services` entry this belongs to. */
    service: slugSchema,
    publishedAt: z.iso.date().optional(),
  })
  .superRefine((entry, context) => {
    const issue = (path: string, message: string) => {
      context.addIssue({ code: "custom", path: [path], message });
    };
    const namesClient = entry.client !== undefined || entry.outcomes.length > 0;

    if (namesClient && !entry.clientConsent) {
      issue(
        entry.client !== undefined ? "client" : "outcomes",
        "a client name or results need clientConsent: true",
      );
    }
    if (entry.kind === "demo") {
      if (entry.client !== undefined) issue("client", "a demo has no client");
      if (entry.outcomes.length > 0)
        issue("outcomes", "a demo has no client results");
      if (entry.clientConsent)
        issue("clientConsent", "a demo has no client to consent");
    } else if (entry.status !== "live") {
      issue("status", "a project must be live");
    }
    if (!entry.draft && entry.status !== "live") {
      issue("draft", "only live entries can be published (draft: false)");
    }
    if (
      !entry.draft &&
      entry.kind === "project" &&
      entry.publishedAt === undefined
    ) {
      issue("publishedAt", "a published project needs a date");
    }
  });

export type Work = z.infer<typeof workSchema>;

/** A long-form page (About): the h1 and the opening paragraph; SEO lives in messages. */
export const pageSchema = z.strictObject({
  heading: text(8, 70),
  lead: text(40, 280),
});

export type PageContent = z.infer<typeof pageSchema>;
