// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createMemoryMailer } from "@/lib/email/resend";
import {
  processInquiry,
  type InquiryDeps,
  type InquirySubmission,
} from "@/lib/inquiry/process";
import type { RawInquiry } from "@/lib/inquiry/schema";
import { createMemoryStore } from "@/lib/inquiry/store";
import type { Logger } from "@/lib/logger";
import { createMemoryLimiter } from "@/lib/security/rate-limit";

const raw: RawInquiry = {
  need: "ai-agents",
  description:
    "A synthetic description that is long enough to pass validation.",
  budget: "5k-15k",
  timeline: "asap",
  name: "Anna Test",
  email: "anna.test@example.com",
  company: "Example S.r.l.",
  marketingConsent: false,
};

function setup(overrides: Partial<InquiryDeps> = {}) {
  const store = createMemoryStore();
  const mailer = createMemoryMailer();
  const logs: Array<{ level: string; event: string; fields: unknown }> = [];
  const log: Logger = {
    info: (event, fields) => logs.push({ level: "info", event, fields }),
    warn: (event, fields) => logs.push({ level: "warn", event, fields }),
    error: (event, fields) => logs.push({ level: "error", event, fields }),
  };
  const deps: InquiryDeps = {
    limiter: createMemoryLimiter({
      requests: 5,
      windowSeconds: 600,
      now: () => 0,
    }),
    verifyBot: () => Promise.resolve({ ok: true }),
    store,
    mailer: { mailer, from: "no-reply@example.com", to: "owner@example.com" },
    log,
    ...overrides,
  };
  const submission = (
    over: Partial<InquirySubmission> = {},
  ): InquirySubmission => ({
    raw,
    honeypot: "",
    turnstileToken: "token",
    clientKey: "client-1",
    locale: "it",
    requestId: "req-1",
    ...over,
  });
  return { deps, store, mailer, logs, submission };
}

describe("processInquiry: the happy path", () => {
  it("stores the inquiry, notifies the owner and answers success", async () => {
    const { deps, store, mailer, submission } = setup();

    expect(await processInquiry(submission(), deps)).toEqual({
      status: "success",
    });

    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({
      email: "anna.test@example.com",
      locale: "it",
      marketingConsent: false,
    });
    expect(mailer.outbox).toHaveLength(1);
    expect(mailer.outbox[0]).toMatchObject({
      to: "owner@example.com",
      from: "no-reply@example.com",
      replyTo: "anna.test@example.com",
    });
  });

  it("stores the locale of the page", async () => {
    const { deps, store, submission } = setup();

    await processInquiry(submission({ locale: "en" }), deps);

    expect(store.rows[0]?.locale).toBe("en");
  });

  it("the marketing consent is stored as given, unticked by default", async () => {
    const { deps, store, submission } = setup();
    await processInquiry(submission(), deps);
    await processInquiry(
      submission({
        raw: { ...raw, marketingConsent: true },
        clientKey: "other",
      }),
      deps,
    );

    expect(store.rows.map((row) => row.marketingConsent)).toEqual([
      false,
      true,
    ]);
  });
});

describe("processInquiry: order of checks", () => {
  it("validates before it spends a rate-limit slot or calls the bot check (negative)", async () => {
    const limiter = {
      limit: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
    };
    const verifyBot = vi.fn(() => Promise.resolve({ ok: true } as const));
    const { deps, store, submission } = setup({ limiter, verifyBot });

    const result = await processInquiry(
      submission({ raw: { ...raw, email: "nope" } }),
      deps,
    );

    expect(result).toEqual({
      status: "error",
      code: "validation",
      fieldErrors: { email: "invalid" },
    });
    expect(limiter.limit).not.toHaveBeenCalled();
    expect(verifyBot).not.toHaveBeenCalled();
    expect(store.rows).toHaveLength(0);
  });

  it("rate-limits before it calls Cloudflare (a flood does not become a flood of verifications)", async () => {
    const verifyBot = vi.fn(() => Promise.resolve({ ok: true } as const));
    const { deps, submission } = setup({
      verifyBot,
      limiter: createMemoryLimiter({
        requests: 1,
        windowSeconds: 600,
        now: () => 0,
      }),
    });
    await processInquiry(submission(), deps);
    verifyBot.mockClear();

    const result = await processInquiry(submission(), deps);

    expect(result).toMatchObject({ status: "error", code: "rate_limited" });
    expect(verifyBot).not.toHaveBeenCalled();
  });

  it("checks the bot token before it stores anything", async () => {
    const { deps, store, mailer, submission } = setup({
      verifyBot: () => Promise.resolve({ ok: false, reason: "rejected" }),
    });

    expect(await processInquiry(submission(), deps)).toEqual({
      status: "error",
      code: "bot_check_failed",
    });
    expect(store.rows).toHaveLength(0);
    expect(mailer.outbox).toHaveLength(0);
  });
});

describe("processInquiry: honeypot", () => {
  it("a filled honeypot gets a normal-looking success but nothing is stored, sent or counted (negative)", async () => {
    const limiter = {
      limit: vi.fn(() => Promise.resolve({ allowed: true, retryAfterSec: 0 })),
    };
    const verifyBot = vi.fn(() => Promise.resolve({ ok: true } as const));
    const { deps, store, mailer, submission } = setup({ limiter, verifyBot });

    const result = await processInquiry(
      submission({ honeypot: "http://spam.example" }),
      deps,
    );

    expect(result).toEqual({ status: "success" });
    expect(store.rows).toHaveLength(0);
    expect(mailer.outbox).toHaveLength(0);
    expect(limiter.limit).not.toHaveBeenCalled();
    expect(verifyBot).not.toHaveBeenCalled();
  });

  it("a honeypot of only spaces is not a bot (a browser autofill artefact)", async () => {
    const { deps, store, submission } = setup();

    await processInquiry(submission({ honeypot: "   " }), deps);

    expect(store.rows).toHaveLength(1);
  });
});

describe("processInquiry: rate limit", () => {
  it("answers with the retry time once the client is over the limit", async () => {
    const { deps, store, submission } = setup({
      limiter: createMemoryLimiter({
        requests: 2,
        windowSeconds: 600,
        now: () => 0,
      }),
    });

    await processInquiry(submission(), deps);
    await processInquiry(submission(), deps);
    const third = await processInquiry(submission(), deps);

    expect(third).toEqual({
      status: "error",
      code: "rate_limited",
      retryAfterSec: 600,
    });
    expect(store.rows).toHaveLength(2);
  });

  it("limits each client separately", async () => {
    const { deps, store, submission } = setup({
      limiter: createMemoryLimiter({
        requests: 1,
        windowSeconds: 600,
        now: () => 0,
      }),
    });

    await processInquiry(submission({ clientKey: "a" }), deps);
    await processInquiry(submission({ clientKey: "b" }), deps);

    expect(store.rows).toHaveLength(2);
  });
});

describe("processInquiry: failures are typed, never raw", () => {
  it("a bot check that cannot reach Cloudflare is `unavailable`, not an accusation", async () => {
    const { deps, store, submission } = setup({
      verifyBot: () => Promise.resolve({ ok: false, reason: "unavailable" }),
    });

    expect(await processInquiry(submission(), deps)).toEqual({
      status: "error",
      code: "unavailable",
    });
    expect(store.rows).toHaveLength(0);
  });

  it("a missing token is a failed bot check", async () => {
    const { deps, submission } = setup({
      verifyBot: () => Promise.resolve({ ok: false, reason: "missing_token" }),
    });

    expect(
      await processInquiry(submission({ turnstileToken: undefined }), deps),
    ).toEqual({
      status: "error",
      code: "bot_check_failed",
    });
  });

  it("a database error is `unavailable`, sends no email, and does not leak the error (negative)", async () => {
    const { deps, mailer, logs, submission } = setup({
      store: {
        insert: () =>
          Promise.reject(
            new Error(
              "connection to db.internal:5432 refused for anna.test@example.com",
            ),
          ),
      },
    });

    const result = await processInquiry(submission(), deps);

    expect(result).toEqual({ status: "error", code: "unavailable" });
    expect(JSON.stringify(result)).not.toMatch(/db\.internal|anna/);
    expect(mailer.outbox).toHaveLength(0);
    expect(logs.at(-1)).toMatchObject({
      level: "error",
      event: "inquiry.store_failed",
    });
  });

  it("a deployed site without a store or a bot check refuses instead of accepting an inquiry it cannot keep", async () => {
    for (const missing of [{ store: null }, { verifyBot: null }] as const) {
      const { deps, mailer, submission } = setup(missing);

      expect(await processInquiry(submission(), deps)).toEqual({
        status: "error",
        code: "unavailable",
      });
      expect(mailer.outbox).toHaveLength(0);
    }
  });

  it("a failed email does not fail the inquiry: it is already stored, and the failure is logged", async () => {
    const { deps, store, logs, submission } = setup({
      mailer: {
        mailer: { send: () => Promise.resolve({ ok: false }) },
        from: "no-reply@example.com",
        to: "owner@example.com",
      },
    });

    expect(await processInquiry(submission(), deps)).toEqual({
      status: "success",
    });
    expect(store.rows).toHaveLength(1);
    expect(logs.some((entry) => entry.event === "inquiry.email_failed")).toBe(
      true,
    );
  });

  it("a mailer that throws does not fail the inquiry either", async () => {
    const { deps, store, submission } = setup({
      mailer: {
        mailer: { send: () => Promise.reject(new Error("boom")) },
        from: "no-reply@example.com",
        to: "owner@example.com",
      },
    });

    expect(await processInquiry(submission(), deps)).toEqual({
      status: "success",
    });
    expect(store.rows).toHaveLength(1);
  });

  it("without a mailer the inquiry is stored and the missing email is logged", async () => {
    const { deps, store, logs, submission } = setup({ mailer: null });

    expect(await processInquiry(submission(), deps)).toEqual({
      status: "success",
    });
    expect(store.rows).toHaveLength(1);
    expect(logs.some((entry) => entry.event === "inquiry.email_skipped")).toBe(
      true,
    );
  });
});

describe("processInquiry: nothing personal reaches the logs (CLAUDE.md §10)", () => {
  it("across success, validation, rate limit, bot and store failures, no log field holds the submitted data", async () => {
    const scenarios: Array<Partial<InquiryDeps>> = [
      {},
      { verifyBot: () => Promise.resolve({ ok: false, reason: "rejected" }) },
      {
        store: {
          insert: () =>
            Promise.reject(new Error("db down: anna.test@example.com")),
        },
      },
      {
        limiter: {
          limit: () => Promise.resolve({ allowed: false, retryAfterSec: 30 }),
        },
      },
    ];
    const everything: unknown[] = [];

    for (const scenario of scenarios) {
      const { deps, logs, submission } = setup(scenario);
      await processInquiry(submission(), deps);
      await processInquiry(submission({ raw: { ...raw, email: "bad" } }), deps);
      await processInquiry(submission({ honeypot: "spam" }), deps);
      everything.push(...logs);
    }

    const text = JSON.stringify(everything);
    expect(everything.length).toBeGreaterThan(8);
    for (const secret of [
      "anna.test",
      "Anna Test",
      "Example S.r.l.",
      "synthetic description",
      "client-1",
      "token",
    ]) {
      expect(text, secret).not.toContain(secret);
    }
  });

  it("every log call carries the request id and the route", async () => {
    const { deps, logs, submission } = setup();
    await processInquiry(submission(), deps);

    for (const entry of logs) {
      expect(entry.fields).toMatchObject({
        route: "/contact",
        requestId: "req-1",
      });
    }
  });
});
