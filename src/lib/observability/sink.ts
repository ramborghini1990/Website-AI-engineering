import { parseSentryDsn } from "@/lib/observability/dsn";
import type { SafeErrorReport } from "@/lib/observability/scrub";

/**
 * The only place an error report leaves the server (P4.5): one HTTPS POST to
 * the EU Sentry ingest host named by `SENTRY_DSN`, in Sentry's envelope format,
 * with no SDK (CLAUDE.md §5: no new dependency; an SDK also reads request
 * data, cookies and IPs by default, which is the opposite of what we want).
 *
 * It takes a `SafeErrorReport` (see `scrub.ts`), so nothing else can be sent:
 * no `user`, no `request`, no `server_name`, no breadcrumbs, no message. It
 * never throws and never waits more than `timeoutMs`: reporting an error must
 * not turn one failure into two.
 *
 * Written from Sentry's public envelope documentation and covered by unit
 * tests with a fake `fetch`; it has NOT been run against a live Sentry project
 * (no account yet, docs/DEPLOYMENT.md §8).
 */

export type ErrorSink = {
  /** Resolves true when the tracker accepted the report. Never rejects. */
  capture: (report: SafeErrorReport) => Promise<boolean>;
};

export type SinkOptions = {
  dsn: string;
  /** `production`, `preview` or `development`. */
  environment: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
  newId?: () => string;
};

/** Sentry wants a 32-character hex id, no dashes. */
const defaultId = () => crypto.randomUUID().replaceAll("-", "");

export function buildEnvelope(
  report: SafeErrorReport,
  meta: { eventId: string; now: Date; environment: string },
): string {
  const event = {
    event_id: meta.eventId,
    timestamp: meta.now.toISOString(),
    platform: "node",
    level: "error",
    environment: meta.environment,
    tags: {
      route: report.route,
      route_type: report.routeType,
      method: report.method,
      ...(report.digest !== undefined && { digest: report.digest }),
    },
    exception: {
      values: [
        {
          type: report.errorClass,
          value: "[message withheld]",
          stacktrace: { frames: report.frames },
        },
      ],
    },
  };
  return [
    JSON.stringify({
      event_id: meta.eventId,
      sent_at: meta.now.toISOString(),
    }),
    JSON.stringify({ type: "event" }),
    JSON.stringify(event),
  ].join("\n");
}

/** Null when the DSN is not an EU Sentry DSN (the env schema refuses those first). */
export function createErrorSink(options: SinkOptions): ErrorSink | null {
  const dsn = parseSentryDsn(options.dsn);
  if (dsn === null) return null;
  const {
    environment,
    fetchImpl = fetch,
    timeoutMs = 2000,
    now = () => new Date(),
    newId = defaultId,
  } = options;

  return {
    async capture(report) {
      try {
        const response = await fetchImpl(dsn.endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/x-sentry-envelope",
            "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=website-sink/1`,
          },
          body: buildEnvelope(report, {
            eventId: newId(),
            now: now(),
            environment,
          }),
          // No cookies, no referrer, no redirects to somewhere else.
          credentials: "omit",
          referrerPolicy: "no-referrer",
          redirect: "error",
          signal: AbortSignal.timeout(timeoutMs),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
  };
}
