import { isForeignOrigin } from "@/lib/analytics/record";
import { clientIp } from "@/lib/inquiry/client-ip";
import { MAX_BODY_BYTES, recordConsent } from "@/lib/consent/receipt";
import { getConsentRuntime } from "@/lib/consent/receipt-runtime";
import { hashIp } from "@/lib/security/rate-limit";

/**
 * Receives a consent receipt (P4.1): `{ policyVersion, method, choices }` and
 * nothing else; answers `{ id }`, the random code the visitor keeps. It sets no
 * cookie (the browser writes its own consent cookie) and stores no IP. Order:
 * same-origin → type → size → JSON → validate → rate-limit → store. The raw IP
 * is hashed for the limiter right away and is never stored or logged.
 */
const NO_STORE = { "cache-control": "no-store" } as const;

const reply = (status: number, extra: Record<string, string> = {}) =>
  new Response(null, { status, headers: { ...NO_STORE, ...extra } });

export async function POST(request: Request): Promise<Response> {
  if (isForeignOrigin(request.headers)) return reply(403);

  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return reply(415);

  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) return reply(413);

  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return reply(400);
  }

  const runtime = getConsentRuntime();
  if (runtime.ipSalt === null) return reply(503);

  const result = await recordConsent(
    raw,
    hashIp(clientIp(request.headers), runtime.ipSalt),
    runtime.deps,
  );
  switch (result.status) {
    case "recorded":
      return Response.json(
        { id: result.id },
        { status: 201, headers: NO_STORE },
      );
    case "invalid":
      return reply(400);
    case "limited":
      return reply(429, { "retry-after": String(result.retryAfterSec) });
    case "unavailable":
      return reply(503);
  }
}
