import type { Diagram, DiagramNode, Point } from "./types";

/** The grid every coordinate snaps to, and the clear space between unrelated nodes. */
const GRID = 8;
/** Widest viewBox allowed (a 360 px phone must still render labels at 12 px or more). */
const MAX_VIEWBOX_WIDTH = 400;

const byId = (diagram: Diagram) =>
  new Map(diagram.nodes.map((node) => [node.id, node] as const));

/** Length of an orthogonal segment (the sum of both axes, one of which is 0). */
function segmentLength(a: Point, b: Point): number {
  return Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
}

/** Lengths of each segment of a polyline, in order (the packet animation shares them out by length). */
export function segmentLengths(points: readonly Point[]): number[] {
  return points
    .slice(1)
    .map((point, index) => segmentLength(points[index], point));
}

function isOrthogonal(a: Point, b: Point): boolean {
  return a[0] === b[0] || a[1] === b[1];
}

function overlaps(a: DiagramNode, b: DiagramNode, padding: number): boolean {
  return (
    a.x < b.x + b.w + padding &&
    b.x < a.x + a.w + padding &&
    a.y < b.y + b.h + padding &&
    b.y < a.y + a.h + padding
  );
}

function inside(inner: DiagramNode, outer: DiagramNode): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h
  );
}

/**
 * Every rule of docs/DESIGN.md §7.1 that can be checked on the data alone.
 * Returns one readable line per violation; an empty list means the diagram is valid.
 */
export function diagramViolations(diagram: Diagram): string[] {
  const problems: string[] = [];
  const nodes = byId(diagram);
  const { w, h } = diagram.viewBox;

  if (w > MAX_VIEWBOX_WIDTH) {
    problems.push(
      `viewBox is ${String(w)} wide (max ${String(MAX_VIEWBOX_WIDTH)})`,
    );
  }
  if (nodes.size !== diagram.nodes.length) problems.push("duplicate node id");

  for (const node of diagram.nodes) {
    for (const value of [node.x, node.y, node.w, node.h]) {
      if (value % GRID !== 0) {
        problems.push(
          `${node.id}: ${String(value)} is off the ${String(GRID)}-unit grid`,
        );
      }
    }
    if (
      node.x < 0 ||
      node.y < 0 ||
      node.x + node.w > w ||
      node.y + node.h > h
    ) {
      problems.push(`${node.id}: outside the viewBox`);
    }
    if (node.parent !== undefined) {
      const parent = nodes.get(node.parent);
      if (!parent) problems.push(`${node.id}: unknown parent ${node.parent}`);
      else if (!inside(node, parent)) {
        problems.push(`${node.id}: not inside its parent ${node.parent}`);
      }
    }
    if (node.step !== undefined && !diagram.steps.includes(node.step)) {
      problems.push(`${node.id}: unknown step ${node.step}`);
    }
    if (node.tone === "boundary") {
      if (!diagram.nodes.some((other) => other.parent === node.id)) {
        problems.push(`${node.id}: a boundary must frame at least one node`);
      }
      if (node.step !== undefined) {
        problems.push(`${node.id}: a boundary has no legend step`);
      }
    }
  }

  for (const [i, a] of diagram.nodes.entries()) {
    for (const b of diagram.nodes.slice(i + 1)) {
      if (a.parent === b.id || b.parent === a.id) continue;
      if (overlaps(a, b, GRID)) {
        problems.push(
          `${a.id} and ${b.id} overlap (less than ${String(GRID)} apart)`,
        );
      }
    }
  }

  const checkPath = (label: string, points: readonly Point[]) => {
    if (points.length < 2) problems.push(`${label}: needs at least two points`);
    for (const point of points) {
      if (point[0] < 0 || point[1] < 0 || point[0] > w || point[1] > h) {
        problems.push(`${label}: point outside the viewBox`);
      }
    }
    for (const [index, point] of points.slice(1).entries()) {
      if (!isOrthogonal(points[index], point)) {
        problems.push(`${label}: diagonal segment ${String(index + 1)}`);
      }
    }
  };

  for (const edge of diagram.edges) {
    const label = `edge ${edge.from} -> ${edge.to}`;
    if (!nodes.has(edge.from))
      problems.push(`${label}: unknown node ${edge.from}`);
    if (!nodes.has(edge.to)) problems.push(`${label}: unknown node ${edge.to}`);
    checkPath(label, edge.points);
  }
  if (diagram.packet) {
    checkPath("packet route", diagram.packet);
    if (!diagram.animated) problems.push("a packet needs an animated diagram");
  }

  return problems;
}

/** Throws with every violation; used by the diagram registry and the tests. */
export function assertValidDiagram(diagram: Diagram): void {
  const problems = diagramViolations(diagram);
  if (problems.length > 0) {
    throw new Error(`Diagram "${diagram.id}": ${problems.join("; ")}`);
  }
}
