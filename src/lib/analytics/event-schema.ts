import "server-only";

import { z } from "zod";

import { demoEventNames, type DemoEvent } from "@/lib/analytics/events";
import { interactiveDemos } from "@/lib/demos/registry";

/**
 * What the endpoint accepts: exactly `{ event, demo }`, both from fixed lists.
 * Strict, so an extra key (an id, a text, a referrer) is refused, not stored.
 */
export const demoEventSchema: z.ZodType<DemoEvent> = z.strictObject({
  event: z.enum(demoEventNames),
  demo: z.enum(interactiveDemos),
});
