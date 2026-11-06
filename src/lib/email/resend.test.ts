// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createMemoryMailer, createResendMailer } from "@/lib/email/resend";

const message = {
  to: "owner@example.com",
  from: "no-reply@example.com",
  subject: "A subject",
  text: "A body",
  replyTo: "visitor@example.com",
};

const answer = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("createResendMailer", () => {
  it("posts the message to Resend with the key in the Authorization header", async () => {
    const fetchImpl = vi.fn(() => answer({ id: "abc" }));
    const mailer = createResendMailer({ apiKey: "re_test_key", fetchImpl });

    expect(await mailer.send(message)).toEqual({ ok: true });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer re_test_key",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      reply_to: message.replyTo,
    });
  });

  it("omits reply_to when there is none", async () => {
    const fetchImpl = vi.fn(() => answer({ id: "abc" }));
    const withoutReply = {
      to: message.to,
      from: message.from,
      subject: message.subject,
      text: message.text,
    };

    await createResendMailer({ apiKey: "k", fetchImpl }).send(withoutReply);

    const init = (
      fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    expect(JSON.parse(init.body as string)).not.toHaveProperty("reply_to");
  });

  it("reports failure, never throws, on an error status, a bad answer or a network error (negative)", async () => {
    const cases: Array<typeof fetch> = [
      () => answer({ message: "nope" }, 401),
      () => answer({ unexpected: true }),
      () => Promise.reject(new TypeError("offline")),
      () => Promise.reject(new DOMException("timeout", "TimeoutError")),
    ];

    for (const fetchImpl of cases) {
      expect(
        await createResendMailer({ apiKey: "k", fetchImpl }).send(message),
      ).toEqual({ ok: false });
    }
  });
});

describe("createMemoryMailer", () => {
  it("keeps messages in memory and sends nothing", async () => {
    const mailer = createMemoryMailer();

    expect(await mailer.send(message)).toEqual({ ok: true });
    expect(mailer.outbox).toEqual([message]);
  });
});
