/**
 * Every third party the site can load and every key it keeps in the browser, in
 * one place (docs/GDPR_CHECKLIST.md §3: the cookie policy is generated from a
 * single registry, P4.2). A third party is loaded ONLY through
 * `<ConsentGate category="...">` (CLAUDE.md §10): nothing is requested on a page
 * view, and the gate opens on the visitor's own click or on a stored "yes" for
 * its category (P4.1).
 *
 * Adding an embed = add its entry here (a test fails otherwise), use the gate,
 * allow its origin in `src/lib/security/csp.ts`, add its category to the banner
 * (`messages/*.json` → `consent.categories`) and name it in the privacy and
 * cookie notices (P4.2).
 *
 * Client-safe: imported by the browser, so no Zod and no server-only code here.
 */

export const consentCategories = ["booking"] as const;
export type ConsentCategory = (typeof consentCategories)[number];

/**
 * The version of what the banner says and what it controls. Change it whenever
 * the banner text or the categories change materially: the stored choice stops
 * matching, the banner asks again, and the receipt names the wording that was on
 * screen (art. 7(1)). Also add it to the accepted versions in `receipt.ts`.
 * Not the same as `CONSENT_VERSION` of the inquiry form (marketing wording).
 */
export const CONSENT_POLICY_VERSION = "2026-11-v1";

/**
 * Where the cookie policy will be (P4.2). `null` until that page exists: the
 * banner links to it as soon as this is set and must not link to a 404 before.
 */
export const COOKIE_POLICY_PATH: string | null = null;

export type ThirdParty = {
  id: string;
  provider: string;
  category: ConsentCategory;
  /** When the first request to the provider happens. */
  trigger: "visitor-click" | "stored-consent";
  purpose: string;
  /** What the provider necessarily receives when the embed loads. */
  dataSent: readonly string[];
  /** The CSP directive that allows it, and the variable that names its origin. */
  csp: { directive: "frame-src"; origin: "NEXT_PUBLIC_CAL_URL" };
};

export const thirdParties: readonly ThirdParty[] = [
  {
    id: "cal-booking",
    provider: "Cal.com (EU instance)",
    category: "booking",
    // Always after an explicit act of the visitor: the click on the gate, or the
    // "yes" given earlier in the banner (the receipt proves it).
    trigger: "stored-consent",
    purpose: "Choosing a time for a first conversation",
    dataSent: [
      "IP address",
      "browser and device information",
      "whatever the visitor types into the booking page",
    ],
    csp: { directive: "frame-src", origin: "NEXT_PUBLIC_CAL_URL" },
  },
];

export type StoredKey = {
  name: string;
  kind: "cookie" | "localStorage" | "indexedDB";
  /** "necessary" = technical, needs no consent (Garante guidelines 2021, §4). */
  category: "necessary";
  provider: "this site";
  purpose: string;
  duration: string;
  /** The module that is allowed to read and write it (a test checks nobody else does). */
  owner: string;
};

/**
 * Everything this site writes in the visitor's browser, all of it first party
 * and never sent anywhere: the banner's answer (so the banner does not come
 * back and the choice can be proven), a theme the visitor picked on purpose, and
 * the changes the visitor makes in the business-suite demo. Classed "necessary"
 * (technical, requested by the visitor's own action): the classification of the
 * last two is draft and needs a qualified professional's review (P4.2).
 */
export const storedKeys: readonly StoredKey[] = [
  {
    name: "consent",
    kind: "cookie",
    category: "necessary",
    provider: "this site",
    purpose:
      "Remembers the cookie choice (choices, wording version, date, receipt code)",
    duration: "6 months",
    owner: "src/lib/consent/client.ts",
  },
  {
    name: "theme",
    kind: "localStorage",
    category: "necessary",
    provider: "this site",
    purpose: "Remembers the light or dark theme the visitor chose",
    duration: "until the visitor picks the automatic theme or clears it",
    owner: "src/lib/theme.ts",
  },
  {
    name: "demo-business-suite",
    kind: "indexedDB",
    category: "necessary",
    provider: "this site",
    purpose:
      "Keeps the changes the visitor makes in the business-suite demo; created when that demo opens, written only when the visitor changes something",
    duration: "until the visitor resets the demo or clears site data",
    owner: "src/lib/demos/business/storage.ts",
  },
];
