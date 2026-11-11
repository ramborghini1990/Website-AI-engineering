import type { Qualification } from "@/lib/demos/linkedin/qualify";

/**
 * A first-message draft, built from fixed sentences and the facts of the
 * research card only (the news item, or what the company does): there is no
 * free text the agent could invent, and no personal detail. Only a prospect
 * worth contacting gets one. The words are passed in (they live in the
 * messages), so this stays pure and the same in both languages. The message
 * always asks a question, never pushes, and offers to stop.
 */

/** The longest message the person can approve: a first message is short. */
export const MAX_DRAFT_LENGTH = 700;

export type DraftWords = {
  greeting: string;
  /** Built from the news when there is one, else from what the company does. */
  hook: string;
  value: string;
  ask: string;
  optOut: string;
  signOff: string;
};

export function draftMessage(
  qualification: Qualification,
  words: DraftWords,
): string | null {
  if (qualification.verdict !== "draft") return null;
  const { greeting, hook, value, ask, optOut, signOff } = words;
  return `${greeting}\n\n${hook} ${value} ${ask}\n\n${optOut}\n${signOff}`;
}
