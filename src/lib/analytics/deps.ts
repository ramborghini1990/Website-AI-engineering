import "server-only";

import {
  createDrizzleCounter,
  createMemoryCounter,
  type EventCounter,
} from "@/lib/analytics/counter";
import { ANALYTICS_LIMIT, type RecordDeps } from "@/lib/analytics/record";
import { createDb } from "@/lib/db/client";
import { DEV_SALT } from "@/lib/inquiry/deps";
import { logger } from "@/lib/logger";
import { createMemoryLimiter } from "@/lib/security/rate-limit";

/**
 * The demo analytics runtime, from plain configuration (`runtime.ts` reads the
 * environment). Unlike the inquiry form, analytics is best effort: a deployed
 * site without a database or salt drops events instead of being "unavailable",
 * and no in-memory stand-in is used there (it would count per instance and look
 * like real numbers). Not deployed (laptop, tests, CI): an in-process counter.
 *
 * The limiter is the in-process one on purpose: the counters are not worth a
 * Redis round trip, and abuse is bounded (30 events a minute per client and
 * instance, each only raising one counter by one).
 */
export type AnalyticsConfig = {
  deployed: boolean;
  databaseUrl: string | undefined;
  ipSalt: string | undefined;
};

export type AnalyticsRuntime = {
  deps: RecordDeps;
  /** Salt for hashing the client address for the limiter; `null` = drop events. */
  ipSalt: string | null;
  /** The local counter, only when nothing is deployed (tests read it). */
  memory:
    | (EventCounter & { rows: ReturnType<typeof createMemoryCounter>["rows"] })
    | null;
};

export function buildAnalyticsRuntime(
  config: AnalyticsConfig,
): AnalyticsRuntime {
  const memory =
    config.databaseUrl === undefined && !config.deployed
      ? createMemoryCounter()
      : null;
  const counter: EventCounter | null =
    config.databaseUrl !== undefined
      ? createDrizzleCounter(createDb(config.databaseUrl))
      : memory;

  return {
    deps: {
      limiter: createMemoryLimiter(ANALYTICS_LIMIT),
      counter,
      log: logger,
    },
    ipSalt: config.ipSalt ?? (config.deployed ? null : DEV_SALT),
    memory,
  };
}
