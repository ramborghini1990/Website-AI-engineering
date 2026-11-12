import { handlePurge } from "@/lib/privacy/cron";
import { getPurgeDeps } from "@/lib/privacy/runtime";

/**
 * Daily purge of expired inquiries (P4.3), called by Vercel Cron (`vercel.json`).
 * GET only: that is what Vercel Cron sends, and any other method is answered
 * 405 by Next. The caller must present `Authorization: Bearer <CRON_SECRET>`;
 * the answer is `{ purged, retentionDays }` and nothing else. See
 * `src/lib/privacy/cron.ts` for the order of checks and docs/DSR.md §6.
 */
export function GET(request: Request): Promise<Response> {
  return handlePurge(request, getPurgeDeps());
}
