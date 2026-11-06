import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HomePage from "@/app/[locale]/page";
import { HomeDemos } from "@/components/home/home-demos";
import { HomeFinalCta } from "@/components/home/home-final-cta";
import { HomeHero } from "@/components/home/home-hero";
import { HomeProcess } from "@/components/home/home-process";
import { HomeProof } from "@/components/home/home-proof";
import { HomeServices } from "@/components/home/home-services";
import type { Locale } from "@/i18n/routing";
import { getServices, getWork } from "@/lib/content/read";
import { workSchema } from "@/lib/content/schemas";
import { processStepKeys } from "@/lib/content/site-map";
import { mockReducedMotion } from "@/test-utils/match-media";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

// The lazy GSAP chunks are not under test here (see the fx tests).
vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return {
    default: () => () => createElement("span", { "data-motion-stub": "" }),
  };
});

// The router-aware Link renders a plain anchor with the locale prefix.
vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => "/",
    Link: (props: { href: string } & ComponentProps<"a">) =>
      createElement("a", { ...props, href: `/it${props.href}` }),
  };
});

let currentLocale: Locale = "it";
vi.mock("next-intl/server", () => ({
  getLocale: () => Promise.resolve(currentLocale),
}));

const messages = { it: it_, en } as const;

function renderIn(locale: Locale, ui: ReactElement) {
  currentLocale = locale;
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

/** A published demo, as a content entry would be once its page and demo exist. */
const publishedDemo = {
  slug: "published-demo",
  data: workSchema.parse({
    title: "A published demo for the tests",
    summary:
      "A summary of the published demo that is long enough to be a sentence.",
    seoTitle: "A published demo title",
    description:
      "A description of the published demo that is comfortably long enough to pass the length rule.",
    kind: "demo",
    status: "live",
    draft: false,
    clientConsent: false,
    sector: "Testing",
    stack: ["TypeScript"],
    service: "ai-agents",
  }),
};

describe.each(["it", "en"] as const)("Hero (%s)", (locale) => {
  const copy = messages[locale].home.hero;

  it("has exactly one h1: the approved one-line offer, complete", () => {
    renderIn(locale, <HomeHero />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAccessibleName(copy.headline);
    expect(headings[0]?.textContent).toBe(copy.headline);
  });

  it("shows the eyebrow and the lead from the deck", () => {
    renderIn(locale, <HomeHero />);

    expect(screen.getByText(copy.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(copy.lead)).toBeInTheDocument();
  });

  it("the headline animates on load with CSS only (no JavaScript chunk is mounted)", () => {
    renderIn(locale, <HomeHero />);

    const words = screen
      .getByRole("heading", { level: 1 })
      .querySelectorAll("[data-fx-word]");
    expect(words.length).toBeGreaterThan(3);
    for (const word of words)
      expect(word.className).toContain("animate-word-rise");
  });

  it("the primary action goes to the contact block and the secondary one to the services on the page (no dead link)", () => {
    renderIn(locale, <HomeHero />);

    expect(screen.getByRole("link", { name: copy.primaryCta })).toHaveAttribute(
      "href",
      "#contact",
    );
    expect(
      screen.getByRole("link", { name: copy.secondaryCta }),
    ).toHaveAttribute("href", "#services");
  });

  it("both actions are 44 px targets", () => {
    renderIn(locale, <HomeHero />);

    for (const name of [copy.primaryCta, copy.secondaryCta]) {
      expect(screen.getByRole("link", { name }).className).toContain(
        "min-h-12",
      );
    }
  });
});

describe.each(["it", "en"] as const)("Proof strip (%s)", (locale) => {
  it("lists the four technical commitments in order, each with its sentence", () => {
    renderIn(locale, <HomeProof />);

    const copy = messages[locale].home.proof;
    const section = screen.getByRole("region", { name: copy.title });
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.querySelector("h3")?.textContent)).toEqual([
      copy.items.owner.title,
      copy.items.quality.title,
      copy.items.human.title,
      copy.items.privacy.title,
    ]);
    expect(items[0]).toHaveTextContent(copy.items.owner.text);
  });

  it("shows no figure: no metric has been supplied and none may be invented (docs/CONTENT.md)", () => {
    renderIn(locale, <HomeProof />);

    // The index labels (01-04) are aria-hidden decoration: read the real copy only.
    const copy = [...screen.getByRole("region").querySelectorAll("h3, p")]
      .map((node) => node.textContent)
      .join(" ");
    expect(copy.length).toBeGreaterThan(100);
    expect(copy).not.toMatch(/\d/);
  });
});

describe.each(["it", "en"] as const)("Services grid (%s)", (locale) => {
  const services = () => getServices(locale);

  it("shows the four services from the content collection, in order, as spotlight cards", () => {
    renderIn(locale, <HomeServices services={services()} />);

    const section = screen.getByRole("region", {
      name: messages[locale].home.services.title,
    });
    const cards = within(section).getAllByRole("listitem");
    expect(cards.map((card) => card.querySelector("h3")?.textContent)).toEqual(
      services().map((service) => service.data.title),
    );
    expect(cards).toHaveLength(4);
    expect(section.querySelectorAll("[data-fx='spotlight-card']")).toHaveLength(
      4,
    );
    expect(cards[0]).toHaveTextContent(services()[0]?.data.summary ?? "?");
  });

  it("is the #services anchor that the hero links to, named by its h2", () => {
    renderIn(locale, <HomeServices services={services()} />);

    const section = document.querySelector("#services");
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-labelledby")).toBe("home-services");
    expect(document.getElementById("home-services")?.tagName).toBe("H2");
  });

  it("shows the technologies of each service in mono type", () => {
    renderIn(locale, <HomeServices services={services()} />);

    expect(screen.getAllByText(/TypeScript · Next\.js/).length).toBeGreaterThan(
      0,
    );
  });

  it("has NO links when the services pages are not available (a link to a 404 is worse than none)", () => {
    renderIn(locale, <HomeServices services={services()} linked={false} />);

    expect(screen.queryAllByRole("link")).toEqual([]);
  });

  it("links to the services pages by default now that they exist (P2.3)", () => {
    renderIn(locale, <HomeServices services={services()} />);

    expect(
      screen.getAllByRole("link").map((link) => link.getAttribute("href")),
    ).toEqual([
      ...services().map((service) => `/it/services/${service.slug}`),
      "/it/services",
    ]);
  });

  it("links each card, and the whole section to /services, once the pages exist", () => {
    renderIn(locale, <HomeServices services={services()} linked />);

    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      ...services().map((service) => `/it/services/${service.slug}`),
      "/it/services",
    ]);
    expect(
      screen.getByRole("link", { name: messages[locale].home.services.cta }),
    ).toBeInTheDocument();
  });

  it("each card link has a name that says which service (not four identical 'learn more')", () => {
    renderIn(locale, <HomeServices services={services()} linked />);

    const names = screen
      .getAllByRole("link")
      .slice(0, 4)
      .map((link) => link.textContent);
    expect(new Set(names).size).toBe(4);
  });
});

describe.each(["it", "en"] as const)("Demos (%s)", (locale) => {
  it("renders NOTHING today: every demo is a draft and none may be advertised before it exists", () => {
    const { container } = renderIn(
      locale,
      <HomeDemos demos={getWork(locale)} />,
    );

    expect(getWork(locale)).toEqual([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("appears once a demo is published, with the simulation notice and no link until the pages exist", () => {
    renderIn(locale, <HomeDemos demos={[publishedDemo]} />);

    const copy = messages[locale].home.demos;
    const section = screen.getByRole("region", { name: copy.title });
    expect(
      within(section).getByRole("heading", { level: 3 }),
    ).toHaveTextContent(publishedDemo.data.title);
    expect(section).toHaveTextContent(messages[locale].work.labels.simulation);
    expect(within(section).queryAllByRole("link")).toEqual([]);
  });

  it("links to the demo and to /work when those pages exist", () => {
    renderIn(locale, <HomeDemos demos={[publishedDemo]} linked />);

    expect(
      screen.getByRole("link", { name: publishedDemo.data.title }),
    ).toHaveAttribute("href", "/it/work/published-demo");
    expect(
      screen.getByRole("link", { name: messages[locale].home.demos.cta }),
    ).toHaveAttribute("href", "/it/work");
  });
});

describe.each(["it", "en"] as const)("Process timeline (%s)", (locale) => {
  it("is the pinned story: the four phases in order, every one present and unhidden in the markup", () => {
    renderIn(locale, <HomeProcess />);

    const steps = messages[locale].process.steps;
    const section = screen.getByRole("region", {
      name: messages[locale].home.process.title,
    });
    const items = [...section.querySelectorAll("[data-fx-step]")];
    expect(items).toHaveLength(4);
    expect(items.map((item) => item.querySelector("h3")?.textContent)).toEqual(
      processStepKeys.map((key) => steps[key].title),
    );
    expect(items[3]).toHaveTextContent(steps.launch.summary);
    for (const item of items) expect(item.getAttribute("style")).toBeNull();
    expect(document.querySelector("[data-fx='pinned-section']")).not.toBeNull();
  });

  it("has no link while /process does not exist, and one once it does", () => {
    const { unmount } = renderIn(locale, <HomeProcess />);
    expect(screen.queryAllByRole("link")).toEqual([]);
    unmount();

    renderIn(locale, <HomeProcess linked />);
    expect(
      screen.getByRole("link", { name: messages[locale].home.process.cta }),
    ).toHaveAttribute("href", "/it/process");
  });

  it("the steps are text only: nothing focusable can hide inside a faded step", () => {
    renderIn(locale, <HomeProcess />);

    for (const step of document.querySelectorAll("[data-fx-step]")) {
      expect(step.querySelector("a, button, input, [tabindex]")).toBeNull();
    }
  });
});

describe.each(["it", "en"] as const)("Final call to action (%s)", (locale) => {
  it("sits on the ambient mesh, with an h2 and an action to the contact block", () => {
    renderIn(locale, <HomeFinalCta />);

    const copy = messages[locale].home.finalCta;
    expect(document.querySelector("[data-fx='gradient-mesh']")).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 2, name: copy.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(copy.body)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.cta })).toHaveAttribute(
      "href",
      "#contact",
    );
  });

  it("the mesh layers are decorative: hidden from assistive technology and not interactive", () => {
    renderIn(locale, <HomeFinalCta />);

    const layers = document.querySelector(
      "[data-fx='gradient-mesh'] > [aria-hidden='true']",
    );
    expect(layers).not.toBeNull();
    expect(layers?.querySelector("a, button, [tabindex]")).toBeNull();
  });
});

describe.each(["it", "en"] as const)("The whole page (%s)", (locale) => {
  const renderPage = async () => {
    currentLocale = locale;
    return renderIn(locale, await HomePage());
  };

  it("has the sections in order: hero, proof, services, process, final call to action (demos only when published)", async () => {
    await renderPage();

    const copy = messages[locale].home;
    const h2s = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(h2s).toEqual([
      copy.proof.title,
      copy.services.title,
      copy.process.title,
      copy.finalCta.title,
    ]);
  });

  it("has one h1 and heading levels never skip (h1, h2, h3)", async () => {
    await renderPage();

    const levels = screen
      .getAllByRole("heading")
      .map((h) => Number(h.tagName.slice(1)));
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(
        levels[i] - levels[i - 1],
        `heading ${String(i)}`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("does not render its own <main> (the layout owns the single landmark)", async () => {
    await renderPage();

    expect(screen.queryByRole("main")).not.toBeInTheDocument();
  });

  it("every link goes to a page that exists (the services pages) or to an in-page anchor: no dead link before P2.4-P2.5", async () => {
    await renderPage();

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(2);
    const services = new Set([
      "/it/services",
      ...getServices(locale).map((service) => `/it/services/${service.slug}`),
    ]);
    for (const href of hrefs) {
      expect(href.startsWith("#") || services.has(href), href).toBe(true);
    }
    // #contact lives in the footer (the layout), #services on this page.
    expect(document.querySelector("#services")).not.toBeNull();
  });

  it("every visible sentence comes from the approved deck or the content files: no hard-coded copy", async () => {
    await renderPage();

    const text = document.body.textContent;
    const copy = messages[locale].home;
    for (const sentence of [
      copy.hero.headline,
      copy.hero.lead,
      copy.services.lead,
      copy.process.lead,
      copy.finalCta.body,
    ]) {
      expect(text).toContain(sentence);
    }
  });

  it("states no unverifiable claim anywhere on the page (the same filter as the content gate)", async () => {
    await renderPage();

    const { claimProblems } = await import("@/lib/content/lint");
    expect(claimProblems(document.body.textContent)).toEqual([]);
  });
});
