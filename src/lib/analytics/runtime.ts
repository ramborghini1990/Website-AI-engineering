import "server-only";

import {
  buildAnalyticsRuntime,
  type AnalyticsRuntime,
} from "@/lib/analytics/deps";
import { env } from "@/lib/env";

let cached: AnalyticsRuntime | undefined;

/** One runtime per server instance, so the in-process limiter and counter keep their state. */
export function getAnalyticsRuntime(): AnalyticsRuntime {
  cached ??= buildAnalyticsRuntime({
    // Vercel sets VERCEL_ENV on every deployment; it is unset on a laptop and in CI.
    deployed: env.VERCEL_ENV !== undefined,
    databaseUrl: env.DATABASE_URL,
    ipSalt: env.RATE_LIMIT_IP_SALT,
  });
  return cached;
}
