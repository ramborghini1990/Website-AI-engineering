// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildRuntime, type InquiryRuntime } from "@/lib/inquiry/deps";

const state = vi.hoisted(() => ({
  headers: new Headers(),
  runtime: null as InquiryRuntime | null,
}));
const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(state.headers),
}));
vi.mock("@/i18n/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/inquiry/runtime", () => ({
  getInquiryRuntime: () => state.runtime,
}));

const { submitInquiry } = await import("@/app/[locale]/contact/actions");

const idle = { status: "idle" } as const;

function validForm(over: Record<string, string> = {}) {
  const form = new FormData();
  const fields: Record<string, string> = {
    need: "ai-agents",
    description:
      "A synthetic description that is long enough to pass validation.",
    budget: "5k-15k",
    timeline: "asap",
    name: "Anna Test",
    email: "anna.test@example.com",
    company: "",
    locale: "it",
    ...over,
  };
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

function freshRuntime(): InquiryRuntime {
  return buildRuntime({
    deployed: false,
    databaseUrl: undefined,
    redis: undefined,
    turnstileSecret: undefined,
    ipSalt: "a-long-random-test-salt-with-at-least-32-characters",
    email: undefined,
  });
}

beforeEach(() => {
  state.headers = new Headers({ "x-real-ip": "203.0.113.7" });
  state.runtime = freshRuntime();
  redirectMock.mockReset();
  // The real redirect throws to stop the action; so does the stand-in.
  redirectMock.mockImplementation(() => {
    throw new Error("NEXT_REDIRECT");
  });
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("submitInquiry", () => {
  it("on success redirects to the confirmation page in the visitor's language", async () => {
    await expect(submitInquiry(idle, validForm())).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirectMock).toHaveBeenCalledWith({
      href: "/contact/thanks",
      locale: "it",
    });
  });

  it("uses the English confirmation page for an English visit (the locale comes from the form)", async () => {
    await expect(
      submitInquiry(idle, validForm({ locale: "en" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirectMock).toHaveBeenCalledWith({
      href: "/contact/thanks",
      locale: "en",
    });
  });

  it.each(["", "xx", "IT", "../../admin", "it\nSet-Cookie: x=1", "en,it"])(
    "a missing or forged locale (%j) falls back to Italian: it can only ever be one of ours (negative)",
    async (forged) => {
      await expect(
        submitInquiry(idle, validForm({ locale: forged })),
      ).rejects.toThrow("NEXT_REDIRECT");

      expect(redirectMock).toHaveBeenCalledWith({
        href: "/contact/thanks",
        locale: "it",
      });
    },
  );

  it("does not use next-intl's server helpers, which need next/root-params (not allowed in a Server Action)", async () => {
    const source = (await import("node:fs")).readFileSync(
      new URL("./actions.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(/next-intl\/server|getLocale|getTranslations/);
  });

  it("returns field errors, without redirecting, for an invalid inquiry", async () => {
    const result = await submitInquiry(
      idle,
      validForm({ email: "not-an-email", description: "short" }),
    );

    expect(result).toEqual({
      status: "error",
      code: "validation",
      fieldErrors: { description: "tooShort", email: "invalid" },
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("a filled honeypot looks like success to the bot (redirect) but stores nothing", async () => {
    const runtime = state.runtime as InquiryRuntime;
    const insert = vi.fn();
    runtime.deps.store = { insert };

    await expect(
      submitInquiry(idle, validForm({ website: "http://spam.example" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(insert).not.toHaveBeenCalled();
  });

  it("rate-limits per client, keyed by a hash that does not contain the address", async () => {
    const runtime = state.runtime as InquiryRuntime;
    const keys: string[] = [];
    runtime.deps.limiter = {
      limit: (key) => {
        keys.push(key);
        return Promise.resolve({ allowed: true, retryAfterSec: 0 });
      },
    };

    await expect(submitInquiry(idle, validForm())).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(keys[0]).not.toContain("203");
  });

  it("two clients get two keys; the same client gets the same key", async () => {
    const runtime = state.runtime as InquiryRuntime;
    const keys: string[] = [];
    runtime.deps.limiter = {
      limit: (key) => {
        keys.push(key);
        return Promise.resolve({ allowed: true, retryAfterSec: 0 });
      },
    };

    for (const ip of ["203.0.113.7", "203.0.113.8", "203.0.113.7"]) {
      state.headers = new Headers({ "x-real-ip": ip });
      await expect(submitInquiry(idle, validForm())).rejects.toThrow(
        "NEXT_REDIRECT",
      );
    }

    expect(keys[0]).toBe(keys[2]);
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("answers rate_limited with the retry time once the limit is reached (the sixth request)", async () => {
    let last: unknown;
    for (let i = 0; i < 6; i++) {
      try {
        last = await submitInquiry(idle, validForm());
      } catch {
        last = "redirected";
      }
    }

    expect(last).toMatchObject({ status: "error", code: "rate_limited" });
    expect((last as { retryAfterSec: number }).retryAfterSec).toBeGreaterThan(
      0,
    );
  });

  it("reads the bot token from the form and passes it to the check", async () => {
    const runtime = state.runtime as InquiryRuntime;
    const verify = vi.fn(() =>
      Promise.resolve({ ok: false, reason: "rejected" } as const),
    );
    runtime.deps.verifyBot = verify;

    const result = await submitInquiry(
      idle,
      validForm({ turnstileToken: "token-from-widget" }),
    );

    expect(verify).toHaveBeenCalledWith("token-from-widget");
    expect(result).toEqual({ status: "error", code: "bot_check_failed" });
  });

  it("is unavailable, with nothing stored, when a deployed site is not fully configured (negative)", async () => {
    state.runtime = buildRuntime({
      deployed: true,
      databaseUrl: undefined,
      redis: undefined,
      turnstileSecret: undefined,
      ipSalt: undefined,
      email: undefined,
    });

    const result = await submitInquiry(idle, validForm());

    expect(result).toEqual({ status: "error", code: "unavailable" });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("ignores fields it does not know, such as framework fields (negative)", async () => {
    const runtime = state.runtime as InquiryRuntime;
    const inserted: unknown[] = [];
    runtime.deps.store = {
      insert: (record) => (inserted.push(record), Promise.resolve({ id: "1" })),
    };
    const form = validForm({
      $ACTION_ID_abc: "1",
      isAdmin: "true",
      ip: "203.0.113.7",
    });

    await expect(submitInquiry(idle, form)).rejects.toThrow("NEXT_REDIRECT");

    expect(JSON.stringify(inserted)).not.toMatch(
      /isAdmin|ACTION_ID|203\.0\.113/,
    );
  });

  it("never logs what the visitor typed", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(submitInquiry(idle, validForm())).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    await submitInquiry(idle, validForm({ email: "bad" }));

    const logged = [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls]
      .flat()
      .join(" ");
    expect(logged.length).toBeGreaterThan(0);
    expect(logged).not.toMatch(
      /anna|example\.com|203\.0\.113|synthetic description/i,
    );
  });
});
