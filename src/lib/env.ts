import "server-only";

import {
  parseServerEnv,
  resolveSiteUrl,
  serverEnvKeys,
  shouldSkipValidation,
} from "@/lib/env-schema";

/**
 * The server's view of the environment, validated once at import. This is the
 * ONLY module (with `env.client.ts` for the browser) that reads `process.env`
 * (CLAUDE.md §6; an ESLint rule enforces it).
 *
 * `import "server-only"` makes importing this file from a client component a
 * BUILD error, so a secret cannot be bundled for the browser by accident. A
 * client component that needs a value uses `@/lib/env.client` (public only).
 *
 * A missing or malformed variable throws here, which fails `next build`.
 * `SKIP_ENV_VALIDATION=1` skips that, during the build only (see
 * `shouldSkipValidation`), for CI jobs that have no secrets.
 */
const source = Object.fromEntries(
  serverEnvKeys.map((key) => [key, process.env[key]]),
);

export const env = parseServerEnv(source, {
  skip: shouldSkipValidation(source),
});

/** True only under `next dev`. Production builds and tests are never "development". */
export const isDevelopment = env.NODE_ENV === "development";

export const siteUrl = resolveSiteUrl(env);
