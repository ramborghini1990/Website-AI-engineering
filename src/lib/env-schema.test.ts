// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  EnvValidationError,
  parsePublicEnv,
  parseServerEnv,
  publicEnvKeys,
  REQUIRED_IN_PRODUCTION,
  serverEnvKeys,
  shouldSkipValidation,
  type PublicEnv,
  type ServerEnv,
} from "@/lib/env-schema";

/** Synthetic values only (CLAUDE.md §10): none of these is a real credential. */
const VALID = {
  NEXT_PUBLIC_SITE_URL: "https://www.example.eu",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key-synthetic",
  TURNSTILE_SECRET_KEY: "secret-key-synthetic",
  UPSTASH_REDIS_REST_URL: "https://eu-example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token-synthetic",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  RATE_LIMIT_IP_SALT: "a-synthetic-salt-of-at-least-32-chars",
  EMAIL_API_KEY: "email-key-synthetic",
  EMAIL_FROM: "no-reply@example.eu",
  INQUIRY_NOTIFY_TO: "inbox@example.eu",
} as const;

function issuesOf(run: () => unknown): Record<string, string> {
  try {
    run();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      return Object.fromEntries(error.issues.map((i) => [i.name, i.message]));
    }
    throw error;
  }
  return {};
}

describe("public variables", () => {
  it("accepts a valid set and leaves unset ones undefined", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SITE_URL: "https://www.example.eu",
    });

    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://www.example.eu");
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBeUndefined();
    expect(env.NEXT_PUBLIC_PLAUSIBLE_ORIGIN).toBeUndefined();
  });

  it("treats a blank value (KEY= in a .env file) as unset", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SITE_URL: "",
      NEXT_PUBLIC_PLAUSIBLE_ORIGIN: "   ",
    });

    expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_PLAUSIBLE_ORIGIN).toBeUndefined();
  });

  it.each([
    ["NEXT_PUBLIC_SITE_URL", "not a url"],
    ["NEXT_PUBLIC_SITE_URL", "ftp://example.eu"],
    ["NEXT_PUBLIC_SITE_URL", "javascript:alert(1)"],
    ["NEXT_PUBLIC_PLAUSIBLE_ORIGIN", "http://plausible.io"], // https only
    ["NEXT_PUBLIC_PLAUSIBLE_ORIGIN", "https://plausible.io/"], // trailing slash: not an origin
    ["NEXT_PUBLIC_PLAUSIBLE_ORIGIN", "https://plausible.io/js/script.js"], // a path is not an origin
    ["NEXT_PUBLIC_PLAUSIBLE_ORIGIN", "plausible.io"],
    ["NEXT_PUBLIC_CAL_URL", "http://cal.eu/handle/intro"], // https only
    ["NEXT_PUBLIC_CAL_URL", "https://cal.com/handle/intro"], // not the EU instance
    ["NEXT_PUBLIC_CAL_URL", "https://evil.example/cal.eu/handle"], // the host is what counts, not the path
    ["NEXT_PUBLIC_CAL_URL", "https://cal.eu.evil.example/handle"], // a look-alike host
    ["NEXT_PUBLIC_CAL_URL", "https://user:pw@cal.eu/handle/intro"], // no credentials
    ["NEXT_PUBLIC_CAL_URL", "cal.eu/handle"],
    ["NEXT_PUBLIC_CAL_URL", "javascript:alert(1)"],
  ])("rejects %s = %s (negative)", (name, value) => {
    expect(
      Object.keys(issuesOf(() => parsePublicEnv({ [name]: value }))),
    ).toEqual([name]);
  });

  it.each([
    "https://cal.eu/example-handle/intro",
    "https://app.cal.eu/example-handle",
    "https://cal.eu/example-handle/intro?layout=month_view",
  ])("accepts the EU Cal.com booking page %s", (value) => {
    expect(
      parsePublicEnv({ NEXT_PUBLIC_CAL_URL: value }).NEXT_PUBLIC_CAL_URL,
    ).toBe(value);
  });

  it("the booking page is optional: blank means no booking section", () => {
    expect(
      parsePublicEnv({ NEXT_PUBLIC_CAL_URL: "  " }).NEXT_PUBLIC_CAL_URL,
    ).toBeUndefined();
  });

  it("only ever contains NEXT_PUBLIC_ names: nothing else can reach the browser", () => {
    expect(publicEnvKeys.length).toBeGreaterThan(0);
    for (const key of publicEnvKeys) expect(key).toMatch(/^NEXT_PUBLIC_/);
  });

  it("ignores every variable it does not declare (a secret in the source cannot leak through)", () => {
    const env = parsePublicEnv({
      NEXT_PUBLIC_SITE_URL: "https://www.example.eu",
      DATABASE_URL: "postgresql://user:pass@localhost/db",
      ANTHROPIC_API_KEY: "secret",
    });

    expect(Object.keys(env).sort()).toEqual([...publicEnvKeys].sort());
    expect(JSON.stringify(env)).not.toContain("secret");
    expect(JSON.stringify(env)).not.toContain("postgresql");
  });

  it("lenient mode never throws: a bad value becomes undefined, a good one stays", () => {
    const env = parsePublicEnv(
      {
        NEXT_PUBLIC_SITE_URL: "not a url",
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key-synthetic",
      },
      { lenient: true },
    );

    expect(env.NEXT_PUBLIC_SITE_URL).toBeUndefined();
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe("site-key-synthetic");
  });
});

describe("server variables", () => {
  it("accepts a fully configured environment", () => {
    const env = parseServerEnv({
      ...VALID,
      NODE_ENV: "production",
      CSP_MODE: "enforce",
    });

    expect(env.DATABASE_URL).toBe(VALID.DATABASE_URL);
    expect(env.CSP_MODE).toBe("enforce");
    expect(env.NODE_ENV).toBe("production");
  });

  it("works with an empty environment: every service is optional until its task lands", () => {
    expect(() => parseServerEnv({})).not.toThrow();
  });

  it("applies safe defaults: CSP mode left to resolveCspMode (enforce in production), demos in simulation", () => {
    const env = parseServerEnv({});

    expect(env.CSP_MODE).toBeUndefined();
    expect(parseServerEnv({ CSP_MODE: "" }).CSP_MODE).toBeUndefined(); // blank = unset
    expect(env.DEMOS_LIVE_ENABLED).toBe(false);
    expect(env.NODE_ENV).toBe("development");
  });

  it("the server schema includes every public variable", () => {
    for (const key of publicEnvKeys) expect(serverEnvKeys).toContain(key);
  });

  it.each([
    ["DATABASE_URL", "https://example.eu/db"], // not a postgres URL
    ["DATABASE_URL", "not a url"],
    ["UPSTASH_REDIS_REST_URL", "http://eu-example.upstash.io"], // https only
    ["RATE_LIMIT_IP_SALT", "too-short"],
    ["CRON_SECRET", "too-short"],
    ["INQUIRY_RETENTION_DAYS", "0"], // a typo must not purge everything
    ["INQUIRY_RETENTION_DAYS", "1"],
    ["INQUIRY_RETENTION_DAYS", "29"],
    ["INQUIRY_RETENTION_DAYS", "3651"],
    ["INQUIRY_RETENTION_DAYS", "-730"],
    ["INQUIRY_RETENTION_DAYS", "730.5"],
    ["INQUIRY_RETENTION_DAYS", "two years"],
    ["EMAIL_FROM", "not-an-email"],
    ["INQUIRY_NOTIFY_TO", "nope"],
    ["CSP_MODE", "enforcing"],
    ["SECURITY_CONTACT", "not-an-email"],
    ["CSP_REPORT_URI", "http://collector.example.eu/r"],
    ["SENTRY_DSN", "https://key@o1.ingest.sentry.io/2"], // US region
    ["SENTRY_DSN", "https://key@o1.ingest.us.sentry.io/2"], // US region, newer host
    ["SENTRY_DSN", "https://key@o1.ingest.de.sentry.io.evil.example/2"], // suffix trick
    ["SENTRY_DSN", "http://key@o1.ingest.de.sentry.io/2"], // https only
    ["SENTRY_DSN", "o1.ingest.de.sentry.io"], // not a URL
    ["VERCEL_ENV", "staging"],
    ["VERCEL_URL", "https://deploy.vercel.app"], // a host, not a URL
    ["NODE_ENV", "staging"],
  ])("rejects %s = %s (negative)", (name, value) => {
    const issues = issuesOf(() => parseServerEnv({ [name]: value }));

    expect(Object.keys(issues)).toEqual([name]);
  });

  it("accepts an EU Sentry DSN, and blank means no tracker", () => {
    const dsn = "https://abc123@o4500.ingest.de.sentry.io/4501";

    expect(parseServerEnv({ SENTRY_DSN: dsn }).SENTRY_DSN).toBe(dsn);
    expect(parseServerEnv({ SENTRY_DSN: "" }).SENTRY_DSN).toBeUndefined();
    expect(parseServerEnv({}).SENTRY_DSN).toBeUndefined();
  });

  it("reports ALL problems at once, not just the first", () => {
    const issues = issuesOf(() =>
      parseServerEnv({
        DATABASE_URL: "nope",
        CSP_MODE: "nope",
        RATE_LIMIT_IP_SALT: "short",
      }),
    );

    expect(Object.keys(issues).sort()).toEqual([
      "CSP_MODE",
      "DATABASE_URL",
      "RATE_LIMIT_IP_SALT",
    ]);
  });

  it("never puts a value in the error: names and rules only (secrets must not reach logs)", () => {
    const secret = "SuperSecretValue-do-not-print-0123456789";
    let message = "";
    try {
      parseServerEnv({
        RATE_LIMIT_IP_SALT: "short-secret-value",
        DATABASE_URL: secret,
        EMAIL_FROM: secret,
        CSP_MODE: secret,
        NEXT_PUBLIC_SITE_URL: secret,
        UPSTASH_REDIS_REST_URL: secret,
      });
    } catch (error) {
      message = String(error instanceof Error ? error.message : error);
    }

    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain(secret);
    expect(message).not.toContain("short-secret-value");
  });

  it("types: public optionals are string | undefined, the kill switch is a boolean, the mode is a union", () => {
    expectTypeOf<PublicEnv["NEXT_PUBLIC_SITE_URL"]>().toEqualTypeOf<
      string | undefined
    >();
    expectTypeOf<ServerEnv["DEMOS_LIVE_ENABLED"]>().toEqualTypeOf<boolean>();
    expectTypeOf<ServerEnv["CSP_MODE"]>().toEqualTypeOf<
      "report-only" | "enforce" | "off" | undefined
    >();
    expectTypeOf<ServerEnv["DATABASE_URL"]>().toEqualTypeOf<
      string | undefined
    >();
  });
});

describe("retention and the scheduled job (P4.3)", () => {
  it("INQUIRY_RETENTION_DAYS defaults to 730 days (24 months) when unset or blank", () => {
    expect(parseServerEnv({}).INQUIRY_RETENTION_DAYS).toBe(730);
    expect(
      parseServerEnv({ INQUIRY_RETENTION_DAYS: "" }).INQUIRY_RETENTION_DAYS,
    ).toBe(730);
    expect(
      parseServerEnv({ INQUIRY_RETENTION_DAYS: "  " }).INQUIRY_RETENTION_DAYS,
    ).toBe(730);
  });

  it("accepts a number inside the bounds, as a string from the environment", () => {
    for (const [value, days] of [
      ["30", 30],
      ["365", 365],
      ["3650", 3650],
    ] as const) {
      expect(
        parseServerEnv({ INQUIRY_RETENTION_DAYS: value })
          .INQUIRY_RETENTION_DAYS,
        value,
      ).toBe(days);
    }
  });

  it("CRON_SECRET is optional, and 32 characters are enough", () => {
    expect(parseServerEnv({}).CRON_SECRET).toBeUndefined();
    expect(parseServerEnv({ CRON_SECRET: "" }).CRON_SECRET).toBeUndefined();
    expect(parseServerEnv({ CRON_SECRET: "x".repeat(32) }).CRON_SECRET).toBe(
      "x".repeat(32),
    );
  });

  it("types: the period is a number, the secret an optional string", () => {
    expectTypeOf<ServerEnv["INQUIRY_RETENTION_DAYS"]>().toEqualTypeOf<number>();
    expectTypeOf<ServerEnv["CRON_SECRET"]>().toEqualTypeOf<
      string | undefined
    >();
  });
});

describe("variables that belong together", () => {
  it.each([
    [
      "Turnstile site key without the secret",
      { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k" },
      "TURNSTILE_SECRET_KEY",
    ],
    [
      "Turnstile secret without the site key",
      { TURNSTILE_SECRET_KEY: "k" },
      "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
    ],
    [
      "Upstash URL without the token",
      { UPSTASH_REDIS_REST_URL: "https://eu.upstash.io" },
      "UPSTASH_REDIS_REST_TOKEN",
    ],
    [
      "Upstash token without the URL",
      { UPSTASH_REDIS_REST_TOKEN: "t" },
      "UPSTASH_REDIS_REST_URL",
    ],
    ["email key alone", { EMAIL_API_KEY: "k" }, "EMAIL_FROM"],
    [
      "email sender without the notify address",
      { EMAIL_API_KEY: "k", EMAIL_FROM: "a@example.eu" },
      "INQUIRY_NOTIFY_TO",
    ],
  ])("fails on %s (negative)", (_name, source, missing) => {
    expect(Object.keys(issuesOf(() => parseServerEnv(source)))).toContain(
      missing,
    );
  });

  it("passes when a group is complete or entirely absent", () => {
    expect(() => parseServerEnv({})).not.toThrow();
    expect(() =>
      parseServerEnv({
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k",
        TURNSTILE_SECRET_KEY: "s",
        UPSTASH_REDIS_REST_URL: "https://eu.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "t",
        EMAIL_API_KEY: "k",
        EMAIL_FROM: "a@example.eu",
        INQUIRY_NOTIFY_TO: "b@example.eu",
      }),
    ).not.toThrow();
  });

  it("live demos need the API key AND the Redis budget guard", () => {
    const issues = issuesOf(() =>
      parseServerEnv({ DEMOS_LIVE_ENABLED: "true" }),
    );

    expect(Object.keys(issues).sort()).toEqual([
      "ANTHROPIC_API_KEY",
      "UPSTASH_REDIS_REST_TOKEN",
      "UPSTASH_REDIS_REST_URL",
    ]);
    expect(() =>
      parseServerEnv({
        DEMOS_LIVE_ENABLED: "true",
        ANTHROPIC_API_KEY: "k",
        UPSTASH_REDIS_REST_URL: "https://eu.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "t",
      }),
    ).not.toThrow();
  });

  it.each(["TRUE", "True", "1", "yes", "on", " true", "false", ""])(
    "the kill switch fails closed: DEMOS_LIVE_ENABLED=%j keeps demos in simulation, and needs nothing",
    (value) => {
      const env = parseServerEnv({ DEMOS_LIVE_ENABLED: value });

      expect(env.DEMOS_LIVE_ENABLED).toBe(false);
    },
  );
});

describe("variables required in production", () => {
  const required = ["DATABASE_URL"];

  it("fails a Vercel production deployment that lacks them, naming the variable", () => {
    const issues = issuesOf(() =>
      parseServerEnv(
        { VERCEL_ENV: "production", NODE_ENV: "production" },
        { required },
      ),
    );

    expect(issues).toEqual({ DATABASE_URL: "is required in production" });
  });

  it("fails a production build outside Vercel too", () => {
    expect(() =>
      parseServerEnv({ NODE_ENV: "production" }, { required }),
    ).toThrow(/DATABASE_URL/);
  });

  it("does not apply to previews, development or tests (they use test keys or none)", () => {
    for (const source of [
      { VERCEL_ENV: "preview", NODE_ENV: "production" },
      { VERCEL_ENV: "development" },
      { NODE_ENV: "development" },
      { NODE_ENV: "test" },
    ] as const) {
      expect(
        () => parseServerEnv(source, { required }),
        JSON.stringify(source),
      ).not.toThrow();
    }
  });

  it("passes when the variable is present", () => {
    expect(() =>
      parseServerEnv(
        { NODE_ENV: "production", DATABASE_URL: VALID.DATABASE_URL },
        { required },
      ),
    ).not.toThrow();
  });

  it("a blank value counts as missing", () => {
    expect(() =>
      parseServerEnv(
        { NODE_ENV: "production", DATABASE_URL: "" },
        { required },
      ),
    ).toThrow(/DATABASE_URL/);
  });

  it("the shipped list only names variables the schema knows (a typo would never fail anything)", () => {
    for (const name of REQUIRED_IN_PRODUCTION)
      expect(serverEnvKeys).toContain(name);
  });
});

describe("SKIP_ENV_VALIDATION", () => {
  const BUILD = "phase-production-build";

  it.each([["1"], ["true"], ["TRUE"], [" 1 "]])(
    "is honoured during `next build` (%j)",
    (flag) => {
      expect(
        shouldSkipValidation({ SKIP_ENV_VALIDATION: flag, NEXT_PHASE: BUILD }),
      ).toBe(true);
    },
  );

  it.each([["0"], ["false"], [""], ["yes"], [undefined]])(
    "is not triggered by %j",
    (flag) => {
      expect(
        shouldSkipValidation({ SKIP_ENV_VALIDATION: flag, NEXT_PHASE: BUILD }),
      ).toBe(false);
    },
  );

  it("is IGNORED at runtime: the flag cannot put an unvalidated app in front of visitors (negative)", () => {
    expect(shouldSkipValidation({ SKIP_ENV_VALIDATION: "1" })).toBe(false);
    expect(
      shouldSkipValidation({
        SKIP_ENV_VALIDATION: "1",
        NEXT_PHASE: "phase-production-server",
      }),
    ).toBe(false);
    expect(
      shouldSkipValidation({
        SKIP_ENV_VALIDATION: "1",
        NEXT_PHASE: "phase-development-server",
      }),
    ).toBe(false);
  });

  it("skip mode does not throw on garbage, keeps what is valid, and returns type-correct defaults", () => {
    const env = parseServerEnv(
      {
        DATABASE_URL: "nope",
        CSP_MODE: "nope",
        NODE_ENV: "nope",
        DEMOS_LIVE_ENABLED: "true",
        NEXT_PUBLIC_SITE_URL: "https://www.example.eu",
        VERCEL_ENV: "nope",
      },
      { skip: true },
    );

    expect(env.DATABASE_URL).toBeUndefined(); // dropped, not passed through
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://www.example.eu"); // valid value kept
    expect(env.CSP_MODE).toBeUndefined(); // invalid -> dropped, so the default applies (enforce in production)
    expect(env.NODE_ENV).toBe("development");
    expect(env.VERCEL_ENV).toBeUndefined();
    expect(env.DEMOS_LIVE_ENABLED).toBe(true);
  });

  it("skip mode also skips the cross-field and production rules", () => {
    expect(() =>
      parseServerEnv(
        {
          NODE_ENV: "production",
          DEMOS_LIVE_ENABLED: "true",
          TURNSTILE_SECRET_KEY: "s",
        },
        { skip: true, required: ["DATABASE_URL"] },
      ),
    ).not.toThrow();
  });
});

describe(".env.example is the contract", () => {
  const text = readFileSync(
    fileURLToPath(new URL("../../.env.example", import.meta.url)),
    "utf8",
  );
  const values = Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ]),
  );
  /** Set by the platform or CI, never by a developer's .env file. */
  const PLATFORM = [
    "NODE_ENV",
    "NEXT_PHASE",
    "SKIP_ENV_VALIDATION",
    "VERCEL_ENV",
    "VERCEL_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
  ];

  it("its placeholders pass the strict schema as they are (a fresh clone builds)", () => {
    expect(() =>
      parseServerEnv(values, { required: [...REQUIRED_IN_PRODUCTION] }),
    ).not.toThrow();
  });

  it("lists every variable the schema reads, except platform ones", () => {
    const missing = serverEnvKeys.filter(
      (key) => !PLATFORM.includes(key) && !(key in values),
    );

    expect(missing).toEqual([]);
  });

  it("lists nothing the schema does not know (no stale or misspelt variable)", () => {
    const unknown = Object.keys(values).filter(
      (key) => !serverEnvKeys.includes(key),
    );

    expect(unknown).toEqual([]);
  });

  it("keeps every public variable prefixed and every secret unprefixed", () => {
    for (const key of Object.keys(values)) {
      if (key.startsWith("NEXT_PUBLIC_"))
        expect(publicEnvKeys as readonly string[]).toContain(key);
      else expect(publicEnvKeys as readonly string[]).not.toContain(key);
    }
  });
});
