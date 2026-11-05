/**
 * Minimal stand-in for the validated env module (CLAUDE.md §6: environment is
 * read only here). P1.7 replaces this file with the Zod server/client schemas;
 * keep the exported names so callers do not change.
 */

/** True only under `next dev`. Production builds and tests are never "development". */
export const isDevelopment = process.env.NODE_ENV === "development";
