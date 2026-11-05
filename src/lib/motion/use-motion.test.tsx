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
function flip(media: ReturnType<typeof mockReducedMotion>, reduced: boolean) {
  vi.setSystemTime(Date.now() + 1000);
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
    expect(onBuild).toHaveBeenCalledWith({ reduced: false });
  });

  it("builds with reduced=true when the visitor asks for reduced motion", () => {
    mockReducedMotion(true);
    const onBuild = vi.fn();

    render(<Probe onBuild={onBuild} />);

    expect(onBuild).toHaveBeenCalledTimes(1);
    expect(onBuild).toHaveBeenCalledWith({ reduced: true });
  });

  it("rebuilds with the new value each time the preference changes, without stacking tweens", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const media = mockReducedMotion(false);
    const onBuild = vi.fn();
    const { getByTestId } = render(<Probe onBuild={onBuild} />);
    const box = getByTestId("box");
    expect(gsap.getTweensOf(box)).toHaveLength(1);

    flip(media, true);
    expect(onBuild).toHaveBeenLastCalledWith({ reduced: true });
    expect(gsap.getTweensOf(box)).toHaveLength(1); // the old one was reverted

    flip(media, false);
    expect(onBuild).toHaveBeenLastCalledWith({ reduced: false });
    expect(gsap.getTweensOf(box)).toHaveLength(1);

    flip(media, true);
    expect(onBuild).toHaveBeenLastCalledWith({ reduced: true });
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

  it("removes its media-query listeners on unmount", () => {
    const media = mockReducedMotion(false);
    const { unmount } = render(<Probe onBuild={vi.fn()} />);
    expect(media.listenerCount()).toBeGreaterThan(0);

    unmount();

    expect(media.listenerCount()).toBe(0);
  });
});
