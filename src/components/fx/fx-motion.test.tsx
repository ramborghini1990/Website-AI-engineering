import { cleanup, render } from "@testing-library/react";
import { useRef, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { spotlightSurfaceOpacity } from "@/components/fx/fx-tokens";
import MagneticMotion from "@/components/fx/magnetic-button.motion";
import PinnedMotion from "@/components/fx/scroll-pinned-section.motion";
import SpotlightMotion from "@/components/fx/spotlight-card.motion";
import TextRevealMotion from "@/components/fx/text-reveal.motion";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { mockReducedMotion } from "@/test-utils/match-media";

/** Mounts `motion` over `children`, sharing one ref like the real wrappers do. */
function Harness({
  tag: Tag = "div",
  motion: Motion,
  children,
}: {
  tag?: "div" | "h2" | "span" | "section";
  motion: (props: { scope: React.RefObject<HTMLElement | null> }) => null;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  return (
    <>
      {/* @ts-expect-error the ref type of a dynamic tag is not worth modelling in a test */}
      <Tag ref={ref} data-testid="host">
        {children}
      </Tag>
      <Motion scope={ref} />
    </>
  );
}

function rect(init: Partial<DOMRect>): DOMRect {
  const base = {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
  };
  return { ...base, ...init, toJSON: () => ({}) };
}

function stubRect(element: Element, init: Partial<DOMRect>) {
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(rect(init));
}

/** Finish every running tween on `element` (quickTo and friends), as if time passed. */
function finish(element: Element) {
  for (const tween of gsap.getTweensOf(element)) tween.progress(1);
}

function pointer(type: string, init: { x: number; y: number; kind?: string }) {
  const event = new MouseEvent(type, {
    clientX: init.x,
    clientY: init.y,
    bubbles: true,
  });
  Object.defineProperty(event, "pointerType", { value: init.kind ?? "mouse" });
  return event;
}

beforeEach(() => {
  mockReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // Nothing from one test may survive into the next.
  expect(ScrollTrigger.getAll()).toHaveLength(0);
});

describe("TextRevealMotion", () => {
  const words = ["Agents", "that", "work"];
  const renderHeading = () =>
    render(
      <Harness tag="h2" motion={TextRevealMotion}>
        {words.map((word) => (
          <span key={word} data-fx-word>
            {word}{" "}
          </span>
        ))}
      </Harness>,
    );

  it("animates the words once when the heading is below the trigger line", () => {
    const { getByTestId, container } = (() => {
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
        rect({ top: 4000 }),
      );
      return renderHeading();
    })();

    const spans = [
      ...container.querySelectorAll<HTMLElement>("[data-fx-word]"),
    ];
    expect(spans.every((span) => gsap.getTweensOf(span).length === 1)).toBe(
      true,
    );
    expect(ScrollTrigger.getAll()).toHaveLength(1);
    expect(ScrollTrigger.getAll()[0]?.trigger).toBe(getByTestId("host"));
    // it animates FROM hidden TO the server-rendered state
    expect(spans.every((span) => span.style.opacity === "0")).toBe(true);
  });

  it("keeps the total stagger within 600 ms even for a long headline", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      rect({ top: 4000 }),
    );
    const long = Array.from({ length: 60 }, (_, i) => `w${String(i)}`);
    const { container } = render(
      <Harness tag="h2" motion={TextRevealMotion}>
        {long.map((word) => (
          <span key={word} data-fx-word>
            {word}
          </span>
        ))}
      </Harness>,
    );

    const starts = [
      ...container.querySelectorAll<HTMLElement>("[data-fx-word]"),
    ].map((span) => gsap.getTweensOf(span)[0]?.startTime() ?? Number.NaN);
    expect(Math.max(...starts) - Math.min(...starts)).toBeLessThanOrEqual(
      0.6 + 1e-6,
    );
  });

  it("leaves a heading that is already on screen alone: no tween, no trigger, nothing hidden", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      rect({ top: 100 }),
    );

    const { container } = renderHeading();

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    for (const span of container.querySelectorAll<HTMLElement>(
      "[data-fx-word]",
    )) {
      expect(gsap.getTweensOf(span)).toHaveLength(0);
      expect(span.style.opacity).toBe("");
    }
  });

  it("does nothing under reduced motion", () => {
    mockReducedMotion(true);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      rect({ top: 4000 }),
    );

    const { container } = renderHeading();

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(
      container.querySelector<HTMLElement>("[data-fx-word]")?.style.opacity,
    ).toBe("");
  });

  it("removes the trigger and restores the words on unmount", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      rect({ top: 4000 }),
    );
    const { container, unmount } = renderHeading();
    const span = container.querySelector<HTMLElement>("[data-fx-word]");
    expect(ScrollTrigger.getAll()).toHaveLength(1);

    unmount();

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(span?.style.opacity).toBe("");
  });
});

describe("MagneticMotion", () => {
  const setup = () => {
    const view = render(
      <Harness motion={MagneticMotion}>
        <span data-fx-magnet>
          <button type="button">Go</button>
        </span>
      </Harness>,
    );
    const host = view.getByTestId("host");
    const magnet = host.querySelector<HTMLElement>("[data-fx-magnet]");
    if (!magnet) throw new Error("magnet missing");
    // a 100 x 40 button whose centre is (50, 20)
    stubRect(host, { left: 0, top: 0, width: 100, height: 40 });
    return { ...view, host, magnet };
  };
  const offset = (magnet: HTMLElement) => ({
    x: Number(gsap.getProperty(magnet, "x")),
    y: Number(gsap.getProperty(magnet, "y")),
  });

  it("leans toward a nearby mouse, by a fraction of the offset", () => {
    const { magnet } = setup();

    window.dispatchEvent(pointer("pointermove", { x: 60, y: 30 }));
    finish(magnet);

    expect(offset(magnet).x).toBeCloseTo(3.5, 5);
    expect(offset(magnet).y).toBeCloseTo(3.5, 5);
  });

  it("never travels further than 12 px", () => {
    const { magnet } = setup();

    window.dispatchEvent(pointer("pointermove", { x: 140, y: -20 }));
    finish(magnet);

    expect(offset(magnet)).toEqual({ x: 12, y: -12 });
  });

  it("lets go when the mouse is further than the reach away", () => {
    const { magnet } = setup();
    window.dispatchEvent(pointer("pointermove", { x: 60, y: 30 }));
    finish(magnet);
    expect(offset(magnet).x).toBeGreaterThan(0);

    window.dispatchEvent(pointer("pointermove", { x: 400, y: 300 }));
    finish(magnet);

    expect(offset(magnet)).toEqual({ x: 0, y: 0 });
  });

  it("ignores touch and pen pointers", () => {
    const { magnet } = setup();

    finish(magnet); // quickTo keeps a +=0.1 template tween: take the baseline after it
    const baseline = offset(magnet);

    window.dispatchEvent(
      pointer("pointermove", { x: 60, y: 30, kind: "touch" }),
    );
    finish(magnet);

    expect(offset(magnet)).toEqual(baseline);
  });

  it("only moves transforms of the inner element, never the layout box", () => {
    const { magnet, host } = setup();

    window.dispatchEvent(pointer("pointermove", { x: 60, y: 30 }));
    finish(magnet);

    expect(magnet.style.transform).toContain("translate");
    for (const property of ["left", "top", "width", "height", "margin"]) {
      expect(magnet.style.getPropertyValue(property)).toBe("");
    }
    expect(host.style.transform).toBe("");
  });

  it("stops listening and resets on unmount, and does nothing under reduced motion", () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const { magnet, unmount } = setup();
    expect(add).toHaveBeenCalledWith("pointermove", expect.any(Function), {
      passive: true,
    });

    unmount();

    expect(remove).toHaveBeenCalledWith("pointermove", expect.any(Function));
    window.dispatchEvent(pointer("pointermove", { x: 60, y: 30 }));
    expect(gsap.getTweensOf(magnet)).toHaveLength(0);
    expect(magnet.style.transform).toBe("");
  });

  it("does not attach anything under reduced motion", () => {
    mockReducedMotion(true);
    const add = vi.spyOn(window, "addEventListener");

    setup();

    expect(add).not.toHaveBeenCalledWith(
      "pointermove",
      expect.anything(),
      expect.anything(),
    );
  });
});

describe("SpotlightMotion", () => {
  const setup = () => {
    const view = render(
      <Harness motion={SpotlightMotion}>
        <span data-fx-spot="edge" />
        <span data-fx-spot="surface" />
        <p>content</p>
      </Harness>,
    );
    const card = view.getByTestId("host");
    stubRect(card, { left: 10, top: 20, width: 300, height: 200 });
    const edge = card.querySelector<HTMLElement>('[data-fx-spot="edge"]');
    const surface = card.querySelector<HTMLElement>('[data-fx-spot="surface"]');
    if (!edge || !surface) throw new Error("discs missing");
    return { ...view, card, edge, surface };
  };
  const opacity = (element: HTMLElement) =>
    Number(gsap.getProperty(element, "opacity"));

  it("centres the discs on the pointer and fades them in on enter", () => {
    const { card, edge, surface } = setup();

    card.dispatchEvent(pointer("pointerenter", { x: 40, y: 60 }));
    finish(edge);
    finish(surface);

    // (quickTo's template tween adds 0.1 px when completed: precision 0)
    expect(Number(gsap.getProperty(edge, "x"))).toBeCloseTo(30, 0);
    expect(Number(gsap.getProperty(edge, "y"))).toBeCloseTo(40, 0);
    expect(Number(gsap.getProperty(surface, "x"))).toBeCloseTo(30, 0);
    expect(gsap.getProperty(edge, "xPercent")).toBe(-50);
    expect(opacity(edge)).toBe(1);
    expect(opacity(surface)).toBe(spotlightSurfaceOpacity);
  });

  it("follows the pointer while it moves", () => {
    const { card, edge, surface } = setup();
    card.dispatchEvent(pointer("pointerenter", { x: 40, y: 60 }));

    card.dispatchEvent(pointer("pointermove", { x: 110, y: 120 }));
    finish(edge);
    finish(surface);

    expect(Number(gsap.getProperty(edge, "x"))).toBeCloseTo(100, 0);
    expect(Number(gsap.getProperty(surface, "y"))).toBeCloseTo(100, 0);
  });

  it("fades both discs out on leave", () => {
    const { card, edge, surface } = setup();
    card.dispatchEvent(pointer("pointerenter", { x: 40, y: 60 }));
    finish(edge);
    finish(surface);

    card.dispatchEvent(pointer("pointerleave", { x: 0, y: 0 }));
    finish(edge);
    finish(surface);

    expect(opacity(edge)).toBe(0);
    expect(opacity(surface)).toBe(0);
  });

  it("ignores touch pointers", () => {
    const { card, edge } = setup();

    card.dispatchEvent(
      pointer("pointerenter", { x: 40, y: 60, kind: "touch" }),
    );
    finish(edge);

    // jsdom has no stylesheet, so look at what GSAP wrote inline
    expect(edge.style.opacity).toBe("");
  });

  it("keeps the surface glow at the strength the contrast test proves", () => {
    expect(spotlightSurfaceOpacity).toBeLessThanOrEqual(0.1);
  });

  it("removes its listeners on unmount; later pointer events do nothing", () => {
    const { card, edge, unmount } = setup();

    unmount();
    card.dispatchEvent(pointer("pointerenter", { x: 40, y: 60 }));

    expect(gsap.getTweensOf(edge)).toHaveLength(0);
    expect(edge.style.opacity).toBe("");
  });

  it("does nothing under reduced motion", () => {
    mockReducedMotion(true);
    const { card, edge } = setup();

    card.dispatchEvent(pointer("pointerenter", { x: 40, y: 60 }));

    expect(gsap.getTweensOf(edge)).toHaveLength(0);
  });
});

/** Same shape as the real wrapper: the pinned section sits inside a plain div that is never pinned. */
function PinnedHarness({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  return (
    <>
      <div>
        <section ref={ref} data-testid="host">
          {children}
        </section>
      </div>
      <PinnedMotion scope={ref} />
    </>
  );
}

describe("PinnedMotion", () => {
  const setup = () =>
    render(
      <PinnedHarness>
        <h2>Title</h2>
        <div data-fx-progress-track className="invisible">
          <div data-fx-progress />
        </div>
        <ol>
          <li data-fx-step>one</li>
          <li data-fx-step>two</li>
          <li data-fx-step>three</li>
        </ol>
      </PinnedHarness>,
    );
  const mountWithHeight = (height: number) => {
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(
      height,
    );
    return setup();
  };

  it("pins the section and scrubs a timeline when the content fits the viewport", () => {
    const { getByTestId } = mountWithHeight(500);

    const triggers = ScrollTrigger.getAll();
    expect(triggers).toHaveLength(1);
    expect(triggers[0]?.vars.pin).toBe(true);
    expect(triggers[0]?.vars.scrub).toBe(true);
    expect(triggers[0]?.trigger).toBe(getByTestId("host"));
  });

  it("shows the first step, hides the later ones until their scroll position, and reveals the progress bar", () => {
    const { container } = mountWithHeight(500);

    const [one, two, three] = [
      ...container.querySelectorAll<HTMLElement>("[data-fx-step]"),
    ];
    expect(one.style.opacity).toBe("");
    expect(two.style.opacity).toBe("0");
    expect(three.style.opacity).toBe("0");
    expect(
      container.querySelector<HTMLElement>("[data-fx-progress-track]")?.style
        .visibility,
    ).not.toBe("hidden");
    expect(
      container.querySelector<HTMLElement>("[data-fx-progress-track]")?.style
        .visibility,
    ).not.toBe("");
  });

  it("does not pin content taller than the viewport (reflow): the static layout stays", () => {
    const { container } = mountWithHeight(window.innerHeight + 200);

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    for (const step of container.querySelectorAll<HTMLElement>(
      "[data-fx-step]",
    )) {
      expect(step.style.opacity).toBe("");
    }
    expect(
      container.querySelector<HTMLElement>("[data-fx-progress-track]")?.style
        .visibility,
    ).toBe("");
  });

  it("does not pin under reduced motion: nothing hidden, no scrub", () => {
    mockReducedMotion(true);

    const { container } = mountWithHeight(500);

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    for (const step of container.querySelectorAll<HTMLElement>(
      "[data-fx-step]",
    )) {
      expect(step.style.opacity).toBe("");
    }
  });

  it("removes the trigger, the pin spacer and every inline style on unmount", () => {
    const { container, unmount } = mountWithHeight(500);
    expect(ScrollTrigger.getAll()).toHaveLength(1);

    unmount();

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(document.querySelector(".pin-spacer")).toBeNull();
    for (const step of container.querySelectorAll<HTMLElement>(
      "[data-fx-step]",
    )) {
      expect(step.style.opacity).toBe("");
    }
  });
});
