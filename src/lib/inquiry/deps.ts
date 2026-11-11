import "server-only";

import { createDb } from "@/lib/db/client";
import { createMemoryMailer, createResendMailer } from "@/lib/email/resend";
import type { InquiryDeps } from "@/lib/inquiry/process";
import { createDrizzleStore, createMemoryStore } from "@/lib/inquiry/store";
import { logger } from "@/lib/logger";
import {
  createMemoryLimiter,
  INQUIRY_LIMIT,
  type RateLimiter,
} from "@/lib/security/rate-limit";
import { createUpstashLimiter } from "@/lib/security/rate-limit.upstash";
import { verifyTurnstile } from "@/lib/security/turnstile";

/**
 * Chooses the real service or the local stand-in for each part of the inquiry
 * flow, from plain configuration (so it is testable without the environment;
 * `runtime.ts` reads the environment).
 *
 * Two situations:
 * - DEPLOYED (Vercel sets `VERCEL_ENV`): everything must be configured, else
 *   the form is `ready: false` and says it is unavailable. No silent mock: a
 *   lead must never be accepted and dropped. Redis, the database, Turnstile
 *   and email are all required there.
 * - NOT deployed (local development, tests, CI, `next start` on a laptop):
 *   whatever is configured is used, the rest is replaced by an in-process
 *   stand-in (memory store, memory limiter, memory mailbox, a bot check that
 *   passes), so the form works with no network and no secrets.
 */

export type InquiryConfig = {
  deployed: boolean;
  databaseUrl: string | undefined;
  redis: { url: string; token: string } | undefined;
  turnstileSecret: string | undefined;
  ipSalt: string | undefined;
  email: { apiKey: string; from: string; to: string } | undefined;
};

export type InquiryRuntime = {
  /** False when a deployed site lacks a required service: the form is unavailable. */
  ready: boolean;
  mode: "live" | "mock";
  deps: InquiryDeps;
  /** Salt for hashing the client address; `null` when it must be configured and is not. */
  ipSalt: string | null;
  /** Names of what is missing in a deployed site (variable groups, never values). */
  missing: string[];
};

/** Not a secret: only used where nothing is deployed, so a local limiter needs some key. */
export const DEV_SALT = "development-only-salt-not-a-secret-0000";

export function buildRuntime(config: InquiryConfig): InquiryRuntime {
  const missing: string[] = [];
  if (config.deployed) {
    if (config.databaseUrl === undefined) missing.push("DATABASE_URL");
    if (config.redis === undefined) missing.push("UPSTASH_REDIS_REST_*");
    if (config.turnstileSecret === undefined) missing.push("TURNSTILE_*");
    if (config.ipSalt === undefined) missing.push("RATE_LIMIT_IP_SALT");
    if (config.email === undefined) missing.push("EMAIL_*, INQUIRY_NOTIFY_TO");
  }

  const limiter: RateLimiter =
    config.redis !== undefined
      ? createUpstashLimiter({
          url: config.redis.url,
          token: config.redis.token,
        })
      : createMemoryLimiter({
          requests: INQUIRY_LIMIT.requests,
          windowSeconds: INQUIRY_LIMIT.windowSeconds,
        });

  const secret = config.turnstileSecret;
  const verifyBot =
    secret !== undefined
      ? (token: string | undefined) => verifyTurnstile({ token, secret })
      : config.deployed
        ? null
        : () => Promise.resolve({ ok: true } as const);

  const store =
    config.databaseUrl !== undefined
      ? createDrizzleStore(createDb(config.databaseUrl))
      : config.deployed
        ? null
        : createMemoryStore();

  const mailer =
    config.email !== undefined
      ? {
          mailer: createResendMailer({ apiKey: config.email.apiKey }),
          from: config.email.from,
          to: config.email.to,
        }
      : config.deployed
        ? null
        : {
            mailer: createMemoryMailer(),
            from: "local@example.invalid",
            to: "owner@example.invalid",
          };

  const live =
    config.databaseUrl !== undefined &&
    config.redis !== undefined &&
    secret !== undefined &&
    config.email !== undefined;

  return {
    ready: missing.length === 0,
    mode: live ? "live" : "mock",
    deps: { limiter, verifyBot, store, mailer, log: logger },
    ipSalt: config.ipSalt ?? (config.deployed ? null : DEV_SALT),
    missing,
  };
}
