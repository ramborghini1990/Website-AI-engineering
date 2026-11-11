import { clientIp } from "@/lib/inquiry/client-ip";
import {
  isForeignOrigin,
  MAX_BODY_BYTES,
  recordDemoEvent,
} from "@/lib/analytics/record";
import { getAnalyticsRuntime } from "@/lib/analytics/runtime";
import { hashIp } from "@/lib/security/rate-limit";

/**
 * Receives the demo events (P3.5): `{ event, demo }` and nothing else. No
 * cookie is read or set, nothing is stored per visitor, and the answer carries
 * no body. Order: same-origin → size → JSON → validate → rate-limit → count.
 * The raw IP is hashed for the limiter right away and is never stored or logged.
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

  const runtime = getAnalyticsRuntime();
  if (runtime.ipSalt === null) return reply(503);

  const result = await recordDemoEvent(
    raw,
    hashIp(clientIp(request.headers), runtime.ipSalt),
    runtime.deps,
  );
  switch (result.status) {
    case "recorded":
      return reply(204);
    case "invalid":
      return reply(400);
    case "limited":
      // Over the limit: dropped, and answered like a success. An error status
      // would put a red line in a busy visitor's console for a counter nobody
      // waits on, and tell a script where the limit is.
      return reply(204);
    case "unavailable":
      return reply(503);
  }
}
