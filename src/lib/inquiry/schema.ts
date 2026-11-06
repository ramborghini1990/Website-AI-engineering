import { z } from "zod";

// This module runs in the browser (each form step is checked with it). Zod 4
// normally probes `new Function("")` to enable its JIT; a strict CSP without
// 'unsafe-eval' reports that probe as a violation (`script-src <- eval`) even
// though the error is caught. Turning the JIT off removes the probe and costs
// nothing measurable on a four-field form. Must run before any schema is built.
z.config({ jitless: true });

/**
 * The inquiry (P2.5): what a visitor tells me in four steps. One schema,
 * shared by the browser (to guide each step) and the server action (which is
 * the real check: nothing from the browser is trusted).
 *
 * Data minimisation (GDPR art. 5(1)(c)): only what is needed to answer. No
 * phone number, no address, no free "anything else" field beyond the
 * description. IP, user agent and the bot token are never part of the record.
 */

export const needValues = [
  "ai-agents",
  "workflow-automation",
  "web-application",
  "document-intelligence",
  "not-sure",
] as const;
export const budgetValues = [
  "under-5k",
  "5k-15k",
  "15k-50k",
  "over-50k",
  "undecided",
] as const;
export const timelineValues = [
  "asap",
  "one-to-three-months",
  "three-to-six-months",
  "exploring",
] as const;

/** Anything below U+0020 except tab and newline, and DEL: never part of a name or a message. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !CONTROL.test(value), { message: "invalid" });

const singleLine = (min: number, max: number) =>
  text(min, max).refine((value) => !/[\r\n]/.test(value), {
    message: "invalid",
  });

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const needStep = z.object({
  need: z.enum(needValues),
  description: text(20, 2000),
});
const budgetStep = z.object({ budget: z.enum(budgetValues) });
const timelineStep = z.object({ timeline: z.enum(timelineValues) });
const contactStep = z.object({
  name: singleLine(2, 100),
  email: z.email().max(254),
  company: z.preprocess(blankToUndefined, singleLine(2, 100).optional()),
  /** Separate and optional (art. 7(4)): never a condition for sending the inquiry. Unticked by default. */
  marketingConsent: z.boolean().default(false),
});

const inquirySchema = z.object({
  ...needStep.shape,
  ...budgetStep.shape,
  ...timelineStep.shape,
  ...contactStep.shape,
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export const stepIds = ["need", "budget", "timeline", "contact"] as const;
export type StepId = (typeof stepIds)[number];

const stepSchemas = {
  need: needStep,
  budget: budgetStep,
  timeline: timelineStep,
  contact: contactStep,
} as const;

/** The form fields that belong to each step. */
export const stepFields = {
  need: ["need", "description"],
  budget: ["budget"],
  timeline: ["timeline"],
  contact: ["name", "email", "company", "marketingConsent"],
} as const satisfies Record<StepId, readonly (keyof InquiryInput)[]>;

export type FieldName = keyof InquiryInput;
export type ErrorCode = "required" | "tooShort" | "tooLong" | "invalid";
export type FieldErrors = Partial<Record<FieldName, ErrorCode>>;

/** Raw values as they arrive from a form: strings, or a checkbox flag. */
export type RawInquiry = Partial<Record<FieldName, string | boolean>>;

const FIELD_NAMES = Object.keys(inquirySchema.shape) as FieldName[];

/**
 * Pick the known fields out of FormData (or any record) and normalise the
 * checkbox. Anything else in the submission (framework fields, extra keys) is
 * ignored: it never reaches the schema.
 */
export function readFields(
  source: FormData | Record<string, unknown>,
): RawInquiry {
  const get = (key: string): unknown =>
    source instanceof FormData ? source.get(key) : source[key];

  const raw: RawInquiry = {};
  for (const field of FIELD_NAMES) {
    const value = get(field);
    if (field === "marketingConsent") {
      raw.marketingConsent =
        value === "on" || value === "true" || value === true;
    } else if (typeof value === "string") {
      raw[field] = value;
    }
  }
  return raw;
}

function codeFor(issue: z.core.$ZodIssue, value: unknown): ErrorCode {
  if (value === undefined || (typeof value === "string" && value.trim() === ""))
    return "required";
  if (issue.code === "too_small") return "tooShort";
  if (issue.code === "too_big") return "tooLong";
  return "invalid";
}

function toFieldErrors(error: z.ZodError, raw: RawInquiry): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string" || !FIELD_NAMES.includes(field as FieldName))
      continue;
    const name = field as FieldName;
    // The first problem per field is the one shown.
    errors[name] ??= codeFor(issue, raw[name]);
  }
  return errors;
}

export type ParseResult<T> =
  { ok: true; data: T } | { ok: false; errors: FieldErrors };

/** The whole inquiry: what the server action stores. */
export function parseInquiry(raw: RawInquiry): ParseResult<InquiryInput> {
  const result = inquirySchema.safeParse(raw);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, errors: toFieldErrors(result.error, raw) };
}

/** One step, for the browser to check before moving on. The server still checks everything. */
export function parseStep(step: StepId, raw: RawInquiry): ParseResult<unknown> {
  const result = stepSchemas[step].safeParse(raw);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, errors: toFieldErrors(result.error, raw) };
}

/** The first step that has an error, so a server rejection can send the visitor back to it. */
export function firstStepWithError(errors: FieldErrors): StepId | null {
  for (const step of stepIds) {
    if (stepFields[step].some((field) => errors[field] !== undefined))
      return step;
  }
  return null;
}
