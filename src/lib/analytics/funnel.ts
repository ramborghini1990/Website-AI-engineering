import type { DemoEventName } from "@/lib/analytics/events";
import { interactiveDemos, type InteractiveDemo } from "@/lib/demos/registry";

/** One stored aggregate: how many times `event` happened in `demo` on `day` (UTC). */
export type CountRow = {
  day: string;
  demo: InteractiveDemo;
  event: DemoEventName;
  count: number;
};

export type FunnelRow = {
  demo: InteractiveDemo;
  started: number;
  completed: number;
  ctaClicked: number;
  /** completed / started, 0..1; null while nobody started. */
  completionRate: number | null;
};

/**
 * The funnel per demo from the aggregates, over whatever days the rows cover.
 * Every registered demo has a row (zeros included), in registry order. The call
 * to action can be clicked without using the demo, so `ctaClicked` is a count,
 * not a share of `started`. Rows for unknown demos are ignored.
 */
export function buildFunnel(rows: readonly CountRow[]): FunnelRow[] {
  return interactiveDemos.map((demo) => {
    const total = (event: DemoEventName) =>
      rows
        .filter((row) => row.demo === demo && row.event === event)
        .reduce((sum, row) => sum + row.count, 0);
    const started = total("demo_started");
    const completed = total("demo_completed");
    return {
      demo,
      started,
      completed,
      ctaClicked: total("cta_clicked"),
      completionRate: started === 0 ? null : Math.min(1, completed / started),
    };
  });
}
