import { createHash, timingSafeEqual } from "node:crypto";

import { errorClass, type Logger } from "@/lib/logger";
import { retentionCutoff } from "@/lib/privacy/retention";
import type { PrivacyStore } from "@/lib/privacy/store";

/**
 * The scheduled purge (P4.3): deletes inquiries older than the retention
 * period. Vercel Cron calls the route with GET and, because a project variable
 * named `CRON_SECRET` exists, `Authorization: Bearer <CRON_SECRET>`.
 *
 * Order: secret configured → caller proves it → database available → purge →
 * counts only. The answer never carries a row, an address or an error message;
 * the log line carries the event, route, status and the class of an error.
 * Only `inquiries` is touched (see `store.ts`): consent receipts stay.
 */

export type PurgeDeps = {
  /** `CRON_SECRET`; undefined = the job is not configured. */
  secret: string | undefined;
  /** Null when a deployed site has no database. */
  store: PrivacyStore | null;
  retentionDays: number;
  now: () => Date;
  log: Logger;
};

const ROUTE = "/api/cron/purge-expired";
const NO_STORE = { "cache-control": "no-store" } as const;

const reply = (status: number, body?: Record<string, number>) =>
  body === undefined
    ? new Response(null, { status, headers: NO_STORE })
    : Response.json(body, { status, headers: NO_STORE });

/**
 * Compares the Authorization header with `Bearer <secret>` in constant time:
 * both sides are hashed first, so the lengths match and the comparison time
 * says nothing about how many leading characters were right.
 */
export function isAuthorized(header: string | null, secret: string): boolean {
  if (header === null) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header), digest(`Bearer ${secret}`));
}

export async function handlePurge(
  request: Request,
  deps: PurgeDeps,
): Promise<Response> {
  const started = deps.now().getTime();
  const { log } = deps;

  if (deps.secret === undefined) {
    log.error("cron.purge.unconfigured", { route: ROUTE, status: 503 });
    return reply(503);
  }
  if (!isAuthorized(request.headers.get("authorization"), deps.secret)) {
    log.warn("cron.purge.unauthorized", { route: ROUTE, status: 401 });
    return reply(401);
  }
  if (deps.store === null) {
    log.error("cron.purge.unavailable", { route: ROUTE, status: 503 });
    return reply(503);
  }

  try {
    const purged = await deps.store.deleteCreatedBefore(
      retentionCutoff(deps.now(), deps.retentionDays),
    );
    log.info("cron.purge.done", {
      route: ROUTE,
      status: 200,
      count: purged,
      durationMs: deps.now().getTime() - started,
    });
    return reply(200, { purged, retentionDays: deps.retentionDays });
  } catch (error) {
    log.error("cron.purge.failed", {
      route: ROUTE,
      status: 500,
      errorClass: errorClass(error),
    });
    return reply(500);
  }
}
