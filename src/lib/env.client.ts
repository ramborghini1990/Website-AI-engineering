import { parsePublicEnv } from "@/lib/env-schema";

/**
 * The browser's view of the environment: `NEXT_PUBLIC_*` only, never a secret.
 * Safe to import from client and server code alike.
 *
 * Each variable is referenced LITERALLY below: Next inlines
 * `process.env.NEXT_PUBLIC_X` at build time, and a dynamic lookup would be
 * empty in the browser. `env.test.ts` checks that this list matches the schema.
 *
 * Lenient on purpose: the server already validated these exact values when it
 * built the page, and a bad one must not crash the browser.
 */
export const publicEnv = parsePublicEnv(
  {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_PLAUSIBLE_ORIGIN: process.env.NEXT_PUBLIC_PLAUSIBLE_ORIGIN,
  },
  { lenient: true },
);
