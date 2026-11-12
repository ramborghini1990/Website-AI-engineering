/**
 * How long an inquiry is kept (P4.3). Pure: no imports, so the environment
 * schema, the cron job and the command-line tool can all use it.
 *
 * The privacy notice (content/legal/{it,en}/privacy.mdx) says 24 months. The clock
 * runs from `created_at`, the only date the table has (there is no "last
 * contact" column), so a row is never kept LONGER than the notice says; a
 * conversation that went on for months is cut off at 24 months from its start.
 * Whoever answers inquiries exports anything that must outlive that (a contract
 * follows) before the purge runs: docs/DSR.md §5.
 */

/** 24 months, as a number of days. Matches the draft privacy notice. */
export const DEFAULT_RETENTION_DAYS = 730;

/** Bounds applied to `INQUIRY_RETENTION_DAYS`: a typo such as `0` or `1` must not purge every inquiry. */
export const MIN_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 3650;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Rows created BEFORE this instant are expired. */
export function retentionCutoff(now: Date, retentionDays: number): Date {
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < MIN_RETENTION_DAYS ||
    retentionDays > MAX_RETENTION_DAYS
  ) {
    // Fail closed: deleting on a nonsense period is worse than not deleting.
    throw new RangeError("retention period out of range");
  }
  return new Date(now.getTime() - retentionDays * DAY_MS);
}

/** When a row created at `createdAt` is due for deletion. */
export function deletionDate(createdAt: Date, retentionDays: number): Date {
  return new Date(createdAt.getTime() + retentionDays * DAY_MS);
}
