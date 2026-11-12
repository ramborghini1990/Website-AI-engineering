import "server-only";

import { z } from "zod";

import { CONSENT_POLICY_VERSION } from "@/lib/consent/registry";
import { consentMethods } from "@/lib/consent/state";
import type { ReceiptStore } from "@/lib/consent/receipt-store";
import type { Logger } from "@/lib/logger";
import type { RateLimiter } from "@/lib/security/rate-limit";

/**
 * Consent receipts (P4.1). A visitor's decision is applied in their browser at
 * once; this records the proof (art. 7(1)) afterwards: validate (strict Zod) →
 * rate-limit (per salted hash of the client, never stored) → one immutable row →
 * typed result. The row holds the wording version, how the choice was given and
 * what was allowed, plus a server-made random id and time. Nothing else: the
 * schema refuses extra keys, so an IP, an agent or an identifier cannot be sent
 * in, and the client key only feeds the limiter.
 *
 * No bot token (it is not a form and there is nothing to gain by flooding it
 * beyond the rate limit's reach) and no account: the receipt stands alone.
 */

/** Generous for a person changing their mind a few times, small for a script. */
export const CONSENT_LIMIT = { requests: 10, windowSeconds: 10 * 60 } as const;

/** A receipt is a handful of short fields; anything bigger is not one. */
export const MAX_BODY_BYTES = 256;

export const receiptSchema = z.strictObject({
  // Only the wording that is live: a stale tab is refused rather than recorded
  // under a text it did not show.
  policyVersion: z.literal(CONSENT_POLICY_VERSION),
  method: z.enum(consentMethods),
  choices: z.strictObject({ booking: z.boolean() }),
});

export type RecordResult =
  | { status: "recorded"; id: string }
  | { status: "invalid" }
  | { status: "limited"; retryAfterSec: number }
  | { status: "unavailable" };

export type ReceiptDeps = {
  limiter: RateLimiter;
  /** `null` when a deployed site has no database yet: receipts cannot be kept. */
  store: ReceiptStore | null;
  log: Pick<Logger, "error">;
};

export async function recordConsent(
  raw: unknown,
  clientKey: string,
  deps: ReceiptDeps,
): Promise<RecordResult> {
  const parsed = receiptSchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid" };

  const verdict = await deps.limiter.limit(clientKey);
  if (!verdict.allowed) {
    return { status: "limited", retryAfterSec: verdict.retryAfterSec };
  }

  if (deps.store === null) return { status: "unavailable" };
  try {
    // Built field by field, never by spreading the input.
    const { id } = await deps.store.insert({
      policyVersion: parsed.data.policyVersion,
      method: parsed.data.method,
      booking: parsed.data.choices.booking,
    });
    return { status: "recorded", id };
  } catch (error) {
    deps.log.error("consent.store_failed", {
      route: "/api/consent",
      errorClass: error instanceof Error ? error.name : typeof error,
    });
    return { status: "unavailable" };
  }
}
