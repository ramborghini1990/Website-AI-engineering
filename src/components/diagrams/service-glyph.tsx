import { serviceDiagrams, type ServiceSlug } from "@/lib/diagrams/services";
import type { Diagram, Point } from "@/lib/diagrams/types";

/**
 * A service's diagram reduced to a mark: one 8 x 8 square per legend step
 * placed where that step's nodes sit (turned 90 degrees to fit the wide glyph),
 * the diagram's edges drawn between them,
 * no text. The step with the person in it is the one accent square (the same
 * element that carries the accent in the full diagram). Decorative: the card it
 * sits in carries the meaning, so the SVG is `aria-hidden`.
 */

const WIDTH = 80;
const HEIGHT = 48;
const SQUARE = 8;
/** Distance from the viewBox edge to the nearest square centre. */
const MARGIN = 6;

interface Mark {
  step: string;
  at: Point;
  human: boolean;
  data: boolean;
}

/** The centre of each legend step: the mean of its nodes' centres, then stretched to fill the glyph. */
function marks(diagram: Diagram): Mark[] {
  const centres = diagram.steps.map((step) => {
    const members = diagram.nodes.filter((node) => node.step === step);
    const mean = (pick: (node: (typeof members)[number]) => number) =>
      members.reduce((sum, node) => sum + pick(node), 0) / members.length;
    return {
      step,
      x: mean((node) => node.x + node.w / 2),
      y: mean((node) => node.y + node.h / 2),
      human: members.some((node) => node.tone === "human"),
      data: members.every((node) => node.tone === "data"),
    };
  });

  const span = (values: number[]) => {
    const min = Math.min(...values);
    return { min, size: Math.max(...values) - min };
  };
  const xs = span(centres.map((c) => c.x));
  const ys = span(centres.map((c) => c.y));
  // A diagram that is a single column (or row) keeps its line centred.
  const place = (
    value: number,
    axis: { min: number; size: number },
    room: number,
  ) =>
    axis.size === 0
      ? room / 2
      : MARGIN + ((value - axis.min) / axis.size) * (room - 2 * MARGIN);

  // The diagrams read top to bottom and the glyph is wider than tall, so the
  // axes swap: a step lower in the diagram sits further right in the glyph.
  return centres.map((c) => ({
    step: c.step,
    at: [place(c.y, ys, WIDTH), place(c.x, xs, HEIGHT)] as const,
    human: c.human,
    data: c.data,
  }));
}

/** Links between the steps the diagram's edges join (one per pair, none from a step to itself). */
function links(diagram: Diagram, byStep: Map<string, Mark>) {
  const stepOf = new Map(diagram.nodes.map((n) => [n.id, n.step] as const));
  const seen = new Set<string>();
  const out: Array<{ from: Point; to: Point; data: boolean }> = [];
  for (const edge of diagram.edges) {
    const a = stepOf.get(edge.from);
    const b = stepOf.get(edge.to);
    if (a === undefined || b === undefined || a === b) continue;
    const key = `${a}>${b}`;
    const from = byStep.get(a);
    const to = byStep.get(b);
    if (seen.has(key) || !from || !to) continue;
    seen.add(key);
    out.push({ from: from.at, to: to.at, data: edge.kind === "data" });
  }
  return out;
}

const fmt = (value: number) => String(Math.round(value * 10) / 10);

export function ServiceGlyph({ slug }: { slug: ServiceSlug }) {
  const diagram = serviceDiagrams[slug];
  const placed = marks(diagram);
  const byStep = new Map(placed.map((mark) => [mark.step, mark] as const));

  return (
    <svg
      viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}
      className="h-auto w-full"
      aria-hidden="true"
      focusable="false"
      data-glyph={slug}
    >
      {links(diagram, byStep).map((link) => (
        <path
          key={`${fmt(link.from[0])}-${fmt(link.from[1])}-${fmt(link.to[0])}-${fmt(link.to[1])}`}
          d={`M${fmt(link.from[0])} ${fmt(link.from[1])}L${fmt(link.to[0])} ${fmt(link.to[1])}`}
          fill="none"
          className={link.data ? "stroke-trace" : "stroke-border-strong"}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {placed.map((mark) => (
        <rect
          key={mark.step}
          x={fmt(mark.at[0] - SQUARE / 2)}
          y={fmt(mark.at[1] - SQUARE / 2)}
          width={SQUARE}
          height={SQUARE}
          rx={1}
          className={
            mark.human
              ? "fill-accent stroke-accent"
              : mark.data
                ? "fill-surface-2 stroke-trace"
                : "fill-surface-2 stroke-border-strong"
          }
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
