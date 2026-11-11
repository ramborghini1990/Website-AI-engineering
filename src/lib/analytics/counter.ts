import { sql, type SQL } from "drizzle-orm";

import type { DemoEventName } from "@/lib/analytics/events";
import type { CountRow } from "@/lib/analytics/funnel";
import { demoEventCounts, type DemoEventCountRow } from "@/lib/db/schema";
import type { InteractiveDemo } from "@/lib/demos/registry";

/**
 * Where the aggregates live. The only operation is "one more of this event in
 * this demo today": nothing per event or per visitor is ever written.
 */
export type EventCounter = {
  increment(
    day: string,
    demo: InteractiveDemo,
    event: DemoEventName,
  ): Promise<void>;
};

/** The UTC calendar day, the only time resolution the aggregates have. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The part of a Drizzle database the counter uses, so tests can pass a fake. */
type UpsertCapable = {
  insert: (table: typeof demoEventCounts) => {
    values: (row: DemoEventCountRow) => {
      onConflictDoUpdate: (config: {
        target: [
          typeof demoEventCounts.day,
          typeof demoEventCounts.demo,
          typeof demoEventCounts.event,
        ];
        set: { count: SQL };
      }) => PromiseLike<unknown>;
    };
  };
};

export function createDrizzleCounter(db: UpsertCapable): EventCounter {
  return {
    async increment(day, demo, event) {
      await db
        .insert(demoEventCounts)
        .values({ day, demo, event, count: 1 })
        .onConflictDoUpdate({
          target: [
            demoEventCounts.day,
            demoEventCounts.demo,
            demoEventCounts.event,
          ],
          set: { count: sql`${demoEventCounts.count} + 1` },
        });
    },
  };
}

/** Local development, tests and CI: kept in this process only, gone on restart. */
export function createMemoryCounter(): EventCounter & {
  rows(): CountRow[];
} {
  const counts = new Map<string, CountRow>();
  return {
    rows: () => [...counts.values()].map((row) => ({ ...row })),
    increment(day, demo, event) {
      const key = `${day}|${demo}|${event}`;
      const existing = counts.get(key);
      if (existing === undefined)
        counts.set(key, { day, demo, event, count: 1 });
      else existing.count += 1;
      return Promise.resolve();
    },
  };
}
