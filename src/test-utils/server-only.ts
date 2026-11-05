// Vitest stand-in for the `server-only` package (which throws outside a React
// Server Component). Unit tests run server modules directly; the real guard is
// exercised by `next build`, see e2e/env-guard and docs/SECURITY.md.
export {};
