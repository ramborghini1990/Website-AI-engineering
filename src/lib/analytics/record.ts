import { utcDay, type EventCounter } from "@/lib/analytics/counter";
import { demoEventSchema } from "@/lib/analytics/event-schema";
import type { Logger } from "@/lib/logger";
import type { RateLimiter } from "@/lib/security/rate-limit";

/** Generous for a person (a few events per visit), small for a script. */
export const ANALYTICS_LIMIT = { requests: 30, windowSeconds: 60 } as const;

/** An event is two short words; anything bigger is not one. */
export const MAX_BODY_BYTES = 256;

export type RecordResult =
  | { status: "recorded" }
  | { status: "invalid" }
  | { status: "limited"; retryAfterSec: number }
  | { status: "unavailable" };

export type RecordDeps = {
  limiter: RateLimiter;
  /** `null` when a deployed site has no database yet: events are dropped. */
  counter: EventCounter | null;
  log: Pick<Logger, "error">;
  now?: () => Date;
};

/**
 * One demo event: validate (strict Zod) → rate-limit (per salted hash of the
 * client, which is never stored) → raise one aggregate counter → typed result.
 * The client key only feeds the limiter's short window; it never reaches the
 * counter, so nothing stored can be traced to a visitor. Failures are logged
 * without the body.
 */
export async function recordDemoEvent(
  raw: unknown,
  clientKey: string,
  deps: RecordDeps,
): Promise<RecordResult> {
  const parsed = demoEventSchema.safeParse(raw);
  if (!parsed.success) return { status: "invalid" };

  const verdict = await deps.limiter.limit(clientKey);
  if (!verdict.allowed) {
    return { status: "limited", retryAfterSec: verdict.retryAfterSec };
  }

  if (deps.counter === null) return { status: "unavailable" };
  try {
    await deps.counter.increment(
      utcDay((deps.now ?? (() => new Date()))()),
      parsed.data.demo,
      parsed.data.event,
    );
  } catch (error) {
    deps.log.error("analytics.store_failed", {
      route: "/api/demo-events",
      errorClass: error instanceof Error ? error.name : typeof error,
    });
    return { status: "unavailable" };
  }
  return { status: "recorded" };
}

/**
 * Refuses a request that a browser says comes from another site. Browsers set
 * `Sec-Fetch-Site` and `Origin` themselves; a script outside a browser can fake
 * both, which is why the rate limit and the strict schema exist as well.
 */
export function isForeignOrigin(headers: Pick<Headers, "get">): boolean {
  if (headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = headers.get("origin");
  if (origin === null) return false;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
