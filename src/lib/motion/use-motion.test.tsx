import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockReducedMotion } from "@/test-utils/match-media";
import { gsap } from "@/lib/motion/gsap";
import { useMotion, type MotionContext } from "@/lib/motion/use-motion";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/**
 * GSAP's matchMedia ignores a change that arrives within 2ms of the previous
 * one (it reads Date.now()). People change the OS setting seconds apart, so
 * move the clock forward between flips, like a real session.
 */
let clock = Date.now();
function flip(media: ReturnType<typeof mockReducedMotion>, reduced: boolean) {
  // GSAP keeps the time of the last change in a module variable that outlives
  // a test, so the fake clock must only ever move forward across the whole file.
  clock += 1000;
  vi.setSystemTime(clock);
  act(() => {
    media.set(reduced);
  });
}

function Probe({ onBuild }: { onBuild: (context: MotionContext) => void }) {
  const scope = useRef<HTMLDivElement>(null);
  useMotion(
    (context) => {
      onBuild(context);
      // A long tween: if it were not reverted it would still be alive later.
      gsap.to(".box", { x: 10, duration: 60 });
    },
    { scope },
  );
  return (
    <div ref={scope}>
      <div className="box" data-testid="box" />
    </div>
  );
}

describe("useMotion", () => {
  it("builds with reduced=false when the visitor has no preference", () => {
    mockReducedMotion(false);
    const onBuild = vi.fn();

    render(<Probe onBuild={onBuild} />);

    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(onBuild).toHaveBeenCalledWith(
      expect.objectContaining({ reduced: false }),
    );
  });

  it("builds with reduced=true when the visitor asks for reduced motion", () => {
    mockReducedMotion(true);
    const onBuild = vi.fn();

    render(<Probe onBuild={onBuild} />);

    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(onBuild).toHaveBeenCalledWith(
      expect.objectContaining({ reduced: true }),
    );
  });

  it("rebuilds with the new value each time the preference changes, without stacking tweens", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const media = mockReducedMotion(false);
    const onBuild = vi.fn();
    const { getByTestId } = render(<Probe onBuild={onBuild} />);
    const box = getByTestId("box");
    expect(gsap.getTweensOf(box)).toHaveLength(1);

    flip(media, true);
    expect(onBuild).toHaveBeenLastCalledWith(
      expect.objectContaining({ reduced: true }),
    );
    expect(gsap.getTweensOf(box)).toHaveLength(1); // the old one was reverted

    flip(media, false);
    expect(onBuild).toHaveBeenLastCalledWith(
      expect.objectContaining({ reduced: false }),
    );
    expect(gsap.getTweensOf(box)).toHaveLength(1);

    flip(media, true);
    expect(onBuild).toHaveBeenLastCalledWith(
      expect.objectContaining({ reduced: true }),
    );
    expect(gsap.getTweensOf(box)).toHaveLength(1);
    expect(onBuild).toHaveBeenCalledTimes(4); // mount + three flips, no extras
  });

  it("reverts everything on unmount (nothing left running)", () => {
    mockReducedMotion(false);
    const { getByTestId, unmount } = render(<Probe onBuild={vi.fn()} />);
    const box = getByTestId("box");
    expect(gsap.getTweensOf(box)).toHaveLength(1);

    unmount();

    expect(gsap.getTweensOf(box)).toHaveLength(0);
  });

  it("runs the cleanup function that build returns on unmount", () => {
    mockReducedMotion(false);
    const cleanup = vi.fn();
    function WithCleanup() {
      const scope = useRef<HTMLDivElement>(null);
      useMotion(() => cleanup, { scope });
      return <div ref={scope} />;
    }
    const { unmount } = render(<WithCleanup />);
    expect(cleanup).not.toHaveBeenCalled();

    unmount();

    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("runs the returned cleanup before rebuilding when the preference flips", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const media = mockReducedMotion(false);
    const events: string[] = [];
    function WithCleanup() {
      const scope = useRef<HTMLDivElement>(null);
      useMotion(
        ({ reduced }) => {
          events.push(`build:${String(reduced)}`);
          return () => {
            events.push(`cleanup:${String(reduced)}`);
          };
        },
        { scope },
      );
      return <div ref={scope} />;
    }
    render(<WithCleanup />);

    flip(media, true);

    expect(events).toEqual(["build:false", "cleanup:false", "build:true"]);
  });

  it("removes its media-query listeners on unmount", () => {
    const media = mockReducedMotion(false);
    const { unmount } = render(<Probe onBuild={vi.fn()} />);
    expect(media.listenerCount()).toBeGreaterThan(0);

    unmount();

    expect(media.listenerCount()).toBe(0);
  });
});
