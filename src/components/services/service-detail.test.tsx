import { cleanup, render, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ServiceDetail } from "@/components/services/service-detail";
import { ServicesIndex } from "@/components/services/services-index";
import type { Locale } from "@/i18n/routing";
import { getServices } from "@/lib/content/read";
import { SERVICE_SLUGS } from "@/lib/diagrams/services";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return {
    default: () => () => createElement("span", { "data-motion-stub": "" }),
  };
});

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

/** True when `later` comes after `earlier` in the document. */
const follows = (earlier: Node, later: Node) =>
  (earlier.compareDocumentPosition(later) &
    Node.DOCUMENT_POSITION_FOLLOWING) !==
  0;

function detail(locale: Locale, slug: string) {
  const entry = getServices(locale).find((service) => service.slug === slug);
  if (!entry) throw new Error(`no ${locale} service ${slug}`);
  const view = render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <ServiceDetail
        slug={entry.slug}
        service={entry.data}
        body={entry.body}
        demo={null}
      />
    </NextIntlClientProvider>,
  );
  return { ...view, data: entry.data };
}

describe.each(["it", "en"] as const)("ServiceDetail (%s)", (locale) => {
  for (const slug of SERVICE_SLUGS) {
    describe(slug, () => {
      it("has the diagram as a named figure with a caption and a numbered legend", () => {
        const { container } = detail(locale, slug);
        const figures = container.querySelectorAll("figure");

        expect(figures).toHaveLength(1);
        const figure = figures[0];
        expect(figure.getAttribute("data-diagram")).toBe(slug);
        const titleId = figure.getAttribute("aria-labelledby") ?? "";
        expect(container.querySelector(`[id="${titleId}"]`)?.textContent).toBe(
          messages[locale].diagrams.services[slug].title,
        );
        expect(figure.querySelector("figcaption ol")).not.toBeNull();
        expect(figure.querySelectorAll("figcaption ol > li")).toHaveLength(
          Object.keys(messages[locale].diagrams.services[slug].steps).length,
        );
        expect(figure.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
          "true",
        );
        // exactly one accent element, and no animation on a diagram below the first screen
        expect(figure.querySelectorAll(".fill-accent")).toHaveLength(1);
        expect(figure.innerHTML).not.toMatch(/animate-|animation/);
      });

      it("puts the figure after the summary and before the body in the source", () => {
        const { container, data } = detail(locale, slug);
        const summary = [...container.querySelectorAll("p")].find(
          (p) => p.textContent === data.summary,
        );
        const figure = container.querySelector("figure");
        const body = container.querySelector("h2");

        if (!summary || !figure || !body) throw new Error("page parts missing");
        expect(follows(summary, figure)).toBe(true);
        expect(follows(figure, body)).toBe(true);
      });

      it("shows each list as a ledger that keeps every item, with no bullets", () => {
        const { container, data } = detail(locale, slug);
        const keys = ["idealFor", "outcomes", "deliverables"] as const;

        expect(container.innerHTML).not.toMatch(/list-disc/);
        for (const key of keys) {
          const heading = within(container).getByRole("heading", {
            level: 2,
            name: messages[locale].services.labels[key],
          });
          // the 24 px icon next to the heading is decorative
          expect(
            heading.querySelector("svg")?.getAttribute("aria-hidden"),
          ).toBe("true");
          const rows = heading.parentElement?.querySelectorAll("ul > li") ?? [];
          expect(
            [...rows].map(
              (row) => row.querySelector("span:last-child")?.textContent,
            ),
          ).toEqual(data[key]);
          for (const row of rows) {
            expect(row.className).toContain("border-t");
            expect(row.querySelector("span")?.getAttribute("aria-hidden")).toBe(
              "true",
            );
          }
        }
      });

      it("renders the technologies as tags, one list item each", () => {
        const { container, data } = detail(locale, slug);
        const heading = within(container).getByRole("heading", {
          level: 2,
          name: messages[locale].services.labels.stack,
        });
        const tags = [
          ...(heading.parentElement?.querySelectorAll("ul > li") ?? []),
        ];

        expect(tags.map((tag) => tag.textContent)).toEqual(data.stack);
        for (const tag of tags) {
          expect(tag.className).toContain("rounded-full");
        }
      });

      it("keeps one h1 and never skips a heading level", () => {
        const { container } = detail(locale, slug);
        const levels = [...container.querySelectorAll("h1, h2, h3")].map((h) =>
          Number(h.tagName.slice(1)),
        );

        expect(levels.filter((level) => level === 1)).toHaveLength(1);
        expect(levels[0]).toBe(1);
        expect(levels.slice(1).every((level) => level === 2)).toBe(true);
      });
    });
  }

  it("renders the page without a figure for a slug that has no diagram", () => {
    const first = getServices(locale)[0];
    const { container } = render(
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        <ServiceDetail
          slug="not-a-service"
          service={first.data}
          body={first.body}
          demo={null}
        />
      </NextIntlClientProvider>,
    );

    expect(container.querySelector("figure")).toBeNull();
    expect(container.querySelector("h1")).not.toBeNull();
  });
});

describe.each(["it", "en"] as const)("ServicesIndex (%s)", (locale) => {
  function index() {
    return render(
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        <ServicesIndex services={getServices(locale)} />
      </NextIntlClientProvider>,
    );
  }

  it("shows the capability map before the cards, one linked legend item per card", () => {
    const { container } = index();
    const figure = container.querySelector(
      "figure[data-diagram='capability-map']",
    );

    expect(figure).not.toBeNull();
    const links = [...(figure?.querySelectorAll("figcaption ol a") ?? [])];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(
      SERVICE_SLUGS.map((slug) => `#service-${slug}`),
    );
    for (const link of links) {
      const id = link.getAttribute("href")?.slice(1) ?? "";
      expect(container.querySelector(`li[id="${id}"] h2`), id).not.toBeNull();
      expect(link.className).toContain("min-h-11");
      expect(link.className).toContain("underline");
    }
    const firstCard = container.querySelector("li[id^='service-']");
    if (!figure || !firstCard) throw new Error("page parts missing");
    expect(follows(figure, firstCard)).toBe(true);
  });

  it("puts a decorative glyph in each card's header row", () => {
    const { container } = index();
    const cards = container.querySelectorAll("li[id^='service-']");

    expect(cards).toHaveLength(SERVICE_SLUGS.length);
    for (const card of cards) {
      const glyph = card.querySelector("svg[data-glyph]");
      expect(glyph?.getAttribute("aria-hidden")).toBe("true");
      expect(glyph?.getAttribute("viewBox")).toBe("0 0 80 48");
    }
  });

  it("keeps the legend text apart from the service titles (a link named by a title would clash with the card's link)", () => {
    for (const { data, slug } of getServices(locale)) {
      const legend =
        messages[locale].diagrams.capabilityMap.steps[
          slug as keyof typeof messages.it.diagrams.capabilityMap.steps
        ];
      expect(legend, slug).not.toContain(data.title);
    }
  });
});
