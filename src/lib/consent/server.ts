import "server-only";

import { headers } from "next/headers";

import { CONSENT_COOKIE, parseDecision } from "@/lib/consent/state";

/** The value of one cookie in a request `Cookie` header, raw (still URL-encoded), as `document.cookie` gives it. */
function cookieValue(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const piece = part.trim();
    const at = piece.indexOf("=");
    if (at > 0 && piece.slice(0, at) === name) return piece.slice(at + 1);
  }
  return undefined;
}

/**
 * True when this request carries no valid consent decision: no cookie, or one
 * that is malformed, about another wording version, older than six months or
 * dated in the future (the same rules the browser applies, `parseDecision`).
 *
 * The root layout uses it so the banner is part of the server-rendered HTML for
 * a visitor who still has to choose. It then paints with the first frame
 * instead of popping up after hydration (P4.7: that late paint was the page's
 * Largest Contentful Paint). It only decides whether the banner is shown; the
 * choice itself is still read and written in the browser (`client.ts`).
 *
 * It reads the request header and never touches the server's cookie API: the
 * server sets no cookie at all (legal-structure.test.ts keeps it that way).
 */
export async function hasNoValidConsent(
  now: number = Date.now(),
): Promise<boolean> {
  const header = (await headers()).get("cookie") ?? "";
  return parseDecision(cookieValue(header, CONSENT_COOKIE), now) === null;
}
