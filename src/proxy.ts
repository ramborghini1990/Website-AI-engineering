import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";

import { routing } from "@/i18n/routing";

const handleI18nRouting = createMiddleware(routing);

/**
 * Next 16 renamed `middleware.ts` to `proxy.ts`.
 *
 * Redirects locale-less paths ("/", "/foo") to the visitor's locale, chosen
 * from Accept-Language (no cookie, see src/i18n/routing.ts).
 *
 * P1.7 adds the CSP nonce and security headers here. They must be applied to
 * the response returned below (redirects included), so keep returning the
 * response object from `handleI18nRouting` instead of building a new one.
 */
export default function proxy(request: NextRequest) {
  return handleI18nRouting(request);
}

export const config = {
  // Skip: API routes, Next internals, Vercel internals, and anything with a
  // dot in the last segment (static files such as /favicon.ico, /next.svg and
  // /.well-known/security.txt).
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
