import type { DemoEngine } from "@/lib/demos/types";
import type { Prospect } from "@/lib/demos/linkedin/fixtures";
import { qualify, type Qualification } from "@/lib/demos/linkedin/qualify";

type EngineStep = { id: string; research: Qualification };

/**
 * The simulation engine of the LinkedIn outreach demo (`DemoEngine`, P3.2). It
 * streams one research step per prospect, in order, so the page can show the
 * agent working through the list. Deterministic: the same prospects always give
 * the same steps. No network, no model, no cost, and no platform is contacted:
 * the prospects are the invented ones in `fixtures.ts`.
 */
export const linkedinEngine: DemoEngine<
  { prospects: readonly Prospect[] },
  EngineStep
> = {
  id: "linkedin-agent",
  mode: "simulation",
  async *run({ prospects }) {
    for (const prospect of prospects) {
      // A real agent would await an approved data source and a model here; the yield keeps the same shape.
      await Promise.resolve();
      yield { id: prospect.id, research: qualify(prospect) };
    }
  },
};
