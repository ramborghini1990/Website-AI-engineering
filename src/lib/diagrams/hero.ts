import type { Diagram } from "./types";

/**
 * Home hero: how one of the agents described in the ai-agents service page
 * (content/services, both languages) works. A request comes in, the agent reasons with a model and rules, reads its
 * tools and documents, a person approves at the critical step, the action runs
 * and is logged. Nothing here goes beyond what that page already says.
 *
 * Coordinates sit on the 8-unit grid inside a 400 x 440 viewBox. The flow runs
 * down the left column (x 16-216); tools and documents sit to its right and are
 * read by the agent through dashed data edges.
 */
export const heroDiagram: Diagram = {
  id: "hero",
  viewBox: { w: 400, h: 440 },
  animated: true,
  steps: ["request", "reason", "tools", "review", "act"],
  nodes: [
    {
      id: "request",
      labelKey: "nodes.request",
      x: 16,
      y: 16,
      w: 200,
      h: 40,
      tone: "neutral",
      step: "request",
    },
    {
      id: "agent",
      labelKey: "nodes.agent",
      x: 16,
      y: 80,
      w: 200,
      h: 128,
      tone: "strong",
      step: "reason",
    },
    {
      id: "model",
      labelKey: "nodes.model",
      x: 24,
      y: 112,
      w: 184,
      h: 40,
      tone: "muted",
      step: "reason",
      parent: "agent",
    },
    {
      id: "rules",
      labelKey: "nodes.rules",
      x: 24,
      y: 160,
      w: 184,
      h: 40,
      tone: "muted",
      step: "reason",
      parent: "agent",
    },
    {
      id: "tools",
      labelKey: "nodes.tools",
      x: 256,
      y: 96,
      w: 128,
      h: 40,
      tone: "data",
      step: "tools",
    },
    {
      id: "docs",
      labelKey: "nodes.docs",
      x: 256,
      y: 152,
      w: 128,
      h: 40,
      tone: "data",
      step: "tools",
    },
    {
      id: "review",
      labelKey: "nodes.review",
      subKey: "nodes.person",
      x: 16,
      y: 232,
      w: 200,
      h: 56,
      tone: "human",
      step: "review",
    },
    {
      id: "action",
      labelKey: "nodes.action",
      subKey: "nodes.done",
      x: 16,
      y: 312,
      w: 200,
      h: 56,
      tone: "output",
      step: "act",
    },
    {
      id: "log",
      labelKey: "nodes.log",
      x: 16,
      y: 392,
      w: 200,
      h: 40,
      tone: "neutral",
      step: "act",
    },
  ],
  edges: [
    {
      from: "request",
      to: "agent",
      kind: "flow",
      points: [
        [120, 56],
        [120, 80],
      ],
    },
    {
      from: "agent",
      to: "review",
      kind: "flow",
      points: [
        [120, 208],
        [120, 232],
      ],
    },
    {
      from: "review",
      to: "action",
      kind: "flow",
      points: [
        [120, 288],
        [120, 312],
      ],
    },
    {
      from: "action",
      to: "log",
      kind: "flow",
      points: [
        [120, 368],
        [120, 392],
      ],
    },
    {
      from: "agent",
      to: "tools",
      kind: "data",
      points: [
        [216, 112],
        [256, 112],
      ],
    },
    {
      from: "agent",
      to: "docs",
      kind: "data",
      points: [
        [216, 168],
        [256, 168],
      ],
    },
  ],
  // The packet runs request -> agent -> review and stays parked on "review":
  // the agent prepares, a person approves (content/services: ai-agents.mdx).
  packet: [
    [120, 56],
    [120, 80],
    [120, 208],
    [120, 232],
  ],
};
