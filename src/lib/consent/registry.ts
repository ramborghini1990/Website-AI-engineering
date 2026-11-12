/**
 * Every third party the site can load, every service that receives visitor data
 * and every key it keeps in the browser, in one place (docs/GDPR_CHECKLIST.md
 * §3: the cookie policy and the privacy notice are generated from this single
 * registry, P4.2, and `src/lib/legal/legal-structure.test.ts` fails when the code
 * and this list disagree).
 *
 * Structure lives here; the words a visitor reads (purpose, lifetime, data,
 * region) live in `messages/*.json` → `legal.*`, keyed by the `id`/`name` below,
 * so they exist in both languages (a test checks that).
 *
 * A third party is loaded ONLY through `<ConsentGate category="...">` (CLAUDE.md
 * §10): nothing is requested on a page view, and the gate opens on the
 * visitor's own click or on a stored "yes" for its category (P4.1).
 *
 * Adding an embed = add its entry here (a test fails otherwise), use the gate,
 * allow its origin in `src/lib/security/csp.ts`, add its category to the banner
 * (`messages/*.json` → `consent.categories`) and its text to `legal.*`.
 * Adding a service that receives data = add a `processors` entry (the test finds
 * it from the environment schema, the dependencies and the URLs in the code).
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

/** Where the cookie policy is (P4.2); the banner links to it. */
export const COOKIE_POLICY_PATH = "/cookie-policy";

/** Closed lists, so the typed messages (`legal.*`) must have a text for each. */
type ThirdPartyId = "cal-booking";
type StoredKeyName = "consent" | "theme" | "demo-business-suite";
type ProcessorId =
  | "vercel"
  | "postgres"
  | "upstash"
  | "cloudflare-turnstile"
  | "resend"
  | "cal-com"
  | "anthropic";

export type ThirdParty = {
  id: ThirdPartyId;
  provider: string;
  /** Its entry in `processors` below. */
  processor: ProcessorId;
  category: ConsentCategory;
  /** When the first request to the provider happens. */
  trigger: "visitor-click" | "stored-consent";
  /** The CSP directive that allows it, and the variable that names its origin. */
  csp: { directive: "frame-src"; origin: "NEXT_PUBLIC_CAL_URL" };
};

export const thirdParties: readonly ThirdParty[] = [
  {
    id: "cal-booking",
    provider: "Cal.com (EU instance)",
    processor: "cal-com",
    category: "booking",
    // Always after an explicit act of the visitor: the click on the gate, or the
    // "yes" given earlier in the banner (the receipt proves it).
    trigger: "stored-consent",
    csp: { directive: "frame-src", origin: "NEXT_PUBLIC_CAL_URL" },
  },
];

export type StoredKey = {
  name: StoredKeyName;
  kind: "cookie" | "localStorage" | "indexedDB";
  /** "necessary" = technical, needs no consent (Garante guidelines 2021, §4). */
  category: "necessary";
  provider: "this site";
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
 *
 * Purpose and lifetime: `legal.storage.<name>` in the messages. The site sets no
 * language cookie (`localeCookie: false` in `src/i18n/routing.ts`).
 */
export const storedKeys: readonly StoredKey[] = [
  {
    name: "consent",
    kind: "cookie",
    category: "necessary",
    provider: "this site",
    owner: "src/lib/consent/client.ts",
  },
  {
    name: "theme",
    kind: "localStorage",
    category: "necessary",
    provider: "this site",
    owner: "src/lib/theme.ts",
  },
  {
    name: "demo-business-suite",
    kind: "indexedDB",
    category: "necessary",
    provider: "this site",
    owner: "src/lib/demos/business/storage.ts",
  },
];

export type Processor = {
  id: ProcessorId;
  /** The name a visitor knows it by. */
  name: string;
  /** The words for it in `legal.processors.<id>` are about this job. */
  role:
    | "hosting"
    | "database"
    | "rate-limit"
    | "bot-protection"
    | "email"
    | "booking"
    | "ai";
  /** When data can reach it. `live-demos` = only if live mode is switched on (it is off). */
  when: "every-visit" | "contact-form" | "booking-consent" | "live-demos";
  /** Environment variables (src/lib/env-schema.ts) that configure it. */
  envVars: readonly string[];
  /** Host names the code or the CSP names for it. */
  hosts: readonly string[];
  /** npm packages that talk to it. */
  packages: readonly string[];
};

/**
 * Every service that can receive a visitor's data, as a processor (art. 28) or,
 * for the booking calendar, a provider the visitor chooses to use. The cookie
 * policy and the privacy notice print this list; a test finds services from the
 * environment schema, the dependencies and the URLs in the code and fails if one
 * is missing here. Region and transfer wording: `legal.processors.<id>`.
 */
export const processors: readonly Processor[] = [
  {
    id: "vercel",
    name: "Vercel Inc.",
    role: "hosting",
    when: "every-visit",
    envVars: ["VERCEL_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL"],
    hosts: [],
    packages: [],
  },
  {
    id: "postgres",
    name: "PostgreSQL database host (EU)",
    role: "database",
    when: "contact-form",
    envVars: ["DATABASE_URL"],
    hosts: [],
    packages: ["postgres", "drizzle-orm"],
  },
  {
    id: "upstash",
    name: "Upstash",
    role: "rate-limit",
    when: "contact-form",
    envVars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    hosts: [],
    packages: ["@upstash/ratelimit", "@upstash/redis"],
  },
  {
    id: "cloudflare-turnstile",
    name: "Cloudflare Turnstile",
    role: "bot-protection",
    when: "contact-form",
    envVars: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"],
    hosts: ["challenges.cloudflare.com"],
    packages: [],
  },
  {
    id: "resend",
    name: "Resend",
    role: "email",
    when: "contact-form",
    envVars: ["EMAIL_API_KEY", "EMAIL_FROM", "INQUIRY_NOTIFY_TO"],
    hosts: ["api.resend.com"],
    packages: [],
  },
  {
    id: "cal-com",
    name: "Cal.com (EU instance)",
    role: "booking",
    when: "booking-consent",
    envVars: ["NEXT_PUBLIC_CAL_URL"],
    hosts: ["cal.eu", "app.cal.eu"],
    packages: [],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    role: "ai",
    when: "live-demos",
    envVars: ["ANTHROPIC_API_KEY", "DEMOS_LIVE_ENABLED"],
    hosts: [],
    packages: ["@anthropic-ai/sdk"],
  },
];
