import { capabilityMap } from "./capability-map";
import { assertValidDiagram } from "./geometry";
import { heroDiagram } from "./hero";
import { SERVICE_SLUGS, serviceDiagrams } from "./services";
import type { Diagram, DiagramNamespace } from "./types";

/**
 * Every diagram of the site, with the message namespace that holds its copy.
 * Later phases (V2-V5) add theirs here: the dev gallery (`/_dev/diagrams`) and
 * the i18n test iterate this list, so a new diagram is checked and shown without
 * touching either.
 */
export interface RegisteredDiagram {
  diagram: Diagram;
  /** Path of the diagram's messages, e.g. `diagrams.hero`. */
  namespace: DiagramNamespace;
}

export const diagramRegistry: readonly RegisteredDiagram[] = [
  { diagram: heroDiagram, namespace: "diagrams.hero" },
  ...SERVICE_SLUGS.map((slug): RegisteredDiagram => ({
    diagram: serviceDiagrams[slug],
    namespace: `diagrams.services.${slug}`,
  })),
  { diagram: capabilityMap, namespace: "diagrams.capabilityMap" },
];

for (const { diagram } of diagramRegistry) assertValidDiagram(diagram);
