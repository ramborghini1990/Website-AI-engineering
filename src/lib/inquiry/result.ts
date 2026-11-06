import type { FieldErrors } from "@/lib/inquiry/schema";

/**
 * What the inquiry Server Action answers. A pure type module on purpose: the
 * browser form imports it, and it must not drag server-only code (database,
 * email, rate limiting) into the client bundle.
 */
export type SubmitResult =
  | { status: "success" }
  | { status: "error"; code: "validation"; fieldErrors: FieldErrors }
  | { status: "error"; code: "rate_limited"; retryAfterSec: number }
  | { status: "error"; code: "bot_check_failed" }
  | { status: "error"; code: "unavailable" };
