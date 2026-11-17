import { SERVICE_SLUGS } from "./services";
import type { Diagram, DiagramEdge, DiagramNode } from "./types";

/**
 * The four services as one connected column (/services). They share one
 * practice and one person accountable, so the links have no direction: dashed
 * `data` edges, no arrow heads, no claim about which service feeds which. The
 * order is the `order` of the services' frontmatter (also the order of the
 * cards and of the Home hero lead).
 */

const STEP = 64; // node height 40 + 24 clear
const X = 16;
const W = 368;

const nodes: DiagramNode[] = SERVICE_SLUGS.map((slug, index) => ({
  id: slug,
  labelKey: `nodes.${slug}`,
  x: X,
  y: 16 + index * STEP,
  w: W,
  h: 40,
  tone: "neutral",
  step: slug,
}));

const edges: DiagramEdge[] = SERVICE_SLUGS.slice(1).map((slug, index) => ({
  from: SERVICE_SLUGS[index],
  to: slug,
  kind: "data",
  points: [
    [X + W / 2, 16 + index * STEP + 40],
    [X + W / 2, 16 + (index + 1) * STEP],
  ],
}));

export const capabilityMap: Diagram = {
  id: "capability-map",
  viewBox: { w: 400, h: 16 + (SERVICE_SLUGS.length - 1) * STEP + 40 + 16 },
  animated: false,
  steps: SERVICE_SLUGS,
  nodes,
  edges,
};

/** The anchor id of a service's card on /services (the legend items link to it). */
export const serviceCardId = (slug: string) => `service-${slug}`;
