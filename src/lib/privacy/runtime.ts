import "server-only";

import { createDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { PurgeDeps } from "@/lib/privacy/cron";
import {
  createDrizzlePrivacyStore,
  createMemoryPrivacyStore,
  type PrivacyStore,
} from "@/lib/privacy/store";

let cachedStore: PrivacyStore | null | undefined;

/**
 * The store the purge job uses: the real database when `DATABASE_URL` is set;
 * on a laptop or in CI without one, an empty in-process stand-in (nothing to
 * purge); on a deployment without one, none (the route answers 503 rather than
 * pretend it purged).
 */
function getStore(): PrivacyStore | null {
  if (cachedStore === undefined) {
    if (env.DATABASE_URL !== undefined) {
      cachedStore = createDrizzlePrivacyStore(createDb(env.DATABASE_URL));
    } else {
      // Vercel sets VERCEL_ENV on every deployment; it is unset on a laptop and in CI.
      cachedStore =
        env.VERCEL_ENV !== undefined ? null : createMemoryPrivacyStore();
    }
  }
  return cachedStore;
}

/** The purge job's configuration, read from the validated environment (the only place that does). */
export function getPurgeDeps(): PurgeDeps {
  return {
    secret: env.CRON_SECRET,
    store: getStore(),
    retentionDays: env.INQUIRY_RETENTION_DAYS,
    now: () => new Date(),
    log: logger,
  };
}
