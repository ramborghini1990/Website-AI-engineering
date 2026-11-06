import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JsonLd } from "@/components/content/json-ld";
import { Markdown } from "@/components/content/markdown";
import { ServiceDetail } from "@/components/services/service-detail";
import { ServicesIndex } from "@/components/services/services-index";
import type { Locale } from "@/i18n/routing";
import { getServices } from "@/lib/content/read";
import { claimProblems } from "@/lib/content/lint";
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

describe("Markdown", () => {
  it("renders headings as h2, paragraphs, lists and emphasis", () => {
    const { container } = render(
      <Markdown
        body={"## Heading\n\nA **strong** and *soft* word.\n\n- one\n- two\n"}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Heading" }),
    ).toBeInTheDocument();
    expect(container.querySelector("strong")).toHaveTextContent("strong");
    expect(container.querySelector("em")).toHaveTextContent("soft");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      ["one", "two"],
    );
    expect(screen.queryAllByRole("heading", { level: 1 })).toEqual([]);
  });

  it("sends /contact to the contact block while the page does not exist", () => {
    render(<Markdown body={"## A\n\nPlease [talk to me](/contact) soon."} />);

    expect(screen.getByRole("link", { name: "talk to me" })).toHaveAttribute(
      "href",
      "#contact",
    );
  });

  it("links an existing internal page through the locale-aware Link", () => {
    render(<Markdown body={"## A\n\nSee [the services](/services)."} />);

    expect(screen.getByRole("link", { name: "the services" })).toHaveAttribute(
      "href",
      "/it/services",
    );
  });

  it("shows a link to a page that does not exist yet as plain text, not a dead link", () => {
    render(
      <Markdown
        body={"## A\n\nSee [the method](/process) and [the team](/about)."}
      />,
    );

    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(screen.getByText(/the method/)).toBeInTheDocument();
  });

  it("opens an https link without leaking the opener", () => {
    render(
      <Markdown body={"## A\n\nRead [the docs](https://example.eu/docs)."} />,
    );

    const link = screen.getByRole("link", { name: "the docs" });
    expect(link).toHaveAttribute("href", "https://example.eu/docs");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("never makes a link or an element from hostile text (negative)", () => {
    const { container } = render(
      <Markdown
        body={
          "## A\n\n[x](javascript:alert(1)) [y](//evil.example) <img src=x onerror=alert(1)> <script>alert(1)</script>\n"
        }
      />,
    );

    expect(screen.queryAllByRole("link")).toEqual([]);
    expect(container.querySelector("script, img")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});

describe("JsonLd", () => {
  it("emits one application/ld+json script that parses and cannot be broken out of (negative)", () => {
    const { container } = render(<JsonLd data={{ name: "</script><b>" }} />);

    const script = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script).not.toBeNull();
    expect(script?.innerHTML).not.toContain("<");
    expect(JSON.parse(script?.textContent ?? "")).toEqual({
      name: "</script><b>",
    });
  });
});

describe.each(["it", "en"] as const)("ServiceDetail (%s)", (locale) => {
  const labels = messages[locale].services.labels;
  const entry = () => {
    const first = getServices(locale).at(0);
    if (!first) throw new Error("no service");
    return first;
  };

  it("has one h1, the service title, and the summary under it", () => {
    const { data, body } = entry();
    renderIn(locale, <ServiceDetail service={data} body={body} demo={null} />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent(data.title);
    expect(screen.getByText(data.summary)).toBeInTheDocument();
  });

  it("renders the body, then the three lists from the frontmatter and the technologies", () => {
    const { data, body } = entry();
    renderIn(locale, <ServiceDetail service={data} body={body} demo={null} />);

    const h2 = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(h2).toEqual(
      expect.arrayContaining([
        labels.idealFor,
        labels.outcomes,
        labels.deliverables,
        labels.stack,
      ]),
    );
    for (const item of [
      ...data.idealFor,
      ...data.outcomes,
      ...data.deliverables,
    ]) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
    expect(screen.getByText(data.stack.join(" · "))).toBeInTheDocument();
    // The body headings come first, as written in the file.
    expect(h2.slice(0, 3)).toEqual(
      [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]),
    );
  });

  it("heading levels never skip (h1, then h2 only)", () => {
    const { data, body } = entry();
    renderIn(locale, <ServiceDetail service={data} body={body} demo={null} />);

    const levels = screen
      .getAllByRole("heading")
      .map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    for (const level of levels.slice(1)) expect(level).toBe(2);
  });

  it("has a breadcrumb that ends on the current page and links back to Home and Services", () => {
    const { data, body } = entry();
    renderIn(locale, <ServiceDetail service={data} body={body} demo={null} />);

    const nav = screen.getByRole("navigation", { name: labels.breadcrumb });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/it/", "/it/services"]);
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent(
      data.title,
    );
  });

  it("ends with the call to action to the contact block, and the link in the text agrees", () => {
    const { data, body } = entry();
    renderIn(locale, <ServiceDetail service={data} body={body} demo={null} />);

    const cta = screen.getByRole("link", {
      name: messages[locale].services.cta.cta,
    });
    expect(cta).toHaveAttribute("href", "#contact");
    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      expect(href.startsWith("#") || href.startsWith("/it/"), href).toBe(true);
    }
  });

  it("shows no demo section when there is no published demo", () => {
    const { data, body } = entry();
    renderIn(locale, <ServiceDetail service={data} body={body} demo={null} />);

    expect(screen.queryByText(labels.demo)).toBeNull();
  });

  it("links the demo when the page is given a published one", () => {
    const { data, body } = entry();
    renderIn(
      locale,
      <ServiceDetail
        service={data}
        body={body}
        demo={{ slug: "live-demo", title: "A live demo" }}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: labels.demo }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A live demo" })).toHaveAttribute(
      "href",
      "/it/work/live-demo",
    );
  });

  it("states no unverifiable claim anywhere on the rendered page", () => {
    for (const { data, body } of getServices(locale)) {
      const { container } = renderIn(
        locale,
        <ServiceDetail service={data} body={body} demo={null} />,
      );
      expect(claimProblems(container.textContent), data.title).toEqual([]);
      cleanup();
    }
  });
});

describe.each(["it", "en"] as const)("ServicesIndex (%s)", (locale) => {
  it("has one h1, a lead, and one h2 per service in order, each linking to its page", () => {
    const services = getServices(locale);
    renderIn(locale, <ServicesIndex services={services} />);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages[locale].services.title,
    );
    expect(
      screen.getByText(messages[locale].services.lead),
    ).toBeInTheDocument();

    const h2 = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(h2.slice(0, 4)).toEqual(
      services.map((service) => service.data.title),
    );

    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href?.startsWith("/it/services/"));
    expect(hrefs).toEqual(
      services.map((service) => `/it/services/${service.slug}`),
    );
  });

  it("each service link has its own accessible name (not four identical 'learn more')", () => {
    renderIn(locale, <ServicesIndex services={getServices(locale)} />);

    const names = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/it/services/"))
      .map((link) => link.textContent);
    expect(new Set(names).size).toBe(4);
  });
});
