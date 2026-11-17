import { cleanup, render, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { Locale } from "@/i18n/routing";
import { heroDiagram } from "@/lib/diagrams/hero";
import type { Diagram as DiagramData } from "@/lib/diagrams/types";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";
import { Diagram } from "./diagram";

const messages = { it: it_, en } as const;

/** The longest the markup of one diagram may be (docs/DESIGN.md §7.1). */
const MAX_MARKUP_BYTES = 12 * 1024;
/** The whole entrance sequence, in ms (docs/DESIGN.md §7.1). */
const MAX_SEQUENCE_MS = 4500;
const NARRATIVE_MS = 1100; // --duration-narrative; keep in step with globals.css
const NODE_IN_MS = 480; // --duration-slow

afterEach(cleanup);

function renderIn(ui: ReactElement, locale: Locale = "it") {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}

const hero = (props: { animate?: boolean } = {}) => (
  <Diagram diagram={heroDiagram} namespace="diagrams.hero" {...props} />
);

describe("<Diagram>", () => {
  it("renders a figure named by its title, with a caption and a legend of one item per step", () => {
    const { container } = renderIn(hero());
    const figure = container.querySelector("figure");

    expect(figure?.getAttribute("data-diagram")).toBe("hero");
    const titleId = figure?.getAttribute("aria-labelledby") ?? "";
    expect(container.querySelector(`[id="${titleId}"]`)?.textContent).toBe(
      "Come lavora un agente",
    );
    expect(figure?.querySelector("figcaption")).not.toBeNull();
    const items = figure?.querySelectorAll("figcaption ol > li[data-step]");
    expect(items).toHaveLength(heroDiagram.steps.length);
    expect(
      [...(items ?? [])].map((li) => li.getAttribute("data-step")),
    ).toEqual([...heroDiagram.steps]);
  });

  it("hides the drawing from assistive technology and gives it a viewBox and fluid sizing", () => {
    const { container } = renderIn(hero());
    const svg = container.querySelector("svg");

    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 400 440");
    expect(svg?.getAttribute("class")).toBe("h-auto w-full");
  });

  it("tells the whole story in HTML text, without CSS or the drawing", () => {
    for (const locale of ["it", "en"] as const) {
      const { container } = renderIn(hero(), locale);
      const legend = container.querySelector("ol");
      const steps = messages[locale].diagrams.hero.steps;
      for (const step of heroDiagram.steps) {
        expect(legend?.textContent, `${locale} ${step}`).toContain(
          steps[step as keyof typeof steps],
        );
      }
      cleanup();
    }
  });

  it("keeps every font size at 15 user units or more", () => {
    const { container } = renderIn(hero());
    const sizes = [
      ...container.innerHTML.matchAll(/font-size="([\d.]+)"/g),
    ].map((m) => Number(m[1]));

    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(15);
  });

  it("stays within the 12 KB markup budget", () => {
    const { container } = renderIn(hero());
    expect(
      new TextEncoder().encode(container.innerHTML).length,
    ).toBeLessThanOrEqual(MAX_MARKUP_BYTES);
  });

  it("has exactly one accent element, and the person's state is also written as text", () => {
    const { container } = renderIn(hero());

    expect(container.querySelectorAll(".fill-accent")).toHaveLength(1);
    const review = container.querySelector('[data-node="review"]');
    expect(review?.querySelector(".fill-accent")).not.toBeNull();
    expect(review?.textContent).toContain("Persona");
    // the done state: a check mark in success plus its label
    const action = container.querySelector('[data-node="action"]');
    expect(action?.querySelector(".fill-success")).not.toBeNull();
    expect(action?.textContent).toContain("Eseguita");
  });

  it("numbers the top-level nodes after their legend step and leaves the parts of a node unnumbered", () => {
    const { container } = renderIn(hero());
    const text = (id: string) =>
      container.querySelector(`[data-node="${id}"] text`)?.textContent ?? "";

    expect(text("request")).toMatch(/^01\s*Richiesta$/);
    expect(text("tools")).toMatch(/^03\s*Strumenti$/);
    expect(text("model")).toBe("Modello");
  });

  it("gives two diagrams on one page different pattern ids", () => {
    const { container } = renderIn(
      <>
        {hero()}
        {hero({ animate: false })}
      </>,
    );
    const ids = [...container.querySelectorAll("pattern")].map((p) => p.id);

    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => !id.includes(":"))).toBe(true);
  });

  it("uses only token colours: no inline fill, stroke or colour style", () => {
    const { container } = renderIn(hero());
    expect(container.innerHTML).not.toMatch(
      /(?:fill|stroke)="(?:#|rgb|hsl|oklch)/,
    );
    expect(container.innerHTML).not.toMatch(
      /style="[^"]*(?:color|fill|stroke):/,
    );
  });
});

describe("<Diagram> animation", () => {
  const animationClasses = (html: string) =>
    [...html.matchAll(/\banimate-[a-z-]+/g)].map((m) => m[0]);

  it("a diagram that does not animate renders no animation class, style or packet motion", () => {
    const still: DiagramData = { ...heroDiagram, animated: false };
    const { container } = renderIn(
      <Diagram diagram={still} namespace="diagrams.hero" />,
    );

    expect(animationClasses(container.innerHTML)).toEqual([]);
    expect(container.innerHTML).not.toMatch(/animation/);
    expect(container.innerHTML).not.toContain("--packet");
    // the parked packet is still there, as the end state
    expect(container.querySelectorAll("circle.fill-text")).toHaveLength(1);
  });

  it("an animated diagram rendered with animate={false} is also still", () => {
    const { container } = renderIn(hero({ animate: false }));
    expect(animationClasses(container.innerHTML)).toEqual([]);
  });

  it("an animated diagram staggers its nodes by 80 ms from 600 ms", () => {
    const { container } = renderIn(hero());
    const delays = heroDiagram.nodes.map((node) =>
      Number.parseInt(
        container.querySelector<HTMLElement>(`[data-node="${node.id}"]`)?.style
          .animationDelay ?? "NaN",
        10,
      ),
    );

    expect(delays).toEqual(heroDiagram.nodes.map((_, i) => 600 + 80 * i));
    expect(
      container.querySelector('[data-node="request"]')?.getAttribute("class"),
    ).toBe("animate-node-in");
  });

  it("runs the packet in one chained leg per route segment, ending parked on review", () => {
    const { container } = renderIn(hero());
    const legs = [
      ...container.querySelectorAll<SVGGElement>("g.animate-packet"),
    ];
    const route = heroDiagram.packet ?? [];

    expect(legs).toHaveLength(route.length - 1);
    // nested: each leg contains the next
    for (const [i, leg] of legs.entries()) {
      expect(leg.querySelector("g.animate-packet") !== null).toBe(
        i < legs.length - 1,
      );
    }
    // the dot rests on the last route point
    const dot = container.querySelector("circle.fill-text");
    expect(dot?.getAttribute("cx")).toBe(String(route.at(-1)?.[0]));
    expect(dot?.getAttribute("cy")).toBe(String(route.at(-1)?.[1]));
  });

  it("finishes the whole sequence in under 4.5 s", () => {
    const { container } = renderIn(hero());
    const ends: number[] = [];

    for (const el of container.querySelectorAll<HTMLElement>("[style]")) {
      const style = el.getAttribute("style") ?? "";
      const delay = /animation-delay:\s*([^;]+)/.exec(style)?.[1] ?? "";
      const duration = /animation-duration:\s*([^;]+)/.exec(style)?.[1] ?? "";
      const calc = (value: string) => {
        // "calc(1000ms + var(--duration-narrative) * 1.5)" or "600ms" or "calc(var(--duration-narrative) * 0.4)"
        const base = /(\d+)ms/.exec(value)?.[1] ?? "0";
        const factor = /\* ([\d.]+)\)/.exec(value)?.[1] ?? "0";
        return Number(base) + NARRATIVE_MS * Number(factor);
      };
      const isPacketLeg = el.classList.contains("animate-packet");
      ends.push(calc(delay) + (isPacketLeg ? calc(duration) : NODE_IN_MS));
    }

    expect(ends.length).toBeGreaterThan(heroDiagram.nodes.length);
    expect(Math.max(...ends)).toBeLessThan(MAX_SEQUENCE_MS);
  });

  it("only uses the two diagram animation tokens", () => {
    const { container } = renderIn(hero());
    expect(new Set(animationClasses(container.innerHTML))).toEqual(
      new Set(["animate-node-in", "animate-packet"]),
    );
    // also reachable by role: the legend is plain text, never animated
    expect(within(container).getAllByRole("listitem").length).toBe(
      heroDiagram.steps.length,
    );
  });
});
