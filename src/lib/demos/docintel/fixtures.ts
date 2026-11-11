/**
 * The sample documents of the document-intelligence demo (P3.3): what is
 * extracted from them and which questions can be asked. Everything here is
 * language-neutral and synthetic. The documents' TEXT lives in the messages
 * (`demos.docIntel.docs.<id>.sections.<section>.text`, in Italian and English),
 * because it is copy; this file says where in that text each value sits.
 *
 * `evidence` is the exact characters a value is read from. It must appear
 * exactly once in its section (a test checks both languages), so a citation can
 * point at it without ambiguity. Names, numbers and addresses are invented.
 */
export const documentIds = ["invoice", "contract", "ddt"] as const;
export type DocumentId = (typeof documentIds)[number];

type ValueKind = "text" | "date" | "money" | "number" | "percent";
export type Unit = "day" | "month" | "kilogram";
/** Why a value that WAS found still needs a person: the original is not clear. */
export type Review = "ambiguous" | "handwritten";

type SectionSpec = { id: string; page: number };

export type FieldSpec = {
  id: string;
  section: string;
  evidence: string;
  kind: ValueKind;
  unit?: Unit;
  review?: Review;
};

/** A question the visitor can pick. No fields means the document does not say. */
export type QuestionSpec = { id: string; fields: readonly string[] };

export type DocumentSpec = {
  id: DocumentId;
  pages: number;
  sections: readonly SectionSpec[];
  fields: readonly FieldSpec[];
  questions: readonly QuestionSpec[];
  /** Fields that must add up to another one (an arithmetic check on the extraction). */
  sumCheck?: { parts: readonly string[]; total: string };
};

const invoice: DocumentSpec = {
  id: "invoice",
  pages: 2,
  sections: [
    { id: "header", page: 1 },
    { id: "parties", page: 1 },
    { id: "lines", page: 1 },
    { id: "totals", page: 2 },
    { id: "payment", page: 2 },
  ],
  fields: [
    {
      id: "invoiceNo",
      section: "header",
      evidence: "FT-2026/0142",
      kind: "text",
    },
    {
      id: "issueDate",
      section: "header",
      evidence: "14/03/2026",
      kind: "date",
    },
    { id: "dueDate", section: "header", evidence: "13/04/2026", kind: "date" },
    {
      id: "supplier",
      section: "parties",
      evidence: "Tessitura Valle S.r.l.",
      kind: "text",
    },
    {
      id: "customer",
      section: "parties",
      evidence: "Orso Allestimenti S.r.l.",
      kind: "text",
    },
    {
      id: "po",
      section: "parties",
      evidence: "PO 4471",
      kind: "text",
      review: "ambiguous",
    },
    { id: "net", section: "totals", evidence: "€ 1.000,00", kind: "money" },
    { id: "vatRate", section: "totals", evidence: "22%", kind: "percent" },
    { id: "vat", section: "totals", evidence: "€ 220,00", kind: "money" },
    { id: "total", section: "totals", evidence: "€ 1.220,00", kind: "money" },
    {
      id: "paymentDays",
      section: "payment",
      evidence: "30",
      kind: "number",
      unit: "day",
    },
    {
      id: "accountHolder",
      section: "payment",
      evidence: "Tessitura Valle S.r.l.",
      kind: "text",
    },
  ],
  questions: [
    { id: "amountDue", fields: ["total", "dueDate"] },
    { id: "vat", fields: ["vat", "vatRate", "net"] },
    { id: "payTo", fields: ["accountHolder", "paymentDays"] },
    { id: "discount", fields: [] },
  ],
  sumCheck: { parts: ["net", "vat"], total: "total" },
};

const contract: DocumentSpec = {
  id: "contract",
  pages: 3,
  sections: [
    { id: "parties", page: 1 },
    { id: "scope", page: 1 },
    { id: "term", page: 1 },
    { id: "fees", page: 2 },
    { id: "renewal", page: 2 },
    { id: "liability", page: 3 },
    { id: "signatures", page: 3 },
  ],
  fields: [
    {
      id: "provider",
      section: "parties",
      evidence: "Studio Rete S.r.l.",
      kind: "text",
    },
    {
      id: "client",
      section: "parties",
      evidence: "Orso Allestimenti S.r.l.",
      kind: "text",
    },
    {
      id: "effectiveDate",
      section: "term",
      evidence: "01/04/2026",
      kind: "date",
    },
    {
      id: "termMonths",
      section: "term",
      evidence: "12",
      kind: "number",
      unit: "month",
    },
    {
      id: "monthlyFee",
      section: "fees",
      evidence: "€ 1.800,00",
      kind: "money",
      review: "handwritten",
    },
    {
      id: "paymentDays",
      section: "fees",
      evidence: "30",
      kind: "number",
      unit: "day",
    },
    {
      id: "noticeDays",
      section: "renewal",
      evidence: "60",
      kind: "number",
      unit: "day",
    },
    {
      id: "liabilityMonths",
      section: "liability",
      evidence: "12",
      kind: "number",
      unit: "month",
    },
    {
      id: "signDate",
      section: "signatures",
      evidence: "20/03/2026",
      kind: "date",
    },
  ],
  questions: [
    { id: "renewal", fields: ["noticeDays", "effectiveDate", "termMonths"] },
    { id: "fee", fields: ["monthlyFee", "paymentDays"] },
    { id: "liability", fields: ["liabilityMonths"] },
    { id: "nonCompete", fields: [] },
  ],
};

const ddt: DocumentSpec = {
  id: "ddt",
  pages: 1,
  sections: [
    { id: "header", page: 1 },
    { id: "parties", page: 1 },
    { id: "carrier", page: 1 },
    { id: "goods", page: 1 },
    { id: "receipt", page: 1 },
  ],
  fields: [
    { id: "ddtNo", section: "header", evidence: "2026/0877", kind: "text" },
    { id: "ddtDate", section: "header", evidence: "02/04/2026", kind: "date" },
    {
      id: "sender",
      section: "parties",
      evidence: "Tessitura Valle S.r.l.",
      kind: "text",
    },
    {
      id: "recipient",
      section: "parties",
      evidence: "Orso Allestimenti S.r.l.",
      kind: "text",
    },
    {
      id: "address",
      section: "parties",
      evidence: "Via Esempio 7, 20100 Milano",
      kind: "text",
    },
    {
      id: "carrier",
      section: "carrier",
      evidence: "Trasporti Rapidi S.n.c.",
      kind: "text",
    },
    { id: "plate", section: "carrier", evidence: "AB123CD", kind: "text" },
    { id: "packages", section: "goods", evidence: "3", kind: "number" },
    {
      id: "grossWeight",
      section: "goods",
      evidence: "148",
      kind: "number",
      unit: "kilogram",
      review: "ambiguous",
    },
    {
      id: "deliveredOn",
      section: "receipt",
      evidence: "03/04/2026",
      kind: "date",
    },
  ],
  questions: [
    { id: "weight", fields: ["packages", "grossWeight"] },
    { id: "who", fields: ["sender", "carrier", "recipient"] },
    { id: "delivered", fields: ["deliveredOn", "address"] },
    { id: "insured", fields: [] },
  ],
};

export const documents: Record<DocumentId, DocumentSpec> = {
  invoice,
  contract,
  ddt,
};
