// @vitest-environment node
import { describe, expect, it } from "vitest";

import { docIntelEngine } from "@/lib/demos/docintel/engine";
import {
  answerQuestion,
  extractField,
  lineAt,
  locate,
  parseValue,
  sumCheck,
  tally,
  type DocText,
  type FieldResult,
  type Value,
} from "@/lib/demos/docintel/extract";
import {
  documentIds,
  documents,
  type DocumentId,
  type FieldSpec,
} from "@/lib/demos/docintel/fixtures";
import { formatValue } from "@/lib/demos/docintel/format";
import {
  currentDoc,
  initialState,
  reducer,
  type DemoAction,
  type State,
} from "@/lib/demos/docintel/state";
import enMessages from "../../../../messages/en.json";
import itMessages from "../../../../messages/it.json";

type DocCopy = {
  title: string;
  name: string;
  summary: string;
  sections: Partial<Record<string, { heading: string; text: string }>>;
  fields: Partial<Record<string, string>>;
  questions: Partial<Record<string, { q: string; a?: string }>>;
};

const LOCALES = [
  ["it", itMessages],
  ["en", enMessages],
] as const;

const copyOf = (messages: typeof itMessages, id: DocumentId): DocCopy =>
  messages.demos.docIntel.docs[id];

const textOf = (messages: typeof itMessages, id: DocumentId): DocText => ({
  sections: documents[id].sections.map((section) => ({
    id: section.id,
    page: section.page,
    text: copyOf(messages, id).sections[section.id]?.text ?? "",
  })),
});

const pageOf = (id: DocumentId, section: string) =>
  documents[id].sections.find((s) => s.id === section)?.page ?? 1;

const readAll = (id: DocumentId, document: DocText): FieldResult[] =>
  documents[id].fields.map((field) =>
    extractField(field, document, pageOf(id, field.section)),
  );

/** What each sample document must give, whatever the language: the fixtures the page promises. */
const EXPECTED: Record<DocumentId, Record<string, Value>> = {
  invoice: {
    invoiceNo: { kind: "text", text: "FT-2026/0142" },
    issueDate: { kind: "date", iso: "2026-03-14" },
    dueDate: { kind: "date", iso: "2026-04-13" },
    supplier: { kind: "text", text: "Tessitura Valle S.r.l." },
    customer: { kind: "text", text: "Orso Allestimenti S.r.l." },
    po: { kind: "text", text: "PO 4471" },
    net: { kind: "money", cents: 100000 },
    vatRate: { kind: "percent", n: 22 },
    vat: { kind: "money", cents: 22000 },
    total: { kind: "money", cents: 122000 },
    paymentDays: { kind: "number", n: 30, unit: "day" },
    accountHolder: { kind: "text", text: "Tessitura Valle S.r.l." },
  },
  contract: {
    provider: { kind: "text", text: "Studio Rete S.r.l." },
    client: { kind: "text", text: "Orso Allestimenti S.r.l." },
    effectiveDate: { kind: "date", iso: "2026-04-01" },
    termMonths: { kind: "number", n: 12, unit: "month" },
    monthlyFee: { kind: "money", cents: 180000 },
    paymentDays: { kind: "number", n: 30, unit: "day" },
    noticeDays: { kind: "number", n: 60, unit: "day" },
    liabilityMonths: { kind: "number", n: 12, unit: "month" },
    signDate: { kind: "date", iso: "2026-03-20" },
  },
  ddt: {
    ddtNo: { kind: "text", text: "2026/0877" },
    ddtDate: { kind: "date", iso: "2026-04-02" },
    sender: { kind: "text", text: "Tessitura Valle S.r.l." },
    recipient: { kind: "text", text: "Orso Allestimenti S.r.l." },
    address: { kind: "text", text: "Via Esempio 7, 20100 Milano" },
    carrier: { kind: "text", text: "Trasporti Rapidi S.n.c." },
    plate: { kind: "text", text: "AB123CD" },
    packages: { kind: "number", n: 3, unit: undefined },
    grossWeight: { kind: "number", n: 148, unit: "kilogram" },
    deliveredOn: { kind: "date", iso: "2026-04-03" },
  },
};

/** The fields a person must look at, and why. Everything else reads cleanly. */
const FLAGGED: Record<DocumentId, Partial<Record<string, string>>> = {
  invoice: { po: "ambiguous" },
  contract: { monthlyFee: "handwritten" },
  ddt: { grossWeight: "ambiguous" },
};

describe.each(LOCALES)("the sample documents (%s)", (_locale, messages) => {
  for (const id of documentIds) {
    describe(id, () => {
      const spec = documents[id];
      const copy = copyOf(messages, id);
      const document = textOf(messages, id);

      it("has text, a heading and a label for everything the fixtures name", () => {
        expect(copy.title.length).toBeGreaterThan(0);
        for (const section of spec.sections) {
          expect(copy.sections[section.id]?.heading, section.id).toBeTruthy();
          expect(copy.sections[section.id]?.text, section.id).toBeTruthy();
        }
        for (const field of spec.fields) {
          expect(copy.fields[field.id], field.id).toBeTruthy();
          expect(
            spec.sections.some((s) => s.id === field.section),
            field.id,
          ).toBe(true);
        }
        for (const question of spec.questions) {
          expect(copy.questions[question.id]?.q, question.id).toBeTruthy();
        }
        expect(Object.keys(copy.sections).sort()).toEqual(
          spec.sections.map((s) => s.id).sort(),
        );
        expect(Object.keys(copy.fields).sort()).toEqual(
          spec.fields.map((f) => f.id).sort(),
        );
      });

      it("uses pages that exist, in order", () => {
        const pages = spec.sections.map((s) => s.page);
        expect(pages).toEqual([...pages].sort((a, b) => a - b));
        expect(Math.max(...pages)).toBe(spec.pages);
        expect(new Set(pages).size).toBe(spec.pages);
      });

      it("finds every piece of evidence exactly once in its section, so a citation is never ambiguous", () => {
        for (const field of spec.fields) {
          const text =
            document.sections.find((s) => s.id === field.section)?.text ?? "";
          expect(text.split(field.evidence).length - 1, field.id).toBe(1);
        }
      });

      it("never overlaps two pieces of evidence in the same section", () => {
        const results = readAll(id, document);
        for (const a of results) {
          for (const b of results) {
            if (a.id === b.id || a.section !== b.section) continue;
            expect(
              a.end <= b.start || b.end <= a.start,
              `${a.id}/${b.id}`,
            ).toBe(true);
          }
        }
      });

      it("every answer is written with exactly the fields its question uses", () => {
        for (const question of spec.questions) {
          const answer = copy.questions[question.id]?.a;
          if (question.fields.length === 0) {
            expect(answer, question.id).toBeUndefined();
            continue;
          }
          const placeholders = [...(answer ?? "").matchAll(/\{(\w+)\}/g)].map(
            (match) => match[1],
          );
          expect(new Set(placeholders), question.id).toEqual(
            new Set(question.fields),
          );
          for (const field of question.fields) {
            expect(
              spec.fields.some((f) => f.id === field),
              `${question.id}/${field}`,
            ).toBe(true);
          }
        }
      });

      it("extracts the values the page promises, and flags only the doubtful ones", () => {
        const results = readAll(id, document);

        expect(results.map((r) => r.id)).toEqual(spec.fields.map((f) => f.id));
        for (const result of results) {
          expect(result.value, result.id).toEqual(EXPECTED[id][result.id]);
          const flag = FLAGGED[id][result.id];
          expect(result.status, result.id).toBe(flag ? "review" : "read");
          expect(result.review, result.id).toBe(flag ?? null);
          expect(result.page, result.id).toBe(pageOf(id, result.section));
        }
      });

      it("points each value at the exact characters it was read from", () => {
        for (const result of readAll(id, document)) {
          const text =
            document.sections.find((s) => s.id === result.section)?.text ?? "";
          expect(text.slice(result.start, result.end), result.id).toBe(
            result.raw,
          );
        }
      });

      it("cites the right page, section and sentence for every answerable question", () => {
        const results = readAll(id, document);
        for (const question of spec.questions) {
          const answer = answerQuestion(question, results, document);
          if (question.fields.length === 0) {
            expect(answer, question.id).toEqual({ status: "notFound" });
            continue;
          }
          expect(answer.status, question.id).toBe("answered");
          if (answer.status !== "answered") continue;
          const used = new Set<string>();
          for (const citation of answer.citations) {
            const section = document.sections.find(
              (s) => s.id === citation.section,
            );
            expect(section?.page, question.id).toBe(citation.page);
            expect(section?.text.split("\n"), question.id).toContain(
              citation.quote,
            );
            for (const fieldId of citation.fields) {
              used.add(fieldId);
              const field = spec.fields.find((f) => f.id === fieldId);
              expect(field?.section, `${question.id}/${fieldId}`).toBe(
                citation.section,
              );
              expect(citation.quote, `${question.id}/${fieldId}`).toContain(
                field?.evidence,
              );
            }
          }
          expect(used, question.id).toEqual(new Set(question.fields));
          const order = answer.citations.map((c) =>
            spec.sections.findIndex((s) => s.id === c.section),
          );
          expect(order, question.id).toEqual([...order].sort((a, b) => a - b));
          expect(answer.needsCheck, question.id).toBe(
            question.fields.some((f) => FLAGGED[id][f] !== undefined),
          );
        }
      });
    });
  }

  it("answers the headline questions from the right sections", () => {
    const cite = (id: DocumentId, question: string) => {
      const q = documents[id].questions.find((x) => x.id === question);
      const document = textOf(messages, id);
      const answer = answerQuestion(
        q ?? { id: "", fields: [] },
        readAll(id, document),
        document,
      );
      return answer.status === "answered"
        ? answer.citations.map((c) => `${String(c.page)}:${c.section}`)
        : [];
    };

    expect(cite("invoice", "amountDue")).toEqual(["1:header", "2:totals"]);
    expect(cite("invoice", "payTo")).toEqual(["2:payment", "2:payment"]);
    expect(cite("contract", "renewal")).toEqual(["1:term", "2:renewal"]);
    expect(cite("contract", "liability")).toEqual(["3:liability"]);
    expect(cite("ddt", "delivered")).toEqual(["1:parties", "1:receipt"]);
  });

  it("the invoice adds up: taxable amount + VAT = total", () => {
    const document = textOf(messages, "invoice");

    expect(sumCheck(documents.invoice, readAll("invoice", document))).toBe(
      "ok",
    );
    expect(sumCheck(documents.contract, [])).toBeNull();
  });
});

describe("negative cases: nothing is guessed", () => {
  const field = (id: string): FieldSpec => {
    const found = documents.invoice.fields.find((f) => f.id === id);
    if (found === undefined) throw new Error(`no field ${id}`);
    return found;
  };
  const invoice = textOf(itMessages, "invoice");

  it("a field whose evidence is not in the document is missing, with no value", () => {
    const stripped: DocText = {
      sections: invoice.sections.map((s) => ({
        ...s,
        text: s.text.replace("FT-2026/0142", "FT-????"),
      })),
    };

    const result = extractField(field("invoiceNo"), stripped, 1);

    expect(result.status).toBe("missing");
    expect(result.value).toBeNull();
    expect(result.raw).toBeNull();
  });

  it("a field in a section the document does not have is missing", () => {
    const result = extractField(field("total"), { sections: [] }, 2);

    expect(result.status).toBe("missing");
  });

  it("a value that does not parse is missing, not coerced", () => {
    const spec: FieldSpec = {
      id: "x",
      section: "totals",
      evidence: "€ 1220,00",
      kind: "money",
    };
    const document: DocText = {
      sections: [{ id: "totals", page: 2, text: "Totale € 1220,00" }],
    };

    expect(extractField(spec, document, 2).status).toBe("missing");
  });

  it.each([
    ["date", "31/02/2026"],
    ["date", "2026-03-14"],
    ["date", "14/13/2026"],
    ["money", "1.220,00"],
    ["money", "€ 1,220.00"],
    ["money", "€ 12.20,00"],
    ["number", "12 months"],
    ["number", "-3"],
    ["percent", "22"],
    ["percent", "1000%"],
    ["text", "   "],
  ] as const)("parseValue rejects %s %j", (kind, raw) => {
    expect(
      parseValue({ id: "x", section: "s", evidence: raw, kind }, raw),
    ).toBeNull();
  });

  it("parseValue reads Italian notation exactly, in cents", () => {
    const money = (raw: string) =>
      parseValue({ id: "x", section: "s", evidence: raw, kind: "money" }, raw);

    expect(money("€ 1.220,00")).toEqual({ kind: "money", cents: 122000 });
    expect(money("€ 0,05")).toEqual({ kind: "money", cents: 5 });
    expect(money("€ 1.234.567,89")).toEqual({
      kind: "money",
      cents: 123456789,
    });
  });

  it("the arithmetic check catches amounts that do not add up, and says when a figure is missing", () => {
    const results = readAll("invoice", invoice);
    const tampered = results.map((r) =>
      r.id === "vat" && r.value?.kind === "money"
        ? { ...r, value: { ...r.value, cents: 23000 } }
        : r,
    );
    const lost = results.map((r) =>
      r.id === "net" ? { ...r, status: "missing" as const, value: null } : r,
    );

    expect(sumCheck(documents.invoice, tampered)).toBe("mismatch");
    expect(sumCheck(documents.invoice, lost)).toBe("unavailable");
    expect(sumCheck(documents.invoice, [])).toBe("unavailable");
  });

  it("a question whose field was not read is not answered: no citation, no guess", () => {
    const results = readAll("invoice", invoice).map((r) =>
      r.id === "dueDate"
        ? { ...r, status: "missing" as const, value: null }
        : r,
    );
    const question = documents.invoice.questions.find(
      (q) => q.id === "amountDue",
    );

    expect(
      answerQuestion(question ?? { id: "", fields: [] }, results, invoice),
    ).toEqual({ status: "notFound" });
    expect(
      answerQuestion({ id: "amountDue", fields: ["total"] }, [], invoice),
    ).toEqual({ status: "notFound" });
  });

  it("locate finds nothing for an empty or absent needle", () => {
    expect(locate("abc", "")).toBeNull();
    expect(locate("abc", "z")).toBeNull();
    expect(locate("abc", "bc")).toEqual({ start: 1, end: 3 });
  });

  it("lineAt returns the whole line around a position", () => {
    const text = "one\ntwo words\nthree";

    expect(lineAt(text, text.indexOf("words"))).toBe("two words");
    expect(lineAt(text, 0)).toBe("one");
    expect(lineAt(text, text.indexOf("three"))).toBe("three");
  });

  it("tally counts only flagged fields as checked", () => {
    const results = readAll("contract", textOf(itMessages, "contract"));

    expect(tally(results, ["monthlyFee", "provider"])).toEqual({
      read: 8,
      review: 1,
      missing: 0,
      checked: 1,
    });
  });
});

describe("formatValue writes values in the visitor's language", () => {
  it("formats money, dates, percentages and units for Italian and English", () => {
    // Italian does not group four-digit numbers, so "1220,00 €"; the pattern tolerates either.
    expect(formatValue({ kind: "money", cents: 122000 }, "it")).toMatch(
      /^1\.?220,00\s€$/,
    );
    expect(formatValue({ kind: "money", cents: 122000 }, "en")).toBe(
      "€1,220.00",
    );
    expect(formatValue({ kind: "date", iso: "2026-04-13" }, "it")).toBe(
      "13 aprile 2026",
    );
    expect(formatValue({ kind: "date", iso: "2026-04-13" }, "en")).toBe(
      "April 13, 2026",
    );
    expect(formatValue({ kind: "percent", n: 22 }, "en")).toBe("22%");
    expect(formatValue({ kind: "number", n: 30, unit: "day" }, "it")).toBe(
      "30 giorni",
    );
    expect(
      formatValue({ kind: "number", n: 148, unit: "kilogram" }, "en"),
    ).toBe("148 kilograms");
    expect(formatValue({ kind: "number", n: 3 }, "en")).toBe("3");
  });
});

describe("the engine is a deterministic simulation", () => {
  it("declares itself a simulation and streams the fields in fixture order", async () => {
    expect(docIntelEngine.mode).toBe("simulation");
    expect(docIntelEngine.id).toBe("doc-intel");
    const document = textOf(itMessages, "contract");
    const seen: string[] = [];

    for await (const result of docIntelEngine.run(
      { spec: documents.contract, document },
      { sessionId: "test", locale: "it" },
    )) {
      seen.push(result.id);
    }

    expect(seen).toEqual(documents.contract.fields.map((f) => f.id));
  });

  it("gives the same result twice", async () => {
    const run = async () => {
      const out: FieldResult[] = [];
      for await (const result of docIntelEngine.run(
        { spec: documents.ddt, document: textOf(enMessages, "ddt") },
        { sessionId: "a", locale: "en" },
      )) {
        out.push(result);
      }
      return out;
    };

    expect(await run()).toEqual(await run());
  });
});

describe("the state: what the visitor can and cannot do", () => {
  const apply = (state: State, ...actions: DemoAction[]) =>
    actions.reduce(reducer, state);

  const fieldsOf = (id: DocumentId) =>
    readAll(id, textOf(itMessages, id)).map((result): DemoAction => ({
      type: "field",
      result,
    }));

  const finished = (): State =>
    apply(initialState(), { type: "start" }, ...fieldsOf("invoice"), {
      type: "finish",
    });

  it("starts on the first document, nothing read, nothing asked", () => {
    const state = initialState();

    expect(state.current).toBe("invoice");
    expect(currentDoc(state)).toEqual({
      phase: "idle",
      results: [],
      checked: [],
    });
    expect(state.question).toBeNull();
  });

  it("reading fills the fields one by one and ends done", () => {
    const state = finished();

    expect(currentDoc(state).phase).toBe("done");
    expect(currentDoc(state).results).toHaveLength(
      documents.invoice.fields.length,
    );
  });

  it("a question cannot be asked before the document is read (negative)", () => {
    const idle = apply(initialState(), { type: "ask", question: "amountDue" });
    const running = apply(
      initialState(),
      { type: "start" },
      { type: "ask", question: "amountDue" },
    );

    expect(idle.question).toBeNull();
    expect(running.question).toBeNull();
  });

  it("only the document's own questions can be asked (negative)", () => {
    const state = apply(finished(), { type: "ask", question: "weight" });

    expect(state.question).toBeNull();
    expect(
      apply(finished(), { type: "ask", question: "amountDue" }).question,
    ).toBe("amountDue");
  });

  it("a field that arrives when no read is running, or twice, is ignored (negative)", () => {
    const first = fieldsOf("invoice").at(0);
    if (first === undefined) throw new Error("no field");

    expect(currentDoc(apply(initialState(), first)).results).toEqual([]);
    expect(
      currentDoc(apply(initialState(), { type: "start" }, first, first))
        .results,
    ).toHaveLength(1);
    expect(currentDoc(apply(finished(), first)).results).toHaveLength(
      documents.invoice.fields.length,
    );
  });

  it("only a flagged field can be marked as checked, and the mark can be taken back (negative)", () => {
    const state = finished();

    expect(
      currentDoc(apply(state, { type: "check", field: "total", checked: true }))
        .checked,
    ).toEqual([]);
    expect(
      currentDoc(apply(state, { type: "check", field: "nope", checked: true }))
        .checked,
    ).toEqual([]);
    const marked = apply(state, { type: "check", field: "po", checked: true });
    expect(currentDoc(marked).checked).toEqual(["po"]);
    expect(
      currentDoc(apply(marked, { type: "check", field: "po", checked: false }))
        .checked,
    ).toEqual([]);
  });

  it("switching document abandons a read in progress but keeps a finished one", () => {
    const midway = apply(
      initialState(),
      { type: "start" },
      ...fieldsOf("invoice").slice(0, 3),
      { type: "select-doc", id: "contract" },
    );
    const afterDone = apply(finished(), { type: "select-doc", id: "ddt" });

    expect(midway.current).toBe("contract");
    expect(midway.docs.invoice).toEqual({
      phase: "idle",
      results: [],
      checked: [],
    });
    expect(afterDone.docs.invoice.phase).toBe("done");
    expect(afterDone.question).toBeNull();
  });

  it("selecting an unknown document changes nothing (negative)", () => {
    const state = initialState();

    expect(
      reducer(state, { type: "select-doc", id: "passport" as DocumentId }),
    ).toBe(state);
  });

  it("only a real section of the current document can be pointed at (negative)", () => {
    const state = initialState();

    expect(apply(state, { type: "focus", section: "totals" }).focus).toBe(
      "totals",
    );
    expect(apply(state, { type: "focus", section: "nope" }).focus).toBeNull();
    expect(
      apply(
        state,
        { type: "focus", section: "totals" },
        {
          type: "focus",
          section: null,
        },
      ).focus,
    ).toBeNull();
  });

  it("reset puts everything back", () => {
    const state = apply(
      finished(),
      { type: "ask", question: "vat" },
      { type: "reset" },
    );

    expect(state).toEqual(initialState());
  });
});
