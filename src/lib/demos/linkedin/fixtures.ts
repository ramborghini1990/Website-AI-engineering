/**
 * The sample prospects of the LinkedIn outreach simulation (P3.2). Everything
 * here is invented: companies and people do not exist, no profile was read
 * from anywhere, and nothing was collected. Only the facts the rules need live
 * here; the words (name, role, company, place, what the company does, the news)
 * are in the messages (`demos.linkedin.items.<id>`) so they exist in both
 * languages.
 */

export type Sector = "manufacturing" | "logistics" | "retail";
export type Role = "operations" | "owner" | "marketing" | "finance";

export const prospectIds = [
  "alfa",
  "borgo",
  "cima",
  "delta",
  "eco",
  "fiume",
] as const;
export type ProspectId = (typeof prospectIds)[number];

/** A recent public business fact a message may refer to; its words are `demos.linkedin.news.<key>`. */
type News = "expansion" | "hub" | "certification";

export type Prospect = {
  id: ProspectId;
  sector: Sector;
  employees: number;
  role: Role;
  news: News | null;
  /** Marked "do not contact" in the (invented) CRM: the agent never scores or drafts for it. */
  doNotContact: boolean;
};

export const prospects: readonly Prospect[] = [
  {
    id: "alfa",
    sector: "manufacturing",
    employees: 120,
    role: "operations",
    news: "expansion",
    doNotContact: false,
  },
  {
    id: "borgo",
    sector: "logistics",
    employees: 60,
    role: "marketing",
    news: "hub",
    doNotContact: false,
  },
  {
    id: "cima",
    sector: "manufacturing",
    employees: 12,
    role: "owner",
    news: null,
    doNotContact: false,
  },
  {
    id: "delta",
    sector: "retail",
    employees: 800,
    role: "finance",
    news: null,
    doNotContact: false,
  },
  {
    id: "eco",
    sector: "manufacturing",
    employees: 200,
    role: "operations",
    news: "certification",
    doNotContact: true,
  },
  {
    id: "fiume",
    sector: "logistics",
    employees: 90,
    role: "operations",
    news: null,
    doNotContact: false,
  },
];
