/**
 * The only way server code writes logs (CLAUDE.md §10, docs/GDPR_CHECKLIST.md
 * §6): structured JSON lines with an ALLOW-LIST of fields and redaction of
 * anything that looks personal.
 *
 * Two layers, so a mistake in one does not leak:
 *  1. Only the field names in `ALLOWED_FIELDS` are written; everything else is
 *     dropped. A request body, a form field, a name, an email or an IP simply
 *     has no field to travel in.
 *  2. String values that are allowed are still scrubbed: email addresses,
 *     phone numbers, IPv4/IPv6 addresses, IBANs, Italian fiscal codes and
 *     bearer tokens are replaced by a marker.
 *
 * Log an event name plus `route`, `status`, `durationMs`, `requestId` and a
 * short `code` or `errorClass`: enough to debug, nothing to identify a person.
 */

export type LogLevel = "info" | "warn" | "error";

/** The fields a log line may carry. Add one only if it can never hold personal data. */
export const ALLOWED_FIELDS = [
  "route",
  "status",
  "durationMs",
  "requestId",
  "code",
  "errorClass",
  "step",
  "attempts",
  /** A number of rows or items (e.g. how many inquiries a purge deleted). */
  "count",
  "retryAfterSec",
  "provider",
  "mode",
] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];
type LogFields = Partial<Record<AllowedField, string | number | boolean>>;

const REDACTIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "[redacted:token]"],
  // A JSON Web Token: three base64url parts, the first two start with `eyJ` ({" ).
  [/\beyJ[\w-]{5,}\.eyJ[\w-]{5,}\.[\w-]*/g, "[redacted:token]"],
  // `token=…`, `api_key=…`, `password=…` (query strings, config dumps): keep the name, drop the value.
  [
    /\b((?:access_|refresh_|id_)?token|api[_-]?key|apikey|secret|password|passwd|pwd|signature|sig|auth|authorization|key)=[^&\s"'<>]+/gi,
    "$1=[redacted:secret]",
  ],
  // Vendor key prefixes: Anthropic, Stripe-style, Resend, GitHub, AWS.
  [
    /\b(?:sk-ant-|sk_(?:live|test)_|pk_(?:live|test)_|re_|ghp_|gho_|github_pat_|AKIA)[A-Za-z0-9_-]{8,}/g,
    "[redacted:token]",
  ],
  // Any other long opaque run with a digit in it (hex digests, base64url secrets); a long
  // identifier made of letters only is code, not a secret. A UUID (a request id) is exempt,
  // and the run must start at its beginning so a UUID's tail is never matched on its own.
  [
    /(?<![\w-])(?![0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?![\w-]))(?=[A-Za-z_-]*\d)[A-Za-z0-9_-]{32,}(?![\w-])/gi,
    "[redacted:token]",
  ],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted:email]"],
  [
    /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g,
    "[redacted:iban]",
  ],
  [/\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi, "[redacted:fiscal-code]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted:ip]"],
  [/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{0,4}\b/gi, "[redacted:ip]"],
  [/(?<![\w.])\+?\d[\d\s().-]{7,}\d\b/g, "[redacted:phone]"],
];

/** Replace anything personal-looking in a string. Exported for tests and for callers that build their own text. */
export function redactString(value: string): string {
  return REDACTIONS.reduce(
    (text, [pattern, marker]) => text.replace(pattern, marker),
    value,
  );
}

const MAX_LENGTH = 200;

/** The log line as data (what is written, before it is serialised). */
export function buildEntry(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
  now: Date = new Date(),
): Record<string, string | number | boolean> {
  const entry: Record<string, string | number | boolean> = {
    time: now.toISOString(),
    level,
    event: redactString(event).slice(0, MAX_LENGTH),
  };
  for (const key of ALLOWED_FIELDS) {
    const value = fields[key];
    if (typeof value === "string") {
      entry[key] = redactString(value).slice(0, MAX_LENGTH);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      entry[key] = value;
    } else if (typeof value === "boolean") {
      entry[key] = value;
    }
  }
  return entry;
}

function write(level: LogLevel, event: string, fields?: LogFields) {
  const line = JSON.stringify(buildEntry(level, event, fields));
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export type Logger = {
  info: (event: string, fields?: LogFields) => void;
  warn: (event: string, fields?: LogFields) => void;
  error: (event: string, fields?: LogFields) => void;
};

export const logger: Logger = {
  info: (event, fields) => {
    write("info", event, fields);
  },
  warn: (event, fields) => {
    write("warn", event, fields);
  },
  error: (event, fields) => {
    write("error", event, fields);
  },
};

/** A fresh id to correlate the log lines of one request. Random, carries nothing. */
export function newRequestId(): string {
  return crypto.randomUUID();
}

/** The class name of a thrown value, never its message (messages can quote input). */
export function errorClass(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}
