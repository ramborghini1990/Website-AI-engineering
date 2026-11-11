import type { InteractiveDemo } from "@/lib/demos/registry";

/**
 * The whole vocabulary of the demo analytics (P3.5, decision D6: cookieless,
 * first party). An event says WHAT happened in WHICH demo and nothing else: no
 * visitor id, no session id, no timestamp from the browser, no referrer, no
 * path, no text. The strict Zod schema that enforces this lives in
 * `event-schema.ts`, server side only: this file is imported by the browser, and
 * Zod must not be (it probes `new Function`, which the CSP reports as a
 * violation).
 *
 * - `demo_started`: the visitor's first click inside the demo.
 * - `demo_completed`: the demo's own "done" moment (an action the person
 *   approved, a question answered, a sale or order booked); see each demo.
 * - `cta_clicked`: the call to action under the demo (into the inquiry form).
 */
export const demoEventNames = [
  "demo_started",
  "demo_completed",
  "cta_clicked",
] as const;
export type DemoEventName = (typeof demoEventNames)[number];

export type DemoEvent = {
  event: DemoEventName;
  /** The work page the demo sits on (its slug), from the registry. */
  demo: InteractiveDemo;
};

/** Where the browser reports events: same origin, never a third party. */
export const DEMO_EVENTS_PATH = "/api/demo-events";
