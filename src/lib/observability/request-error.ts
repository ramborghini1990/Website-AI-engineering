import { logger, newRequestId, type Logger } from "@/lib/logger";
import type { ErrorSink } from "@/lib/observability/sink";
import { scrubError, type ReportContext } from "@/lib/observability/scrub";

/**
 * What happens when Next reports an unhandled server error (`onRequestError`
 * in `src/instrumentation.ts`, P4.5): one scrubbed log line, then, if a tracker
 * is configured, the same scrubbed report to it. Both come from the same
 * `SafeErrorReport`, so the log and the tracker can never disagree about what
 * is safe. Errors caught by our own handlers (they answer with a typed result)
 * are logged there with their class only and do not pass through here.
 *
 * Never throws: this runs while the visitor is already getting an error page.
 */

export type RequestErrorDeps = {
  sink: ErrorSink | null;
  log?: Logger;
};

export async function reportRequestError(
  error: unknown,
  request: { method?: unknown },
  context: ReportContext,
  deps: RequestErrorDeps,
): Promise<void> {
  const log = deps.log ?? logger;
  try {
    const report = scrubError(error, request, context);
    log.error("request.error", {
      route: report.route,
      errorClass: report.errorClass,
      requestId: newRequestId(),
      ...(report.digest !== undefined && { code: report.digest }),
    });
    if (deps.sink !== null) {
      const sent = await deps.sink.capture(report);
      if (!sent) log.warn("request.error.not-reported", { provider: "sentry" });
    }
  } catch {
    // Nothing safe left to say; the error page is already on its way.
  }
}
