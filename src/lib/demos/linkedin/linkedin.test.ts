// @vitest-environment node
import { describe, expect, it } from "vitest";

import { draftMessage, MAX_DRAFT_LENGTH } from "@/lib/demos/linkedin/draft";
import { linkedinEngine } from "@/lib/demos/linkedin/engine";
import {
  prospectIds,
  prospects,
  type Prospect,
} from "@/lib/demos/linkedin/fixtures";
import {
  FACTOR_POINTS,
  qualify,
  type Qualification,
} from "@/lib/demos/linkedin/qualify";
import {
  initialState,
  isOpenDraft,
  reducer,
  scheduledItems,
  slotInfo,
  statistics,
  type DemoAction,
  type State,
} from "@/lib/demos/linkedin/state";
import enMessages from "../../../../messages/en.json";
import itMessages from "../../../../messages/it.json";

const byId = (id: string): Prospect => {
  const found = prospects.find((prospect) => prospect.id === id);
  if (found === undefined) throw new Error(`no prospect ${id}`);
  return found;
};

describe("qualify: fit with the ideal customer", () => {
  it("rates each sample prospect as the page promises", () => {
    const expected: Record<string, [string, number | null]> = {
      alfa: ["draft", 100],
      borgo: ["draft", 75],
      cima: ["hold", 55],
      delta: ["skip", 0],
      eco: ["blocked", null],
      fiume: ["draft", 75],
    };
    for (const prospect of prospects) {
      const { verdict, score } = qualify(prospect);
      expect([verdict, score], prospect.id).toEqual(expected[prospect.id]);
    }
  });

  it("the score is exactly the sum of the factors shown", () => {
    for (const prospect of prospects) {
      const { factors, score } = qualify(prospect);
      if (score === null) continue;
      expect(score, prospect.id).toBe(
        factors.reduce((sum, factor) => sum + FACTOR_POINTS[factor], 0),
      );
    }
    expect(Object.values(FACTOR_POINTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("a contact marked do-not-contact is blocked whatever its score would be (negative)", () => {
    const perfect: Prospect = { ...byId("alfa"), doNotContact: true };

    expect(qualify(perfect)).toEqual({
      factors: [],
      score: null,
      verdict: "blocked",
    });
  });

  it("the size range is inclusive and the role matters", () => {
    const base = byId("alfa");

    expect(qualify({ ...base, employees: 20 }).factors).toContain("size");
    expect(qualify({ ...base, employees: 500 }).factors).toContain("size");
    expect(qualify({ ...base, employees: 19 }).factors).not.toContain("size");
    expect(qualify({ ...base, employees: 501 }).factors).not.toContain("size");
    expect(qualify({ ...base, role: "marketing" }).factors).not.toContain(
      "role",
    );
  });

  it("is deterministic", () => {
    expect(prospects.map(qualify)).toEqual(prospects.map(qualify));
  });
});

describe("draftMessage", () => {
  const words = {
    greeting: "Hello Ana,",
    hook: "I read that X did Y.",
    value: "V.",
    ask: "A?",
    optOut: "Tell me to stop.",
    signOff: "Me",
  };
  const research = (verdict: Qualification["verdict"]): Qualification => ({
    factors: [],
    score: verdict === "blocked" ? null : 70,
    verdict,
  });

  it("writes a message only for a prospect worth contacting", () => {
    expect(draftMessage(research("draft"), words)).toContain("I read that");
    for (const verdict of ["hold", "skip", "blocked"] as const) {
      expect(draftMessage(research(verdict), words), verdict).toBeNull();
    }
  });

  it("always offers a way out and asks a question instead of pushing", () => {
    const text = draftMessage(research("draft"), words) ?? "";

    expect(text).toContain(words.optOut);
    expect(text).toContain(words.ask);
  });

  for (const [locale, messages] of [
    ["it", itMessages],
    ["en", enMessages],
  ] as const) {
    it(`${locale}: every drafted message in the sample fits the limit and contains no placeholder`, () => {
      const t = messages.demos.linkedin;
      for (const prospect of prospects) {
        const research = qualify(prospect);
        const item = t.items[prospect.id];
        const text = draftMessage(research, {
          greeting: t.draft.greeting.replace("{name}", item.name.split(" ")[0]),
          hook:
            prospect.news !== null
              ? t.draft.hookNews
                  .replace("{company}", item.company)
                  .replace("{signal}", t.news[prospect.news])
              : t.draft.hookAbout
                  .replace("{company}", item.company)
                  .replace("{about}", item.about),
          value: t.draft.value,
          ask: t.draft.ask,
          optOut: t.draft.optOut,
          signOff: t.draft.signOff,
        });
        if (research.verdict !== "draft") {
          expect(text, prospect.id).toBeNull();
          continue;
        }
        expect(text?.length, prospect.id).toBeLessThanOrEqual(MAX_DRAFT_LENGTH);
        expect(text, prospect.id).not.toMatch(/[{}]/);
      }
    });

    it(`${locale}: every prospect has its words`, () => {
      for (const id of prospectIds) {
        expect(Object.keys(messages.demos.linkedin.items[id]).sort()).toEqual([
          "about",
          "company",
          "name",
          "place",
          "title",
        ]);
      }
    });
  }
});

describe("linkedinEngine", () => {
  it("is a simulation and streams one step per prospect, in order", async () => {
    const steps: string[] = [];

    for await (const step of linkedinEngine.run(
      { prospects },
      { sessionId: "test", locale: "en" },
    )) {
      steps.push(step.id);
    }

    expect(linkedinEngine.id).toBe("linkedin-agent");
    expect(linkedinEngine.mode).toBe("simulation");
    expect(steps).toEqual(prospects.map((prospect) => prospect.id));
  });

  it("gives the same steps for the same prospects", async () => {
    const run = async () => {
      const out: unknown[] = [];
      for await (const step of linkedinEngine.run(
        { prospects },
        { sessionId: "a", locale: "it" },
      )) {
        out.push(step);
      }
      return out;
    };

    expect(await run()).toEqual(await run());
  });
});

describe("the approval gate (reducer)", () => {
  const apply = (state: State, ...actions: DemoAction[]) =>
    actions.reduce(reducer, state);
  const researched = (): State => {
    let state = reducer(initialState(prospects), { type: "start" });
    for (const prospect of prospects) {
      const research = qualify(prospect);
      state = reducer(state, {
        type: "researched",
        id: prospect.id,
        research,
        draft: research.verdict === "draft" ? `Hello ${prospect.id}` : null,
      });
    }
    return reducer(state, { type: "finish" });
  };
  const item = (state: State, id: string) => {
    const found = state.items.find((candidate) => candidate.id === id);
    if (found === undefined) throw new Error(id);
    return found;
  };

  it("starts with nothing researched, drafted or scheduled", () => {
    const state = initialState(prospects);

    expect(statistics(state)).toEqual({
      total: 6,
      researched: 0,
      drafts: 0,
      pending: 0,
      scheduled: 0,
    });
    expect(scheduledItems(state)).toEqual([]);
  });

  it("approving before the research changes nothing (negative)", () => {
    const state = apply(
      initialState(prospects),
      { type: "review", id: "alfa", reviewed: true },
      { type: "approve", id: "alfa" },
    );

    expect(item(state, "alfa").decision).toBeNull();
    expect(scheduledItems(state)).toEqual([]);
  });

  it("approving without the confirmation changes nothing: the step cannot be skipped (negative)", () => {
    const state = apply(researched(), { type: "approve", id: "alfa" });

    expect(item(state, "alfa").decision).toBeNull();
    expect(item(state, "alfa").slot).toBeNull();
    expect(scheduledItems(state)).toEqual([]);
  });

  it("confirm then approve schedules exactly that prospect, with the first slot", () => {
    const state = apply(
      researched(),
      { type: "review", id: "alfa", reviewed: true },
      { type: "approve", id: "alfa" },
    );

    expect(item(state, "alfa")).toMatchObject({
      decision: "scheduled",
      slot: 1,
    });
    expect(scheduledItems(state).map((i) => i.id)).toEqual(["alfa"]);
    expect(statistics(state)).toMatchObject({ scheduled: 1, pending: 2 });
  });

  it("an approval is one prospect: approving one never approves another (negative)", () => {
    const state = apply(
      researched(),
      { type: "review", id: "alfa", reviewed: true },
      { type: "review", id: "borgo", reviewed: true },
      { type: "approve", id: "alfa" },
    );

    expect(item(state, "borgo").decision).toBeNull();
    expect(item(state, "fiume").decision).toBeNull();
  });

  it("slots follow the order of approval and are spaced out", () => {
    const state = apply(
      researched(),
      { type: "review", id: "borgo", reviewed: true },
      { type: "approve", id: "borgo" },
      { type: "review", id: "alfa", reviewed: true },
      { type: "approve", id: "alfa" },
    );

    expect(scheduledItems(state).map((i) => [i.id, i.slot])).toEqual([
      ["borgo", 1],
      ["alfa", 2],
    ]);
    expect(slotInfo(1)).toEqual({ day: 1, time: "09:30" });
    expect(slotInfo(2).time).not.toBe(slotInfo(1).time);
    expect(slotInfo(4)).toEqual({ day: 2, time: "09:30" });
  });

  it("editing the message after confirming takes the confirmation back: the person must read the new text (negative)", () => {
    const state = apply(
      researched(),
      { type: "review", id: "alfa", reviewed: true },
      { type: "edit", id: "alfa", draft: "A different message" },
      { type: "approve", id: "alfa" },
    );

    expect(item(state, "alfa").reviewed).toBe(false);
    expect(item(state, "alfa").decision).toBeNull();
    expect(item(state, "alfa").draft).toBe("A different message");
  });

  it("a blank message cannot be confirmed or approved (negative)", () => {
    const state = apply(
      researched(),
      { type: "edit", id: "alfa", draft: "   \n " },
      { type: "review", id: "alfa", reviewed: true },
      { type: "approve", id: "alfa" },
    );

    expect(isOpenDraft(item(state, "alfa"))).toBe(false);
    expect(item(state, "alfa").reviewed).toBe(false);
    expect(item(state, "alfa").decision).toBeNull();
  });

  it("an over-long message is cut to the limit", () => {
    const state = apply(researched(), {
      type: "edit",
      id: "alfa",
      draft: "x".repeat(MAX_DRAFT_LENGTH + 200),
    });

    expect(item(state, "alfa").draft).toHaveLength(MAX_DRAFT_LENGTH);
  });

  it("a prospect that is on hold, not a fit or blocked can never be scheduled, even confirmed (negative)", () => {
    for (const id of ["cima", "delta", "eco"]) {
      const state = apply(
        researched(),
        { type: "review", id, reviewed: true },
        { type: "approve", id },
        { type: "edit", id, draft: "Forced draft" },
        { type: "review", id, reviewed: true },
        { type: "approve", id },
        { type: "discard", id },
      );

      expect(item(state, id).decision, id).toBeNull();
      expect(item(state, id).draft, id).toBeNull();
      expect(scheduledItems(state), id).toEqual([]);
    }
  });

  it("the decision is final: a scheduled message cannot be edited, re-approved or discarded; a discarded one cannot be scheduled (negative)", () => {
    const scheduled = apply(
      researched(),
      { type: "review", id: "alfa", reviewed: true },
      { type: "approve", id: "alfa" },
    );
    const after = apply(
      scheduled,
      { type: "edit", id: "alfa", draft: "Sneaky change" },
      { type: "discard", id: "alfa" },
      { type: "approve", id: "alfa" },
    );
    const discarded = apply(
      researched(),
      { type: "discard", id: "borgo" },
      { type: "review", id: "borgo", reviewed: true },
      { type: "approve", id: "borgo" },
    );

    expect(item(after, "alfa")).toEqual(item(scheduled, "alfa"));
    expect(item(discarded, "borgo").decision).toBe("discarded");
    expect(scheduledItems(discarded)).toEqual([]);
  });

  it("the research can only be recorded once per prospect", () => {
    const state = researched();
    const again = reducer(state, {
      type: "researched",
      id: "alfa",
      research: { factors: [], score: 0, verdict: "skip" },
      draft: null,
    });

    expect(item(again, "alfa").research?.verdict).toBe("draft");
  });

  it("an unknown id changes nothing", () => {
    const state = researched();

    expect(
      apply(
        state,
        { type: "review", id: "nobody", reviewed: true },
        { type: "approve", id: "nobody" },
        { type: "select", id: "nobody" },
      ),
    ).toEqual(state);
  });

  it("reset starts over: nothing researched, decided or scheduled", () => {
    const state = apply(
      researched(),
      { type: "review", id: "alfa", reviewed: true },
      { type: "approve", id: "alfa" },
      { type: "reset", prospects },
    );

    expect(state).toEqual(initialState(prospects));
  });
});
