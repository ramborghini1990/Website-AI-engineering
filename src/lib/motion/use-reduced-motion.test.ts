import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockReducedMotion } from "@/test-utils/match-media";
import { useReducedMotion } from "@/lib/motion/use-reduced-motion";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useReducedMotion", () => {
  it("is false when the visitor has no preference", () => {
    mockReducedMotion(false);
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });

  it("is true when the visitor asks for reduced motion", () => {
    mockReducedMotion(true);
    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it("follows the OS setting live, in both directions", () => {
    const media = mockReducedMotion(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      media.set(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      media.set(false);
    });
    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount (no listener left behind)", () => {
    const media = mockReducedMotion(false);
    const { unmount } = renderHook(() => useReducedMotion());
    expect(media.listenerCount()).toBeGreaterThan(0);

    unmount();

    expect(media.listenerCount()).toBe(0);
  });

  it("renders as false on the server, whatever the preference", async () => {
    mockReducedMotion(true);
    const { renderToString } = await import("react-dom/server");
    const { createElement } = await import("react");
    function Probe() {
      return createElement("span", null, String(useReducedMotion()));
    }

    expect(renderToString(createElement(Probe))).toContain("false");
  });
});
