/**
 * Data model of the diagram system (docs/DESIGN.md §7.1). A diagram is plain
 * data: the Server Component in `src/components/diagrams/diagram.tsx` turns it
 * into inline SVG, so a diagram never needs client JavaScript.
 *
 * Coordinates are SVG user units in a viewBox at most 400 wide, snapped to an
 * 8-unit grid. Every visible string is an i18n key under a namespace such as
 * `diagrams.hero`; nothing here holds copy.
 */
import type { Messages } from "@/i18n/messages";

/**
 * How a node is drawn.
 * - `neutral`: a plain step (stroke `border-strong`).
 * - `strong`: the step the diagram is about (stroke `text`).
 * - `data`: a source the step reads from (stroke `trace`).
 * - `human`: a person decides here (stroke `border-strong` + the one accent dot).
 * - `output`: the result; drawn with a check mark and a text state.
 * - `muted`: a part inside another node (stroke `border-subtle`, decorative).
 * - `boundary`: a dashed, unfilled frame (stroke `border-strong`) with its label in the
 *   corner, drawn around the nodes that list it as `parent`, e.g. the permissions an agent works within.
 */
export type DiagramTone =
  "neutral" | "strong" | "data" | "human" | "output" | "muted" | "boundary";

export type Point = readonly [x: number, y: number];

/**
 * A message namespace that holds one diagram's copy: `diagrams.<id>`, or
 * `diagrams.services.<slug>` for the service diagrams and `diagrams.demos.<slug>`
 * for the "how this demo works" diagrams (messages/*.json).
 */
export type DiagramNamespace =
  | `diagrams.${Exclude<Extract<keyof Messages["diagrams"], string>, "services" | "demos">}`
  | `diagrams.services.${Extract<keyof Messages["diagrams"]["services"], string>}`
  | `diagrams.demos.${Extract<keyof Messages["diagrams"]["demos"], string>}`;

export interface DiagramNode {
  id: string;
  /** Message key under the diagram's namespace, e.g. `nodes.request`. Max 16 characters. */
  labelKey: string;
  /** Optional second line (a state or a role), same rules as `labelKey`. */
  subKey?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tone: DiagramTone;
  /** Legend step this node belongs to (a key of `Diagram.steps`); drives the numbered index and the legend hover. */
  step?: string;
  /** Id of the node or boundary this one sits inside (it must lie within it; the pair is exempt from the overlap rule). */
  parent?: string;
}

type DiagramEdgeKind = "flow" | "data" | "feedback";

export interface DiagramEdge {
  from: string;
  to: string;
  kind: DiagramEdgeKind;
  /** Orthogonal polyline: every segment is horizontal or vertical. */
  points: readonly Point[];
}

export interface Diagram {
  id: string;
  viewBox: { w: number; h: number };
  nodes: readonly DiagramNode[];
  edges: readonly DiagramEdge[];
  /** Legend step keys in reading order; each is a key under `<namespace>.steps`. */
  steps: readonly string[];
  /** Plays the finite entrance sequence. Only the hero does (below-the-fold diagrams stay still). */
  animated: boolean;
  /** Route of the travelling packet (orthogonal); it ends parked on its last point. Animated diagrams only. */
  packet?: readonly Point[];
}
