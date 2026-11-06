/**
 * The client address for rate limiting, from the headers the platform sets
 * (Vercel overwrites `x-real-ip` and `x-forwarded-for`, so a visitor cannot
 * choose them). The value is hashed straight away by the caller and never
 * stored or logged. Anything that does not look like an IP address becomes
 * "unknown", one shared bucket: a garbage header cannot create unlimited keys.
 */
const IP_SHAPE = /^[0-9a-f:.]{2,45}$/i;

export function clientIp(headers: Pick<Headers, "get">): string {
  const candidate =
    headers.get("x-real-ip")?.trim() ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";
  return IP_SHAPE.test(candidate) ? candidate : "unknown";
}
