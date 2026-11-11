import { MAX_DRAFT_LENGTH } from "@/lib/demos/linkedin/draft";
import type { Prospect } from "@/lib/demos/linkedin/fixtures";
import type { Qualification } from "@/lib/demos/linkedin/qualify";

/**
 * The state of the demo as a pure reducer, so the rule that matters is tested
 * without a browser: A MESSAGE CANNOT BE SCHEDULED WITHOUT A PERSON'S APPROVAL.
 * The only path to "scheduled" is `approve`, and `approve` is refused unless the
 * prospect was researched, has a draft that is not empty, was not decided yet,
 * and the person confirmed they read THIS text: editing the draft takes the
 * confirmation back. `approve` names one prospect; there is no action that
 * approves several, and nothing schedules by itself.
 */

type Decision = "scheduled" | "discarded";
type Phase = "idle" | "running" | "done";

export type ItemState = Prospect & {
  research: Qualification | null;
  /** The message the person may edit; null when there is nothing to write. */
  draft: string | null;
  /** The person confirmed they read the draft as it is now. */
  reviewed: boolean;
  decision: Decision | null;
  /** 1-based order in the schedule, set when (and only when) the person approves. */
  slot: number | null;
};

export type State = {
  items: ItemState[];
  selectedId: string | null;
  phase: Phase;
};

export type DemoAction =
  | { type: "start" }
  | {
      type: "researched";
      id: string;
      research: Qualification;
      draft: string | null;
    }
  | { type: "finish" }
  | { type: "select"; id: string }
  | { type: "edit"; id: string; draft: string }
  | { type: "review"; id: string; reviewed: boolean }
  | { type: "approve"; id: string }
  | { type: "discard"; id: string }
  | { type: "reset"; prospects: readonly Prospect[] };

export function initialState(prospects: readonly Prospect[]): State {
  return {
    items: prospects.map((prospect) => ({
      ...prospect,
      research: null,
      draft: null,
      reviewed: false,
      decision: null,
      slot: null,
    })),
    selectedId: prospects[0]?.id ?? null,
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

/** A draft the person can still act on: it exists, is not blank and was not decided. */
export const isOpenDraft = (item: ItemState): boolean =>
  item.research?.verdict === "draft" &&
  item.draft !== null &&
  item.draft.trim() !== "" &&
  item.decision === null;

export function reducer(state: State, action: DemoAction): State {
  switch (action.type) {
    case "start":
      return state.phase === "running" ? state : { ...state, phase: "running" };
    case "researched":
      return update(state, action.id, (item) =>
        item.research !== null
          ? item
          : { ...item, research: action.research, draft: action.draft },
      );
    case "finish":
      return { ...state, phase: "done" };
    case "select":
      return state.items.some((item) => item.id === action.id)
        ? { ...state, selectedId: action.id }
        : state;
    case "edit":
      return update(state, action.id, (item) =>
        // Only a draft that exists, before a decision; a change takes the confirmation back.
        item.draft === null || item.decision !== null
          ? item
          : {
              ...item,
              draft: action.draft.slice(0, MAX_DRAFT_LENGTH),
              reviewed: false,
            },
      );
    case "review":
      return update(state, action.id, (item) =>
        isOpenDraft(item) ? { ...item, reviewed: action.reviewed } : item,
      );
    case "approve": {
      const scheduled = state.items.filter(
        (item) => item.decision === "scheduled",
      ).length;
      return update(state, action.id, (item) =>
        isOpenDraft(item) && item.reviewed
          ? { ...item, decision: "scheduled", slot: scheduled + 1 }
          : item,
      );
    }
    case "discard":
      return update(state, action.id, (item) =>
        item.research?.verdict === "draft" && item.decision === null
          ? { ...item, decision: "discarded", reviewed: false }
          : item,
      );
    case "reset":
      return initialState(action.prospects);
  }
}

/** Scheduled messages in the order the person approved them. */
export const scheduledItems = (state: State): ItemState[] =>
  state.items
    .filter((item) => item.decision === "scheduled")
    .sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));

export type Statistics = {
  total: number;
  researched: number;
  drafts: number;
  pending: number;
  scheduled: number;
};

export function statistics(state: State): Statistics {
  const researched = state.items.filter((item) => item.research !== null);
  return {
    total: state.items.length,
    researched: researched.length,
    drafts: researched.filter((item) => item.research?.verdict === "draft")
      .length,
    pending: researched.filter(isOpenDraft).length,
    scheduled: state.items.filter((item) => item.decision === "scheduled")
      .length,
  };
}

/** The times messages would go out: spaced out, a few per working day. */
const SLOT_TIMES = ["09:30", "11:00", "14:30"] as const;

export function slotInfo(slot: number): { day: number; time: string } {
  const index = Math.max(slot, 1) - 1;
  return {
    day: Math.floor(index / SLOT_TIMES.length) + 1,
    time: SLOT_TIMES[index % SLOT_TIMES.length] ?? SLOT_TIMES[0],
  };
}
