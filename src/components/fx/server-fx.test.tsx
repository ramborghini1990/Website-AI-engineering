import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { meshOpacity } from "@/components/fx/fx-tokens";
import { GradientMesh } from "@/components/fx/gradient-mesh";
import { Marquee } from "@/components/fx/marquee";

const ITEMS = ["Next.js", "Postgres", "Zod", "Claude API"];

describe("Marquee", () => {
  const setup = () =>
    render(
      <Marquee
        items={ITEMS}
        label="Technologies"
        pauseLabel="Pause the ticker"
      />,
    );

  it("exposes one named list with every item; the looping copy is hidden from assistive technology", () => {
    const { container } = setup();

    const list = screen.getByRole("list", { name: "Technologies" });
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((i) => i.textContent),
    ).toEqual(ITEMS);
    const lists = container.querySelectorAll("ul");
    expect(lists).toHaveLength(2);
    expect(lists[1].getAttribute("aria-hidden")).toBe("true");
    expect(lists[1].textContent).toBe(lists[0].textContent);
  });

  it("has a real, labelled pause switch (works with the keyboard and without JavaScript)", () => {
    setup();

    const toggle = screen.getByRole("checkbox", { name: "Pause the ticker" });
    expect(toggle).not.toBeChecked();
    expect(toggle.closest("label")?.className).toContain("min-h-11");
  });

  it("runs from the animation token and pauses on hover and when the switch is checked", () => {
    const { container } = setup();

    const track = container.querySelector(
      "[data-fx='marquee'] .animate-marquee",
    );
    expect(track).not.toBeNull();
    expect(track?.className).toContain("group-hover/viewport:animation-paused");
    expect(track?.className).toContain(
      "group-has-[:checked]/ticker:animation-paused",
    );
  });

  it("falls back to a wrapped static list under reduced motion: copy and switch hidden, no clipping", () => {
    const { container } = setup();

    const [first, copy] = container.querySelectorAll("ul");
    expect(first.className).toContain("motion-reduce:flex-wrap");
    expect(copy.className).toContain("motion-reduce:hidden");
    expect(container.querySelector("label")?.className).toContain(
      "motion-reduce:hidden",
    );
    expect(container.querySelector(".group\\/viewport")?.className).toContain(
      "motion-reduce:overflow-visible",
    );
  });

  it("scales the loop length with the number of items and never goes below 20 s", () => {
    const { container, rerender } = setup();
    const viewport = () =>
      container.querySelector<HTMLElement>(".group\\/viewport");
    expect(viewport()?.style.getPropertyValue("--marquee-duration")).toBe(
      "20s",
    );

    rerender(
      <Marquee
        items={Array.from({ length: 12 }, (_, i) => `item ${String(i)}`)}
        label="x"
        pauseLabel="y"
        secondsPerItem={4}
      />,
    );
    expect(viewport()?.style.getPropertyValue("--marquee-duration")).toBe(
      "48s",
    );
  });
});

describe("GradientMesh", () => {
  it("renders its children above hidden decorative layers", () => {
    const { container } = render(
      <GradientMesh>
        <h2>Content</h2>
      </GradientMesh>,
    );

    expect(
      screen.getByRole("heading", { name: "Content" }),
    ).toBeInTheDocument();
    const layers = container.querySelector("[aria-hidden='true']");
    expect(layers).not.toBeNull();
    expect(layers?.className).toContain("pointer-events-none");
    expect(layers?.children).toHaveLength(3);
    expect(layers?.querySelector("a, button, input, [tabindex]")).toBeNull();
  });

  it("isolates and clips itself so the blobs never leak behind the page or add scrolling", () => {
    const { container } = render(<GradientMesh />);

    const root = container.firstElementChild;
    expect(root?.className).toContain("isolate");
    expect(root?.className).toContain("overflow-hidden");
  });

  it("uses the opacities from fx-tokens (the values the contrast test proves)", () => {
    const { container } = render(<GradientMesh />);

    const blobs = [
      ...container.querySelectorAll<HTMLElement>("[aria-hidden='true'] > div"),
    ];
    expect(blobs.map((blob) => Number(blob.style.opacity))).toEqual([
      meshOpacity.a,
      meshOpacity.b,
      meshOpacity.c,
    ]);
  });

  it("keeps the blobs faint: each peak is at most 5 %", () => {
    for (const opacity of Object.values(meshOpacity)) {
      expect(opacity).toBeLessThanOrEqual(0.05);
    }
  });
});
