import type { FieldResult } from "@/lib/demos/docintel/extract";
import {
  documentIds,
  documents,
  type DocumentId,
} from "@/lib/demos/docintel/fixtures";

/**
 * The state of the demo as a pure reducer, so the rules that matter are tested
 * without a browser:
 *  - a question can only be asked once the document was read (answers are built
 *    from the extracted fields), and only one of that document's own questions;
 *  - only a field flagged for review can be marked as checked;
 *  - there is no action that takes a file or free text: the visitor can only
 *    choose among the bundled documents and their questions.
 */

type Phase = "idle" | "running" | "done";

export type DocState = {
  phase: Phase;
  results: FieldResult[];
  /** Flagged fields the person marked as checked against the document. */
  checked: string[];
};

export type State = {
  current: DocumentId;
  docs: Record<DocumentId, DocState>;
  question: string | null;
  /** The section the visitor was last pointed to (by a source or a citation). */
  focus: string | null;
};

export type DemoAction =
  | { type: "select-doc"; id: DocumentId }
  | { type: "start" }
  | { type: "field"; result: FieldResult }
  | { type: "finish" }
  | { type: "ask"; question: string }
  | { type: "focus"; section: string | null }
  | { type: "check"; field: string; checked: boolean }
  | { type: "reset" };

const emptyDoc = (): DocState => ({ phase: "idle", results: [], checked: [] });

export function initialState(): State {
  return {
    current: documentIds[0],
    docs: {
      invoice: emptyDoc(),
      contract: emptyDoc(),
      ddt: emptyDoc(),
    },
    question: null,
    focus: null,
  };
}

const setCurrent = (
  state: State,
  change: (doc: DocState) => DocState,
): State => ({
  ...state,
  docs: { ...state.docs, [state.current]: change(state.docs[state.current]) },
});

export function reducer(state: State, action: DemoAction): State {
  switch (action.type) {
    case "select-doc": {
      if (!documentIds.includes(action.id) || action.id === state.current) {
        return state;
      }
      // Leaving a document mid-read abandons that read: it starts over next time.
      const leaving = state.docs[state.current];
      return {
        ...state,
        current: action.id,
        docs: {
          ...state.docs,
          [state.current]: leaving.phase === "running" ? emptyDoc() : leaving,
        },
        question: null,
        focus: null,
      };
    }
    case "start":
      return setCurrent(state, (doc) =>
        doc.phase === "idle" ? { ...doc, phase: "running" } : doc,
      );
    case "field":
      return setCurrent(state, (doc) =>
        doc.phase !== "running" ||
        doc.results.some((r) => r.id === action.result.id)
          ? doc
          : { ...doc, results: [...doc.results, action.result] },
      );
    case "finish":
      return setCurrent(state, (doc) =>
        doc.phase === "running" ? { ...doc, phase: "done" } : doc,
      );
    case "ask": {
      const known = documents[state.current].questions.some(
        (q) => q.id === action.question,
      );
      return known && state.docs[state.current].phase === "done"
        ? { ...state, question: action.question, focus: null }
        : state;
    }
    case "focus": {
      const known =
        action.section === null ||
        documents[state.current].sections.some((s) => s.id === action.section);
      return known ? { ...state, focus: action.section } : state;
    }
    case "check":
      return setCurrent(state, (doc) => {
        const flagged = doc.results.some(
          (r) => r.id === action.field && r.status === "review",
        );
        if (!flagged) return doc;
        const rest = doc.checked.filter((id) => id !== action.field);
        return {
          ...doc,
          checked: action.checked ? [...rest, action.field] : rest,
        };
      });
    case "reset":
      return initialState();
  }
}

export const currentDoc = (state: State): DocState => state.docs[state.current];
