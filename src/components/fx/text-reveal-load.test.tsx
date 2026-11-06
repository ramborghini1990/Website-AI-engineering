import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TextReveal } from "@/components/fx/text-reveal";
import { manualIdle } from "@/test-utils/idle";
import { mockReducedMotion } from "@/test-utils/match-media";

// The lazy GSAP chunk is a marker here.
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

const delays = (container: ParentNode) =>
  [...container.querySelectorAll<HTMLElement>("[data-fx-word]")].map((word) =>
    Number.parseInt(word.style.animationDelay, 10),
  );

describe('TextReveal when="load" (the hero headline: CSS only)', () => {
  it("renders every word with the word-rise animation class, in the server HTML", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <TextReveal as="h1" when="load" text="Build agents that hold up" />,
    );

    const words = [...host.querySelectorAll("[data-fx-word]")];
    expect(words.map((word) => word.textContent)).toEqual([
      "Build",
      "agents",
      "that",
      "hold",
      "up",
    ]);
    for (const word of words)
      expect(word.className).toContain("animate-word-rise");
  });

  it("keeps the text complete and accessible: one h1 named by the full sentence, words hidden from AT", () => {
    mockReducedMotion(false);
    render(<TextReveal as="h1" when="load" text="Build agents that hold up" />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Build agents that hold up",
    });
    expect(heading.textContent).toBe("Build agents that hold up");
    expect(heading.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("starts the first word at once and finishes the stagger within 600 ms, for any length (DESIGN §6.3)", () => {
    for (const count of [2, 5, 12, 40, 120]) {
      const text = Array.from(
        { length: count },
        (_, i) => `w${String(i)}`,
      ).join(" ");
      const host = document.createElement("div");
      host.innerHTML = renderToString(<TextReveal when="load" text={text} />);

      const list = delays(host);
      expect(list[0], `${String(count)} words`).toBe(0);
      expect(Math.max(...list), `${String(count)} words`).toBeLessThanOrEqual(
        600,
      );
      expect(
        [...list].sort((a, b) => a - b),
        `${String(count)} words`,
      ).toEqual(list);
    }
  });

  it("uses 40 ms per word when the headline is short", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(
      <TextReveal when="load" text="one two three" />,
    );

    expect(delays(host)).toEqual([0, 40, 80]);
  });

  it("never loads the GSAP chunk (it needs no JavaScript), even when idle and not reduced", () => {
    mockReducedMotion(false, { finePointer: true });
    render(<TextReveal when="load" text="Build agents" />);

    runIdle();

    expect(screen.queryByTestId("motion-chunk")).not.toBeInTheDocument();
  });

  it("hides nothing in the markup: no opacity or visibility style, only an animation delay", () => {
    const html = renderToString(
      <TextReveal when="load" text="Build agents that hold up" />,
    );

    expect(html).not.toMatch(/opacity|visibility|display:\s*none/);
    expect(html).toMatch(/animation-delay:0ms/);
  });
});

describe('TextReveal when="view" (default) is unchanged', () => {
  it("has no animation class or delay, and still lazy-loads GSAP after idle", () => {
    mockReducedMotion(false);
    const host = document.createElement("div");
    host.innerHTML = renderToString(<TextReveal text="Below the fold" />);
    expect(host.querySelector("[data-fx-word]")?.className).not.toContain(
      "animate-word-rise",
    );
    expect(
      host.querySelector<HTMLElement>("[data-fx-word]")?.getAttribute("style"),
    ).toBeNull();

    render(<TextReveal text="Below the fold" />);
    runIdle();

    expect(screen.getByTestId("motion-chunk")).toBeInTheDocument();
  });
});
