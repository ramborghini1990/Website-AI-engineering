import type { Analysis, Kind, SourceId } from "@/lib/demos/instagram/analyze";

/**
 * A reply draft, built from sentences of the knowledge base only. Each answer
 * sentence carries the source it came from; there is no free text the agent
 * could invent. Nothing to draft (spam, or a request that needs a person) gives
 * `null`. The words themselves are passed in (they live in the messages), so
 * this stays pure and the same in both languages.
 */

export type Sentence = { text: string; source?: SourceId };

export type DraftWords = {
  greeting: string;
  closing: string;
  lead: string;
  supportAsk: string;
  answer: (source: SourceId) => string;
};

export function draftSentences(
  input: { kind: Kind; analysis: Analysis },
  words: DraftWords,
): Sentence[] | null {
  const { analysis } = input;
  if (analysis.action === "hide-report" || analysis.action === "escalate")
    return null;

  const sentences: Sentence[] = [{ text: words.greeting }];
  if (analysis.category === "support") {
    sentences.push({ text: words.supportAsk });
  }
  for (const source of analysis.sources) {
    sentences.push({ text: words.answer(source), source });
  }
  if (analysis.category === "lead") {
    sentences.push({ text: words.lead });
  }
  sentences.push({ text: words.closing });
  return sentences;
}

export const draftText = (sentences: readonly Sentence[]) =>
  sentences.map((sentence) => sentence.text).join(" ");
