/**
 * Every third party the site can load, in one place (docs/GDPR_CHECKLIST.md §3:
 * the cookie policy is generated from a single registry, P4.2). A third party is
 * loaded ONLY through `<ConsentGate category="...">` (CLAUDE.md §10), after the
 * visitor's own click: nothing is requested on a page view, and nothing is
 * stored in the browser to remember the choice, so there is no consent cookie to
 * document for it.
 *
 * Adding an embed = add its entry here (a test fails otherwise), use the gate,
 * allow its origin in `src/lib/security/csp.ts` and name it in the privacy and
 * cookie notices (P4.2).
 */

export const consentCategories = ["booking"] as const;
export type ConsentCategory = (typeof consentCategories)[number];

export type ThirdParty = {
  id: string;
  provider: string;
  category: ConsentCategory;
  /** When the first request to the provider happens. */
  trigger: "visitor-click";
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
    trigger: "visitor-click",
    purpose: "Choosing a time for a first conversation",
    dataSent: [
      "IP address",
      "browser and device information",
      "whatever the visitor types into the booking page",
    ],
    csp: { directive: "frame-src", origin: "NEXT_PUBLIC_CAL_URL" },
  },
];
