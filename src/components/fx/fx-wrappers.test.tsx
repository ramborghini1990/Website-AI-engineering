import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MagneticButton } from "@/components/fx/magnetic-button";
import { ScrollPinnedSection } from "@/components/fx/scroll-pinned-section";
import { SpotlightCard } from "@/components/fx/spotlight-card";
import { TextReveal } from "@/components/fx/text-reveal";
import { mockReducedMotion } from "@/test-utils/match-media";
import { manualIdle } from "@/test-utils/idle";

// The lazy motion chunk is a marker here; its behaviour is tested in *.motion.test.tsx.
vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return {
    default: () =>
      function MotionChunkStub() {
        return createElement("div", { "data-testid": "motion-chunk" });
      },
  };
});

const { runIdle } = manualIdle();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type Case = {
  name: string;
  /** Needs a mouse-like pointer before it loads its motion. */
  pointer: boolean;
  element: () => ReactElement;
};

const CASES: Case[] = [
  {
    name: "TextReveal",
    pointer: false,
    element: () => <TextReveal text="Agents that do the work" />,
  },
  {
    name: "MagneticButton",
    pointer: true,
    element: () => (
      <MagneticButton>
        <button type="button">Start</button>
      </MagneticButton>
    ),
  },
  {
    name: "SpotlightCard",
    pointer: true,
    element: () => <SpotlightCard>Card body</SpotlightCard>,
  },
  {
    name: "ScrollPinnedSection",
    pointer: false,
    element: () => (
      <ScrollPinnedSection steps={[<p key="a">One</p>, <p key="b">Two</p>]}>
        <h2>Title</h2>
      </ScrollPinnedSection>
    ),
  },
];

describe.each(CASES)("$name: when its motion chunk loads", (testCase) => {
  const mount = () => render(testCase.element());

  it("renders no motion on the server and before the browser is idle", () => {
    mockReducedMotion(false, { finePointer: true });

    expect(renderToString(testCase.element())).not.toContain("motion-chunk");
    mount();
    expect(screen.queryByTestId("motion-chunk")).not.toBeInTheDocument();
  });

  it("loads it once the browser is idle", () => {
    mockReducedMotion(false, { finePointer: true });
    mount();

    runIdle();

    expect(screen.getByTestId("motion-chunk")).toBeInTheDocument();
  });

  it("never loads it under reduced motion, even when idle", () => {
    mockReducedMotion(true, { finePointer: true });
    mount();

    runIdle();

    expect(screen.queryByTestId("motion-chunk")).not.toBeInTheDocument();
  });

  it("drops it when the preference flips to reduced, and brings it back after", () => {
    const media = mockReducedMotion(false, { finePointer: true });
    mount();
    runIdle();
    expect(screen.getByTestId("motion-chunk")).toBeInTheDocument();

    act(() => {
      media.set(true);
    });
    expect(screen.queryByTestId("motion-chunk")).not.toBeInTheDocument();

    act(() => {
      media.set(false);
    });
    expect(screen.getByTestId("motion-chunk")).toBeInTheDocument();
  });

  it(
    testCase.pointer
      ? "does not load it without a mouse-like pointer (touch)"
      : "does not need a mouse: it loads on touch devices too",
    () => {
      mockReducedMotion(false, { finePointer: false });
      mount();

      runIdle();

      if (testCase.pointer) {
        expect(screen.queryByTestId("motion-chunk")).not.toBeInTheDocument();
      } else {
        expect(screen.getByTestId("motion-chunk")).toBeInTheDocument();
      }
    },
  );
});

describe("static markup (what renders without JavaScript)", () => {
  it("TextReveal: the complete heading, one accessible name, split words hidden from AT", () => {
    const html = renderToString(
      <TextReveal as="h1" text="Agents that do the work" />,
    );
    const host = document.createElement("div");
    host.innerHTML = html;

    const heading = host.querySelector("h1");
    expect(heading?.getAttribute("aria-label")).toBe("Agents that do the work");
    expect(heading?.textContent).toBe("Agents that do the work");
    expect(heading?.querySelector("[aria-hidden='true']")).not.toBeNull();
    expect(host.querySelectorAll("[data-fx-word]")).toHaveLength(5);
    // nothing is hidden in the markup: the animation hides things, the server does not
    expect(html).not.toMatch(/opacity:\s*0|visibility:\s*hidden/);
  });

  it("TextReveal: collapses extra whitespace and renders no empty words", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<TextReveal text="  one   two  " />);

    expect(host.querySelectorAll("[data-fx-word]")).toHaveLength(2);
    expect(host.querySelector("h2")?.textContent).toBe("one two");
  });

  it("MagneticButton: renders its child untouched inside two plain spans", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <MagneticButton>
        <button type="button">Start</button>
      </MagneticButton>,
    );

    expect(host.querySelector("button")?.textContent).toBe("Start");
    expect(host.querySelector("[data-fx-magnet] > button")).not.toBeNull();
    expect(host.querySelector("[tabindex]")).toBeNull();
  });

  it("SpotlightCard: children and extra props pass through; both discs are hidden decoration at rest", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <SpotlightCard id="card-1" data-testid="x">
        <h3>Heading</h3>
      </SpotlightCard>,
    );

    expect(host.querySelector("#card-1 h3")?.textContent).toBe("Heading");
    const discs = host.querySelectorAll("[data-fx-spot]");
    expect(discs).toHaveLength(2);
    for (const disc of discs) {
      expect(disc.getAttribute("aria-hidden")).toBe("true");
      expect(disc.className).toContain("opacity-0");
      expect(disc.className).toContain("pointer-events-none");
    }
  });

  it("ScrollPinnedSection: every step is present, in order, and none is hidden", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <ScrollPinnedSection
        steps={[
          <p key="a">First</p>,
          <p key="b">Second</p>,
          <p key="c">Third</p>,
        ]}
      >
        <h2>Process</h2>
      </ScrollPinnedSection>,
    );

    const steps = [...host.querySelectorAll("[data-fx-step]")];
    expect(steps.map((step) => step.textContent)).toEqual([
      "01First",
      "02Second",
      "03Third",
    ]);
    expect(host.querySelector("h2")?.textContent).toBe("Process");
    // the progress bar is hidden decoration until the motion pins the section
    const track = host.querySelector("[data-fx-progress-track]");
    expect(track?.getAttribute("aria-hidden")).toBe("true");
    expect(track?.className).toContain("invisible");
    // no step carries a hiding style
    for (const step of steps) expect(step.getAttribute("style")).toBeNull();
  });
});
