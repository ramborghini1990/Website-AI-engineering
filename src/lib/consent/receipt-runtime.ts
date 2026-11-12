import "server-only";

import {
  buildConsentRuntime,
  type ConsentRuntime,
} from "@/lib/consent/receipt-deps";
import { env } from "@/lib/env";

let cached: ConsentRuntime | undefined;

/** One runtime per server instance, so the in-process limiter and store keep their state. */
export function getConsentRuntime(): ConsentRuntime {
  cached ??= buildConsentRuntime({
    // Vercel sets VERCEL_ENV on every deployment; it is unset on a laptop and in CI.
    deployed: env.VERCEL_ENV !== undefined,
    databaseUrl: env.DATABASE_URL,
    ipSalt: env.RATE_LIMIT_IP_SALT,
  });
  return cached;
}
