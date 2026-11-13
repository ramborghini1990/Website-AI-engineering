import { useSyncExternalStore } from "react";

import { CONSENT_POLICY_VERSION } from "@/lib/consent/registry";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  CONSENT_RECEIPT_PATH,
  acceptAll,
  isReceiptId,
  parseDecision,
  rejectAll,
  serializeDecision,
  type ConsentChoices,
  type ConsentDecision,
  type ConsentMethod,
} from "@/lib/consent/state";

/**
 * The browser side of the cookie choice (P4.1). The ONLY module that reads or
 * writes the `consent` cookie (a test checks it). The choice applies at once and
 * is written to a first-party technical cookie; the receipt that proves it
 * (art. 7(1)) is sent afterwards, to this site only, and its failure never
 * undoes or blocks the choice.
 *
 * Before hydration (and on the server) the state is "unknown": every gate stays
 * blocked, so nothing loads. The one exception is the banner of a request the
 * server saw without a valid decision (`useConsent(true)`): it is rendered as
 * "undecided", which is what the browser reads too, so nothing flashes.
 */

export type ConsentSnapshot =
  | { status: "unknown"; revision: 0; panelOpen: false }
  | {
      status: "undecided";
      revision: number;
      panelOpen: boolean;
    }
  | {
      status: "decided";
      revision: number;
      panelOpen: boolean;
      decision: ConsentDecision;
    };

const SERVER_SNAPSHOT: ConsentSnapshot = {
  status: "unknown",
  revision: 0,
  panelOpen: false,
};

/**
 * What a browser that has not decided yet reads before any interaction. One
 * shared object, so a banner the server rendered as "undecided" (see
 * `useConsent`) finds the identical snapshot in the browser and is not
 * re-rendered after hydration.
 */
const UNDECIDED_SNAPSHOT: ConsentSnapshot = {
  status: "undecided",
  revision: 0,
  panelOpen: false,
};

/** Raised on every decision made in this page view, so a gate can tell "before" from "after". */
let revision = 0;
let panelOpen = false;
let cached: { key: string; value: ConsentSnapshot } | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function readCookie(): string {
  try {
    for (const part of document.cookie.split("; ")) {
      const at = part.indexOf("=");
      if (part.slice(0, at) === CONSENT_COOKIE) return part.slice(at + 1);
    }
  } catch {
    // Cookies blocked: no stored decision, the banner asks (and is not remembered).
  }
  return "";
}

function writeCookie(decision: ConsentDecision): void {
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${CONSENT_COOKIE}=${serializeDecision(decision)}; Max-Age=${String(CONSENT_MAX_AGE_SECONDS)}; Path=/; SameSite=Lax${secure}`;
  } catch {
    // Cookies blocked: the choice still holds for this page view (see `memory`).
  }
}

/**
 * The latest decision of this page view. Used as the answer ONLY when the
 * browser refused to keep the cookie (`cookieRefused`): then the choice lasts
 * this page view. When cookies work, the cookie is the single truth, so a
 * visitor who clears it is asked again.
 */
let memory: ConsentDecision | null = null;
let cookieRefused = false;

function current(): ConsentDecision | null {
  const stored = parseDecision(readCookie(), Date.now());
  return stored ?? (cookieRefused ? memory : null);
}

function getSnapshot(): ConsentSnapshot {
  const raw = readCookie();
  const key = `${raw}|${String(revision)}|${String(panelOpen)}|${String(cookieRefused)}`;
  if (cached !== null && cached.key === key) return cached.value;

  const decision = current();
  const value: ConsentSnapshot =
    decision === null
      ? revision === 0 && !panelOpen
        ? UNDECIDED_SNAPSHOT
        : { status: "undecided", revision, panelOpen }
      : { status: "decided", revision, panelOpen, decision };
  cached = { key, value };
  return value;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // A decision made in another tab shows up when this one is used again.
  window.addEventListener("focus", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("focus", listener);
  };
}

/**
 * `serverUndecided`: the server already saw that this request has no valid
 * decision (`hasNoValidConsent`), so it renders and hydrates as "undecided"
 * instead of "unknown". Only the banner passes it. Every other reader (the
 * gates) keeps "unknown" on the server, so nothing third-party can load before
 * the browser has read the cookie.
 */
export function useConsent(serverUndecided = false): ConsentSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () =>
    serverUndecided ? UNDECIDED_SNAPSHOT : SERVER_SNAPSHOT,
  );
}

export function allows(
  snapshot: ConsentSnapshot,
  category: keyof ConsentChoices,
): boolean {
  return snapshot.status === "decided" && snapshot.decision.choices[category];
}

/** Opens the banner on its preferences (the footer link, "withdraw as easy as give"). */
export function openPreferences(): void {
  panelOpen = true;
  emit();
}

export function closePanel(): void {
  panelOpen = false;
  emit();
}

async function sendReceipt(
  method: ConsentMethod,
  choices: ConsentChoices,
): Promise<string | null> {
  try {
    const response = await fetch(CONSENT_RECEIPT_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        policyVersion: CONSENT_POLICY_VERSION,
        method,
        choices,
      }),
      keepalive: true,
      credentials: "omit",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("id" in body)) {
      return null;
    }
    return isReceiptId(body.id) ? body.id : null;
  } catch {
    return null;
  }
}

/**
 * Records a decision: applied and stored now, proven afterwards. `close` (the
 * "X") is stored exactly like "reject all". A newer decision made while the
 * receipt is in flight wins: the late answer is dropped.
 */
function decide(method: ConsentMethod, choices: ConsentChoices): void {
  const decision: ConsentDecision = {
    version: CONSENT_POLICY_VERSION,
    decidedAt: Date.now(),
    choices,
    id: null,
  };
  memory = decision;
  writeCookie(decision);
  cookieRefused = parseDecision(readCookie(), Date.now()) === null;
  revision += 1;
  panelOpen = false;
  emit();

  void sendReceipt(method, choices).then((id) => {
    if (id === null || memory?.decidedAt !== decision.decidedAt) return;
    memory = { ...decision, id };
    writeCookie(memory);
    emit();
  });
}

export const acceptEverything = () => {
  decide("accept_all", acceptAll());
};
export const rejectEverything = (
  method: "reject_all" | "close" = "reject_all",
) => {
  decide(method, rejectAll());
};
export const saveChoices = (choices: ConsentChoices) => {
  decide("custom", choices);
};

/** For tests: forget everything held in this page view. */
export function resetConsentForTests(): void {
  revision = 0;
  panelOpen = false;
  memory = null;
  cookieRefused = false;
  cached = null;
}
