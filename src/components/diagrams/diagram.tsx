import { useTranslations } from "next-intl";
import { useId, type CSSProperties } from "react";

import { segmentLengths } from "@/lib/diagrams/geometry";
import type {
  Diagram as DiagramData,
  DiagramEdge,
  DiagramNamespace,
  DiagramNode,
  DiagramTone,
  Point,
} from "@/lib/diagrams/types";

/**
 * Server-rendered SVG diagram (docs/DESIGN.md §7.1). No client JavaScript: the
 * final state is in the HTML and the entrance is CSS keyframes from the
 * `--animate-node-in` and `--animate-packet` tokens, which the
 * prefers-reduced-motion block in globals.css sets to `none`.
 *
 * Accessibility: a <figure> named by its title, the <svg> is decorative
 * (`aria-hidden`) and the same story is told by the <ol> legend in HTML, so
 * nothing depends on seeing the drawing.
 */

const LABEL_SIZE = 15; // user units: renders >= 12 px at 360 px (viewBox <= 400 wide)
const LABEL_PAD = 12;
const NODE_STAGGER_MS = 80;
const NODE_START_MS = 600;
const PACKET_START_MS = 1000;
/** The packet's whole trip lasts this many `--duration-narrative` units, shared out by length. */
const PACKET_TRIP_UNITS = 3;
const CHEVRON_LENGTH = 6;
const CHEVRON_HALF_WIDTH = 4;

/** Whole class names, written out so Tailwind can see them. */
const TONE: Record<
  DiagramTone,
  { rect: string; stroke: number; label: string }
> = {
  neutral: {
    rect: "fill-surface-2 stroke-border-strong",
    stroke: 1,
    label: "fill-text-secondary",
  },
  strong: {
    rect: "fill-surface-2 stroke-text",
    stroke: 1.5,
    label: "fill-text-secondary",
  },
  data: {
    rect: "fill-surface-2 stroke-trace",
    stroke: 1,
    label: "fill-text-secondary",
  },
  human: {
    rect: "fill-surface-2 stroke-border-strong",
    stroke: 1,
    label: "fill-text-secondary",
  },
  output: {
    rect: "fill-surface-2 stroke-border-strong",
    stroke: 1,
    label: "fill-text-secondary",
  },
  muted: {
    rect: "fill-surface-1 stroke-border-subtle",
    stroke: 1,
    label: "fill-text-muted",
  },
  // Unfilled frame (`fill="none"` is set on the rect); dashed like a perimeter.
  boundary: {
    rect: "stroke-border-strong",
    stroke: 1,
    label: "fill-text-muted",
  },
};

const pathOf = (points: readonly Point[]) =>
  points
    .map(
      ([x, y], index) => `${index === 0 ? "M" : "L"}${String(x)} ${String(y)}`,
    )
    .join("");

/** Open arrow head at the last point of an orthogonal edge. */
function chevron(points: readonly Point[]): string {
  const [tx, ty] = points[points.length - 1];
  const [px, py] = points[points.length - 2];
  const dx = Math.sign(tx - px);
  const dy = Math.sign(ty - py);
  const bx = tx - dx * CHEVRON_LENGTH;
  const by = ty - dy * CHEVRON_LENGTH;
  // Perpendicular of an axis-aligned direction swaps the axes.
  const a: Point = [bx + dy * CHEVRON_HALF_WIDTH, by + dx * CHEVRON_HALF_WIDTH];
  const b: Point = [bx - dy * CHEVRON_HALF_WIDTH, by - dx * CHEVRON_HALF_WIDTH];
  return pathOf([a, [tx, ty], b]);
}

function Edge({
  edge,
  delayMs,
  animate,
}: {
  edge: DiagramEdge;
  delayMs: number;
  animate: boolean;
}) {
  const motion = animate
    ? {
        className: "animate-node-in",
        style: { animationDelay: `${String(delayMs)}ms` } as CSSProperties,
      }
    : {};
  const data = edge.kind === "data";
  return (
    <g {...motion}>
      <path
        d={pathOf(edge.points)}
        fill="none"
        className={data ? "stroke-trace" : "stroke-text-muted"}
        strokeWidth={data ? 1 : 1.5}
        // data: a link with no direction; feedback: a loop back (dotted, with an arrow head)
        strokeDasharray={
          data ? "4 4" : edge.kind === "feedback" ? "2 4" : undefined
        }
        vectorEffect="non-scaling-stroke"
      />
      {edge.kind !== "data" ? (
        <path
          d={chevron(edge.points)}
          fill="none"
          className="stroke-text-muted"
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </g>
  );
}

function Node({
  node,
  index,
  stepIndex,
  numbered,
  container,
  label,
  sub,
  animate,
}: {
  node: DiagramNode;
  index: number;
  /** 1-based legend step, or 0 for a node without one. */
  stepIndex: number;
  /** Shows the step number: a node of its own, not a part inside another node (a boundary does not count as a node). */
  numbered: boolean;
  container: boolean;
  label: string;
  sub: string | undefined;
  animate: boolean;
}) {
  const tone = TONE[node.tone];
  const hasSub = sub !== undefined;
  const textX = node.x + LABEL_PAD;
  const labelY = container
    ? node.y + 24
    : hasSub
      ? node.y + 22
      : node.y + node.h / 2 + 5;
  const midY = node.y + node.h / 2;
  const motion = animate
    ? {
        className: "animate-node-in",
        style: {
          animationDelay: `${String(NODE_START_MS + index * NODE_STAGGER_MS)}ms`,
        } as CSSProperties,
      }
    : {};

  return (
    <g
      data-node={node.id}
      data-node-step-index={stepIndex > 0 ? stepIndex : undefined}
      {...motion}
    >
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={2}
        fill={node.tone === "boundary" ? "none" : undefined}
        strokeDasharray={node.tone === "boundary" ? "6 4" : undefined}
        className={tone.rect}
        strokeWidth={tone.stroke}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={textX}
        y={labelY}
        fontSize={LABEL_SIZE}
        className={`font-mono uppercase ${tone.label}`}
      >
        {numbered ? (
          <tspan className="fill-text-muted">
            {`${String(stepIndex).padStart(2, "0")} `}
          </tspan>
        ) : null}
        {label}
      </text>
      {hasSub ? (
        <text
          x={textX}
          y={node.y + 42}
          fontSize={LABEL_SIZE}
          className="fill-text-muted font-mono uppercase"
        >
          {sub}
        </text>
      ) : null}
      {node.tone === "human" ? (
        // The one accent of the figure: a person is in the loop here (the
        // state is also written out in the sub-label, never colour alone).
        <circle
          cx={node.x + node.w - 16}
          cy={midY}
          r={4}
          className="fill-accent"
        />
      ) : null}
      {node.tone === "output" ? (
        <path
          // Check mark, drawn as a filled shape in a 16-unit box; the state is also the sub-label text.
          d={`M${String(node.x + node.w - 32)} ${String(midY + 0.5)}l2.5-2.5 3.5 3.5 7.5-7.5 2.5 2.5-10 10z`}
          className="fill-success"
        />
      ) : null}
    </g>
  );
}

/** The travelling packet: nested groups, one per route segment, each animating its own leg. */
function Packet({ route }: { route: readonly Point[] }) {
  const lengths = segmentLengths(route);
  const total = lengths.reduce((sum, length) => sum + length, 0);
  const end = route[route.length - 1];

  const legs = lengths.map((length, index) => ({
    dx: route[index][0] - route[index + 1][0],
    dy: route[index][1] - route[index + 1][1],
    share: (PACKET_TRIP_UNITS * length) / total,
    // each leg starts when the ones before it end
    start:
      (PACKET_TRIP_UNITS *
        lengths.slice(0, index).reduce((sum, before) => sum + before, 0)) /
      total,
  }));

  // The dot rests on the last point; every leg shifts it back by that segment
  // and the shifts shrink to zero one after the other, so the sum walks the route.
  const dot = (
    <circle
      cx={end[0]}
      cy={end[1]}
      r={4}
      className="animate-node-in fill-text"
      style={{ animationDelay: `${String(PACKET_START_MS)}ms` }}
    />
  );
  return legs.reduceRight(
    (content, leg) => (
      <g
        className="animate-packet"
        style={
          {
            "--packet-dx": `${String(leg.dx)}px`,
            "--packet-dy": `${String(leg.dy)}px`,
            animationDuration: `calc(var(--duration-narrative) * ${leg.share.toFixed(3)})`,
            animationDelay: `calc(${String(PACKET_START_MS)}ms + var(--duration-narrative) * ${leg.start.toFixed(3)})`,
          } as CSSProperties
        }
      >
        {content}
      </g>
    ),
    dot,
  );
}

/** The parked packet of a diagram that does not animate: just the dot on its last point. */
function StaticPacket({ route }: { route: readonly Point[] }) {
  const end = route[route.length - 1];
  return <circle cx={end[0]} cy={end[1]} r={4} className="fill-text" />;
}

export function Diagram({
  diagram,
  namespace,
  animate = diagram.animated,
  className,
  stepHref,
}: {
  diagram: DiagramData;
  namespace: DiagramNamespace;
  /** Defaults to the diagram's own setting; `false` renders it without any animation class. */
  animate?: boolean;
  className?: string;
  /** Turns a legend item into an in-page link (a map whose items point at the sections they stand for). */
  stepHref?: (step: string) => string;
}) {
  const t = useTranslations(namespace);
  // Keys come from the diagram data; src/lib/diagrams/i18n.test.ts proves every one exists in both languages.
  const text = (key: string) => (t as (key: string) => string)(key);
  const reactId = useId().replace(/:/g, "");
  const gridId = `diagram-grid-${reactId}`;
  const titleId = `diagram-title-${reactId}`;
  const play = animate && diagram.animated;
  const { w, h } = diagram.viewBox;
  const indexOf = new Map(
    diagram.nodes.map((node, i) => [node.id, i] as const),
  );
  const toneOf = new Map(diagram.nodes.map((node) => [node.id, node.tone]));

  return (
    <figure
      data-diagram={diagram.id}
      aria-labelledby={titleId}
      className={className}
    >
      <svg
        viewBox={`0 0 ${String(w)} ${String(h)}`}
        className="h-auto w-full"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <pattern
            id={gridId}
            width={40}
            height={40}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M40 0H0V40"
              fill="none"
              className="stroke-border-subtle"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          </pattern>
        </defs>
        <rect
          width={w}
          height={h}
          rx={2}
          className="fill-surface-1 stroke-border-subtle"
          vectorEffect="non-scaling-stroke"
        />
        <rect width={w} height={h} fill={`url(#${gridId})`} />
        {diagram.edges.map((edge) => (
          <Edge
            key={`${edge.from}-${edge.to}`}
            edge={edge}
            animate={play}
            delayMs={
              NODE_START_MS +
              Math.max(indexOf.get(edge.from) ?? 0, indexOf.get(edge.to) ?? 0) *
                NODE_STAGGER_MS
            }
          />
        ))}
        {diagram.nodes.map((node, index) => (
          <Node
            key={node.id}
            node={node}
            index={index}
            stepIndex={
              node.step === undefined ? 0 : diagram.steps.indexOf(node.step) + 1
            }
            numbered={
              node.step !== undefined &&
              (node.parent === undefined ||
                toneOf.get(node.parent) === "boundary")
            }
            container={diagram.nodes.some((other) => other.parent === node.id)}
            label={text(node.labelKey)}
            sub={node.subKey === undefined ? undefined : text(node.subKey)}
            animate={play}
          />
        ))}
        {diagram.packet ? (
          play ? (
            <Packet route={diagram.packet} />
          ) : (
            <StaticPacket route={diagram.packet} />
          )
        ) : null}
      </svg>
      <figcaption className="mt-6">
        <p id={titleId} className="font-mono text-xs text-text-muted uppercase">
          {text("title")}
        </p>
        <ol className="mt-4 grid gap-3">
          {diagram.steps.map((step, index) => (
            <li
              key={step}
              data-step={step}
              data-step-index={index + 1}
              className="grid grid-cols-[auto_1fr] gap-3 text-sm text-text-secondary"
            >
              <span
                aria-hidden="true"
                className="font-mono text-xs text-text-muted"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              {stepHref ? (
                <a
                  href={stepHref(step)}
                  className="inline-flex min-h-11 items-center text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
                >
                  {text(`steps.${step}`)}
                </a>
              ) : (
                <span>{text(`steps.${step}`)}</span>
              )}
            </li>
          ))}
        </ol>
      </figcaption>
    </figure>
  );
}
