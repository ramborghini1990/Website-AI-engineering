import { createHmac } from "node:crypto";

/**
 * Rate limiting for the inquiry form (docs/BLUEPRINT.md §security): a sliding
 * window per client, where the client is a salted HASH of the IP, never the IP
 * itself (GDPR data minimisation; the raw address is not stored or logged).
 *
 * This file is the port and the in-process adapter. The in-process adapter
 * serves local development, tests and CI (no network, deterministic with an
 * injected clock). Production uses Upstash Redis (`rate-limit.upstash.ts`).
 * The in-process one is NOT a production limiter: each serverless instance
 * has its own memory, so the limit is per instance.
 */

type RateLimitResult = {
  allowed: boolean;
  /** Seconds until a blocked client may try again (0 when allowed). */
  retryAfterSec: number;
};

export type RateLimiter = {
  limit(key: string): Promise<RateLimitResult>;
};

export const INQUIRY_LIMIT = { requests: 5, windowSeconds: 10 * 60 } as const;

/**
 * The limiter key for a client: HMAC-SHA256 of the IP with a secret salt,
 * truncated. The same IP and salt always give the same key; without the salt the
 * key cannot be turned back into an address by trying all of IPv4.
 */
export function hashIp(ip: string, salt: string): string {
  return createHmac("sha256", salt).update(ip).digest("hex").slice(0, 32);
}

const MAX_KEYS = 10_000;

export function createMemoryLimiter(options: {
  requests: number;
  windowSeconds: number;
  now?: () => number;
}): RateLimiter {
  const { requests, windowSeconds } = options;
  const now = options.now ?? Date.now;
  const windowMs = windowSeconds * 1000;
  const hits = new Map<string, number[]>();

  return {
    limit(key) {
      const current = now();
      const recent = (hits.get(key) ?? []).filter(
        (time) => current - time < windowMs,
      );

      if (recent.length >= requests) {
        hits.set(key, recent);
        const oldest = recent[0] ?? current;
        return Promise.resolve({
          allowed: false,
          retryAfterSec: Math.max(
            1,
            Math.ceil((oldest + windowMs - current) / 1000),
          ),
        });
      }

      recent.push(current);
      hits.set(key, recent);

      // Bounded memory: when many distinct keys pile up, drop the ones whose window has passed.
      if (hits.size > MAX_KEYS) {
        for (const [other, times] of hits) {
          if (times.every((time) => current - time >= windowMs))
            hits.delete(other);
        }
      }
      return Promise.resolve({ allowed: true, retryAfterSec: 0 });
    },
  };
}
