import type { InquiryInput } from "@/lib/inquiry/schema";

/**
 * The email that tells the owner a new inquiry arrived. It is an internal
 * message (the owner reads Italian), so its labels live here, not in the
 * visitor-facing messages.
 *
 * Plain text only: nothing the visitor typed is ever interpreted as HTML. The
 * subject is built from fixed labels and never from free text, so a visitor
 * cannot inject headers or a misleading subject. The visitor's own text appears
 * only in the body.
 */

const NEED: Record<InquiryInput["need"], string> = {
  "ai-agents": "Agenti AI",
  "workflow-automation": "Automazione dei processi",
  "web-application": "Applicazione web",
  "document-intelligence": "Document intelligence",
  "not-sure": "Non so ancora",
};

const BUDGET: Record<InquiryInput["budget"], string> = {
  "under-5k": "Fino a 5.000 euro",
  "5k-15k": "Da 5.000 a 15.000 euro",
  "15k-50k": "Da 15.000 a 50.000 euro",
  "over-50k": "Oltre 50.000 euro",
  undecided: "Non ancora definito",
};

const TIMELINE: Record<InquiryInput["timeline"], string> = {
  asap: "Il prima possibile",
  "one-to-three-months": "Entro 1-3 mesi",
  "three-to-six-months": "Entro 3-6 mesi",
  exploring: "Sto solo valutando",
};

export type Notification = { subject: string; text: string };

export function buildNotification(
  input: InquiryInput,
  locale: "it" | "en",
): Notification {
  return {
    subject: `Nuova richiesta dal sito: ${NEED[input.need]}`,
    text: [
      "Nuova richiesta dal modulo di contatto.",
      "",
      `Nome: ${input.name}`,
      `Email: ${input.email}`,
      `Azienda: ${input.company ?? "non indicata"}`,
      `Lingua della pagina: ${locale === "it" ? "italiano" : "inglese"}`,
      "",
      `Di che cosa ha bisogno: ${NEED[input.need]}`,
      `Budget indicativo: ${BUDGET[input.budget]}`,
      `Tempi: ${TIMELINE[input.timeline]}`,
      `Consenso a comunicazioni di marketing: ${input.marketingConsent ? "sì" : "no"}`,
      "",
      "Descrizione:",
      input.description,
      "",
      "Rispondi a questo messaggio per scrivere direttamente alla persona.",
    ].join("\n"),
  };
}
