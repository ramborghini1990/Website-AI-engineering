import type { Diagram } from "./types";

/**
 * One diagram per service page (docs/DESIGN.md §7.1). Each draws only what that
 * service's page (content/services, both languages) already says; the source
 * sentence of every node is named in the comment above it. They do not animate:
 * they sit beside the page's text, not in a hero.
 *
 * Layout shared by all four: viewBox 400 wide, a main column at x 16 and a side
 * column at x 224 (160 wide), every coordinate on the 8-unit grid. A numbered
 * label needs about 12 + 9 x (3 + characters) units (see i18n.test.ts).
 */

/** The four services, in the order of `order` in their frontmatter. */
export const SERVICE_SLUGS = [
  "ai-agents",
  "workflow-automation",
  "web-applications",
  "document-intelligence",
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];

/** Narrows a slug from the content collection (a plain string) to one that has a diagram. */
export const isServiceSlug = (slug: string): slug is ServiceSlug =>
  (SERVICE_SLUGS as readonly string[]).includes(slug);

/**
 * ai-agents.mdx: the agent gets only the tools and data it needs, with limited
 * permissions; a person approves at critical steps; every action is logged;
 * it is evaluated on test cases and its quality and costs are followed.
 */
const aiAgents: Diagram = {
  id: "ai-agents",
  viewBox: { w: 400, h: 432 },
  animated: false,
  steps: ["request", "agent", "sources", "review", "act", "evaluate"],
  nodes: [
    {
      id: "request",
      labelKey: "nodes.request",
      x: 16,
      y: 16,
      w: 192,
      h: 40,
      tone: "neutral",
      step: "request",
    },
    {
      id: "permissions",
      labelKey: "nodes.permissions",
      x: 16,
      y: 80,
      w: 192,
      h: 112,
      tone: "boundary",
    },
    {
      id: "agent",
      labelKey: "nodes.agent",
      x: 32,
      y: 112,
      w: 160,
      h: 64,
      tone: "strong",
      step: "agent",
      parent: "permissions",
    },
    {
      id: "tools",
      labelKey: "nodes.tools",
      x: 224,
      y: 96,
      w: 160,
      h: 40,
      tone: "data",
      step: "sources",
    },
    {
      id: "data",
      labelKey: "nodes.data",
      x: 224,
      y: 152,
      w: 160,
      h: 40,
      tone: "data",
      step: "sources",
    },
    {
      id: "review",
      labelKey: "nodes.review",
      subKey: "nodes.person",
      x: 16,
      y: 216,
      w: 192,
      h: 56,
      tone: "human",
      step: "review",
    },
    {
      id: "action",
      labelKey: "nodes.action",
      subKey: "nodes.done",
      x: 16,
      y: 296,
      w: 192,
      h: 56,
      tone: "output",
      step: "act",
    },
    {
      id: "log",
      labelKey: "nodes.log",
      x: 16,
      y: 376,
      w: 192,
      h: 40,
      tone: "neutral",
      step: "act",
    },
    {
      id: "tests",
      labelKey: "nodes.tests",
      x: 224,
      y: 232,
      w: 160,
      h: 40,
      tone: "neutral",
      step: "evaluate",
    },
    {
      id: "quality",
      labelKey: "nodes.quality",
      x: 224,
      y: 296,
      w: 160,
      h: 40,
      tone: "neutral",
      step: "evaluate",
    },
  ],
  edges: [
    {
      from: "request",
      to: "agent",
      kind: "flow",
      points: [
        [112, 56],
        [112, 112],
      ],
    },
    {
      from: "agent",
      to: "review",
      kind: "flow",
      points: [
        [112, 176],
        [112, 216],
      ],
    },
    {
      from: "review",
      to: "action",
      kind: "flow",
      points: [
        [112, 272],
        [112, 296],
      ],
    },
    {
      from: "action",
      to: "log",
      kind: "flow",
      points: [
        [112, 352],
        [112, 376],
      ],
    },
    {
      from: "agent",
      to: "tools",
      kind: "data",
      points: [
        [192, 120],
        [224, 120],
      ],
    },
    {
      from: "agent",
      to: "data",
      kind: "data",
      points: [
        [192, 168],
        [224, 168],
      ],
    },
    {
      from: "tests",
      to: "quality",
      kind: "feedback",
      points: [
        [304, 272],
        [304, 296],
      ],
    },
  ],
};

/**
 * workflow-automation.mdx: checks that prevent duplicate operations; clear
 * rules mean a traditional flow, AI only for messy data or free text; retries;
 * a log of every run; alerts when a person needs to step in.
 */
const workflowAutomation: Diagram = {
  id: "workflow-automation",
  viewBox: { w: 400, h: 328 },
  animated: false,
  steps: ["trigger", "check", "rule", "write", "exception", "log"],
  nodes: [
    {
      id: "trigger",
      labelKey: "nodes.trigger",
      x: 16,
      y: 16,
      w: 176,
      h: 40,
      tone: "neutral",
      step: "trigger",
    },
    {
      id: "check",
      labelKey: "nodes.check",
      x: 16,
      y: 80,
      w: 176,
      h: 40,
      tone: "neutral",
      step: "check",
    },
    {
      id: "rule",
      labelKey: "nodes.rule",
      x: 16,
      y: 144,
      w: 176,
      h: 40,
      tone: "strong",
      step: "rule",
    },
    {
      id: "write",
      labelKey: "nodes.write",
      x: 16,
      y: 208,
      w: 176,
      h: 40,
      tone: "neutral",
      step: "write",
    },
    {
      id: "log",
      labelKey: "nodes.log",
      x: 16,
      y: 272,
      w: 176,
      h: 40,
      tone: "neutral",
      step: "log",
    },
    {
      id: "exception",
      labelKey: "nodes.exception",
      subKey: "nodes.person",
      x: 224,
      y: 136,
      w: 160,
      h: 56,
      tone: "human",
      step: "exception",
    },
    {
      id: "retry",
      labelKey: "nodes.retry",
      x: 224,
      y: 216,
      w: 160,
      h: 40,
      tone: "neutral",
      step: "write",
    },
  ],
  edges: [
    {
      from: "trigger",
      to: "check",
      kind: "flow",
      points: [
        [104, 56],
        [104, 80],
      ],
    },
    {
      from: "check",
      to: "rule",
      kind: "flow",
      points: [
        [104, 120],
        [104, 144],
      ],
    },
    {
      from: "rule",
      to: "write",
      kind: "flow",
      points: [
        [104, 184],
        [104, 208],
      ],
    },
    {
      from: "write",
      to: "log",
      kind: "flow",
      points: [
        [104, 248],
        [104, 272],
      ],
    },
    {
      from: "rule",
      to: "exception",
      kind: "flow",
      points: [
        [192, 164],
        [224, 164],
      ],
    },
    {
      from: "write",
      to: "retry",
      kind: "feedback",
      points: [
        [192, 236],
        [224, 236],
      ],
    },
  ],
};

/**
 * web-applications.mdx: complete applications from interface to data in one
 * codebase, TypeScript and Next.js, used well from phone and computer;
 * automated tests, WCAG 2.2 AA checks and speed measurements are part of the
 * work, then a clear release procedure. PostgreSQL is the data store named in
 * the service's technologies.
 */
const webApplications: Diagram = {
  id: "web-applications",
  viewBox: { w: 400, h: 296 },
  animated: false,
  steps: ["user", "interface", "app", "data", "quality"],
  nodes: [
    {
      id: "user",
      labelKey: "nodes.user",
      subKey: "nodes.devices",
      x: 16,
      y: 16,
      w: 176,
      h: 56,
      tone: "human",
      step: "user",
    },
    {
      id: "interface",
      labelKey: "nodes.interface",
      x: 16,
      y: 96,
      w: 176,
      h: 40,
      tone: "neutral",
      step: "interface",
    },
    {
      id: "app",
      labelKey: "nodes.app",
      subKey: "nodes.language",
      x: 16,
      y: 160,
      w: 176,
      h: 56,
      tone: "strong",
      step: "app",
    },
    {
      id: "database",
      labelKey: "nodes.database",
      x: 16,
      y: 240,
      w: 176,
      h: 40,
      tone: "data",
      step: "data",
    },
    {
      id: "tests",
      labelKey: "nodes.tests",
      x: 224,
      y: 16,
      w: 160,
      h: 40,
      tone: "neutral",
      step: "quality",
    },
    {
      id: "accessibility",
      labelKey: "nodes.accessibility",
      x: 224,
      y: 80,
      w: 160,
      h: 40,
      tone: "neutral",
      step: "quality",
    },
    {
      id: "speed",
      labelKey: "nodes.speed",
      x: 224,
      y: 144,
      w: 160,
      h: 40,
      tone: "neutral",
      step: "quality",
    },
    {
      id: "release",
      labelKey: "nodes.release",
      x: 224,
      y: 208,
      w: 160,
      h: 40,
      tone: "output",
      step: "quality",
    },
  ],
  edges: [
    {
      from: "user",
      to: "interface",
      kind: "flow",
      points: [
        [104, 72],
        [104, 96],
      ],
    },
    {
      from: "interface",
      to: "app",
      kind: "flow",
      points: [
        [104, 136],
        [104, 160],
      ],
    },
    {
      from: "app",
      to: "database",
      kind: "data",
      points: [
        [104, 216],
        [104, 240],
      ],
    },
    {
      from: "tests",
      to: "accessibility",
      kind: "flow",
      points: [
        [304, 56],
        [304, 80],
      ],
    },
    {
      from: "accessibility",
      to: "speed",
      kind: "flow",
      points: [
        [304, 120],
        [304, 144],
      ],
    },
    {
      from: "speed",
      to: "release",
      kind: "flow",
      points: [
        [304, 184],
        [304, 208],
      ],
    },
  ],
};

/**
 * document-intelligence.mdx: documents are read and their fields extracted;
 * the data is checked against defined rules and formats; uncertain cases go to
 * a person through a review interface; answers point to the passage of the
 * document they come from.
 */
const documentIntelligence: Diagram = {
  id: "document-intelligence",
  viewBox: { w: 400, h: 384 },
  animated: false,
  steps: ["documents", "extract", "check", "review", "data", "ask"],
  nodes: [
    {
      id: "documents",
      labelKey: "nodes.documents",
      x: 16,
      y: 16,
      w: 176,
      h: 40,
      tone: "data",
      step: "documents",
    },
    {
      id: "extract",
      labelKey: "nodes.extract",
      x: 16,
      y: 80,
      w: 176,
      h: 40,
      tone: "neutral",
      step: "extract",
    },
    {
      id: "check",
      labelKey: "nodes.check",
      x: 16,
      y: 144,
      w: 176,
      h: 40,
      tone: "strong",
      step: "check",
    },
    {
      id: "review",
      labelKey: "nodes.review",
      subKey: "nodes.person",
      x: 224,
      y: 136,
      w: 160,
      h: 56,
      tone: "human",
      step: "review",
    },
    {
      id: "structured",
      labelKey: "nodes.structured",
      subKey: "nodes.structuredSub",
      x: 16,
      y: 232,
      w: 176,
      h: 56,
      tone: "output",
      step: "data",
    },
    {
      id: "question",
      labelKey: "nodes.question",
      x: 16,
      y: 320,
      w: 176,
      h: 40,
      tone: "neutral",
      step: "ask",
    },
    {
      id: "answer",
      labelKey: "nodes.answer",
      subKey: "nodes.source",
      x: 224,
      y: 312,
      w: 160,
      h: 56,
      tone: "output",
      step: "ask",
    },
  ],
  edges: [
    {
      from: "documents",
      to: "extract",
      kind: "flow",
      points: [
        [104, 56],
        [104, 80],
      ],
    },
    {
      from: "extract",
      to: "check",
      kind: "flow",
      points: [
        [104, 120],
        [104, 144],
      ],
    },
    {
      from: "check",
      to: "structured",
      kind: "flow",
      points: [
        [104, 184],
        [104, 232],
      ],
    },
    {
      from: "check",
      to: "review",
      kind: "flow",
      points: [
        [192, 164],
        [224, 164],
      ],
    },
    {
      from: "review",
      to: "structured",
      kind: "flow",
      points: [
        [304, 192],
        [304, 260],
        [192, 260],
      ],
    },
    {
      from: "question",
      to: "answer",
      kind: "flow",
      points: [
        [192, 340],
        [224, 340],
      ],
    },
  ],
};

export const serviceDiagrams: Record<ServiceSlug, Diagram> = {
  "ai-agents": aiAgents,
  "workflow-automation": workflowAutomation,
  "web-applications": webApplications,
  "document-intelligence": documentIntelligence,
};
