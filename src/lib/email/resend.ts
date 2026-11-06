import "server-only";

import { z } from "zod";

/**
 * Transactional email through Resend's REST API (decision D5 in
 * docs/BLUEPRINT.md: an EU-capable transactional provider; Resend needs no SDK,
 * a `fetch` is enough, so no dependency is added). The provider is a processor
 * of the visitor's inquiry: it belongs in the record of processing and the
 * privacy notice (P4.2), with its DPA and the data region checked.
 *
 * Only the notification to the owner is sent. No email goes to the visitor.
 */

export type OutgoingEmail = {
  to: string;
  from: string;
  subject: string;
  text: string;
  /** Where a reply goes: the visitor's address, already validated as an email. */
  replyTo?: string;
};

export type Mailer = {
  send(message: OutgoingEmail): Promise<{ ok: true } | { ok: false }>;
};

const RESEND_URL = "https://api.resend.com/emails";
const answer = z.object({ id: z.string() });

export function createResendMailer(options: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Mailer {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async send(message) {
      try {
        const response = await fetchImpl(RESEND_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            ...(message.replyTo !== undefined
              ? { reply_to: message.replyTo }
              : {}),
          }),
          signal: AbortSignal.timeout(options.timeoutMs ?? 8000),
        });
        if (!response.ok) return { ok: false };
        return answer.safeParse(await response.json()).success
          ? { ok: true }
          : { ok: false };
      } catch {
        return { ok: false };
      }
    },
  };
}

/** Local development, tests and CI: nothing leaves the machine; messages are kept for inspection. */
export function createMemoryMailer(): Mailer & { outbox: OutgoingEmail[] } {
  const outbox: OutgoingEmail[] = [];
  return {
    outbox,
    send(message) {
      outbox.push(message);
      return Promise.resolve({ ok: true });
    },
  };
}
