import type { Instrumentation } from "next";

/**
 * Next calls this for every unhandled server error (render, route handler,
 * Server Action, proxy). It hands over the error, the request (path, headers)
 * and a context; only the method and the route PATTERN are used, and the rest
 * is deliberately not read (see `src/lib/observability/scrub.ts`).
 * It must be awaited, or the function can be frozen before the report is sent.
 *
 * The module is imported lazily so a deployment without `SENTRY_DSN` pays
 * nothing at start-up.
 */
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const { reportServerError } = await import("@/lib/observability/runtime");
  await reportServerError(error, { method: request.method }, context);
};
