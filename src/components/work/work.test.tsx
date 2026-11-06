import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkDetail } from "@/components/work/work-detail";
import { WorkIndex } from "@/components/work/work-index";
import type { Locale } from "@/i18n/routing";
import { workSchema, type Work } from "@/lib/content/schemas";
import { mockReducedMotion } from "@/test-utils/match-media";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

// The router-aware Link renders a plain anchor with the locale prefix.
vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => "/",
    Link: (props: { href: string } & ComponentProps<"a">) =>
      createElement("a", { ...props, href: `/it${props.href}` }),
  };
});

const messages = { it: it_, en } as const;

function renderIn(locale: Locale, ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  mockReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const base = {
  summary: "A synthetic summary that is long enough to be a real sentence.",
  seoTitle: "A synthetic title",
  description:
    "A synthetic description that is comfortably long enough to pass the length rule of the schema.",
  status: "live",
  draft: false,
  clientConsent: false,
  service: "ai-agents",
};

function entry(slug: string, extra: Record<string, unknown>) {
  return {
    slug,
    data: workSchema.parse({
      ...base,
      title: `Entry ${slug} for the tests`,
      kind: "demo",
      sector: "Retail",
      stack: ["TypeScript"],
      ...extra,
    }),
  };
}

const demoA = entry("demo-a", {
  sector: "Retail",
  stack: ["TypeScript", "Next.js"],
});
const demoB = entry("demo-b", {
  sector: "Legal",
  stack: ["TypeScript", "PostgreSQL"],
});
const consented = entry("case-study", {
  kind: "project",
  clientConsent: true,
  client: "Fixture Client S.r.l.",
  outcomes: [{ label: "Fixture metric", value: "A synthetic value" }],
  sector: "Retail",
  stack: ["Next.js"],
  publishedAt: "2026-01-15",
});
const all = [demoA, demoB, consented];

/** An object the schema would refuse: a client named without consent. Components must still show nothing. */
const unconsented: Work = {
  ...consented.data,
  clientConsent: false,
  client: "Secret Client S.p.A.",
  outcomes: [{ label: "Secret metric", value: "A secret value" }],
};

describe.each(["it", "en"] as const)("WorkIndex (%s)", (locale) => {
  const copy = messages[locale].work;

  it("has one h1 and the lead", () => {
    renderIn(locale, <WorkIndex entries={all} filters={{}} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      copy.title,
    );
    expect(screen.getByText(copy.lead)).toBeInTheDocument();
  });

  it("with nothing published says so plainly: no filters, no list, no invented entry", () => {
    renderIn(locale, <WorkIndex entries={[]} filters={{}} />);

    expect(
      screen.getByRole("heading", { level: 2, name: copy.empty.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.empty.body)).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(new RegExp(copy.filters.noResults))).toBeNull();
  });

  it("lists every entry with its type, sector and a link to its page", () => {
    renderIn(locale, <WorkIndex entries={all} filters={{}} />);

    // The entries come first; the call to action has the last h2.
    const titles = screen
      .getAllByRole("heading", { level: 2 })
      .slice(0, all.length)
      .map((h) => h.textContent);
    expect(titles).toEqual(all.map((item) => item.data.title));
    for (const item of all) {
      expect(
        screen.getByRole("link", { name: item.data.title }),
      ).toHaveAttribute("href", `/it/work/${item.slug}`);
    }
    expect(
      screen.getByText(copy.filters.count.replace("{count}", "3")),
    ).toBeInTheDocument();
  });

  it("offers the three filter groups, from the entries, as links to /work?...", () => {
    renderIn(locale, <WorkIndex entries={all} filters={{}} />);

    const nav = screen.getByRole("navigation", { name: copy.filters.label });
    for (const title of [
      copy.filters.type,
      copy.filters.sector,
      copy.filters.stack,
    ]) {
      expect(within(nav).getByText(title)).toBeInTheDocument();
    }
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/it/work?kind=demo");
    expect(hrefs).toContain("/it/work?kind=project");
    expect(hrefs).toContain("/it/work?sector=Legal");
    expect(hrefs).toContain("/it/work?stack=PostgreSQL");
    expect(hrefs.filter((href) => href === "/it/work")).toHaveLength(3);
  });

  it("marks the active option with aria-current and keeps the other filters in each link", () => {
    renderIn(
      locale,
      <WorkIndex entries={all} filters={{ kind: "demo", sector: "Retail" }} />,
    );

    const nav = screen.getByRole("navigation", { name: copy.filters.label });
    const current = within(nav)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "true")
      .map((link) => link.textContent);
    expect(current).toEqual([copy.labels.demo, "Retail", copy.filters.all]);
    expect(within(nav).getByRole("link", { name: "Legal" })).toHaveAttribute(
      "href",
      "/it/work?kind=demo&sector=Legal",
    );
  });

  it("narrows the list to the filters", () => {
    renderIn(locale, <WorkIndex entries={all} filters={{ kind: "demo" }} />);

    expect(
      screen
        .getAllByRole("heading", { level: 2 })
        .slice(0, 2)
        .map((h) => h.textContent),
    ).toEqual([demoA.data.title, demoB.data.title]);
    expect(screen.queryByText(consented.data.title)).toBeNull();
    expect(
      screen.getByText(copy.filters.count.replace("{count}", "2")),
    ).toBeInTheDocument();
  });

  it("says when the filters match nothing, and offers to clear them", () => {
    renderIn(
      locale,
      <WorkIndex
        entries={all}
        filters={{ sector: "Legal", stack: "Next.js" }}
      />,
    );

    expect(screen.getByText(copy.filters.noResults)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: copy.filters.clear }),
    ).toHaveAttribute("href", "/it/work");
    expect(
      screen.getByText(copy.filters.count.replace("{count}", "0")),
    ).toBeInTheDocument();
  });

  it("leaves out a filter group with a single option: nothing to choose", () => {
    const solo = entry("solo", { stack: ["TypeScript"] });
    renderIn(locale, <WorkIndex entries={[solo]} filters={{}} />);

    expect(
      screen.queryByRole("navigation", { name: copy.filters.label }),
    ).toBeNull();
  });

  it("a demo says it is a simulation; a case study does not", () => {
    renderIn(locale, <WorkIndex entries={[demoA, consented]} filters={{}} />);

    expect(screen.getAllByText(copy.labels.simulation)).toHaveLength(1);
  });

  it("ends with the contact call to action, to the contact block", () => {
    renderIn(locale, <WorkIndex entries={all} filters={{}} />);

    expect(screen.getByRole("link", { name: copy.cta.cta })).toHaveAttribute(
      "href",
      "#contact",
    );
  });

  it("names the client of a consenting case study, and nobody else", () => {
    renderIn(locale, <WorkIndex entries={all} filters={{}} />);

    expect(screen.getAllByText("Fixture Client S.r.l.")).toHaveLength(1);
  });

  it("shows no client name for an entry without consent, even if the data holds one (negative)", () => {
    const { container } = renderIn(
      locale,
      <WorkIndex
        entries={[demoA, { slug: "leaky", data: unconsented }]}
        filters={{}}
      />,
    );

    expect(container.textContent).not.toContain("Secret Client");
    expect(container.textContent).not.toContain("Secret metric");
    expect(screen.queryByText(copy.labels.client + ":")).toBeNull();
  });

  it("the filter values from the URL are shown as text, never as markup (negative)", () => {
    const { container } = renderIn(
      locale,
      <WorkIndex
        entries={all}
        filters={{ sector: "<img src=x onerror=alert(1)>" }}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
  });
});

describe.each(["it", "en"] as const)("WorkDetail (%s)", (locale) => {
  const copy = messages[locale].work;
  const body =
    "## Fixture heading\n\nSome text with a [link](/services).\n\n- one\n- two\n";
  const service = { slug: "ai-agents", title: "The related service" };

  it("has one h1, the type, the summary and the body from the Markdown renderer", () => {
    renderIn(
      locale,
      <WorkDetail work={demoA.data} body={body} service={service} />,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      demoA.data.title,
    );
    expect(screen.getByText(demoA.data.summary)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Fixture heading" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
  });

  it("states that a demo is a simulation with synthetic data", () => {
    renderIn(
      locale,
      <WorkDetail work={demoA.data} body={body} service={service} />,
    );

    expect(screen.getByText(copy.labels.simulation)).toBeInTheDocument();
  });

  it("shows the sector, the technologies and a link to the related service", () => {
    renderIn(
      locale,
      <WorkDetail work={demoA.data} body={body} service={service} />,
    );

    expect(screen.getByText("Retail")).toBeInTheDocument();
    expect(screen.getByText("TypeScript · Next.js")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: service.title })).toHaveAttribute(
      "href",
      "/it/services/ai-agents",
    );
  });

  it("omits the service row when the service is unknown", () => {
    renderIn(
      locale,
      <WorkDetail work={demoA.data} body={body} service={null} />,
    );

    expect(screen.queryByText(copy.labels.service)).toBeNull();
  });

  it("has a breadcrumb that ends on the current page", () => {
    renderIn(
      locale,
      <WorkDetail work={demoA.data} body={body} service={null} />,
    );

    const nav = screen.getByRole("navigation", {
      name: copy.labels.breadcrumb,
    });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((l) => l.getAttribute("href")),
    ).toEqual(["/it/", "/it/work"]);
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent(
      demoA.data.title,
    );
  });

  it("shows the client and the results of a consenting case study, without the simulation notice", () => {
    renderIn(
      locale,
      <WorkDetail work={consented.data} body={body} service={service} />,
    );

    expect(screen.getByText("Fixture Client S.r.l.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: copy.labels.outcomes }),
    ).toBeInTheDocument();
    expect(screen.getByText("Fixture metric")).toBeInTheDocument();
    expect(screen.getByText("A synthetic value")).toBeInTheDocument();
    expect(screen.queryByText(copy.labels.simulation)).toBeNull();
  });

  it("shows NO client and NO results without consent, even if the data holds them (negative)", () => {
    const { container } = renderIn(
      locale,
      <WorkDetail work={unconsented} body={body} service={service} />,
    );

    expect(container.textContent).not.toContain("Secret Client");
    expect(container.textContent).not.toContain("Secret metric");
    expect(container.textContent).not.toContain("A secret value");
    expect(screen.queryByText(copy.labels.client)).toBeNull();
    expect(
      screen.queryByRole("heading", { level: 2, name: copy.labels.outcomes }),
    ).toBeNull();
  });

  it("shows no image: there is no client logo to show", () => {
    const { container } = renderIn(
      locale,
      <WorkDetail work={consented.data} body={body} service={service} />,
    );

    expect(container.querySelector("img, svg[role='img']")).toBeNull();
  });

  it("heading levels never skip (h1, then h2 only)", () => {
    renderIn(
      locale,
      <WorkDetail work={consented.data} body={body} service={service} />,
    );

    const levels = screen
      .getAllByRole("heading")
      .map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    for (const level of levels.slice(1)) expect(level).toBe(2);
  });
});
