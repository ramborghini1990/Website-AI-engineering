import { render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LenisRuntime from "@/lib/motion/lenis-runtime";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";

const state = vi.hoisted(() => ({
  instances: [] as Array<{
    options: Record<string, unknown>;
    raf: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    emitScroll: () => void;
  }>,
  pathname: "/a",
}));

vi.mock("lenis", () => ({
  default: class FakeLenis {
    raf = vi.fn();
    stop = vi.fn();
    start = vi.fn();
    destroy = vi.fn();
    private scrollHandler: (() => void) | undefined;
    constructor(public options: Record<string, unknown>) {
      state.instances.push(this);
    }
    on(event: string, handler: () => void) {
      if (event === "scroll") this.scrollHandler = handler;
    }
    emitScroll() {
      this.scrollHandler?.();
    }
  },
}));

vi.mock("@/i18n/navigation", () => ({ usePathname: () => state.pathname }));

beforeEach(() => {
  state.instances.length = 0;
  state.pathname = "/a";
  document.body.removeAttribute("data-scroll-locked");
});

afterEach(() => {
  document.body.removeAttribute("data-scroll-locked");
});

const live = () =>
  state.instances.filter((i) => i.destroy.mock.calls.length === 0);

describe("LenisRuntime: one loop, clean teardown", () => {
  it("creates exactly one Lenis with its own loop off and touch left native", () => {
    render(<LenisRuntime />);

    expect(state.instances).toHaveLength(1);
    expect(state.instances[0]?.options).toMatchObject({
      autoRaf: false,
      smoothWheel: true,
      syncTouch: false,
    });
  });

  it("drives Lenis from gsap.ticker only, in milliseconds", () => {
    const add = vi.spyOn(gsap.ticker, "add");
    render(<LenisRuntime />);

    expect(add).toHaveBeenCalledTimes(1);
    const tick = add.mock.calls[0]?.[0] as (time: number) => void;
    tick(1.5); // GSAP time is seconds
    expect(state.instances[0]?.raf).toHaveBeenCalledWith(1500);
  });

  it("disables lag smoothing while running and restores GSAP's defaults after", () => {
    const lagSmoothing = vi.spyOn(gsap.ticker, "lagSmoothing");
    const { unmount } = render(<LenisRuntime />);
    expect(lagSmoothing).toHaveBeenLastCalledWith(0);

    unmount();

    expect(lagSmoothing).toHaveBeenLastCalledWith(500, 33);
  });

  it("keeps ScrollTrigger in sync on every Lenis scroll", () => {
    const update = vi.spyOn(ScrollTrigger, "update");
    render(<LenisRuntime />);

    state.instances[0]?.emitScroll();

    expect(update).toHaveBeenCalledTimes(1);
  });

  it("on unmount: removes the ticker callback it added, destroys Lenis, stops watching the scroll lock", async () => {
    const add = vi.spyOn(gsap.ticker, "add");
    const remove = vi.spyOn(gsap.ticker, "remove");
    const { unmount } = render(<LenisRuntime />);
    const tick = add.mock.calls[0]?.[0];

    unmount();

    expect(remove).toHaveBeenCalledWith(tick);
    expect(state.instances[0]?.destroy).toHaveBeenCalledTimes(1);

    const stops = state.instances[0]?.stop.mock.calls.length ?? 0;
    document.body.setAttribute("data-scroll-locked", "1");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(state.instances[0]?.stop.mock.calls.length).toBe(stops);
  });

  it("leaks nothing under React StrictMode's double mount: only the live instance gets frames, and none after unmount", async () => {
    // Counting ticker.add/remove calls cannot prove this: GSAP's own `add`
    // calls `remove` internally. So let the REAL ticker run and look at who
    // actually receives frames.
    const framesOf = (index: number) =>
      state.instances[index]?.raf.mock.calls.length ?? 0;
    const totalFrames = () =>
      state.instances.reduce((sum, i) => sum + i.raf.mock.calls.length, 0);

    const { unmount } = render(
      <StrictMode>
        <LenisRuntime />
      </StrictMode>,
    );

    expect(state.instances.length).toBeGreaterThanOrEqual(2); // mounted twice
    expect(live()).toHaveLength(1);
    await waitFor(() => {
      expect(totalFrames()).toBeGreaterThan(0); // the loop is running
    });

    // The instance destroyed by StrictMode's first cleanup never got a frame.
    const destroyed = state.instances.findIndex(
      (i) => i.destroy.mock.calls.length > 0,
    );
    expect(framesOf(destroyed)).toBe(0);

    unmount();
    expect(live()).toHaveLength(0);

    const framesAtUnmount = totalFrames();
    await new Promise((resolve) => setTimeout(resolve, 150)); // several ticks
    expect(totalFrames()).toBe(framesAtUnmount); // no loop left behind
  });
});

describe("LenisRuntime: Radix scroll lock", () => {
  it("pauses Lenis while a dialog locks page scroll and resumes after", async () => {
    render(<LenisRuntime />);
    const lenis = state.instances[0];

    document.body.setAttribute("data-scroll-locked", "1");
    await waitFor(() => {
      expect(lenis.stop).toHaveBeenCalled();
    });

    const startsBefore = lenis.start.mock.calls.length;
    document.body.removeAttribute("data-scroll-locked");
    await waitFor(() => {
      expect(lenis.start.mock.calls.length).toBeGreaterThan(startsBefore);
    });
  });

  it("starts paused if the page is already locked when it mounts", () => {
    document.body.setAttribute("data-scroll-locked", "1");

    render(<LenisRuntime />);

    expect(state.instances[0]?.stop).toHaveBeenCalled();
  });
});

describe("LenisRuntime: route changes", () => {
  it("re-measures every ScrollTrigger after a navigation, once the new page has mounted", async () => {
    const refresh = vi.spyOn(ScrollTrigger, "refresh");
    const { rerender } = render(<LenisRuntime />);
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1); // initial mount
    });

    state.pathname = "/b";
    rerender(<LenisRuntime />);

    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(2);
    });
  });

  it("does not refresh again when the path did not change", async () => {
    const refresh = vi.spyOn(ScrollTrigger, "refresh");
    const { rerender } = render(<LenisRuntime />);
    await waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    rerender(<LenisRuntime />);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
