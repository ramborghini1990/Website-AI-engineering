import { errorClass, type Logger } from "@/lib/logger";
import { buildNotification } from "@/lib/inquiry/notification";
import type { SubmitResult } from "@/lib/inquiry/result";
import { parseInquiry, type RawInquiry } from "@/lib/inquiry/schema";
import { toRecord, type InquiryStore } from "@/lib/inquiry/store";
import type { Mailer } from "@/lib/email/resend";
import type { RateLimiter } from "@/lib/security/rate-limit";
import type { TurnstileResult } from "@/lib/security/turnstile";

/**
 * What happens to a submitted inquiry, as one function with its services passed
 * in: validate (Zod) → rate-limit → verify the bot token → store → notify →
 * typed result (CLAUDE.md §6). Everything with side effects is an argument, so
 * the whole flow is tested with fakes and no network.
 *
 * The honeypot comes first of all: a filled one is a bot, and it is answered
 * with a normal-looking success so it learns nothing, but nothing is stored,
 * sent or counted.
 *
 * Errors reach the visitor as a short code (`unavailable`, `rate_limited`...),
 * never as a message from a service; the details go to the redacting logger as
 * an event name and an error class, never the submitted data.
 */

export type InquiryDeps = {
  limiter: RateLimiter;
  /** Resolves the bot check for a token; `null` means no verifier is configured (a deployed site must refuse). */
  verifyBot: ((token: string | undefined) => Promise<TurnstileResult>) | null;
  store: InquiryStore | null;
  /** The notification channel; `null` skips the email (the inquiry is still stored). */
  mailer: { mailer: Mailer; from: string; to: string } | null;
  log: Logger;
};

export type InquirySubmission = {
  raw: RawInquiry;
  /** The honeypot field's value. Real visitors never see or fill it. */
  honeypot: string;
  turnstileToken: string | undefined;
  /** The salted hash of the client, the rate-limit key. */
  clientKey: string;
  locale: "it" | "en";
  requestId: string;
};

const ROUTE = "/contact";

export async function processInquiry(
  submission: InquirySubmission,
  deps: InquiryDeps,
): Promise<SubmitResult> {
  const { log } = deps;
  const base = { route: ROUTE, requestId: submission.requestId };

  if (submission.honeypot.trim() !== "") {
    log.info("inquiry.honeypot", { ...base, code: "ignored" });
    return { status: "success" };
  }

  const parsed = parseInquiry(submission.raw);
  if (!parsed.ok) {
    log.info("inquiry.invalid", { ...base, code: "validation" });
    return {
      status: "error",
      code: "validation",
      fieldErrors: parsed.errors,
    };
  }

  const limited = await deps.limiter.limit(submission.clientKey);
  if (!limited.allowed) {
    log.warn("inquiry.rate_limited", {
      ...base,
      retryAfterSec: limited.retryAfterSec,
    });
    return {
      status: "error",
      code: "rate_limited",
      retryAfterSec: limited.retryAfterSec,
    };
  }

  if (deps.verifyBot === null || deps.store === null) {
    log.error("inquiry.misconfigured", { ...base, code: "unavailable" });
    return { status: "error", code: "unavailable" };
  }

  const bot = await deps.verifyBot(submission.turnstileToken);
  if (!bot.ok) {
    log.warn("inquiry.bot_check_failed", { ...base, code: bot.reason });
    return bot.reason === "unavailable"
      ? { status: "error", code: "unavailable" }
      : { status: "error", code: "bot_check_failed" };
  }

  try {
    await deps.store.insert(toRecord(parsed.data, submission.locale));
  } catch (error) {
    log.error("inquiry.store_failed", {
      ...base,
      errorClass: errorClass(error),
    });
    return { status: "error", code: "unavailable" };
  }

  if (deps.mailer !== null) {
    const { subject, text } = buildNotification(parsed.data, submission.locale);
    const sent = await deps.mailer.mailer
      .send({
        from: deps.mailer.from,
        to: deps.mailer.to,
        subject,
        text,
        replyTo: parsed.data.email,
      })
      .catch(() => ({ ok: false as const }));
    // The inquiry is already safe in the database: a failed email is logged, not shown to the visitor.
    if (!sent.ok) log.error("inquiry.email_failed", { ...base, code: "email" });
  } else {
    log.warn("inquiry.email_skipped", { ...base, code: "no_mailer" });
  }

  log.info("inquiry.stored", { ...base, status: 200 });
  return { status: "success" };
}
