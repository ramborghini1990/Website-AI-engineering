import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { ComponentType, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MagneticButton } from "@/components/fx/magnetic-button";
import { ScrollPinnedSection } from "@/components/fx/scroll-pinned-section";
import { SpotlightCard } from "@/components/fx/spotlight-card";
import { TextReveal } from "@/components/fx/text-reveal";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { manualIdle } from "@/test-utils/idle";
import { mockReducedMotion } from "@/test-utils/match-media";

// Real wrappers AND real lazy motion chunks: `next/dynamic` is replaced by
// React.lazy, which loads the same modules asynchronously.
vi.mock("next/dynamic", async () => {
  const { createElement, lazy, Suspense } = await import("react");
  return {
    default: (loader: () => Promise<{ default: ComponentType<object> }>) => {
      const Lazy = lazy(loader);
      return function LazyChunk(props: object) {
        return createElement(
          Suspense,
          { fallback: null },
          createElement(Lazy, props),
        );
      };
    },
  };
});

const { runIdle } = manualIdle();

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function Maybe({ show, children }: { show: boolean; children: ReactElement }) {
  return show ? children : null;
}

/** Wait for the lazy chunk to be mounted and to have built something on `target`. */
async function loaded(until: () => boolean) {
  runIdle();
  await waitFor(() => {
    expect(until()).toBe(true);
  });
}

describe("the real wrappers with their real motion chunks", () => {
  it("ScrollPinnedSection: pins, and can be removed on its own without breaking React or leaking", async () => {
    mockReducedMotion(false);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(500);
    const element = (
      <ScrollPinnedSection steps={[<p key="a">One</p>, <p key="b">Two</p>]}>
        <h2>Title</h2>
      </ScrollPinnedSection>
    );
    const { rerender, container } = render(<Maybe show>{element}</Maybe>);

    await loaded(() => ScrollTrigger.getAll().length === 1);
    expect(container.querySelector(".pin-spacer")).not.toBeNull();

    // The case that used to throw "node to be removed is not a child of this node".
    expect(() => {
      rerender(<Maybe show={false}>{element}</Maybe>);
    }).not.toThrow();

    expect(ScrollTrigger.getAll()).toHaveLength(0);
    expect(container.querySelector(".pin-spacer")).toBeNull();
    expect(container.innerHTML).toBe("");
  });

  it("ScrollPinnedSection: turning reduced motion on unpins it and leaves every step visible", async () => {
    const media = mockReducedMotion(false);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(500);
    const { container } = render(
      <ScrollPinnedSection steps={[<p key="a">One</p>, <p key="b">Two</p>]}>
        <h2>Title</h2>
      </ScrollPinnedSection>,
    );
    await loaded(() => ScrollTrigger.getAll().length === 1);
    vi.setSystemTime(Date.now() + 100_000);

    act(() => {
      media.set(true);
    });

    await waitFor(() => {
      expect(ScrollTrigger.getAll()).toHaveLength(0);
    });
    expect(container.querySelector(".pin-spacer")).toBeNull();
    for (const step of container.querySelectorAll<HTMLElement>(
      "[data-fx-step]",
    )) {
      expect(step.style.opacity).toBe("");
    }
  });

  it("TextReveal: animates below the fold, and leaves nothing behind when removed", async () => {
    mockReducedMotion(false);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 4000,
    } as DOMRect);
    const element = <TextReveal text="Agents that work" />;
    const { rerender, container } = render(<Maybe show>{element}</Maybe>);

    await loaded(() => ScrollTrigger.getAll().length === 1);
    expect(
      gsap.getTweensOf(container.querySelector("[data-fx-word]")),
    ).toHaveLength(1);

    rerender(<Maybe show={false}>{element}</Maybe>);

    expect(ScrollTrigger.getAll()).toHaveLength(0);
  });

  it("MagneticButton: follows a nearby mouse once loaded, and a later mouse move does nothing after unmount", async () => {
    mockReducedMotion(false, { finePointer: true });
    const { container, unmount } = render(
      <MagneticButton>
        <button type="button">Go</button>
      </MagneticButton>,
    );
    const host = container.querySelector<HTMLElement>("[data-fx='magnetic']");
    const magnet = container.querySelector<HTMLElement>("[data-fx-magnet]");
    if (!host || !magnet) throw new Error("markup missing");
    vi.spyOn(host, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      width: 100,
      height: 40,
    } as DOMRect);
    const move = () => {
      const event = new MouseEvent("pointermove", {
        clientX: 60,
        clientY: 30,
      });
      Object.defineProperty(event, "pointerType", { value: "mouse" });
      window.dispatchEvent(event);
    };

    await loaded(() => {
      move();
      return gsap.getTweensOf(magnet).length > 0;
    });

    unmount();
    magnet.style.transform = "";
    move();
    expect(gsap.getTweensOf(magnet)).toHaveLength(0);
    expect(magnet.style.transform).toBe("");
  });

  it("SpotlightCard: lights up on pointer enter once loaded, and does nothing after unmount", async () => {
    mockReducedMotion(false, { finePointer: true });
    const { container, unmount } = render(<SpotlightCard>body</SpotlightCard>);
    const card = container.querySelector<HTMLElement>(
      "[data-fx='spotlight-card']",
    );
    const edge = container.querySelector<HTMLElement>("[data-fx-spot='edge']");
    if (!card || !edge) throw new Error("markup missing");
    const enter = () => {
      const event = new MouseEvent("pointerenter", { clientX: 5, clientY: 5 });
      Object.defineProperty(event, "pointerType", { value: "mouse" });
      card.dispatchEvent(event);
    };

    await loaded(() => {
      enter();
      return gsap.getTweensOf(edge).length > 0;
    });

    unmount();
    expect(gsap.getTweensOf(edge)).toHaveLength(0);
    enter();
    expect(gsap.getTweensOf(edge)).toHaveLength(0);
  });
});
