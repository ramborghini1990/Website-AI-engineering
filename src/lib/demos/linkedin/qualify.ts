import type { Prospect, Role, Sector } from "@/lib/demos/linkedin/fixtures";

/**
 * Lead qualification with fixed rules (P3.2): how well a prospect fits the
 * ideal customer of the fictional supplier, and so whether a first message is
 * worth a person's time at all. The weights are illustrative and shown to the
 * visitor as a breakdown; they are not a validated model.
 *
 * The first rule is not a score: a contact marked "do not contact" is blocked
 * before anything else and is neither scored nor drafted for.
 */

const IDEAL_CUSTOMER = {
  sectors: ["manufacturing", "logistics"] satisfies Sector[],
  minEmployees: 20,
  maxEmployees: 500,
  roles: ["operations", "owner"] satisfies Role[],
} as const;

export const FACTOR_POINTS = {
  sector: 30,
  size: 20,
  role: 25,
  news: 25,
} as const;
export type Factor = keyof typeof FACTOR_POINTS;

/** From this score a first message is worth drafting; from `HOLD_FROM` the contact is kept on a list. */
const DRAFT_FROM = 60;
const HOLD_FROM = 30;

/**
 * `draft`: write a first message for a person to review. `hold`: not now.
 * `skip`: not a fit. `blocked`: asked not to be contacted.
 */
export type Verdict = "draft" | "hold" | "skip" | "blocked";

export type Qualification = {
  factors: Factor[];
  /** Null when blocked: a blocked contact is not ranked. */
  score: number | null;
  verdict: Verdict;
};

const sectors: readonly Sector[] = IDEAL_CUSTOMER.sectors;
const roles: readonly Role[] = IDEAL_CUSTOMER.roles;

export function qualify(prospect: Prospect): Qualification {
  if (prospect.doNotContact) {
    return { factors: [], score: null, verdict: "blocked" };
  }

  const factors: Factor[] = [];
  if (sectors.includes(prospect.sector)) factors.push("sector");
  if (
    prospect.employees >= IDEAL_CUSTOMER.minEmployees &&
    prospect.employees <= IDEAL_CUSTOMER.maxEmployees
  ) {
    factors.push("size");
  }
  if (roles.includes(prospect.role)) factors.push("role");
  if (prospect.news !== null) factors.push("news");

  const score = factors.reduce((sum, factor) => sum + FACTOR_POINTS[factor], 0);
  const verdict: Verdict =
    score >= DRAFT_FROM ? "draft" : score >= HOLD_FROM ? "hold" : "skip";
  return { factors, score, verdict };
}
