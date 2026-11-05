// @vitest-environment node
import { describe, expect, it } from "vitest";

import { gsap, registerGsap } from "@/lib/motion/gsap";

describe("registerGsap (server, no window)", () => {
  it("is a harmless no-op: importing the module on the server must not throw or register anything", () => {
    expect(typeof window).toBe("undefined");

    expect(() => {
      registerGsap();
    }).not.toThrow();

    // `core.globals()` exists at runtime but is missing from GSAP's typings.
    const core = gsap.core as unknown as {
      globals: () => Record<string, unknown>;
    };
    expect(core.globals()["ScrollTrigger"]).toBeUndefined();
  });
});
