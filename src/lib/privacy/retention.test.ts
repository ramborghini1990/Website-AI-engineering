// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  DEFAULT_RETENTION_DAYS,
  deletionDate,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  retentionCutoff,
} from "@/lib/privacy/retention";

const NOW = new Date("2026-11-12T03:17:00.000Z");

describe("retentionCutoff", () => {
  it("the default is 730 days (24 months, as the privacy notice says)", () => {
    expect(DEFAULT_RETENTION_DAYS).toBe(730);
  });

  it("is exactly `days` before now", () => {
    expect(retentionCutoff(NOW, 730).toISOString()).toBe(
      "2024-11-12T03:17:00.000Z",
    );
    expect(retentionCutoff(NOW, 30).toISOString()).toBe(
      "2026-10-13T03:17:00.000Z",
    );
  });

  it("negative: a period outside the bounds, or not a whole number, throws (it never purges on a typo)", () => {
    for (const days of [
      0,
      1,
      -730,
      MIN_RETENTION_DAYS - 1,
      MAX_RETENTION_DAYS + 1,
      30.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      expect(() => retentionCutoff(NOW, days), String(days)).toThrow(
        RangeError,
      );
    }
  });

  it("accepts both ends of the range", () => {
    expect(() => retentionCutoff(NOW, MIN_RETENTION_DAYS)).not.toThrow();
    expect(() => retentionCutoff(NOW, MAX_RETENTION_DAYS)).not.toThrow();
  });
});

describe("deletionDate", () => {
  it("is the creation date plus the period, the inverse of the cutoff", () => {
    const created = new Date("2025-01-01T10:00:00.000Z");

    expect(deletionDate(created, 730).toISOString()).toBe(
      "2027-01-01T10:00:00.000Z",
    );
    // A row created exactly at the cutoff is due at `now`.
    expect(deletionDate(retentionCutoff(NOW, 730), 730).getTime()).toBe(
      NOW.getTime(),
    );
  });
});
