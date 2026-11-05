import { act } from "@testing-library/react";
import { beforeEach, vi } from "vitest";

/**
 * Replaces requestIdleCallback with a queue the test drives, like the browser
 * going idle. Call once at the top of a test file; `runIdle()` releases it.
 * Restore with `vi.unstubAllGlobals()` after unmounting.
 */
export function manualIdle() {
  let callbacks: Array<() => void> = [];

  beforeEach(() => {
    callbacks = [];
    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((callback: () => void) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());
  });

  return {
    runIdle: () => {
      act(() => {
        for (const callback of callbacks) callback();
      });
    },
  };
}
