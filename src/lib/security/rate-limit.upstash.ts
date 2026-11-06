import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { logger } from "@/lib/logger";
import { INQUIRY_LIMIT, type RateLimiter } from "@/lib/security/rate-limit";

/**
 * The production limiter: a sliding window in Upstash Redis (EU region), shared
 * by every serverless instance. The key is the hashed client, so the raw IP
 * never reaches Redis.
 *
 * If Redis does not answer, Upstash lets the request through (fail-open,
 * `reason: "timeout"`): the form keeps working during an outage. That is a
 * conscious choice for a contact form (a lost inquiry costs more than a few
 * extra spam attempts, which Turnstile and the honeypot still stop). It is
 * logged so an outage is visible.
 */
export function createUpstashLimiter(connection: {
  url: string;
  token: string;
}): RateLimiter {
  const limiter = new Ratelimit({
    redis: new Redis({ url: connection.url, token: connection.token }),
    limiter: Ratelimit.slidingWindow(
      INQUIRY_LIMIT.requests,
      `${String(INQUIRY_LIMIT.windowSeconds)} s` as `${number} s`,
    ),
    prefix: "ratelimit:inquiry",
    analytics: false,
    timeout: 3000,
  });

  return {
    async limit(key) {
      const result = await limiter.limit(key);
      if (result.reason === "timeout") {
        logger.warn("ratelimit.degraded", {
          provider: "upstash",
          code: "timeout",
        });
      }
      return {
        allowed: result.success,
        retryAfterSec: result.success
          ? 0
          : Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    },
  };
}
