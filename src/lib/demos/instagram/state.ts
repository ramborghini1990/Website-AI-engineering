import type { Action, Analysis } from "@/lib/demos/instagram/analyze";
import type { InboxItem } from "@/lib/demos/instagram/engine";

/**
 * The state of the demo as a pure reducer, so the rules that matter are tested
 * without a browser. The rule that matters most: NOTHING HAPPENS WITHOUT A
 * DECISION. An item can only be decided after it was analysed, only once, and
 * "approved" is the only way an action counts as done. There is no path from
 * "analysed" to "done" that skips the person (the same promise as the approval
 * gate of the LinkedIn demo, P3.2).
 */

export type Decision = "approved" | "rejected";
export type Filter = "all" | "dm" | "comment";
type Phase = "idle" | "running" | "done";

export type ItemState = InboxItem & {
  analysis: Analysis | null;
  /** The draft the person may edit; null when there is nothing to draft. */
  draft: string | null;
  decision: Decision | null;
};

export type State = {
  items: ItemState[];
  selectedId: string | null;
  filter: Filter;
  phase: Phase;
};

export type DemoAction =
  | { type: "start" }
  | { type: "analyzed"; id: string; analysis: Analysis; draft: string | null }
  | { type: "finish" }
  | { type: "select"; id: string }
  | { type: "filter"; filter: Filter }
  | { type: "edit"; id: string; draft: string }
  | { type: "decide"; id: string; decision: Decision }
  | { type: "add"; item: ItemState }
  | { type: "reset"; items: readonly InboxItem[] };

export function initialState(items: readonly InboxItem[]): State {
  return {
    items: items.map((item) => ({
      ...item,
      analysis: null,
      draft: null,
      decision: null,
    })),
    selectedId: items[0]?.id ?? null,
    filter: "all",
    phase: "idle",
  };
}

const update = (
  state: State,
  id: string,
  change: (item: ItemState) => ItemState,
): State => ({
  ...state,
  items: state.items.map((item) => (item.id === id ? change(item) : item)),
});

export function reducer(state: State, action: DemoAction): State {
  switch (action.type) {
    case "start":
      return state.phase === "running" ? state : { ...state, phase: "running" };
    case "analyzed":
      return update(state, action.id, (item) =>
        item.analysis !== null
          ? item
          : { ...item, analysis: action.analysis, draft: action.draft },
      );
    case "finish":
      return { ...state, phase: "done" };
    case "select":
      return state.items.some((item) => item.id === action.id)
        ? { ...state, selectedId: action.id }
        : state;
    case "filter":
      return { ...state, filter: action.filter };
    case "edit":
      return update(state, action.id, (item) =>
        // Only a draft that exists, and only before a decision.
        item.draft === null || item.decision !== null
          ? item
          : { ...item, draft: action.draft },
      );
    case "decide":
      return update(state, action.id, (item) =>
        item.analysis === null || item.decision !== null
          ? item
          : { ...item, decision: action.decision },
      );
    case "add":
      return {
        ...state,
        items: [action.item, ...state.items],
        selectedId: action.item.id,
        filter: "all",
      };
    case "reset":
      return initialState(action.items);
  }
}

/** The action an item shows as done, or null while it is waiting, undecided or discarded. */
export function doneAction(item: ItemState): Action | null {
  return item.decision === "approved" && item.analysis !== null
    ? item.analysis.action
    : null;
}

export type Statistics = {
  total: number;
  analysed: number;
  leads: number;
  pending: number;
};

export function statistics(state: State): Statistics {
  const analysed = state.items.filter((item) => item.analysis !== null);
  return {
    total: state.items.length,
    analysed: analysed.length,
    leads: analysed.filter((item) => item.analysis?.category === "lead").length,
    pending: analysed.filter((item) => item.decision === null).length,
  };
}
