import { useMemo } from "react";

import {
  BalanceChart,
  BalanceTable,
  FlowChart,
  FlowLegend,
  FlowTable,
} from "@/components/demos/business/charts";
import { useBusinessCopy } from "@/components/demos/business/use-business-copy";
import type { BusinessData } from "@/lib/demos/business/fixtures";
import { balanceSeries, kpis, weeklyFlows } from "@/lib/demos/business/model";

/**
 * The cash-flow dashboard: four key figures, the balance over the last 30
 * days, and money in and out per week, each chart with its table. Every number
 * is computed from the same data the till and the orders change.
 */
export function CashflowView({ data }: { data: BusinessData }) {
  const c = useBusinessCopy();
  const figures = useMemo(() => kpis(data), [data]);
  const balance = useMemo(() => balanceSeries(data, 30), [data]);
  const weeks = useMemo(() => weeklyFlows(data, 8), [data]);

  const tiles = [
    ["balance", figures.balanceCents],
    ["in", figures.inCents],
    ["out", figures.outCents],
    ["open", figures.openOrdersCents],
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-10">
      <dl
        aria-label={c.text("cash.kpi.title")}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {tiles.map(([key, cents]) => (
          <div
            key={key}
            data-kpi={key}
            className="grid gap-1 border border-border-strong p-4"
          >
            <dt className="text-sm text-text-muted">
              {c.text(`cash.kpi.${key}`)}
            </dt>
            <dd className="font-mono text-2xl text-text">{c.money(cents)}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section
          aria-labelledby="bm-balance-title"
          className="grid min-w-0 content-start gap-3"
        >
          <h3 id="bm-balance-title" className="text-xl text-text">
            {c.text("cash.balance.title")}
          </h3>
          <BalanceChart points={balance} />
          <BalanceTable points={balance} />
        </section>
        <section
          aria-labelledby="bm-flow-title"
          className="grid min-w-0 content-start gap-3"
        >
          <h3 id="bm-flow-title" className="text-xl text-text">
            {c.text("cash.flow.title")}
          </h3>
          <FlowLegend />
          <FlowChart weeks={weeks} />
          <FlowTable weeks={weeks} />
        </section>
      </div>

      <p className="max-w-3xl text-sm text-text-muted">{c.text("cash.note")}</p>
    </div>
  );
}
