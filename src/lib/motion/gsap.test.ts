import { describe, expect, it, vi } from "vitest";

import { ease } from "@/lib/motion/tokens";
import { gsap, registerGsap, ScrollTrigger } from "@/lib/motion/gsap";

describe("registerGsap (browser)", () => {
  it("has registered ScrollTrigger by the time the module is imported", () => {
    // `core.globals()` exists at runtime but is missing from GSAP's typings.
    const core = gsap.core as unknown as {
      globals: () => Record<string, unknown>;
    };

    expect(core.globals()["ScrollTrigger"]).toBe(ScrollTrigger);
  });

  it("registers only once: calling it again changes nothing", () => {
    const registerPlugin = vi.spyOn(gsap, "registerPlugin");

    registerGsap();
    registerGsap();

    expect(registerPlugin).not.toHaveBeenCalled();
  });

  it("makes our CSS easing tokens available as GSAP eases", () => {
    for (const name of [ease.standard, ease.out, ease.in, ease.inOut]) {
      const fn = gsap.parseEase(name);
      expect(fn(0), name).toBeCloseTo(0, 5);
      expect(fn(1), name).toBeCloseTo(1, 5);
    }
  });

  it("gives the curves their intended character (out starts fast, in starts slow)", () => {
    expect(gsap.parseEase(ease.out)(0.25)).toBeGreaterThan(0.6);
    expect(gsap.parseEase(ease.in)(0.25)).toBeLessThan(0.1);
    // linear stays linear
    expect(gsap.parseEase(ease.linear)(0.25)).toBeCloseTo(0.25, 5);
  });
});
