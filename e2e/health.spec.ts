import { expect, test } from "@playwright/test";

/**
 * The uptime probe (P4.5) on the real server: answers fast, is never cached,
 * and says nothing about the deployment. No page is rendered, so no viewport,
 * theme or motion variant applies; the unit test covers the body in isolation.
 */

test.describe("GET /api/health", () => {
  test("answers 200 {status: ok}, uncached, not indexable", async ({
    request,
  }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers()["content-type"]).toContain("application/json");
    expect(response.headers()["cache-control"]).toBe("no-store, max-age=0");
    expect(response.headers()["x-robots-tag"]).toBe("noindex");
  });

  test("is not served from a cache on the second call", async ({ request }) => {
    await request.get("/api/health");
    const second = await request.get("/api/health");

    expect(second.headers()["x-vercel-cache"]).toBeUndefined();
    expect(second.headers()["age"]).toBeUndefined();
  });

  test("HEAD works for monitors that use it; other methods are refused", async ({
    request,
  }) => {
    expect((await request.head("/api/health")).status()).toBe(200);
    expect((await request.post("/api/health")).status()).toBe(405);
  });

  test("leaks nothing about the deployment (negative)", async ({ request }) => {
    const response = await request.get("/api/health");
    const headers = Object.keys(response.headers()).join(",");

    expect(await response.text()).not.toMatch(
      /version|commit|region|uptime|database|redis|next|node|\d+\.\d+\.\d+/i,
    );
    expect(headers).not.toMatch(/powered-by|x-version|x-vercel-id/i);
  });
});
