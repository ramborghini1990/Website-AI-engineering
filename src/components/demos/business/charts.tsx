import { useId } from "react";

import { ScrollRegion } from "@/components/demos/business/scroll-region";
import { useBusinessCopy } from "@/components/demos/business/use-business-copy";
import type { BalancePoint, WeekFlow } from "@/lib/demos/business/model";

/**
 * The two charts of the cash-flow screen, drawn as plain SVG (no chart
 * library). Each is an image with a written description (what it shows, the
 * start, lowest, highest and last values) and is followed by the same numbers
 * as a real table that a screen reader can walk cell by cell. Colour is never
 * the only signal: money in is a filled bar and money out an outlined bar, and
 * both are named in the legend. Everything uses the site's colour tokens, so
 * both themes work. The marks are not interactive; the table is how to read
 * exact values.
 */

const W = 400;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 28, left: 52 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
const TICKS = 4;

/** Round the axis to a tidy step so the gridlines read as clean numbers. */
function niceScale(min: number, max: number): { lo: number; hi: number } {
  const span = Math.max(max - min, 1);
  const raw = span / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    ([1, 2, 5, 10].find((m) => m * magnitude >= raw) ?? 10) * magnitude;
  return {
    lo: Math.floor(min / step) * step,
    hi: Math.ceil(max / step) * step,
  };
}

const GRID = "stroke-border-subtle";
const AXIS_TEXT = "fill-text-secondary text-[0.8125rem]";

function Frame({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  const uid = useId();
  return (
    <svg
      role="img"
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      aria-labelledby={`${uid}-t`}
      aria-describedby={`${uid}-d`}
      className="block h-auto w-full"
    >
      <title id={`${uid}-t`}>{title}</title>
      <desc id={`${uid}-d`}>{desc}</desc>
      {children}
    </svg>
  );
}

/** Gridlines with their amounts, for the scale `lo..hi`. */
function YAxis({
  lo,
  hi,
  y,
  format,
}: {
  lo: number;
  hi: number;
  y: (value: number) => number;
  format: (cents: number) => string;
}) {
  const step = (hi - lo) / TICKS;
  return (
    <g aria-hidden="true">
      {Array.from({ length: TICKS + 1 }, (_, i) => lo + i * step).map(
        (value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(value)}
              y2={y(value)}
              className={GRID}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(value)}
              textAnchor="end"
              dominantBaseline="middle"
              className={AXIS_TEXT}
            >
              {format(value)}
            </text>
          </g>
        ),
      )}
    </g>
  );
}

export function BalanceChart({ points }: { points: BalancePoint[] }) {
  const c = useBusinessCopy();
  const values = points.map((p) => p.balanceCents);
  const { lo, hi } = niceScale(Math.min(...values), Math.max(...values));
  const x = (i: number) =>
    PAD.left + (i / Math.max(points.length - 1, 1)) * PLOT_W;
  const y = (value: number) =>
    PAD.top + PLOT_H - ((value - lo) / Math.max(hi - lo, 1)) * PLOT_H;
  const first = points.at(0);
  const last = points.at(-1);
  if (first === undefined || last === undefined) return null;

  return (
    <Frame
      title={c.text("cash.balance.title")}
      desc={c.text("cash.balance.desc", {
        start: c.dateLong(first.date),
        end: c.dateLong(last.date),
        first: c.money(first.balanceCents),
        min: c.money(Math.min(...values)),
        max: c.money(Math.max(...values)),
        last: c.money(last.balanceCents),
      })}
    >
      <YAxis lo={lo} hi={hi} y={y} format={c.compact} />
      <g aria-hidden="true">
        <polyline
          points={points
            .map((p, i) => `${String(x(i))},${String(y(p.balanceCents))}`)
            .join(" ")}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-accent"
        />
        <circle
          cx={x(points.length - 1)}
          cy={y(last.balanceCents)}
          r={4}
          strokeWidth={2}
          className="fill-accent stroke-surface-1"
        />
        <text x={PAD.left} y={H - 8} textAnchor="start" className={AXIS_TEXT}>
          {c.date(first.date)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 8}
          textAnchor="end"
          className={AXIS_TEXT}
        >
          {c.date(last.date)}
        </text>
      </g>
    </Frame>
  );
}

export function FlowChart({ weeks }: { weeks: WeekFlow[] }) {
  const c = useBusinessCopy();
  const top = Math.max(...weeks.flatMap((w) => [w.inCents, w.outCents]), 1);
  const { hi } = niceScale(0, top);
  const y = (value: number) => PAD.top + PLOT_H - (value / hi) * PLOT_H;
  const group = PLOT_W / Math.max(weeks.length, 1);
  const bar = Math.min(group * 0.34, 16);
  const latest = weeks.at(-1);
  if (latest === undefined) return null;

  return (
    <Frame
      title={c.text("cash.flow.title")}
      desc={c.text("cash.flow.desc", {
        end: c.dateLong(latest.end),
        in: c.money(latest.inCents),
        out: c.money(latest.outCents),
      })}
    >
      <YAxis lo={0} hi={hi} y={y} format={c.compact} />
      <g aria-hidden="true">
        {weeks.map((week, i) => {
          const centre = PAD.left + group * i + group / 2;
          return (
            <g key={week.end}>
              <rect
                x={centre - bar - 1}
                y={y(week.inCents)}
                width={bar}
                height={y(0) - y(week.inCents)}
                className="fill-accent"
              />
              {/* Outlined, not filled: the second series differs by shape as well as by colour. */}
              <rect
                x={centre + 1}
                y={y(week.outCents) + 1}
                width={bar}
                height={Math.max(y(0) - y(week.outCents) - 1, 0)}
                strokeWidth={2}
                className="fill-surface-1 stroke-text-secondary"
              />
              {i === 0 || i === weeks.length - 1 ? (
                <text
                  x={centre}
                  y={H - 8}
                  textAnchor={i === 0 ? "start" : "end"}
                  className={AXIS_TEXT}
                >
                  {c.date(week.end)}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </Frame>
  );
}

/** The legend of the bar chart: a swatch that repeats the mark's fill, and the words. */
export function FlowLegend() {
  const c = useBusinessCopy();
  return (
    <ul
      aria-label={c.text("cash.legend.label")}
      className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-secondary"
    >
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="size-3 bg-accent" />
        {c.text("cash.legend.in")}
      </li>
      <li className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="size-3 border-2 border-text-secondary bg-surface-1"
        />
        {c.text("cash.legend.out")}
      </li>
    </ul>
  );
}

/** The same numbers as the charts, as tables. Native `<details>`: works without JavaScript. */
export function BalanceTable({ points }: { points: BalancePoint[] }) {
  const c = useBusinessCopy();
  return (
    <details
      data-table="balance"
      className="min-w-0 border border-border-strong"
    >
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-base text-text">
        {c.text("cash.table.show")}
      </summary>
      <ScrollRegion
        label={c.text("cash.table.balanceCaption")}
        className="max-h-80 px-4 pb-4"
      >
        <table className="w-full text-base">
          <caption className="sr-only">
            {c.text("cash.table.balanceCaption")}
          </caption>
          <thead>
            <tr className="border-b border-border-strong text-sm text-text-muted">
              <th scope="col" className="py-2 pe-4 text-start font-normal">
                {c.text("cash.table.day")}
              </th>
              <th scope="col" className="py-2 text-end font-normal">
                {c.text("cash.table.balance")}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date} className="border-b border-border-subtle">
                <th
                  scope="row"
                  className="py-2 pe-4 text-start font-normal text-text-secondary"
                >
                  {c.dateLong(point.date)}
                </th>
                <td className="py-2 text-end font-mono text-text">
                  {c.money(point.balanceCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </details>
  );
}

export function FlowTable({ weeks }: { weeks: WeekFlow[] }) {
  const c = useBusinessCopy();
  return (
    <details data-table="flow" className="min-w-0 border border-border-strong">
      <summary className="min-h-11 cursor-pointer px-4 py-3 text-base text-text">
        {c.text("cash.table.show")}
      </summary>
      <ScrollRegion
        label={c.text("cash.table.flowCaption")}
        className="px-4 pb-4"
      >
        <table className="w-full text-base">
          <caption className="sr-only">
            {c.text("cash.table.flowCaption")}
          </caption>
          <thead>
            <tr className="border-b border-border-strong text-sm text-text-muted">
              <th scope="col" className="py-2 pe-4 text-start font-normal">
                {c.text("cash.table.week")}
              </th>
              <th scope="col" className="py-2 pe-4 text-end font-normal">
                {c.text("cash.table.in")}
              </th>
              <th scope="col" className="py-2 pe-4 text-end font-normal">
                {c.text("cash.table.out")}
              </th>
              <th scope="col" className="py-2 text-end font-normal">
                {c.text("cash.table.net")}
              </th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr
                key={week.end}
                data-week={week.end}
                className="border-b border-border-subtle"
              >
                <th
                  scope="row"
                  className="py-2 pe-4 text-start font-normal text-text-secondary"
                >
                  {c.dateLong(week.end)}
                </th>
                <td className="py-2 pe-4 text-end font-mono text-text">
                  {c.money(week.inCents)}
                </td>
                <td className="py-2 pe-4 text-end font-mono text-text">
                  {c.money(week.outCents)}
                </td>
                <td className="py-2 text-end font-mono text-text">
                  {c.money(week.inCents - week.outCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollRegion>
    </details>
  );
}
