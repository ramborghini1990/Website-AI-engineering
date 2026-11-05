import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names and drops falsy values", () => {
    expect(cn("a", false, null, undefined, "b", { c: true, d: false })).toBe(
      "a b c",
    );
  });

  it("lets the last conflicting Tailwind class win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("bg-surface-2", "bg-accent")).toBe("bg-accent");
  });

  it("keeps a font-size and a text colour together (different groups)", () => {
    expect(cn("text-sm", "text-text-muted")).toBe("text-sm text-text-muted");
  });

  it("replaces a text colour token with another one", () => {
    expect(cn("text-text", "text-accent")).toBe("text-accent");
  });

  it("merges our custom shadow tokens with each other and with Tailwind's", () => {
    expect(cn("shadow-popover", "shadow-modal")).toBe("shadow-modal");
    expect(cn("shadow-popover", "shadow-none")).toBe("shadow-none");
  });

  it("merges our custom easing token", () => {
    expect(cn("ease-standard", "ease-out")).toBe("ease-out");
  });

  it("does not merge classes that only differ by variant", () => {
    expect(cn("hover:bg-accent", "bg-surface-2")).toBe(
      "hover:bg-accent bg-surface-2",
    );
  });
});
