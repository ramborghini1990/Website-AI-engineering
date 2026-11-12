import "server-only";

import { CONSENT_LIMIT, type ReceiptDeps } from "@/lib/consent/receipt";
import {
  createDrizzleReceiptStore,
  createMemoryReceiptStore,
  type ReceiptStore,
} from "@/lib/consent/receipt-store";
import { createDb } from "@/lib/db/client";
import { DEV_SALT } from "@/lib/inquiry/deps";
import { logger } from "@/lib/logger";
import { createMemoryLimiter } from "@/lib/security/rate-limit";

/**
 * The receipt runtime, from plain configuration (`receipt-runtime.ts` reads the
 * environment). Like the demo analytics and unlike the inquiry form, it is best
 * effort: the visitor's choice always applies in their browser, so a deployed
 * site without a database drops the receipt (answers 503) instead of refusing
 * the choice, and no in-memory stand-in is used there (it would "prove" nothing
 * after a restart). Not deployed (laptop, tests, CI): an in-process store.
 * A real database is still needed before launch (B13).
 */
export type ConsentConfig = {
  deployed: boolean;
  databaseUrl: string | undefined;
  ipSalt: string | undefined;
};

export type ConsentRuntime = {
  deps: ReceiptDeps;
  /** Salt for hashing the client address for the limiter; `null` = drop receipts. */
  ipSalt: string | null;
  /** The local store, only when nothing is deployed (tests read it). */
  memory: (ReceiptStore & { rows: unknown[] }) | null;
};

export function buildConsentRuntime(config: ConsentConfig): ConsentRuntime {
  const memory =
    config.databaseUrl === undefined && !config.deployed
      ? createMemoryReceiptStore()
      : null;
  const store: ReceiptStore | null =
    config.databaseUrl !== undefined
      ? createDrizzleReceiptStore(createDb(config.databaseUrl))
      : memory;

  return {
    deps: { limiter: createMemoryLimiter(CONSENT_LIMIT), store, log: logger },
    ipSalt: config.ipSalt ?? (config.deployed ? null : DEV_SALT),
    memory,
  };
}
