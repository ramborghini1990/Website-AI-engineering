// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildRuntime, type InquiryConfig } from "@/lib/inquiry/deps";

const nothing: InquiryConfig = {
  deployed: false,
  databaseUrl: undefined,
  redis: undefined,
  turnstileSecret: undefined,
  ipSalt: undefined,
  email: undefined,
};

const everything: InquiryConfig = {
  deployed: true,
  databaseUrl: "postgresql://user:pw@db.example.eu:5432/app",
  redis: { url: "https://eu.example.upstash.io", token: "token-for-tests" },
  turnstileSecret: "1x0000000000000000000000000000000AA",
  ipSalt: "a-long-random-test-salt-with-at-least-32-characters",
  email: {
    apiKey: "re_test",
    from: "no-reply@example.com",
    to: "owner@example.com",
  },
};

describe("buildRuntime: not deployed (laptop, tests, CI)", () => {
  it("works with nothing configured, in mock mode, with in-process stand-ins", async () => {
    const runtime = buildRuntime(nothing);

    expect(runtime.ready).toBe(true);
    expect(runtime.mode).toBe("mock");
    expect(runtime.missing).toEqual([]);
    expect(runtime.deps.store).not.toBeNull();
    expect(runtime.deps.mailer).not.toBeNull();
    expect(await runtime.deps.verifyBot?.(undefined)).toEqual({ ok: true });
    expect(await runtime.deps.limiter.limit("k")).toEqual({
      allowed: true,
      retryAfterSec: 0,
    });
  });

  it("has a development salt, so a local limiter works without secrets", () => {
    expect(buildRuntime(nothing).ipSalt).not.toBeNull();
  });

  it("the local limiter really limits: the sixth request in a window is refused", async () => {
    const { deps } = buildRuntime(nothing);

    const results = [];
    for (let i = 0; i < 6; i++)
      results.push((await deps.limiter.limit("same-client")).allowed);

    expect(results).toEqual([true, true, true, true, true, false]);
  });

  it("the memory mailbox sends nothing: a notification stays in the process", async () => {
    const { deps } = buildRuntime(nothing);

    expect(
      await deps.mailer?.mailer.send({
        to: "a@example.com",
        from: "b@example.com",
        subject: "s",
        text: "t",
      }),
    ).toEqual({ ok: true });
  });

  it("uses a configured service even outside a deployment, and says it is not fully mock when all four are set", () => {
    const runtime = buildRuntime({ ...everything, deployed: false });

    expect(runtime.mode).toBe("live");
    expect(runtime.ready).toBe(true);
  });
});

describe("buildRuntime: deployed (Vercel)", () => {
  it("is ready and live when everything is configured", () => {
    const runtime = buildRuntime(everything);

    expect(runtime.ready).toBe(true);
    expect(runtime.mode).toBe("live");
    expect(runtime.ipSalt).toBe(everything.ipSalt);
    expect(runtime.deps.store).not.toBeNull();
    expect(runtime.deps.verifyBot).not.toBeNull();
  });

  it.each([
    ["the database", { databaseUrl: undefined }, "DATABASE_URL"],
    ["Redis", { redis: undefined }, "UPSTASH_REDIS_REST_*"],
    ["Turnstile", { turnstileSecret: undefined }, "TURNSTILE_*"],
    ["the salt", { ipSalt: undefined }, "RATE_LIMIT_IP_SALT"],
    ["email", { email: undefined }, "EMAIL_*, INQUIRY_NOTIFY_TO"],
  ])(
    "is NOT ready without %s: the form is unavailable, never silently mocked (negative)",
    (_name, override, missing) => {
      const runtime = buildRuntime({ ...everything, ...override });

      expect(runtime.ready).toBe(false);
      expect(runtime.missing).toEqual([missing]);
    },
  );

  it("with nothing configured it names everything missing, and has no store and no bot check to fall back on", () => {
    const runtime = buildRuntime({ ...nothing, deployed: true });

    expect(runtime.ready).toBe(false);
    expect(runtime.missing).toHaveLength(5);
    expect(runtime.deps.store).toBeNull();
    expect(runtime.deps.verifyBot).toBeNull();
    expect(runtime.deps.mailer).toBeNull();
    expect(runtime.ipSalt).toBeNull();
  });

  it("the list of what is missing holds names, never values", () => {
    const runtime = buildRuntime({
      ...everything,
      databaseUrl: undefined,
      turnstileSecret: undefined,
    });

    expect(runtime.missing.join(" ")).not.toMatch(
      /postgresql|re_test|token-for-tests|salt/i,
    );
  });
});
