/**
 * The contract every demo implements (docs/BLUEPRINT.md, "Demo architecture").
 * A demo can run as a simulation (scripted or rule-based, no network, no cost:
 * the default for every visitor) or, later, as a live AI call behind a budget
 * guard (P3.0, not built yet). `run` streams its steps so the page can show
 * them one at a time.
 */
type DemoId =
  "instagram-agent" | "linkedin-agent" | "doc-intel" | "business-suite";

type DemoMode = "simulation" | "live";

type DemoContext = {
  /** Random per page view, carries nothing about the visitor. */
  sessionId: string;
  locale: "it" | "en";
};

export interface DemoEngine<Input, Output> {
  readonly id: DemoId;
  readonly mode: DemoMode;
  run(input: Input, context: DemoContext): AsyncIterable<Output>;
}
