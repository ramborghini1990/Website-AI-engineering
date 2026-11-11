import type { DemoEngine } from "@/lib/demos/types";
import { seedParts, type SeedPart } from "@/lib/demos/business/fixtures";

/**
 * The simulation engine of the back-office demo (`DemoEngine`, P3.4). It
 * streams the sample business one collection at a time (stock, sales,
 * expenses, orders), which is how "start over" rebuilds it. Deterministic: the
 * same seed always gives the same business. No network, no model: the data is
 * generated here from a fixed seed, and the visitor's own changes stay in the
 * browser (see `storage.ts`).
 */
export const businessEngine: DemoEngine<Record<string, never>, SeedPart> = {
  id: "business-suite",
  mode: "simulation",
  async *run() {
    for (const part of seedParts()) {
      await Promise.resolve();
      yield part;
    }
  },
};
