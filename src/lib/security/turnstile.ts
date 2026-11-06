import { z } from "zod";

/**
 * Cloudflare Turnstile server-side verification. The browser widget produces a
 * single-use token; this asks Cloudflare whether it is valid. Nothing about the
 * visitor is sent except the token (not even the IP: Cloudflare already sees it
 * from the widget, and data minimisation says not to add it).
 *
 * Fails CLOSED: an unreachable Cloudflare, a timeout or an unreadable answer
 * means "not verified", never "let it through". The caller decides what the
 * visitor is told.
 *
 * Cloudflare publishes test secrets for development: `1x0000000000000000000000000000000AA`
 * always passes, `2x0000000000000000000000000000000AA` always fails. They are
 * used in tests and `.env.example`, never in production.
 */

export const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const responseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
});

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing_token" | "rejected" | "unavailable" };

/** Cloudflare tokens are at most 2048 characters. A longer value is not one. */
const MAX_TOKEN_LENGTH = 2048;

export async function verifyTurnstile(options: {
  token: string | undefined;
  secret: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<TurnstileResult> {
  const { token, secret } = options;
  if (token === undefined || token.trim() === "")
    return { ok: false, reason: "missing_token" };
  if (token.length > MAX_TOKEN_LENGTH) return { ok: false, reason: "rejected" };

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
    });
    if (!response.ok) return { ok: false, reason: "unavailable" };
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) return { ok: false, reason: "unavailable" };
    return parsed.data.success
      ? { ok: true }
      : { ok: false, reason: "rejected" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
