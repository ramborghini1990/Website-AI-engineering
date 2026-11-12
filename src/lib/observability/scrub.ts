import { redactString } from "@/lib/logger";

/**
 * What may leave the server about an error (P4.5, docs/SECURITY.md §9). The
 * rule is an allow-list, like the logger's: a report is BUILT from a few safe
 * facts, it is never a copy of the error with things removed.
 *
 *  - Sent: the error's class name, Next's digest, the route PATTERN
 *    (`/[locale]/work/[slug]`, never the real URL), the HTTP method, the kind
 *    of route, and the stack reduced to `function (file:line:column)`.
 *  - Never read: the error message (it can quote form input), the request
 *    path or query, headers (cookies, authorization, forwarded IPs), the body.
 *    The function signature does not even accept them.
 *  - Everything that is sent still goes through `redactString` (emails, IPs,
 *    phones, tokens, keys) as a second layer.
 */

export type ReportContext = {
  /** The route pattern from Next's context, e.g. `/[locale]/work/[slug]`. */
  routePath?: unknown;
  /** `render`, `route`, `action` or `proxy`. */
  routeType?: unknown;
};

type ReportFrame = {
  function?: string;
  filename: string;
  lineno?: number;
  colno?: number;
};

export type SafeErrorReport = {
  errorClass: string;
  digest?: string;
  route: string;
  routeType: string;
  method: string;
  /** Oldest call first (Sentry's order). */
  frames: ReportFrame[];
};

const MAX_FRAMES = 30;
const METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
const ROUTE_TYPES = new Set(["render", "route", "action", "proxy"]);

/** `at fn (file:1:2)` and `at file:1:2` (V8). */
const FRAME = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;

/** A file name only: no directory (it can hold a user name), no query, no scheme. */
function basename(path: string): string {
  const clean = path.split("?")[0] ?? path;
  const name = clean.split(/[\\/]/).pop() ?? "";
  return name === "" ? "unknown" : name;
}

function parseFrames(stack: string): ReportFrame[] {
  const frames: ReportFrame[] = [];
  for (const line of stack.split("\n")) {
    const match = FRAME.exec(line);
    if (match === null) continue;
    const [, fn, file, lineno, colno] = match;
    frames.push({
      // The group is optional (`at file:1:2` has no function): empty or undefined means none.
      ...(fn ? { function: redactString(fn).slice(0, 100) } : {}),
      filename: redactString(basename(file)).slice(0, 100),
      lineno: Number(lineno),
      colno: Number(colno),
    });
    if (frames.length === MAX_FRAMES) break;
  }
  return frames.reverse();
}

/** A route pattern is code structure; keep only characters a pattern can have. */
function safeRoute(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const pattern = value.replace(/[^A-Za-z0-9/_[\]().@-]/g, "").slice(0, 200);
  return pattern === "" ? "unknown" : redactString(pattern);
}

function safeClass(error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error;
  return /^[A-Za-z][A-Za-z0-9_$]{0,63}$/.test(name) ? name : "Error";
}

function safeDigest(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return undefined;
  }
  const digest = error.digest;
  return typeof digest === "string" && /^[A-Za-z0-9_-]{1,32}$/.test(digest)
    ? digest
    : undefined;
}

export function scrubError(
  error: unknown,
  request: { method?: unknown },
  context: ReportContext,
): SafeErrorReport {
  const method =
    typeof request.method === "string" &&
    METHODS.has(request.method.toUpperCase())
      ? request.method.toUpperCase()
      : "UNKNOWN";
  const routeType =
    typeof context.routeType === "string" && ROUTE_TYPES.has(context.routeType)
      ? context.routeType
      : "unknown";
  const digest = safeDigest(error);

  return {
    errorClass: safeClass(error),
    ...(digest !== undefined && { digest }),
    route: safeRoute(context.routePath),
    routeType,
    method,
    frames:
      error instanceof Error && typeof error.stack === "string"
        ? parseFrames(error.stack)
        : [],
  };
}
