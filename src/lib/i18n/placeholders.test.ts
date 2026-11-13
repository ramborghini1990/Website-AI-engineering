import { describe, expect, it } from "vitest";

import { fillPlaceholders } from "@/lib/i18n/placeholders";

import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

describe("fillPlaceholders", () => {
  it("fills every {name} slot, repeats included", () => {
    expect(fillPlaceholders("Step {a} of {b} ({a})", { a: 2, b: 4 })).toBe(
      "Step 2 of 4 (2)",
    );
  });

  it("leaves a slot without a value untouched instead of printing undefined", () => {
    expect(fillPlaceholders("Hi {name}, {other}", { name: "Anna" })).toBe(
      "Hi Anna, {other}",
    );
  });

  it("does not expand a value that itself looks like a slot (single pass)", () => {
    expect(fillPlaceholders("{a} {b}", { a: "{b}", b: "x" })).toBe("{b} x");
  });

  it("ignores names inherited from Object.prototype (negative)", () => {
    expect(fillPlaceholders("{constructor} {toString}", {})).toBe(
      "{constructor} {toString}",
    );
  });

  it("does not treat replacement patterns in a value specially", () => {
    expect(fillPlaceholders("{a}", { a: "$& $1 $$" })).toBe("$& $1 $$");
  });

  it("returns text without slots unchanged, including markup characters", () => {
    expect(fillPlaceholders("a <b> & c", { a: 1 })).toBe("a <b> & c");
  });
});

/**
 * Messages that are read with `fillPlaceholders(t.raw(...))` instead of
 * `t(key, values)`. ICU would give them different output if they used more than
 * plain slots, so they are pinned to plain slots here, in both languages.
 * Add a path when a new call site uses the helper.
 */
const SIMPLE_MESSAGES: readonly (readonly string[])[] = [
  ["contact", "form", "progress"],
];

function messageAt(messages: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (node, key) =>
      typeof node === "object" && node !== null
        ? (node as Record<string, unknown>)[key]
        : undefined,
    messages,
  );
}

describe("messages read through fillPlaceholders stay plain text with slots", () => {
  for (const [locale, messages] of [
    ["it", it_],
    ["en", en],
  ] as const) {
    for (const path of SIMPLE_MESSAGES) {
      it(`${locale}: ${path.join(".")}`, () => {
        const text = messageAt(messages, path);
        expect(typeof text).toBe("string");
        // No ICU syntax beyond {slot}: no plural/select/#, no <tags>, no apostrophe escapes.
        const withoutSlots = String(text).replace(/\{\w+\}/g, "");
        expect(withoutSlots).not.toMatch(/[{}<>']/);
        expect(String(text)).not.toMatch(/\{\w+\s*,/);
      });
    }
  }
});
