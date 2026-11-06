import "server-only";

import { env } from "@/lib/env";
import {
  buildRuntime,
  type InquiryConfig,
  type InquiryRuntime,
} from "@/lib/inquiry/deps";
import { logger } from "@/lib/logger";

/** The inquiry configuration, read from the validated environment (the only place that does). */
function configFromEnv(): InquiryConfig {
  const { EMAIL_API_KEY, EMAIL_FROM, INQUIRY_NOTIFY_TO } = env;
  return {
    // Vercel sets VERCEL_ENV on every deployment (production and preview); it is unset on a laptop and in CI.
    deployed: env.VERCEL_ENV !== undefined,
    databaseUrl: env.DATABASE_URL,
    redis:
      env.UPSTASH_REDIS_REST_URL !== undefined &&
      env.UPSTASH_REDIS_REST_TOKEN !== undefined
        ? {
            url: env.UPSTASH_REDIS_REST_URL,
            token: env.UPSTASH_REDIS_REST_TOKEN,
          }
        : undefined,
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    ipSalt: env.RATE_LIMIT_IP_SALT,
    email:
      EMAIL_API_KEY !== undefined &&
      EMAIL_FROM !== undefined &&
      INQUIRY_NOTIFY_TO !== undefined
        ? { apiKey: EMAIL_API_KEY, from: EMAIL_FROM, to: INQUIRY_NOTIFY_TO }
        : undefined,
  };
}

let cached: InquiryRuntime | undefined;

/**
 * One runtime per server instance, so the in-process stand-ins (memory limiter,
 * memory store) keep their state between requests.
 */
export function getInquiryRuntime(): InquiryRuntime {
  if (cached === undefined) {
    cached = buildRuntime(configFromEnv());
    if (!cached.ready) {
      logger.error("inquiry.unavailable", {
        code: cached.missing.join(" ").slice(0, 150),
      });
    } else if (cached.mode === "mock") {
      logger.warn("inquiry.mock_mode", { mode: "mock" });
    }
  }
  return cached;
}

/** The public Turnstile site key, or undefined when the widget should not render. */
export function turnstileSiteKey(): string | undefined {
  return env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}
