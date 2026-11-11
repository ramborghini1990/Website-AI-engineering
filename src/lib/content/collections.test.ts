// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { routing, type Locale } from "@/i18n/routing";
import { business } from "@/lib/business";
import { bodyProblems, claimProblems } from "@/lib/content/lint";
import { getPage, getServices, getWork, defaultContentRoot } from "@/lib/content/read";
import {
  collections,
  contactNextKeys,
  contactPrepareKeys,
  homeProofKeys,
  mdxPageKeys,
  pageKeys,
  pagePaths,
  type PageKey,
  processPrincipleKeys,
  processStepKeys,
} from "@/lib/content/site-map";
import english from "../../../messages/en.json";
import italian from "../../../messages/it.json";

/**
 * The content gate: runs in `pnpm test` (and so in `pnpm verify`), and does for
 * the copy deck what `next build` does for types. It reads the REAL files in
 * `content/` and the REAL messages, so a bad frontmatter field, a missing
 * translation, a duplicate title or an unverifiable claim fails here.
 */

const messagesByLocale = { it: italian, en: english } as const;
const locales = routing.locales;
const ROOT = defaultContentRoot();

type Json = string | { [key: string]: Json };

/** Every leaf string of a message subtree, with its dotted key. */
function leaves(tree: Json, prefix: string): Array<[string, string]> {
  if (typeof tree === "string") return [[prefix, tree]];
  return Object.entries(tree).flatMap(([key, value]) => leaves(value, `${prefix}.${key}`));
}

/** `{brand}` filled in, so lengths are those a visitor sees. */
const rendered = (message: string) => message.replaceAll("{brand}", business.brand.name);

const services = (locale: Locale) => getServices(locale);
const work = (locale: Locale) => getWork(locale, { includeDrafts: true });

describe("what the content gate covers (not vacuous)", () => {
  it("finds the collections the copy deck defines", () => {
    expect(collections).toEqual(["services", "work", "pages"]);
    for (const locale of locales) {
      expect(services(locale), locale).toHaveLength(4);
      expect(work(locale), locale).toHaveLength(4);
      for (const key of mdxPageKeys) expect(getPage(locale, key), `${locale}/${key}`).not.toBeNull();
    }
  });

  it("every .mdx file on disk is read: nothing is silently skipped", () => {
    const onDisk = (collection: string, locale: string) =>
      readdirSync(path.join(ROOT, collection, locale))
        .filter((name) => !name.startsWith("."))
        .map((name) => {
          expect(name.endsWith(".mdx"), `${collection}/${locale}/${name}`).toBe(true);
          return name.replace(/\.mdx$/, "");
        })
        .sort();

    for (const locale of locales) {
      expect(services(locale).map((e) => e.slug).sort(), `services/${locale}`).toEqual(onDisk("services", locale));
      expect(work(locale).map((e) => e.slug).sort(), `work/${locale}`).toEqual(onDisk("work", locale));
      expect(onDisk("pages", locale), `pages/${locale}`).toEqual([...mdxPageKeys]);
    }
  });
});

describe("collections: Italian and English match", () => {
  for (const collection of ["services", "work"] as const) {
    it(`${collection}: the same slugs exist in both languages`, () => {
      const read = collection === "services" ? services : work;

      expect(read("it").map((e) => e.slug).sort()).toEqual(read("en").map((e) => e.slug).sort());
    });
  }

  it("services: order, demo link and technologies are identical in both languages", () => {
    for (const italian of services("it")) {
      const english = services("en").find((e) => e.slug === italian.slug);

      expect(english, italian.slug).toBeDefined();
      expect({ order: english?.data.order, demo: english?.data.demo, stack: english?.data.stack }).toEqual({
        order: italian.data.order,
        demo: italian.data.demo,
        stack: italian.data.stack,
      });
      expect(english?.data.outcomes.length).toBe(italian.data.outcomes.length);
      expect(english?.data.deliverables.length).toBe(italian.data.deliverables.length);
      expect(english?.data.idealFor.length).toBe(italian.data.idealFor.length);
    }
  });

  it("work: kind, status, draft, consent, service and technologies are identical in both languages", () => {
    for (const italian of work("it")) {
      const english = work("en").find((e) => e.slug === italian.slug);
      const structure = ({ kind, status, draft, clientConsent, service, stack }: typeof italian.data) => ({
        kind,
        status,
        draft,
        clientConsent,
        service,
        stack,
      });

      expect(english, italian.slug).toBeDefined();
      expect(structure(english?.data ?? italian.data)).toEqual(structure(italian.data));
    }
  });

  it("orders are unique and consecutive within a language", () => {
    for (const locale of locales) {
      expect(services(locale).map((e) => e.data.order), locale).toEqual([1, 2, 3, 4]);
    }
  });

  it("the English text is really written in English, not copied from the Italian", () => {
    for (const italian of services("it")) {
      const english = services("en").find((e) => e.slug === italian.slug);
      for (const field of ["title", "summary", "seoTitle", "description"] as const) {
        if (field === "title" && italian.data.title === english?.data.title) continue; // "Document intelligence" is the same term in both
        expect(english?.data[field], `${italian.slug}.${field}`).not.toBe(italian.data[field]);
      }
      expect(english?.body, italian.slug).not.toBe(italian.body);
    }
    for (const italian of work("it")) {
      const english = work("en").find((e) => e.slug === italian.slug);
      expect(english?.data.summary, italian.slug).not.toBe(italian.data.summary);
      expect(english?.body, italian.slug).not.toBe(italian.body);
    }
  });
});

describe("collections: references and honesty rules", () => {
  it("every service demo points at an existing work entry", () => {
    for (const locale of locales) {
      const slugs = new Set(work(locale).map((e) => e.slug));
      for (const service of services(locale)) {
        if (service.data.demo !== null) {
          expect(slugs.has(service.data.demo), `${locale}/${service.slug} -> ${service.data.demo}`).toBe(true);
        }
      }
    }
  });

  it("every work entry belongs to an existing service", () => {
    for (const locale of locales) {
      const slugs = new Set(services(locale).map((e) => e.slug));
      for (const entry of work(locale)) {
        expect(slugs.has(entry.data.service), `${locale}/${entry.slug} -> ${entry.data.service}`).toBe(true);
      }
    }
  });

  it("nothing about a client is published without their consent, and no draft is live (CLAUDE.md §12)", () => {
    for (const locale of locales) {
      for (const entry of work(locale)) {
        const { client, outcomes, clientConsent, draft, status } = entry.data;
        if (client !== undefined || outcomes.length > 0) expect(clientConsent, entry.slug).toBe(true);
        if (!draft) expect(status, entry.slug).toBe("live");
      }
    }
  });

  it("a demo is published only once it exists: today only the Instagram demo (P3.1) is live, the other three stay planned drafts", () => {
    const LIVE = ["instagram-lead-agent"];
    for (const locale of locales) {
      for (const entry of work(locale)) {
        expect(entry.data.kind, entry.slug).toBe("demo");
        const live = LIVE.includes(entry.slug);
        expect(entry.data.status, entry.slug).toBe(live ? "live" : "planned");
        expect(entry.data.draft, entry.slug).toBe(!live);
      }
      expect(
        getWork(locale).map((entry) => entry.slug),
        `published work in ${locale}`,
      ).toEqual(LIVE);
    }
  });

  it("every service names its demo (or none), and demos are named like the blueprint's planned four", () => {
    const names = work("it").map((e) => e.slug).sort();

    expect(names).toEqual([
      "business-management-app",
      "document-intelligence-demo",
      "instagram-lead-agent",
      "linkedin-assisted-outreach",
    ]);
  });
});

describe("collections: bodies follow the editorial rules", () => {
  /** Internal paths a body may link to: the pages, and the published detail pages. */
  const knownPaths = (locale: Locale) =>
    new Set<string>([
      ...Object.values(pagePaths),
      ...services(locale).map((e) => `/services/${e.slug}`),
      ...getWork(locale).map((e) => `/work/${e.slug}`),
    ]);

  for (const locale of locales) {
    it(`${locale}: every service body passes (headings, MDX-safe, known links, length, no unverifiable claims)`, () => {
      for (const entry of services(locale)) {
        expect(
          bodyProblems(entry.body, { knownPaths: knownPaths(locale), minWords: 110, maxWords: 400 }),
          `${locale}/services/${entry.slug}`,
        ).toEqual([]);
      }
    });

    it(`${locale}: every work body passes`, () => {
      for (const entry of work(locale)) {
        expect(
          bodyProblems(entry.body, { knownPaths: knownPaths(locale), minWords: 60, maxWords: 250 }),
          `${locale}/work/${entry.slug}`,
        ).toEqual([]);
      }
    });

    it(`${locale}: the About body passes`, () => {
      const page = getPage(locale, "about");

      expect(
        bodyProblems(page?.body ?? "", { knownPaths: knownPaths(locale), minWords: 150, maxWords: 500 }),
        `${locale}/pages/about`,
      ).toEqual([]);
    });

    it(`${locale}: frontmatter text has no unverifiable claims either`, () => {
      const all = [
        ...services(locale).map((e) => [e.slug, JSON.stringify(e.data)] as const),
        ...work(locale).map((e) => [e.slug, JSON.stringify(e.data)] as const),
        ["about", JSON.stringify(getPage(locale, "about")?.data)] as const,
      ];

      for (const [slug, text] of all) expect(claimProblems(text), `${locale}/${slug}`).toEqual([]);
    });
  }

  it("a hostile body would be caught (negative control on real rules)", () => {
    const body = "## A\n\nGarantiamo 10 anni di risultati {x} [y](/does-not-exist) words words words words";

    expect(bodyProblems(body, { knownPaths: knownPaths("it"), minWords: 3, maxWords: 50 }).length).toBeGreaterThanOrEqual(3);
  });
});

describe("messages: every page has its own localized title and description", () => {
  const meta = (locale: Locale, key: PageKey) =>
    (
      messagesByLocale[locale].metadata as unknown as Record<
        PageKey,
        { title: string; description: string }
      >
    )[key];

  it("every page of the site map has metadata in both languages", () => {
    for (const locale of locales) {
      for (const key of pageKeys) {
        const entry = meta(locale, key);
        expect(entry, `${locale}.metadata.${key}`).toBeDefined();
        expect(entry.title, `${locale}.metadata.${key}.title`).toBeTruthy();
        expect(entry.description, `${locale}.metadata.${key}.description`).toBeTruthy();
      }
    }
  });

  it("titles fit a search result (12 to 52 characters before the brand) and descriptions fit a snippet (80 to 160)", () => {
    for (const locale of locales) {
      for (const key of pageKeys) {
        const entry = meta(locale, key);
        const title = rendered(entry.title);
        const description = rendered(entry.description);

        expect(title.length, `${locale} ${key} title "${title}"`).toBeGreaterThanOrEqual(12);
        expect(title.length, `${locale} ${key} title "${title}"`).toBeLessThanOrEqual(52);
        expect(description.length, `${locale} ${key} description`).toBeGreaterThanOrEqual(80);
        expect(description.length, `${locale} ${key} description`).toBeLessThanOrEqual(160);
      }
    }
  });

  it("titles are unique across the six pages, and so are descriptions (per language)", () => {
    for (const locale of locales) {
      const titles = pageKeys.map((key) => meta(locale, key).title);
      const descriptions = pageKeys.map((key) => meta(locale, key).description);

      expect(new Set(titles).size, `${locale} titles`).toBe(pageKeys.length);
      expect(new Set(descriptions).size, `${locale} descriptions`).toBe(pageKeys.length);
    }
  });

  it("titles and descriptions of ALL indexable pages (pages, services, demos) are unique together, per language", () => {
    for (const locale of locales) {
      const items = [
        ...pageKeys.map((key) => meta(locale, key)),
        ...services(locale).map((e) => ({ title: e.data.seoTitle, description: e.data.description })),
        ...work(locale).map((e) => ({ title: e.data.seoTitle, description: e.data.description })),
      ];

      expect(new Set(items.map((i) => i.title)).size, `${locale} titles`).toBe(items.length);
      expect(new Set(items.map((i) => i.description)).size, `${locale} descriptions`).toBe(items.length);
    }
  });

  it("no title or description is shared between the two languages (each is written for its audience)", () => {
    for (const key of pageKeys) {
      expect(meta("it", key).title, key).not.toBe(meta("en", key).title);
      expect(meta("it", key).description, key).not.toBe(meta("en", key).description);
    }
  });

  it("a page title is not just the brand or the same as the heading of another page", () => {
    for (const locale of locales) {
      for (const key of pageKeys) {
        expect(rendered(meta(locale, key).title), `${locale} ${key}`).not.toBe(business.brand.name);
      }
    }
  });
});

describe("messages: the deck is complete and in order", () => {
  const keysOf = (tree: object) => Object.keys(tree).sort();

  it("the lists the pages iterate exist in both languages with the same keys", () => {
    for (const locale of locales) {
      const m = messagesByLocale[locale];

      expect(keysOf(m.home.proof.items), locale).toEqual([...homeProofKeys].sort());
      expect(keysOf(m.process.steps), locale).toEqual([...processStepKeys].sort());
      expect(keysOf(m.process.principles.items), locale).toEqual([...processPrincipleKeys].sort());
      expect(keysOf(m.contact.prepare.items), locale).toEqual([...contactPrepareKeys].sort());
      expect(keysOf(m.contact.next.items), locale).toEqual([...contactNextKeys].sort());
    }
  });

  it("each process step has a title, summary, body and exactly three deliverables", () => {
    for (const locale of locales) {
      for (const key of processStepKeys) {
        const step = messagesByLocale[locale].process.steps[key];

        expect(step.title && step.summary && step.body, `${locale} ${key}`).toBeTruthy();
        expect(Object.keys(step.outputs), `${locale} ${key}`).toEqual(["first", "second", "third"]);
      }
    }
  });

  it("the navigation labels cover the pages that have a link", () => {
    for (const locale of locales) {
      expect(keysOf(messagesByLocale[locale].nav.items), locale).toEqual(
        ["about", "home", "process", "services", "work"],
      );
    }
  });

  it("the deck copy has no unverifiable claims, placeholders or hype (home, services, work, process, about, contact, metadata)", () => {
    for (const locale of locales) {
      const m = messagesByLocale[locale];
      const copy = [
        ...leaves(m.metadata, "metadata"),
        ...leaves(m.home, "home"),
        ...leaves(m.services, "services"),
        ...leaves(m.work, "work"),
        ...leaves(m.process, "process"),
        ...leaves(m.about, "about"),
        ...leaves(m.contact, "contact"),
      ];

      expect(copy.length).toBeGreaterThan(100);
      for (const [key, value] of copy) expect(claimProblems(value), `${locale} ${key}`).toEqual([]);
    }
  });

  it("copy never hard-codes the brand: it uses {brand} or nothing", () => {
    for (const locale of locales) {
      const text = JSON.stringify(messagesByLocale[locale]);

      expect(text, locale).not.toContain(business.brand.name);
    }
  });

  it("never uses an address or an email that has not been provided (no invented contact details)", () => {
    for (const locale of locales) {
      const text = JSON.stringify(messagesByLocale[locale]);

      expect(text, locale).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}/i);
      expect(text, locale).not.toMatch(/\+?\d[\d\s]{8,}\d/);
    }
  });
});

describe("source files", () => {
  it("every content file starts with a frontmatter fence and has no tab or Windows quirk that would break a later YAML or MDX tool", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)],
      );
    const files = walk(ROOT).filter((f) => f.endsWith(".mdx"));

    expect(files.length).toBe(18);
    for (const file of files) {
      const raw = readFileSync(file, "utf8");
      expect(raw.startsWith("---"), file).toBe(true);
      expect(raw.split(/\r?\n---\r?\n/)[0], file).not.toMatch(/\t/);
    }
  });
});
