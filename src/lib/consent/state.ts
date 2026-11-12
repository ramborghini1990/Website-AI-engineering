import {
  CONSENT_POLICY_VERSION,
  consentCategories,
  type ConsentCategory,
} from "@/lib/consent/registry";

/**
 * The visitor's cookie choice as it is kept in the browser, and how it is read
 * back. Pure and client-safe (no Zod: it must not reach the browser, see
 * `analytics/event-schema.ts`). The cookie is external input like any other, so
 * `parseDecision` checks every field and treats anything unexpected as "no
 * decision": the banner asks again, nothing is assumed.
 */

export const CONSENT_COOKIE = "consent";

/** 6 months (Garante 2021, §6.2): the banner does not come back sooner. */
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 182;

/** Same origin only; the receipt endpoint. */
export const CONSENT_RECEIPT_PATH = "/api/consent";

/** How the choice was made. `close` is the "X": it means reject. */
export const consentMethods = [
  "accept_all",
  "reject_all",
  "custom",
  "close",
] as const;
export type ConsentMethod = (typeof consentMethods)[number];

export type ConsentChoices = Record<ConsentCategory, boolean>;

export type ConsentDecision = {
  version: string;
  /** Milliseconds since the epoch, from the visitor's device. */
  decidedAt: number;
  choices: ConsentChoices;
  /** The receipt code the server returned; `null` until (or unless) it did. */
  id: string | null;
};

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isReceiptId = (value: unknown): value is string =>
  typeof value === "string" && UUID.test(value);

export const rejectAll = (): ConsentChoices =>
  Object.fromEntries(
    consentCategories.map((category) => [category, false]),
  ) as ConsentChoices;

export const acceptAll = (): ConsentChoices =>
  Object.fromEntries(
    consentCategories.map((category) => [category, true]),
  ) as ConsentChoices;

/** The compact cookie value: `{"v","t","c":[0|1,...],"i"}`, URL-encoded. */
export function serializeDecision(decision: ConsentDecision): string {
  return encodeURIComponent(
    JSON.stringify({
      v: decision.version,
      t: decision.decidedAt,
      c: consentCategories.map((category) =>
        decision.choices[category] ? 1 : 0,
      ),
      ...(decision.id === null ? {} : { i: decision.id }),
    }),
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Reads the cookie value. `null` (ask again) when it is missing, is not exactly
 * what `serializeDecision` writes, names another wording version (the banner or
 * the categories changed), is older than 6 months, or is dated in the future.
 */
export function parseDecision(
  raw: string | undefined,
  now: number,
): ConsentDecision | null {
  if (raw === undefined || raw === "" || raw.length > 400) return null;
  let value: unknown;
  try {
    value = JSON.parse(decodeURIComponent(raw));
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (!keys.every((key) => ["v", "t", "c", "i"].includes(key))) return null;

  const { v, t, c, i } = record;
  if (v !== CONSENT_POLICY_VERSION) return null;
  if (typeof t !== "number" || !Number.isFinite(t)) return null;
  if (now - t > CONSENT_MAX_AGE_SECONDS * 1000 || t - now > DAY_MS) return null;
  if (
    !Array.isArray(c) ||
    c.length !== consentCategories.length ||
    !c.every((flag) => flag === 0 || flag === 1)
  ) {
    return null;
  }
  if (i !== undefined && !isReceiptId(i)) return null;

  const choices = Object.fromEntries(
    consentCategories.map((category, index) => [category, c[index] === 1]),
  ) as ConsentChoices;
  return { version: v, decidedAt: t, choices, id: i ?? null };
}
