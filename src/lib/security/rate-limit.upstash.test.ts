// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.fn();
const slidingWindow = vi.fn(() => "sliding-window-config");
const redisConstructor = vi.fn();
const ratelimitConstructor = vi.fn();

vi.mock("@upstash/redis", () => ({ Redis: redisConstructor }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    function (this: { limit: unknown }, options: unknown) {
      ratelimitConstructor(options);
      this.limit = limitMock;
    },
    { slidingWindow },
  ),
}));

const { createUpstashLimiter } =
  await import("@/lib/security/rate-limit.upstash");

beforeEach(() => {
  limitMock.mockReset();
  slidingWindow.mockClear();
  redisConstructor.mockClear();
  ratelimitConstructor.mockClear();
});

describe("createUpstashLimiter", () => {
  it("builds a sliding window of five per ten minutes, with the given connection and no analytics", () => {
    createUpstashLimiter({ url: "https://eu.example.upstash.io", token: "t" });

    expect(redisConstructor).toHaveBeenCalledWith({
      url: "https://eu.example.upstash.io",
      token: "t",
    });
    expect(slidingWindow).toHaveBeenCalledWith(5, "600 s");
    expect(ratelimitConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: "ratelimit:inquiry",
        analytics: false,
      }),
    );
  });

  it("allows a request Upstash accepts", async () => {
    limitMock.mockResolvedValue({ success: true, reset: Date.now() + 1000 });
    const limiter = createUpstashLimiter({
      url: "https://x.example",
      token: "t",
    });

    expect(await limiter.limit("key")).toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
    expect(limitMock).toHaveBeenCalledWith("key");
  });

  it("blocks a request Upstash refuses and tells when to retry", async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 90_000 });
    const limiter = createUpstashLimiter({
      url: "https://x.example",
      token: "t",
    });

    const result = await limiter.limit("key");

    expect(result.allowed).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThanOrEqual(89);
    expect(result.retryAfterSec).toBeLessThanOrEqual(90);
  });

  it("a reset time in the past still asks for at least one second", async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() - 5000 });
    const limiter = createUpstashLimiter({
      url: "https://x.example",
      token: "t",
    });

    expect((await limiter.limit("key")).retryAfterSec).toBe(1);
  });

  it("logs a degraded limiter (Redis timeout) without any key or address", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    limitMock.mockResolvedValue({ success: true, reason: "timeout", reset: 0 });
    const limiter = createUpstashLimiter({
      url: "https://x.example",
      token: "t",
    });

    expect((await limiter.limit("hashed-client-key")).allowed).toBe(true);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("ratelimit.degraded");
    expect(String(warn.mock.calls[0]?.[0])).not.toContain("hashed-client-key");
  });
});
