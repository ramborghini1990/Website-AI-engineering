import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SERVICE_SLUGS, serviceDiagrams } from "@/lib/diagrams/services";
import { ServiceGlyph } from "./service-glyph";

afterEach(cleanup);

const markup = (slug: (typeof SERVICE_SLUGS)[number]) =>
  render(<ServiceGlyph slug={slug} />).container.innerHTML;

describe("<ServiceGlyph>", () => {
  for (const slug of SERVICE_SLUGS) {
    describe(slug, () => {
      it("is decorative: aria-hidden, an 80 x 48 viewBox, fluid sizing, no text", () => {
        const { container } = render(<ServiceGlyph slug={slug} />);
        const svg = container.querySelector("svg");

        expect(svg?.getAttribute("aria-hidden")).toBe("true");
        expect(svg?.getAttribute("viewBox")).toBe("0 0 80 48");
        expect(svg?.getAttribute("class")).toBe("h-auto w-full");
        expect(container.querySelector("text, tspan, title, desc")).toBeNull();
        expect(container.textContent).toBe("");
      });

      it("draws one 8 x 8 square per legend step, all inside the viewBox and apart from each other", () => {
        const { container } = render(<ServiceGlyph slug={slug} />);
        const squares = [...container.querySelectorAll("rect")].map((rect) => ({
          x: Number(rect.getAttribute("x")),
          y: Number(rect.getAttribute("y")),
          w: Number(rect.getAttribute("width")),
          h: Number(rect.getAttribute("height")),
        }));

        expect(squares).toHaveLength(serviceDiagrams[slug].steps.length);
        for (const square of squares) {
          expect([square.w, square.h]).toEqual([8, 8]);
          expect(square.x).toBeGreaterThanOrEqual(0);
          expect(square.y).toBeGreaterThanOrEqual(0);
          expect(square.x + 8).toBeLessThanOrEqual(80);
          expect(square.y + 8).toBeLessThanOrEqual(48);
        }
        for (const [i, a] of squares.entries()) {
          for (const b of squares.slice(i + 1)) {
            const apart = Math.abs(a.x - b.x) >= 8 || Math.abs(a.y - b.y) >= 8;
            expect(apart, `${slug}: two squares overlap`).toBe(true);
          }
        }
      });

      it("has the person's step as the one accent square and links the steps", () => {
        const { container } = render(<ServiceGlyph slug={slug} />);

        expect(container.querySelectorAll(".fill-accent")).toHaveLength(1);
        expect(container.querySelectorAll("path").length).toBeGreaterThan(0);
      });

      it("paints with semantic tokens only", () => {
        const html = markup(slug);

        expect(html).not.toMatch(/(?:fill|stroke)="(?:#|rgb|hsl|oklch)/);
        expect(html).not.toMatch(/style=/);
        expect(html).not.toMatch(/(?:fill|stroke)-\[/);
      });
    });
  }

  it("draws four different glyphs", () => {
    const all = SERVICE_SLUGS.map((slug) =>
      markup(slug).replace(/data-glyph="[^"]*"/, ""),
    );
    cleanup();

    expect(new Set(all).size).toBe(SERVICE_SLUGS.length);
  });
});
