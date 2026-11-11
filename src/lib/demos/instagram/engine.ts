import type { DemoEngine } from "@/lib/demos/types";
import {
  analyze,
  type Analysis,
  type Kind,
} from "@/lib/demos/instagram/analyze";

export type InboxItem = {
  id: string;
  kind: Kind;
  handle: string;
  text: string;
};

export type EngineStep = { id: string; analysis: Analysis };

/**
 * The simulation engine of the Instagram demo (`DemoEngine`, P3.1). It streams
 * one step per item, in order, so the page can show the agent working through
 * the inbox. Deterministic: the same inbox always gives the same steps. No
 * network, no model, no cost (docs/BLUEPRINT.md D2: simulation is the default
 * for every visitor).
 */
export const instagramEngine: DemoEngine<
  { items: readonly InboxItem[] },
  EngineStep
> = {
  id: "instagram-agent",
  mode: "simulation",
  async *run({ items }) {
    for (const item of items) {
      // A real agent would await a model here; the yield keeps the same shape.
      await Promise.resolve();
      yield { id: item.id, analysis: analyze(item.text) };
    }
  },
};
