import { env, siteUrl } from "@/lib/env";
import { buildSecurityTxt } from "@/lib/security/security-txt";

/**
 * `/.well-known/security.txt` (RFC 9116, P4.4). Plain text, built per request so
 * `Expires` never goes stale (see `buildSecurityTxt`). It is outside the proxy
 * matcher (the path has a dot), so the one header that matters for a text file
 * is set here.
 */
// Without this a GET handler that reads no request data is prerendered at build
// time, and `Expires` would be frozen at the build date.
export const dynamic = "force-dynamic";

export function GET(): Response {
  const body = buildSecurityTxt({
    origin: siteUrl.origin,
    contactEmail: env.SECURITY_CONTACT,
    now: new Date(),
  });
  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
    },
  });
}
