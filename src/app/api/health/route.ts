/**
 * Uptime probe (P4.5): `GET /api/health` (and `HEAD`) answers 200 `{"status":"ok"}`
 * when the app can start and render a response, which is what an external
 * monitor (UptimeRobot, Better Stack, Vercel's own checks) needs. Answering at
 * all proves the build, the environment validation (a bad variable fails at
 * start) and the function region work.
 *
 * Deliberately NOT in the answer: version, commit, region, uptime, which
 * services are configured, anything from the environment. It does not call the
 * database, Redis or any provider either: a public endpoint that fans out to
 * paid or rate-limited services can be used to exhaust them, and "the database
 * is down" is not something to tell strangers. See docs/DEPLOYMENT.md §8.
 *
 * `force-dynamic` plus `no-store` so a CDN or a browser never serves a stale
 * "ok" for a site that is down.
 */
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { status: "ok" },
    {
      headers: {
        "cache-control": "no-store, max-age=0",
        "x-robots-tag": "noindex",
      },
    },
  );
}
