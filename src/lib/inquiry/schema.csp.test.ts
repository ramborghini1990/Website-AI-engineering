// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The inquiry schema runs in the browser under a CSP that forbids eval
 * (src/lib/security/csp.ts). Zod 4 probes `new Function("")` unless its JIT is
 * off, and the browser reports even a caught probe as `script-src <- eval`
 * (found by e2e/contact.spec.ts). This fails if that probe comes back.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("the inquiry schema and eval", () => {
  it("validates, valid and invalid input, without ever constructing a Function (negative)", async () => {
    vi.resetModules();
    let constructed = 0;
    vi.stubGlobal(
      "Function",
      new Proxy(Function, {
        construct(target, args, newTarget) {
          constructed += 1;
          return Reflect.construct(target, args, newTarget) as object;
        },
      }),
    );

    const { parseInquiry, parseStep } = await import("@/lib/inquiry/schema");
    parseInquiry({
      need: "ai-agents",
      description: "A synthetic description that is long enough to pass.",
      budget: "5k-15k",
      timeline: "asap",
      name: "Anna Test",
      email: "anna.test@example.com",
      marketingConsent: false,
    });
    parseInquiry({});
    parseStep("contact", { name: "A", email: "nope" });

    expect(constructed).toBe(0);
  });

  it("the control: without the setting, this same check would catch Zod's probe", async () => {
    vi.resetModules();
    let constructed = 0;
    vi.stubGlobal(
      "Function",
      new Proxy(Function, {
        construct(target, args, newTarget) {
          constructed += 1;
          return Reflect.construct(target, args, newTarget) as object;
        },
      }),
    );
    const { z } = await import("zod");
    z.config({ jitless: false });

    z.object({ a: z.string() }).safeParse({ a: "x" });

    expect(constructed).toBeGreaterThan(0);
  });
});
