import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { z } from "zod";

import {
  DEFAULT_RETENTION_DAYS,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
} from "@/lib/privacy/retention";

/**
 * The environment contract, as pure functions and schemas. No `process.env`
 * here and no `server-only`: the two modules that read the real environment
 * are `env.ts` (server, everything) and `env.client.ts` (browser, `NEXT_PUBLIC_*`
 * only). Keeping the logic pure makes every rule testable with synthetic input.
 *
 * Rules (CLAUDE.md §6, §10):
 *  - Every variable is declared here, with a type. Nothing else is read.
 *  - An empty string means "unset" (that is what a `.env` line `KEY=` gives).
 *  - Errors name the variable and the rule, never the value (secrets).
 */

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** `KEY=` in a .env file is an empty string: treat blank as unset. */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

/** An optional variable: unset or blank is fine, anything else must pass `schema`. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional());

const httpUrl = z.url({ protocol: /^https?$/ });
const httpsUrl = z.url({ protocol: /^https$/ });
/**
 * True for `https://host[:port]` exactly: no path, no trailing slash. Never
 * throws: Zod runs every check even after the URL check failed, so a malformed
 * value reaches this function too.
 */
function isOrigin(value: string): boolean {
  return URL.canParse(value) && new URL(value).origin === value;
}

/** What a CSP source needs: an https origin. */
const httpsOrigin = httpsUrl.refine(isOrigin, {
  message:
    "must be an origin such as https://example.eu (no path, no trailing slash)",
});
/**
 * Hosts the booking page may be on: the EU instance of Cal.com only (P2.7), so
 * the visitor's data stays with an EU-hosted processor. The allow-list is the
 * rule; the exact hosts are an assumption to confirm against the Cal.com
 * account (docs/PROJECT_STATE D32). A page elsewhere fails the build.
 */
const BOOKING_HOSTS = ["cal.eu", "app.cal.eu"] as const;
const bookingUrl = httpsUrl.refine(
  (value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      (BOOKING_HOSTS as readonly string[]).includes(url.hostname) &&
      url.username === "" &&
      url.password === ""
    );
  },
  {
    message: `must be an https URL on ${BOOKING_HOSTS.join(" or ")} (the EU Cal.com instance), without credentials`,
  },
);
/** A host as Vercel exposes it: no scheme, no path. */
const host = z
  .string()
  .regex(/^[a-z0-9.-]+(:\d+)?$/i, "must be a host name without scheme or path");

// ---------------------------------------------------------------------------
// the contract
// ---------------------------------------------------------------------------

/** Values that are shipped to the browser. Non-secret by definition (CLAUDE.md §6). */
const publicShape = {
  /** Canonical origin for canonical and hreflang URLs. Falls back to Vercel's URLs, then localhost. */
  NEXT_PUBLIC_SITE_URL: optional(httpUrl),
  /** Cloudflare Turnstile site key (public by design). With the secret, enables the Turnstile CSP origins. */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optional(z.string().min(1)),
  /** Origin of the cookieless analytics script and event endpoint (e.g. Plausible). Unset = no analytics origin in the CSP. */
  NEXT_PUBLIC_PLAUSIBLE_ORIGIN: optional(httpsOrigin),
  /**
   * The public booking page on the EU Cal.com instance (P2.7), e.g.
   * https://cal.eu/<handle>/<event>. Unset = no booking section on the contact
   * page and no extra origin in the CSP. Public by design: it is a link.
   */
  NEXT_PUBLIC_CAL_URL: optional(bookingUrl),
} as const;

/** Server-only values. Anything secret goes here, never in `publicShape`. */
const privateShape = {
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PHASE: optional(z.string()),
  /** Build-time escape hatch for CI; see `shouldSkipValidation`. */
  SKIP_ENV_VALIDATION: optional(z.string()),

  // Vercel system variables
  VERCEL_ENV: optional(z.enum(["production", "preview", "development"])),
  VERCEL_URL: optional(host),
  VERCEL_PROJECT_PRODUCTION_URL: optional(host),

  // Content Security Policy (src/lib/security/csp.ts)
  /** `report-only` observes, `enforce` blocks, `off` sends no CSP. Start with report-only. */
  CSP_MODE: z.enum(["report-only", "enforce", "off"]).default("report-only"),
  /** Optional collector for violation reports. A third party if it is not ours: list it in the privacy notice. */
  CSP_REPORT_URI: optional(httpsUrl),

  // Data and services (consumers arrive in P2.5 and later)
  DATABASE_URL: optional(z.url({ protocol: /^postgres(ql)?$/ })),
  UPSTASH_REDIS_REST_URL: optional(httpsUrl),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string().min(1)),
  TURNSTILE_SECRET_KEY: optional(z.string().min(1)),
  /** Salt for hashing client IPs before rate limiting; long enough to be unguessable. */
  RATE_LIMIT_IP_SALT: optional(z.string().min(32)),
  /**
   * Shared secret of the scheduled jobs (P4.3): Vercel Cron sends it as
   * `Authorization: Bearer <value>` when a variable of this exact name exists.
   * Unset = the purge route answers 503 and deletes nothing.
   */
  CRON_SECRET: optional(z.string().min(32)),
  /**
   * Days an inquiry is kept before the purge job deletes it (P4.3). Default 730
   * = 24 months, the period in the privacy notice. Bounded so a typo cannot
   * wipe the table.
   */
  INQUIRY_RETENTION_DAYS: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .min(MIN_RETENTION_DAYS)
      .max(MAX_RETENTION_DAYS)
      .default(DEFAULT_RETENTION_DAYS),
  ),
  EMAIL_API_KEY: optional(z.string().min(1)),
  EMAIL_FROM: optional(z.email()),
  INQUIRY_NOTIFY_TO: optional(z.email()),
  ANTHROPIC_API_KEY: optional(z.string().min(1)),
  /** Kill switch, fail-closed: anything but exactly "true" means demos stay in simulation. */
  DEMOS_LIVE_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
} as const;

const publicSchema = z.object(publicShape);

type EnvInput = Record<string, string | undefined>;

/** Names of the browser-visible variables. */
export const publicEnvKeys = Object.keys(publicShape) as ReadonlyArray<
  keyof typeof publicShape
>;
/** Names of every variable the server reads. */
export const serverEnvKeys = [
  ...publicEnvKeys,
  ...(Object.keys(privateShape) as ReadonlyArray<keyof typeof privateShape>),
] as ReadonlyArray<string>;

export type PublicEnv = z.infer<typeof publicSchema>;

// ---------------------------------------------------------------------------
// cross-field rules
// ---------------------------------------------------------------------------

type Value = string | number | boolean | undefined;
type Rule = (
  env: Record<string, Value>,
) => Array<{ name: string; message: string }>;

/** All of `names` set, or none: a half-configured service is a bug, not a feature flag. */
const allOrNone =
  (label: string, names: readonly string[]): Rule =>
  (env) => {
    const set = names.filter((name) => env[name] !== undefined);
    if (set.length === 0 || set.length === names.length) return [];
    return names
      .filter((name) => env[name] === undefined)
      .map((name) => ({
        name,
        message: `is required when the rest of ${label} is set (${set.join(", ")})`,
      }));
  };

const RULES: readonly Rule[] = [
  allOrNone("Turnstile", [
    "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
  ]),
  allOrNone("Upstash Redis", [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ]),
  allOrNone("email", ["EMAIL_API_KEY", "EMAIL_FROM", "INQUIRY_NOTIFY_TO"]),
  // Live demos spend money: they need the key and the Redis budget guard.
  (env) =>
    env["DEMOS_LIVE_ENABLED"] === true
      ? [
          "ANTHROPIC_API_KEY",
          "UPSTASH_REDIS_REST_URL",
          "UPSTASH_REDIS_REST_TOKEN",
        ]
          .filter((name) => env[name] === undefined)
          .map((name) => ({
            name,
            message: 'is required when DEMOS_LIVE_ENABLED is "true"',
          }))
      : [],
];

/**
 * Variables that must be present in a production deployment. Empty on purpose
 * today: nothing in the app reads these services yet, and requiring them now
 * would fail the live Vercel build before the services exist. Each task that
 * adds a consumer adds its variables here (P2.5: DATABASE_URL, UPSTASH_*,
 * TURNSTILE_*, EMAIL_*, RATE_LIMIT_IP_SALT).
 */
export const REQUIRED_IN_PRODUCTION: readonly string[] = [];

// ---------------------------------------------------------------------------
// errors
// ---------------------------------------------------------------------------

export type EnvIssue = { name: string; message: string };

/** Carries variable names and rules only. Never values: they may be secrets. */
export class EnvValidationError extends Error {
  readonly issues: readonly EnvIssue[];

  constructor(issues: readonly EnvIssue[]) {
    super(
      `Invalid environment variables:\n${issues
        .map((issue) => `  - ${issue.name}: ${issue.message}`)
        .join("\n")}\nSee .env.example and docs/DEPLOYMENT.md §3.`,
    );
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

function toIssues(error: z.ZodError): EnvIssue[] {
  return error.issues.map((issue) => ({
    name: issue.path.length > 0 ? issue.path.join(".") : "(environment)",
    message: issue.message,
  }));
}

// ---------------------------------------------------------------------------
// parsing
// ---------------------------------------------------------------------------

function pick(source: EnvInput, keys: readonly string[]): EnvInput {
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}

/**
 * Parse the browser-visible variables. Strict by default (throws). With
 * `lenient`, an invalid value becomes `undefined` instead: used in the browser,
 * where the server has already validated the same values at build time and a
 * bad one must not take the page down.
 */
export function parsePublicEnv(
  source: EnvInput,
  options: { lenient?: boolean } = {},
): PublicEnv {
  const input = pick(source, publicEnvKeys);
  if (options.lenient === true) return lenientParse(publicShape, input);
  const result = publicSchema.safeParse(input);
  if (!result.success) throw new EnvValidationError(toIssues(result.error));
  return result.data;
}

const serverShape = { ...publicShape, ...privateShape } as const;
const serverSchema = z.object(serverShape);
export type ServerEnv = z.infer<typeof serverSchema>;

/**
 * Parse every variable the server reads and apply the cross-field and
 * production-required rules. Throws `EnvValidationError` listing ALL problems.
 *
 * `skip` (see `shouldSkipValidation`) returns what parses and drops the rest,
 * without throwing: for builds that have no secrets.
 */
export function parseServerEnv(
  source: EnvInput,
  options: { skip?: boolean; required?: readonly string[] } = {},
): ServerEnv {
  const input = pick(source, serverEnvKeys);
  if (options.skip === true)
    return lenientParse(serverShape, input) as ServerEnv;

  const result = serverSchema.safeParse(input);
  const issues: EnvIssue[] = result.success ? [] : toIssues(result.error);

  if (result.success) {
    const env = result.data as Record<string, Value>;
    for (const rule of RULES) issues.push(...rule(env));
    if (isProduction(result.data)) {
      for (const name of options.required ?? REQUIRED_IN_PRODUCTION) {
        if (env[name] === undefined) {
          issues.push({ name, message: "is required in production" });
        }
      }
    }
  }

  if (issues.length > 0 || !result.success)
    throw new EnvValidationError(issues);
  return result.data;
}

/** Production deployment: Vercel says so, or (outside Vercel) a production build. */
function isProduction(
  env: Pick<ServerEnv, "VERCEL_ENV" | "NODE_ENV">,
): boolean {
  return (
    (env.VERCEL_ENV ??
      (env.NODE_ENV === "production" ? "production" : undefined)) ===
    "production"
  );
}

/**
 * Field by field: a value that parses is kept, one that does not (or is
 * missing) takes the field's default, else `undefined`. Every field without a
 * default is optional, so the result still satisfies the schema's output type.
 */
function lenientParse(
  shape: Record<string, z.ZodType>,
  input: EnvInput,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(shape).map(([key, schema]): [string, unknown] => {
      const parsed = schema.safeParse(input[key]);
      return [
        key,
        parsed.success ? parsed.data : schema.safeParse(undefined).data,
      ];
    }),
  );
}

/**
 * `SKIP_ENV_VALIDATION=1` lets CI build without secrets, but ONLY during
 * `next build`: at runtime (`next start`, a Vercel function) it is ignored and
 * the environment is validated, so the flag can never put an unvalidated app in
 * front of visitors.
 */
export function shouldSkipValidation(source: EnvInput): boolean {
  const flag = source["SKIP_ENV_VALIDATION"]?.trim().toLowerCase();
  return (
    (flag === "1" || flag === "true") &&
    source["NEXT_PHASE"] === PHASE_PRODUCTION_BUILD
  );
}

// ---------------------------------------------------------------------------
// site URL (moved here from env.ts in P1.7, behaviour unchanged)
// ---------------------------------------------------------------------------

type SiteUrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string | undefined;
  VERCEL_ENV?: string | undefined;
  VERCEL_PROJECT_PRODUCTION_URL?: string | undefined;
  VERCEL_URL?: string | undefined;
};

const present = (value: string | undefined) =>
  value !== undefined && value.trim() !== "" ? value.trim() : undefined;

/**
 * Absolute origin of the site, used for canonical and hreflang URLs.
 * Order: explicit NEXT_PUBLIC_SITE_URL, then Vercel's production domain (only
 * on production deployments), then the per-deployment Vercel URL (previews),
 * then localhost. Throws on an invalid explicit value: a wrong origin in
 * hreflang would silently hurt SEO, so failing the build is better.
 */
export function resolveSiteUrl(env: SiteUrlEnv): URL {
  const explicit = present(env.NEXT_PUBLIC_SITE_URL);
  if (explicit !== undefined) {
    try {
      return new URL(explicit);
    } catch {
      throw new Error("NEXT_PUBLIC_SITE_URL is not a valid absolute URL");
    }
  }

  const production = present(env.VERCEL_PROJECT_PRODUCTION_URL);
  if (env.VERCEL_ENV === "production" && production !== undefined) {
    return new URL(`https://${production}`);
  }

  const deployment = present(env.VERCEL_URL);
  if (deployment !== undefined) return new URL(`https://${deployment}`);

  return new URL("http://localhost:3000");
}
