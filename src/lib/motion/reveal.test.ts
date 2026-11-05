import { describe, expect, it, vi } from "vitest";

import { gsap } from "@/lib/motion/gsap";
import { playIntro, revealOnScroll } from "@/lib/motion/reveal";
import {
  duration,
  ease,
  introOffset,
  reducedFade,
  revealOffset,
} from "@/lib/motion/tokens";

const fakeTween = {} as gsap.core.Tween;

describe("revealOnScroll", () => {
  it("animates FROM an offset with the token duration and easing, once, on scroll", () => {
    const from = vi.spyOn(gsap, "from").mockReturnValue(fakeTween);
    const element = document.createElement("div");

    revealOnScroll(element, { reduced: false });

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith(element, {
      opacity: 0,
      y: revealOffset,
      duration: duration.reveal,
      ease: ease.out,
      scrollTrigger: { trigger: element, start: "top 85%", once: true },
    });
  });

  it("only moves opacity and transform (y), never layout properties", () => {
    const from = vi.spyOn(gsap, "from").mockReturnValue(fakeTween);

    revealOnScroll(document.createElement("div"), { reduced: false });

    const vars = from.mock.calls[0]?.[1] as Record<string, unknown>;
    const animated = Object.keys(vars).filter(
      (key) => !["duration", "ease", "scrollTrigger", "stagger"].includes(key),
    );
    expect(animated.sort()).toEqual(["opacity", "y"]);
  });

  it("does nothing under reduced motion: the element stays in its final state", () => {
    const from = vi.spyOn(gsap, "from");

    const result = revealOnScroll(document.createElement("div"), {
      reduced: true,
    });

    expect(result).toBeUndefined();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("playIntro", () => {
  it("moves and fades with the narrative duration normally", () => {
    const from = vi.spyOn(gsap, "from").mockReturnValue(fakeTween);

    playIntro(".x", { reduced: false });

    expect(from).toHaveBeenCalledWith(
      ".x",
      expect.objectContaining({
        opacity: 0,
        y: introOffset,
        duration: duration.narrative,
        ease: ease.out,
      }),
    );
  });

  it("is a short opacity fade with no movement under reduced motion", () => {
    const from = vi.spyOn(gsap, "from").mockReturnValue(fakeTween);

    playIntro(".x", { reduced: true });

    const vars = from.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(vars).toEqual({
      opacity: 0,
      duration: reducedFade,
      ease: ease.linear,
    });
    expect(vars).not.toHaveProperty("y");
    expect(vars["duration"]).toBeLessThanOrEqual(0.16);
  });
});
