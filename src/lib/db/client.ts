import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * A Drizzle client over postgres.js. One connection per serverless instance
 * (`max: 1`) and no prepared statements, which is what a pooled Postgres
 * endpoint (Neon's pooler, Supabase's pgbouncer) requires. The connection
 * string is a secret: it comes from `env.ts`, never from here.
 */
export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzle(client);
}
