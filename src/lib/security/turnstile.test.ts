// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  TURNSTILE_VERIFY_URL,
  verifyTurnstile,
} from "@/lib/security/turnstile";

// Cloudflare's published always-pass test secret: not a secret.
const SECRET = "1x0000000000000000000000000000000AA";

const answer = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("verifyTurnstile", () => {
  it("accepts a token Cloudflare approves, sending only the secret and the token", async () => {
    const fetchImpl = vi.fn(() => answer({ success: true }));

    const result = await verifyTurnstile({
      token: "tok",
      secret: SECRET,
      fetchImpl,
    });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect([...body.keys()].sort()).toEqual(["response", "secret"]);
    expect(body.get("response")).toBe("tok");
  });

  it("rejects a token Cloudflare refuses", async () => {
    const fetchImpl = vi.fn(() =>
      answer({ success: false, "error-codes": ["invalid-input-response"] }),
    );

    expect(
      await verifyTurnstile({ token: "bad", secret: SECRET, fetchImpl }),
    ).toEqual({
      ok: false,
      reason: "rejected",
    });
  });

  it.each([undefined, "", "   "])(
    "rejects a missing token (%j) without calling Cloudflare (negative)",
    async (token) => {
      const fetchImpl = vi.fn(() => answer({ success: true }));

      expect(
        await verifyTurnstile({ token, secret: SECRET, fetchImpl }),
      ).toEqual({
        ok: false,
        reason: "missing_token",
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("rejects an absurdly long token without calling Cloudflare (negative)", async () => {
    const fetchImpl = vi.fn(() => answer({ success: true }));

    const result = await verifyTurnstile({
      token: "x".repeat(5000),
      secret: SECRET,
      fetchImpl,
    });

    expect(result).toEqual({ ok: false, reason: "rejected" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when Cloudflare is unreachable, slow or answers badly (negative)", async () => {
    const cases: Array<typeof fetch> = [
      () => Promise.reject(new TypeError("network down")),
      () => Promise.reject(new DOMException("timeout", "TimeoutError")),
      () => answer({ success: true }, 500),
      () => answer({ unexpected: "shape" }),
      () =>
        Promise.resolve(new Response("<html>not json</html>", { status: 200 })),
    ];

    for (const fetchImpl of cases) {
      expect(
        await verifyTurnstile({ token: "tok", secret: SECRET, fetchImpl }),
      ).toEqual({
        ok: false,
        reason: "unavailable",
      });
    }
  });
});
