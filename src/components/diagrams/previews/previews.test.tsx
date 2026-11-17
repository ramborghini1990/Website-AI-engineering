import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DemoPreview } from "@/components/diagrams/demo-preview";
import { interactiveDemos } from "@/lib/demos/registry";

afterEach(cleanup);

const MAX_MARKUP_BYTES = 12 * 1024;

describe("demo previews", () => {
  for (const slug of interactiveDemos) {
    describe(slug, () => {
      it("is decorative: aria-hidden, a 400 x 250 viewBox, fluid, no text", () => {
        const { container } = render(<DemoPreview slug={slug} />);
        const svg = container.querySelector("svg");

        expect(svg?.getAttribute("aria-hidden")).toBe("true");
        expect(svg?.getAttribute("viewBox")).toBe("0 0 400 250");
        expect(svg?.getAttribute("class")).toBe("h-auto w-full");
        expect(svg?.getAttribute("data-preview")).toBe(slug);
        // abstract bars only: no words, no names, no title or description
        expect(container.querySelector("text, tspan, title, desc")).toBeNull();
        expect(container.textContent).toBe("");
      });

      it("has exactly one accent element", () => {
        const { container } = render(<DemoPreview slug={slug} />);
        expect(container.querySelectorAll(".fill-accent")).toHaveLength(1);
        expect(container.querySelectorAll(".preview-accent")).toHaveLength(1);
      });

      it("stays within the 12 KB markup budget", () => {
        const { container } = render(<DemoPreview slug={slug} />);
        expect(
          new TextEncoder().encode(container.innerHTML).length,
        ).toBeLessThanOrEqual(MAX_MARKUP_BYTES);
      });

      it("paints with semantic tokens only and no animation", () => {
        const { container } = render(<DemoPreview slug={slug} />);
        const html = container.innerHTML;

        expect(html).not.toMatch(/(?:fill|stroke)="(?:#|rgb|hsl|oklch)/);
        expect(html).not.toMatch(/style=/);
        expect(html).not.toMatch(/(?:fill|stroke)-\[/);
        expect(html).not.toMatch(/animate-|animation/);
        expect(html).not.toMatch(/https?:|url\(/);
      });
    });
  }

  it("the business chart draws its two series in fill-accent and fill-trace, and nothing else", () => {
    const { container } = render(
      <DemoPreview slug="business-management-app" />,
    );
    const series = [...container.querySelectorAll("path")].filter((path) =>
      /fill-(?:accent|trace)/.test(path.getAttribute("class") ?? ""),
    );

    expect(series.map((path) => path.getAttribute("class"))).toEqual([
      "preview-accent fill-accent",
      "fill-trace",
    ]);
    // no third series colour anywhere in the chart's paths
    for (const path of container.querySelectorAll("path")) {
      expect(path.getAttribute("class") ?? "").not.toMatch(
        /fill-(?:success|warning|text|text-muted|border)/,
      );
    }
  });

  it("the document preview marks the doubtful field with warning, dashed, plus a glyph (not colour alone)", () => {
    const { container } = render(
      <DemoPreview slug="document-intelligence-demo" />,
    );
    const warning = [...container.querySelectorAll(".stroke-warning")];

    expect(warning.length).toBeGreaterThanOrEqual(2);
    expect(
      warning.some((el) => el.getAttribute("stroke-dasharray") !== null),
    ).toBe(true);
    expect(warning.some((el) => el.tagName.toLowerCase() === "path")).toBe(
      true,
    );
  });

  it("the linkedin preview shows a success check on each scheduled row", () => {
    const { container } = render(
      <DemoPreview slug="linkedin-assisted-outreach" />,
    );
    expect(container.querySelectorAll("path.fill-success")).toHaveLength(3);
  });

  it("renders nothing for a slug that is not an interactive demo (negative)", () => {
    for (const slug of ["fixture-case-study", "", "constructor", "unknown"]) {
      const { container } = render(<DemoPreview slug={slug} />);
      expect(container.innerHTML, JSON.stringify(slug)).toBe("");
    }
  });
});
