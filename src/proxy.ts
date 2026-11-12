import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";

import { routing } from "@/i18n/routing";
import { env, isDevelopment } from "@/lib/env";
import {
  buildCsp,
  cspHeaderName,
  generateNonce,
  resolveCspMode,
  securityHeaders,
} from "@/lib/security/csp";

const handleI18nRouting = createMiddleware(routing);

/** True when the path has a percent-escape that is not valid UTF-8. */
function isMalformedPath(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return false;
  } catch {
    return true;
  }
}

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`.
 *
 * 1. Locale: redirects locale-less paths ("/", "/foo") to the visitor's
 *    locale, chosen from Accept-Language (no cookie, see src/i18n/routing.ts).
 * 2. Security: a fresh CSP nonce per request, the CSP itself (enforced in
 *    production unless `CSP_MODE=report-only` is set as a rollback; see
 *    `resolveCspMode`) and the fixed security headers, on every response
 *    including redirects.
 *
 * The nonce travels two ways: in the CSP header on the response (what the
 * browser enforces) and in the REQUEST headers handed to the app (what Next
 * reads while rendering, to stamp the nonce on its own scripts, and what
 * `headers().get("x-nonce")` returns for a `<Script nonce>`). The response comes
 * from `handleI18nRouting`, so redirects keep working and keep their headers.
 */
export default function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const mode = resolveCspMode(env.CSP_MODE, env.NODE_ENV === "production");
  const headerName = cspHeaderName(mode);

  const requestHeaders = new Headers(request.headers);
  let policy: string | null = null;
  if (headerName !== null) {
    policy = buildCsp({
      nonce,
      development: isDevelopment,
      turnstile:
        env.NEXT_PUBLIC_TURNSTILE_SITE_KEY !== undefined &&
        env.TURNSTILE_SECRET_KEY !== undefined,
      analyticsOrigin: env.NEXT_PUBLIC_PLAUSIBLE_ORIGIN,
      bookingOrigin:
        env.NEXT_PUBLIC_CAL_URL !== undefined
          ? new URL(env.NEXT_PUBLIC_CAL_URL).origin
          : undefined,
      reportUri: env.CSP_REPORT_URI,
      enforcing: mode === "enforce",
    });
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set(headerName, policy);
  }

  // A path with a broken percent-escape ("/it/%E0%A4%A") makes Next answer 500.
  // It is the visitor's mistake, not ours: refuse it as a bad request.
  const response = isMalformedPath(request.nextUrl.pathname)
    ? new NextResponse(null, { status: 400 })
    : handleI18nRouting(new NextRequest(request, { headers: requestHeaders }));

  if (headerName !== null && policy !== null) {
    response.headers.set(headerName, policy);
  }
  for (const [name, value] of securityHeaders({
    production: env.NODE_ENV === "production",
  })) {
    response.headers.set(name, value);
  }
  return response;
}

export const config = {
  // Skip: API routes, Next internals, Vercel internals, and anything with a
  // dot in the last segment (static files such as /favicon.ico, /next.svg and
  // /.well-known/security.txt).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
