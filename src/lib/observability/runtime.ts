import "server-only";

import { env } from "@/lib/env";
import { reportRequestError } from "@/lib/observability/request-error";
import type { ReportContext } from "@/lib/observability/scrub";
import { createErrorSink, type ErrorSink } from "@/lib/observability/sink";

/**
 * Wires `SENTRY_DSN` to the sink. Unset (the default, and always in
 * development and CI) means no sink: errors are logged and nothing leaves the
 * server. Built once per process.
 */
let cached: ErrorSink | null | undefined;

function getSink(): ErrorSink | null {
  if (cached === undefined) {
    cached =
      env.SENTRY_DSN === undefined
        ? null
        : createErrorSink({
            dsn: env.SENTRY_DSN,
            environment: env.VERCEL_ENV ?? env.NODE_ENV,
          });
  }
  return cached;
}

export function reportServerError(
  error: unknown,
  request: { method?: unknown },
  context: ReportContext,
): Promise<void> {
  return reportRequestError(error, request, context, { sink: getSink() });
}
