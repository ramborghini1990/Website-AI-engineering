// @vitest-environment node
import { describe, expect, it } from "vitest";

import { dynamic, GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("answers 200 {status: ok} and nothing else", async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("is never cached and never indexed", () => {
    const headers = GET().headers;

    expect(headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(headers.get("x-robots-tag")).toBe("noindex");
    expect(dynamic).toBe("force-dynamic");
  });

  it("leaks no version, commit, region, uptime or service name (negative)", async () => {
    const response = GET();
    const text = await response.text();

    expect(Object.keys(JSON.parse(text) as object)).toEqual(["status"]);
    expect(text).not.toMatch(
      /version|commit|sha|region|uptime|database|redis|upstash|anthropic|next|node|\d+\.\d+\.\d+/i,
    );
    expect([...response.headers.keys()].join(",")).not.toMatch(
      /powered-by|server|x-vercel|x-version/i,
    );
  });
});
