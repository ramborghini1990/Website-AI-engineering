import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LenisProvider } from "@/lib/motion/lenis-provider";
import { mockReducedMotion } from "@/test-utils/match-media";

// The heavy runtime (GSAP + Lenis) is lazy-loaded in production; here it is a marker.
vi.mock("next/dynamic", async () => {
  const { createElement } = await import("react");
  return {
    default: () =>
      function LenisRuntimeStub() {
        return createElement("div", { "data-testid": "lenis-runtime" });
      },
  };
});

let idleCallbacks: Array<() => void> = [];
const cancelIdle = vi.fn();

beforeEach(() => {
  idleCallbacks = [];
  cancelIdle.mockClear();
  vi.stubGlobal(
    "requestIdleCallback",
    vi.fn((callback: () => void) => {
      idleCallbacks.push(callback);
      return idleCallbacks.length;
    }),
  );
  vi.stubGlobal("cancelIdleCallback", cancelIdle);
});

afterEach(() => {
  // Unmount while the stubbed globals still exist (the provider's cleanup uses them).
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const runIdle = () => {
  act(() => {
    for (const callback of idleCallbacks) callback();
  });
};

describe("LenisProvider", () => {
  it("always renders its children, immediately", () => {
    mockReducedMotion(false);

    render(
      <LenisProvider>
        <p>page content</p>
      </LenisProvider>,
    );

    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("does not load the engine until the browser is idle", () => {
    mockReducedMotion(false);
    render(<LenisProvider>x</LenisProvider>);

    expect(screen.queryByTestId("lenis-runtime")).not.toBeInTheDocument();

    runIdle();

    expect(screen.getByTestId("lenis-runtime")).toBeInTheDocument();
  });

  it("never loads the engine under reduced motion, even when idle", () => {
    mockReducedMotion(true);
    render(<LenisProvider>x</LenisProvider>);

    runIdle();

    expect(screen.queryByTestId("lenis-runtime")).not.toBeInTheDocument();
  });

  it("destroys the engine when the preference flips to reduced, and brings it back after", () => {
    const media = mockReducedMotion(false);
    render(<LenisProvider>x</LenisProvider>);
    runIdle();
    expect(screen.getByTestId("lenis-runtime")).toBeInTheDocument();

    act(() => {
      media.set(true);
    });
    expect(screen.queryByTestId("lenis-runtime")).not.toBeInTheDocument();

    act(() => {
      media.set(false);
    });
    expect(screen.getByTestId("lenis-runtime")).toBeInTheDocument();
  });

  it("cancels the pending idle callback on unmount", () => {
    mockReducedMotion(false);
    const { unmount } = render(<LenisProvider>x</LenisProvider>);

    unmount();

    expect(cancelIdle).toHaveBeenCalled();
  });

  it("falls back to a short timer where requestIdleCallback does not exist (Safari)", () => {
    vi.useFakeTimers();
    vi.stubGlobal("requestIdleCallback", undefined);
    mockReducedMotion(false);
    render(<LenisProvider>x</LenisProvider>);
    expect(screen.queryByTestId("lenis-runtime")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(screen.getByTestId("lenis-runtime")).toBeInTheDocument();
  });
});
