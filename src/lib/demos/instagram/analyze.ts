/**
 * The brain of the Instagram demo, as plain rules (P3.1). It is a SIMULATION of
 * what an agent decides: no model is called, no network is used, and the same
 * text always gives the same answer. A real agent would use a language model
 * for the same job and the same approval step; the rules make the demo free,
 * offline and testable.
 *
 * The text is DATA, never instructions: nothing in a message can change what
 * this code does. An attempt to instruct the agent ("ignore your previous
 * instructions") is recognised as one and treated as spam.
 */

export type Category = "inquiry" | "lead" | "support" | "spam";
export type Kind = "dm" | "comment";
export type SourceId =
  | "shipping"
  | "returns"
  | "sizing"
  | "wholesale"
  | "hours"
  | "pricing"
  | "orderStatus";

export type Factor =
  "intent" | "quantity" | "timeline" | "business" | "contact" | "budget";

/** Points per factor of a lead; they add up to 100. */
export const FACTOR_POINTS: Record<Factor, number> = {
  intent: 25,
  quantity: 25,
  timeline: 15,
  business: 15,
  contact: 10,
  budget: 10,
};

type Signal =
  | "link"
  | "promo"
  | "injection"
  | "orderProblem"
  | "damaged"
  | "refund"
  | Factor
  | "question"
  | "topicShipping"
  | "topicReturns"
  | "topicSizing"
  | "topicHours"
  | "topicPricing"
  | "noSource";

/** What the agent proposes. Every one of them needs a person's approval before anything happens. */
export type Action = "reply" | "reply-handoff" | "hide-report" | "escalate";
type Bucket = "hot" | "warm" | "cold";

export type Analysis = {
  category: Category;
  /** Why, in the order they were found. */
  signals: Signal[];
  /** Lead only: the factors that were present. */
  factors: Factor[];
  /** Lead only: 0-100. */
  score: number | null;
  bucket: Bucket | null;
  /** Knowledge-base entries the reply may use, and only those. */
  sources: SourceId[];
  action: Action;
};

export const MAX_TEXT_LENGTH = 280;

const normalise = (text: string) =>
  text.slice(0, 2000).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Money amounts are removed before counting quantities, so a budget is not read as a number of items. */
const withoutMoney = (text: string) =>
  text
    .replace(/[€$]\s?[\d.,]+/g, " ")
    .replace(/[\d.,]+\s?(?:€|eur\b|euro\b|dollars?\b|usd\b)/g, " ");

const PATTERNS = {
  link: /https?:\/\/|www\.|bit\.ly/,
  promo:
    /guadagn|earn \$|crypto|giveaway|follower gratis|free followers|click here|clicca qui|clicca il link|follow for follow|f4f|seguimi|follow me/,
  injection:
    /ignora .{0,30}istruzion|ignore .{0,25}instructions|system prompt|prompt di sistema|you are now|da ora sei/,
  orderProblem:
    /(il mio ordine|my order|ordine n|order #|tracking|tracciamento).{0,60}(non|not|ritard|late|delay|ancora|yet|bloccat)|(non|not).{0,40}(arrivat|consegnat|arrived|delivered|received|ricevut)/,
  damaged:
    /danneggiat|\brott[oa]\b|difettos|sbagliat|damaged|broken|defective|wrong (size|item|colou?r)/,
  refund: /rimbors|refund|money back|annull|cancel my/,
  intent:
    /preventiv|quotazion|\bquote\b|offerta|listino|ingrosso|wholesale|\bbulk\b|fornitur|rivender|resell|collaborazion|partnership/,
  quantity: /\bbulk\b|molti pezzi|many pieces/,
  timeline:
    /\bentro\b|fine (mese|settimana)|prossim[oa] (mese|settimana)|end of (the )?(month|week)|next (month|week)|deadline|scadenza|urgent|\basap\b|\bby (monday|friday|the end)/,
  business:
    /azienda|negozio|boutique|hotel|ristorante|\bspa\b|studio|ufficio|societa|company|business|\bshop\b|\bstore\b|agenzia|agency|\bteam\b|evento|\bevent\b/,
  contact:
    /chiam|telefon|\bcall\b|\bphone\b|\bemail\b|\be-mail\b|scriver|contattar|contact (us|me)|whatsapp/,
  budget: /budget|€|\beuro\b|\beur\b|\$|\bdollars?\b/,
  question: /\?/,
  topicShipping:
    /spedizion|consegn|corriere|shipping|delivery|quanto tempo|how long/,
  topicReturns:
    /\bresi\b|\breso\b|restituz|return policy|\breturns?\b|exchange|\bcambio\b/,
  topicSizing:
    /tagli[ae]|misur|dimension|\bsizes?\b|\bfit\b|color[ei]|colou?rs?/,
  topicHours:
    /orari|apert[oie]|chius[oie]|opening|\bopen\b|\bhours\b|domenica|sunday/,
  topicPricing:
    /quanto costa|prezz[oi]|\bcosto\b|how much|\bprice\b|\bcosts?\b/,
} as const;

function bucket(score: number): Bucket {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}

const NO_SCORE = { factors: [] as Factor[], score: null, bucket: null };

// What a message IS does not depend on whether it came as a direct message or
// a public comment (only the wording of the reply does, see draft.ts).
export function analyze(text: string): Analysis {
  const t = normalise(text);
  const signals: Signal[] = [];
  const found = (signal: Signal, pattern: RegExp) => {
    if (pattern.test(t)) {
      signals.push(signal);
      return true;
    }
    return false;
  };

  // 1. Spam first: a message that tries to instruct the agent or to sell something is not served.
  const link = found("link", PATTERNS.link);
  const promo = found("promo", PATTERNS.promo);
  const injection = found("injection", PATTERNS.injection);
  if (link || promo || injection) {
    return {
      category: "spam",
      signals,
      ...NO_SCORE,
      sources: [],
      action: "hide-report",
    };
  }

  // 2. Support: a problem with an order the customer already made.
  const orderProblem = found("orderProblem", PATTERNS.orderProblem);
  const damaged = found("damaged", PATTERNS.damaged);
  const refund = found("refund", PATTERNS.refund);
  if (orderProblem || damaged || refund) {
    const needsPerson = damaged || refund;
    return {
      category: "support",
      signals,
      ...NO_SCORE,
      sources: needsPerson ? ["orderStatus", "returns"] : ["orderStatus"],
      // Money and damaged goods are a person's decision.
      action: needsPerson ? "escalate" : "reply",
    };
  }

  // 3. Lead: someone who wants to buy, in quantity or for a business.
  const money = withoutMoney(t);
  const present = {
    intent: PATTERNS.intent.test(t),
    quantity:
      PATTERNS.quantity.test(t) ||
      (money.match(/\b\d{2,4}\b/g) ?? []).some((n) => Number(n) >= 10),
    timeline: PATTERNS.timeline.test(t),
    business: PATTERNS.business.test(t),
    contact: PATTERNS.contact.test(t),
    budget: PATTERNS.budget.test(t),
  } satisfies Record<Factor, boolean>;
  const isLead =
    present.intent ||
    (present.quantity && (present.business || present.timeline));
  if (isLead) {
    const factors = (Object.keys(present) as Factor[]).filter(
      (factor) => present[factor],
    );
    const score = factors.reduce(
      (sum, factor) => sum + FACTOR_POINTS[factor],
      0,
    );
    return {
      category: "lead",
      signals: factors,
      factors,
      score,
      bucket: bucket(score),
      sources: ["wholesale"],
      action: "reply-handoff",
    };
  }

  // 4. Inquiry: answer only from the knowledge base; with no source, hand it to a person.
  const sources: SourceId[] = [];
  const topic = (signal: Signal, pattern: RegExp, source: SourceId) => {
    if (found(signal, pattern)) sources.push(source);
  };
  topic("topicPricing", PATTERNS.topicPricing, "pricing");
  topic("topicShipping", PATTERNS.topicShipping, "shipping");
  topic("topicReturns", PATTERNS.topicReturns, "returns");
  topic("topicSizing", PATTERNS.topicSizing, "sizing");
  topic("topicHours", PATTERNS.topicHours, "hours");
  found("question", PATTERNS.question);
  if (sources.length === 0) signals.push("noSource");

  return {
    category: "inquiry",
    signals,
    ...NO_SCORE,
    sources,
    action: sources.length > 0 ? "reply" : "escalate",
  };
}
