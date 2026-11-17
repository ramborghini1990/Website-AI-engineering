// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  assertValidDiagram,
  diagramViolations,
  segmentLengths,
} from "./geometry";
import { heroDiagram } from "./hero";
import { diagramRegistry } from "./registry";
import { serviceDiagrams } from "./services";
import type { Diagram, DiagramNode } from "./types";

const withNode = (id: string, patch: Partial<DiagramNode>): Diagram => ({
  ...heroDiagram,
  nodes: heroDiagram.nodes.map((node) =>
    node.id === id ? { ...node, ...patch } : node,
  ),
});

describe("the hero diagram", () => {
  it("passes every geometry rule", () => {
    expect(diagramViolations(heroDiagram)).toEqual([]);
    expect(() => {
      assertValidDiagram(heroDiagram);
    }).not.toThrow();
  });

  it("has the nodes, flow edges and data edges the plan names", () => {
    expect(heroDiagram.nodes.map((n) => n.id)).toEqual([
      "request",
      "agent",
      "model",
      "rules",
      "tools",
      "docs",
      "review",
      "action",
      "log",
    ]);
    const edges = (kind: string) =>
      heroDiagram.edges
        .filter((e) => e.kind === kind)
        .map((e) => `${e.from}>${e.to}`);
    expect(edges("flow")).toEqual([
      "request>agent",
      "agent>review",
      "review>action",
      "action>log",
    ]);
    expect(edges("data")).toEqual(["agent>tools", "agent>docs"]);
  });

  it("fits a phone: a viewBox at most 400 wide, so 15-unit labels render at 12 px or more at 360 px", () => {
    expect(heroDiagram.viewBox.w).toBeLessThanOrEqual(400);
  });

  it("parks the packet on the review node", () => {
    const review = heroDiagram.nodes.find((n) => n.id === "review");
    const end = heroDiagram.packet?.at(-1);
    expect(end?.[1]).toBe(review?.y);
    expect(end?.[0]).toBeGreaterThanOrEqual(review?.x ?? Infinity);
  });
});

describe("every registered diagram", () => {
  it("includes the hero, the four services and the capability map", () => {
    expect(diagramRegistry.map((entry) => entry.diagram.id)).toEqual([
      "hero",
      "ai-agents",
      "workflow-automation",
      "web-applications",
      "document-intelligence",
      "capability-map",
    ]);
  });

  for (const { diagram } of diagramRegistry) {
    it(`${diagram.id} passes every geometry rule and fits a phone (viewBox at most 400 wide)`, () => {
      expect(diagramViolations(diagram)).toEqual([]);
      expect(diagram.viewBox.w).toBeLessThanOrEqual(400);
    });

    it(`${diagram.id} gives every legend step at least one node`, () => {
      for (const step of diagram.steps) {
        expect(
          diagram.nodes.some((node) => node.step === step),
          `${diagram.id}: step ${step} has no node`,
        ).toBe(true);
      }
    });
  }

  it("only the hero animates; below-the-fold diagrams stay still", () => {
    for (const { diagram } of diagramRegistry) {
      expect(diagram.animated, diagram.id).toBe(diagram.id === "hero");
    }
  });
});

describe("a boundary (negative cases)", () => {
  const agents = serviceDiagrams["ai-agents"];
  const patched = (id: string, patch: Partial<DiagramNode>): Diagram => ({
    ...agents,
    nodes: agents.nodes.map((node) =>
      node.id === id ? { ...node, ...patch } : node,
    ),
  });

  it("frames the agent and nothing else", () => {
    const framed = agents.nodes
      .filter((node) => node.parent === "permissions")
      .map((node) => node.id);
    expect(framed).toEqual(["agent"]);
  });

  it("rejects an outside node moved into the boundary", () => {
    expect(
      diagramViolations(patched("tools", { x: 160, y: 96 })).join("\n"),
    ).toMatch(/permissions and tools overlap/);
  });

  it("rejects a framed node that leaves the boundary", () => {
    expect(
      diagramViolations(patched("agent", { x: 200, w: 160 })).join("\n"),
    ).toMatch(/agent: not inside its parent permissions/);
  });

  it("rejects a boundary that frames nothing, or that has a legend step", () => {
    expect(
      diagramViolations(patched("agent", { parent: undefined })).join("\n"),
    ).toMatch(/permissions: a boundary must frame at least one node/);
    expect(
      diagramViolations(patched("permissions", { step: "agent" })).join("\n"),
    ).toMatch(/permissions: a boundary has no legend step/);
  });
});

describe("diagram geometry (negative cases)", () => {
  it("rejects a node moved onto another", () => {
    const problems = diagramViolations(withNode("docs", { y: 96 }));
    expect(problems.join("\n")).toMatch(/tools and docs overlap/);
  });

  it("rejects two nodes closer than the 8-unit padding", () => {
    // tools ends at y 136; docs at 140 would leave 4.
    const problems = diagramViolations(withNode("docs", { y: 140 }));
    expect(problems.join("\n")).toMatch(/overlap/);
  });

  it("rejects a node outside the viewBox", () => {
    const problems = diagramViolations(withNode("tools", { x: 304 }));
    expect(problems).toContain("tools: outside the viewBox");
  });

  it("rejects a diagonal edge segment", () => {
    const diagram: Diagram = {
      ...heroDiagram,
      edges: [
        {
          from: "request",
          to: "agent",
          kind: "flow",
          points: [
            [120, 56],
            [128, 80],
          ],
        },
      ],
    };
    expect(diagramViolations(diagram).join("\n")).toMatch(/diagonal segment 1/);
  });

  it("rejects an edge to an unknown node", () => {
    const diagram: Diagram = {
      ...heroDiagram,
      edges: [
        {
          from: "request",
          to: "nowhere",
          kind: "flow",
          points: [
            [120, 56],
            [120, 80],
          ],
        },
      ],
    };
    expect(diagramViolations(diagram).join("\n")).toMatch(
      /unknown node nowhere/,
    );
  });

  it("rejects a viewBox wider than 400 and an off-grid coordinate", () => {
    expect(
      diagramViolations({ ...heroDiagram, viewBox: { w: 408, h: 440 } }),
    ).toContain("viewBox is 408 wide (max 400)");
    expect(diagramViolations(withNode("log", { x: 13 })).join("\n")).toMatch(
      /13 is off the 8-unit grid/,
    );
  });

  it("rejects a part that leaves its parent and an unknown step", () => {
    expect(
      diagramViolations(withNode("model", { x: 8, w: 200 })).join("\n"),
    ).toMatch(/not inside its parent agent/);
    expect(
      diagramViolations(withNode("log", { step: "nope" })).join("\n"),
    ).toMatch(/unknown step nope/);
  });

  it("rejects a packet on a diagram that does not animate", () => {
    expect(
      diagramViolations({ ...heroDiagram, animated: false }).join("\n"),
    ).toMatch(/packet needs an animated diagram/);
  });

  it("throws, naming the diagram, from assertValidDiagram", () => {
    expect(() => {
      assertValidDiagram(withNode("docs", { y: 96 }));
    }).toThrow(/Diagram "hero"/);
  });
});

describe("segmentLengths", () => {
  it("measures each orthogonal segment of the packet route", () => {
    expect(segmentLengths(heroDiagram.packet ?? [])).toEqual([24, 128, 24]);
    expect(
      segmentLengths([
        [0, 0],
        [10, 0],
        [10, 5],
      ]),
    ).toEqual([10, 5]);
  });
});
