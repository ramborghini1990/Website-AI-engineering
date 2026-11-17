import { isInteractiveDemo, type InteractiveDemo } from "@/lib/demos/registry";
import { WINDOW_DAYS, products, supplierIds } from "./business/fixtures";
import { documentIds, documents } from "./docintel/fixtures";
import { fixtures as inboxMessages } from "./instagram/fixtures";
import { prospects } from "./linkedin/fixtures";

/**
 * Facts about an interactive demo, for the badges on the work cards and the
 * detail page. Every count is computed from the demo's own fixtures (never
 * typed in here), so the badge and the demo cannot disagree. Every quality is
 * a statement the demo's page already makes; the sentence is cited above each
 * entry (content/work, Italian; the English page says the same).
 */

type CountKey =
  | "messages"
  | "prospects"
  | "documents"
  | "fields"
  | "flagged"
  | "products"
  | "suppliers"
  | "days";

type Quality =
  "synthetic" | "humanApproval" | "inBrowser" | "noServerWrites" | "noNetwork";

export interface DemoFacts {
  counts: Array<{ key: CountKey; count: number }>;
  qualities: Quality[];
}

const allFields = documentIds.flatMap((id) => documents[id].fields);

const counts: Record<InteractiveDemo, DemoFacts["counts"]> = {
  // "Una simulazione della posta in arrivo e dei commenti" (the sample inbox)
  "instagram-lead-agent": [{ key: "messages", count: inboxMessages.length }],
  // "Un breve elenco di aziende e persone inventate"
  "linkedin-assisted-outreach": [{ key: "prospects", count: prospects.length }],
  // "Tre documenti di esempio"; fields extracted; "Ogni documento contiene
  // qualcosa che una persona deve guardare" (the fields flagged for review)
  "document-intelligence-demo": [
    { key: "documents", count: documentIds.length },
    { key: "fields", count: allFields.length },
    {
      key: "flagged",
      count: allFields.filter((field) => field.review !== undefined).length,
    },
  ],
  // The sample shop: its products, its suppliers and the days of history
  "business-management-app": [
    { key: "products", count: products.length },
    { key: "suppliers", count: supplierIds.length },
    { key: "days", count: WINDOW_DAYS },
  ],
};

const qualities: Record<InteractiveDemo, Quality[]> = {
  // synthetic: "La demo usa solo profili e messaggi sintetici"
  // humanApproval: "la bozza viene mostrata e approvata da una persona"
  "instagram-lead-agent": ["synthetic", "humanApproval"],
  // synthetic: "usa solo dati inventati"
  // humanApproval: "passaggio di approvazione che non si può saltare"
  "linkedin-assisted-outreach": ["synthetic", "humanApproval"],
  // synthetic: "Tre documenti di esempio con aziende inventate"
  // humanApproval: "restano segnalati finché qualcuno non li segna come controllati"
  // noNetwork: "nulla viene inviato a un server"
  "document-intelligence-demo": ["synthetic", "humanApproval", "noNetwork"],
  // synthetic: "Il negozio, i prodotti e ogni importo sono inventati"
  // inBrowser: "salvate nell'archivio di questo browser"
  // noServerWrites: "nessun account, nessun server, nessun cookie"
  "business-management-app": ["synthetic", "inBrowser", "noServerWrites"],
};

const none: DemoFacts = { counts: [], qualities: [] };

/** The facts of an interactive demo; empty for any other slug (projects, drafts, unknown). */
export function demoFacts(slug: string): DemoFacts {
  if (!isInteractiveDemo(slug)) return none;
  return { counts: counts[slug], qualities: qualities[slug] };
}
