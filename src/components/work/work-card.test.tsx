import { cleanup, render, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkCard } from "@/components/work/work-card";
import type { Locale } from "@/i18n/routing";
import { workSchema } from "@/lib/content/schemas";
import { interactiveDemos } from "@/lib/demos/registry";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => "/",
    Link: (props: { href: string } & ComponentProps<"a">) =>
      createElement("a", { ...props, href: `/it${props.href}` }),
  };
});

const messages = { it: it_, en } as const;

afterEach(cleanup);

const base = {
  summary: "A synthetic summary that is long enough to be a real sentence.",
  seoTitle: "A synthetic title",
  description:
    "A synthetic description that is comfortably long enough to pass the length rule of the schema.",
  status: "live",
  draft: false,
  sector: "Retail",
  stack: ["TypeScript", "Next.js"],
  service: "ai-agents",
};

const demo = workSchema.parse({
  ...base,
  title: "A synthetic demo for the tests",
  kind: "demo",
  clientConsent: false,
});
const project = workSchema.parse({
  ...base,
  title: "A synthetic project for the tests",
  kind: "project",
  clientConsent: true,
  client: "Fixture Client S.r.l.",
  outcomes: [{ label: "Fixture metric", value: "A synthetic value" }],
  publishedAt: "2026-01-15",
});
// The schema refuses a client without consent, so the withdrawn-consent case is built from a valid entry.
const unconsented = {
  ...project,
  clientConsent: false,
  client: "Secret Client S.r.l.",
};

function card(locale: Locale, slug: string, data = demo) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <ul>
        <WorkCard slug={slug} data={data} index={1} />
      </ul>
    </NextIntlClientProvider>,
  );
}

describe.each(["it", "en"] as const)("WorkCard (%s)", (locale) => {
  for (const slug of interactiveDemos) {
    it(`${slug}: a preview, at most three facts, the tags and the simulation notice`, () => {
      const { container } = card(locale, slug);

      expect(container.querySelectorAll("svg[data-preview]")).toHaveLength(1);
      expect(
        container
          .querySelector("svg[data-preview]")
          ?.getAttribute("data-preview"),
      ).toBe(slug);
      const facts = container.querySelector(
        `ul[aria-label="${messages[locale].work.facts.title}"]`,
      );
      expect(facts).not.toBeNull();
      const badges = facts?.querySelectorAll(":scope > li") ?? [];
      expect(badges.length).toBeGreaterThanOrEqual(2);
      expect(badges.length).toBeLessThanOrEqual(3);
      // every badge is written out as text, never colour alone
      for (const badge of badges) {
        expect(badge.textContent.trim().length).toBeGreaterThan(3);
      }
      const tags = within(container)
        .getAllByRole("listitem")
        .filter((li) => li.className.includes("rounded-full"));
      expect(tags.map((tag) => tag.textContent)).toEqual(demo.stack);
      expect(container.textContent).toContain(
        messages[locale].work.labels.simulation,
      );
    });
  }

  it("shows the counts in the right language, with the plural agreeing", () => {
    const { container } = card(locale, "instagram-lead-agent");
    // the sample inbox has more than one message: the plural branch
    expect(container.textContent).toMatch(
      locale === "it" ? /\d+ messaggi di prova/ : /\d+ sample messages/,
    );
  });

  it("a project card shows neither a preview nor facts, even on a demo's slug (negative)", () => {
    const { container } = card(locale, "instagram-lead-agent", project);

    expect(container.querySelector("svg")).toBeNull();
    expect(
      container.querySelector(
        `ul[aria-label="${messages[locale].work.facts.title}"]`,
      ),
    ).toBeNull();
  });

  it("a demo entry that is not an interactive demo has no preview and no facts (negative)", () => {
    const { container } = card(locale, "fixture-demo");

    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelectorAll("li li")).toHaveLength(demo.stack.length);
  });

  it("the client's name appears only with consent (negative cases kept)", () => {
    const withConsent = card(locale, "case-study", project);
    expect(withConsent.container.textContent).toContain(
      "Fixture Client S.r.l.",
    );
    cleanup();

    const without = card(locale, "case-study", unconsented);
    expect(without.container.textContent).not.toContain("Secret Client");
  });

  it("the preview's accent lifts on hover and focus through the card's group, with opacity only", () => {
    const { container } = card(locale, "instagram-lead-agent");
    const panel = container.querySelector("svg[data-preview]")?.parentElement;

    expect(container.querySelector("li")?.className).toContain("group");
    expect(panel?.className).toContain(
      "group-hover:[&_.preview-accent]:opacity-100",
    );
    expect(panel?.className).toContain(
      "group-focus-within:[&_.preview-accent]:opacity-100",
    );
    expect(panel?.className).toContain("[&_.preview-accent]:opacity-60");
    expect(panel?.className).toContain("duration-fast");
  });
});
