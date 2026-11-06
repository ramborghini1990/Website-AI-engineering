// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  createMemoryLimiter,
  hashIp,
  INQUIRY_LIMIT,
} from "@/lib/security/rate-limit";

const SALT = "a-long-random-test-salt-with-at-least-32-characters";

describe("hashIp", () => {
  it("is stable for the same ip and salt, and never contains the ip", () => {
    const a = hashIp("203.0.113.42", SALT);

    expect(hashIp("203.0.113.42", SALT)).toBe(a);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toContain("203");
  });

  it("differs by ip and by salt (a rotated salt breaks the link)", () => {
    const a = hashIp("203.0.113.42", SALT);

    expect(hashIp("203.0.113.43", SALT)).not.toBe(a);
    expect(hashIp("203.0.113.42", `${SALT}-rotated`)).not.toBe(a);
  });
});

describe("createMemoryLimiter (sliding window)", () => {
  it("allows up to the limit, then blocks with a retry time", async () => {
    let now = 1_000_000;
    const limiter = createMemoryLimiter({
      requests: 3,
      windowSeconds: 60,
      now: () => now,
    });

    for (let i = 0; i < 3; i++) {
      expect(await limiter.limit("a")).toEqual({
        allowed: true,
        retryAfterSec: 0,
      });
      now += 1000;
    }
    const blocked = await limiter.limit("a");

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(57);
  });

  it("lets the client back in as the window slides", async () => {
    let now = 0;
    const limiter = createMemoryLimiter({
      requests: 2,
      windowSeconds: 10,
      now: () => now,
    });
    await limiter.limit("a");
    now = 5000;
    await limiter.limit("a");

    expect((await limiter.limit("a")).allowed).toBe(false);
    now = 10_001; // the first hit has left the window, the second has not
    expect((await limiter.limit("a")).allowed).toBe(true);
    expect((await limiter.limit("a")).allowed).toBe(false);
  });

  it("counts each client on its own", async () => {
    const limiter = createMemoryLimiter({
      requests: 1,
      windowSeconds: 60,
      now: () => 0,
    });

    expect((await limiter.limit("a")).allowed).toBe(true);
    expect((await limiter.limit("a")).allowed).toBe(false);
    expect((await limiter.limit("b")).allowed).toBe(true);
  });

  it("a blocked attempt does not extend the block (only allowed hits count)", async () => {
    let now = 0;
    const limiter = createMemoryLimiter({
      requests: 1,
      windowSeconds: 10,
      now: () => now,
    });
    await limiter.limit("a");
    for (let i = 0; i < 20; i++) {
      now += 400;
      await limiter.limit("a");
    }

    now = 10_001;
    expect((await limiter.limit("a")).allowed).toBe(true);
  });

  it("the inquiry limit is five a window of ten minutes", () => {
    expect(INQUIRY_LIMIT).toEqual({ requests: 5, windowSeconds: 600 });
  });

  it("keeps its memory bounded when many distinct clients arrive", async () => {
    let now = 0;
    const limiter = createMemoryLimiter({
      requests: 1,
      windowSeconds: 1,
      now: () => now,
    });
    for (let i = 0; i < 10_050; i++) {
      now += 2000; // every earlier window has expired
      await limiter.limit(`client-${String(i)}`);
    }

    expect((await limiter.limit("client-0")).allowed).toBe(true);
  });
});
