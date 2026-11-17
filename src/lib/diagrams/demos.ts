import type { InteractiveDemo } from "@/lib/demos/registry";
import type {
  Diagram,
  DiagramEdge,
  DiagramNode,
  DiagramTone,
  Point,
} from "./types";

/**
 * "How this demo works", one static diagram per interactive demo (docs/DESIGN.md
 * §7.1). Each draws only what the demo's page says under "Che cosa mostra" /
 * "Controllo umano" (content/work, both languages); the sentence behind every
 * step is the legend text in messages (`diagrams.demos.<slug>.steps`).
 *
 * Shared layout: viewBox 400 wide, a main column at x 16 (200 wide) and a side
 * column at x 232 (152 wide), every coordinate on the 8-unit grid.
 */

function node(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  tone: DiagramTone,
  extra: Partial<DiagramNode> = {},
): DiagramNode {
  return { id, labelKey: `nodes.${id}`, x, y, w, h, tone, ...extra };
}

const edge = (
  from: string,
  to: string,
  kind: DiagramEdge["kind"],
  ...points: Point[]
): DiagramEdge => ({ from, to, kind, points });

/**
 * instagram-lead-agent: the agent sorts each message (information request,
 * sales interest, support, spam), scores the contacts and drafts a reply; a
 * person approves, and qualified contacts move on.
 */
const instagram: Diagram = {
  id: "instagram-lead-agent",
  viewBox: { w: 400, h: 344 },
  animated: false,
  steps: ["inbox", "classify", "score", "draft", "review"],
  nodes: [
    node("messages", 16, 16, 200, 40, "neutral", { step: "inbox" }),
    node("classify", 16, 80, 200, 40, "strong", { step: "classify" }),
    node("score", 16, 144, 200, 40, "neutral", { step: "score" }),
    node("draft", 16, 208, 200, 40, "neutral", { step: "draft" }),
    node("review", 16, 272, 200, 56, "human", {
      step: "review",
      subKey: "nodes.person",
    }),
    node("information", 232, 16, 152, 32, "neutral"),
    node("interest", 232, 56, 152, 32, "neutral"),
    node("support", 232, 96, 152, 32, "neutral"),
    node("spam", 232, 136, 152, 32, "neutral"),
  ],
  edges: [
    edge("messages", "classify", "flow", [116, 56], [116, 80]),
    edge("classify", "score", "flow", [116, 120], [116, 144]),
    edge("score", "draft", "flow", [116, 184], [116, 208]),
    edge("draft", "review", "flow", [116, 248], [116, 272]),
    edge(
      "classify",
      "information",
      "data",
      [216, 100],
      [224, 100],
      [224, 32],
      [232, 32],
    ),
    edge(
      "classify",
      "interest",
      "data",
      [216, 100],
      [224, 100],
      [224, 72],
      [232, 72],
    ),
    edge(
      "classify",
      "support",
      "data",
      [216, 100],
      [224, 100],
      [224, 112],
      [232, 112],
    ),
    edge(
      "classify",
      "spam",
      "data",
      [216, 100],
      [224, 100],
      [224, 152],
      [232, 152],
    ),
  ],
};

/**
 * linkedin-assisted-outreach: for each invented prospect the assistant writes a
 * research summary, rates the fit with the ideal customer (and says who should
 * not be contacted), drafts a first message where contact makes sense; a
 * person reads, edits and approves it, one prospect at a time, and only then
 * does it show as scheduled.
 */
const linkedin: Diagram = {
  id: "linkedin-assisted-outreach",
  viewBox: { w: 400, h: 424 },
  animated: false,
  steps: ["prospects", "research", "fit", "draft", "approval"],
  nodes: [
    node("prospects", 16, 16, 200, 40, "data", { step: "prospects" }),
    node("research", 16, 80, 200, 40, "neutral", { step: "research" }),
    node("fit", 16, 144, 200, 40, "strong", { step: "fit" }),
    node("draft", 16, 208, 200, 40, "neutral", { step: "draft" }),
    node("approval", 16, 272, 200, 56, "human", {
      step: "approval",
      subKey: "nodes.person",
    }),
    node("scheduled", 16, 352, 200, 56, "output", {
      step: "approval",
      subKey: "nodes.afterApproval",
    }),
    node("skip", 232, 144, 152, 40, "neutral"),
  ],
  edges: [
    edge("prospects", "research", "flow", [116, 56], [116, 80]),
    edge("research", "fit", "flow", [116, 120], [116, 144]),
    edge("fit", "draft", "flow", [116, 184], [116, 208]),
    edge("draft", "approval", "flow", [116, 248], [116, 272]),
    edge("approval", "scheduled", "flow", [116, 328], [116, 352]),
    edge("fit", "skip", "flow", [216, 164], [232, 164]),
  ],
};

/**
 * document-intelligence-demo: three invented documents; each yields structured
 * fields with the words they were read from; doubtful values stay flagged until
 * a person marks them checked; a picked question gets an answer citing the
 * sentence, page and section.
 */
const docintel: Diagram = {
  id: "document-intelligence-demo",
  viewBox: { w: 400, h: 280 },
  animated: false,
  steps: ["docs", "fields", "review", "ask"],
  nodes: [
    node("docs", 16, 16, 200, 40, "data", { step: "docs" }),
    node("fields", 16, 80, 200, 40, "strong", { step: "fields" }),
    node("review", 232, 72, 152, 56, "human", {
      step: "review",
      subKey: "nodes.person",
    }),
    node("question", 16, 144, 200, 40, "neutral", { step: "ask" }),
    node("answer", 16, 208, 200, 56, "output", {
      step: "ask",
      subKey: "nodes.citation",
    }),
  ],
  edges: [
    edge("docs", "fields", "flow", [116, 56], [116, 80]),
    edge("fields", "question", "flow", [116, 120], [116, 144]),
    edge("question", "answer", "flow", [116, 184], [116, 208]),
    edge("fields", "review", "flow", [216, 100], [232, 100]),
  ],
};

/**
 * business-management-app: the sample shop is generated in the page from a
 * fixed seed; the till, the cash-flow dashboard and the purchase orders work on
 * the same data; changes stay in this browser's own storage and nowhere else.
 */
const business: Diagram = {
  id: "business-management-app",
  viewBox: { w: 400, h: 296 },
  animated: false,
  steps: ["seed", "till", "dashboard", "orders", "store"],
  nodes: [
    node("browser", 16, 16, 368, 264, "boundary"),
    node("seed", 32, 48, 336, 40, "neutral", {
      step: "seed",
      parent: "browser",
    }),
    node("till", 32, 112, 200, 40, "neutral", {
      step: "till",
      parent: "browser",
    }),
    node("dashboard", 32, 168, 200, 40, "neutral", {
      step: "dashboard",
      parent: "browser",
    }),
    node("orders", 32, 224, 200, 40, "neutral", {
      step: "orders",
      parent: "browser",
    }),
    node("storage", 248, 168, 120, 40, "data", {
      step: "store",
      parent: "browser",
    }),
  ],
  edges: [
    edge("seed", "storage", "flow", [308, 88], [308, 168]),
    edge(
      "till",
      "storage",
      "data",
      [232, 132],
      [240, 132],
      [240, 180],
      [248, 180],
    ),
    edge("dashboard", "storage", "data", [232, 188], [248, 188]),
    edge(
      "orders",
      "storage",
      "data",
      [232, 244],
      [240, 244],
      [240, 196],
      [248, 196],
    ),
  ],
};

export const demoDiagrams: Record<InteractiveDemo, Diagram> = {
  "instagram-lead-agent": instagram,
  "linkedin-assisted-outreach": linkedin,
  "document-intelligence-demo": docintel,
  "business-management-app": business,
};
