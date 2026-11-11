import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Locale } from "@/i18n/routing";
import enMessages from "../../../../messages/en.json";
import itMessages from "../../../../messages/it.json";

const reducedMotion = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/motion/use-reduced-motion", () => ({
  useReducedMotion: () => reducedMotion.value,
}));

const { DocintelDemo } =
  await import("@/components/demos/docintel/docintel-demo");

const messages = { it: itMessages, en: enMessages } as const;

function renderDemo(locale: Locale = "it") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ demos: messages[locale].demos }}
    >
      <DocintelDemo />
    </NextIntlClientProvider>,
  );
}

const copy = (locale: Locale = "it") => messages[locale].demos.docIntel;

const scrollIntoView = vi.fn();

beforeEach(() => {
  reducedMotion.value = true;
  scrollIntoView.mockClear();
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function read(locale: Locale = "it") {
  await act(async () => {
    await Promise.resolve();
    fireEvent.click(
      screen.getByRole("button", { name: copy(locale).controls.read }),
    );
  });
  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent(
      copy(locale).controls.done.split("{")[0] ?? "",
    );
  });
}

const pick = (name: string) => {
  // The picker buttons are named "<document> <summary> <pages>": match the start, literally.
  fireEvent.click(
    screen.getByRole("button", {
      name: (accessible) => accessible.startsWith(name),
    }),
  );
};
const fields = (locale: Locale = "it") =>
  screen.getByRole("region", { name: copy(locale).fields.title });
const qa = (locale: Locale = "it") =>
  screen.getByRole("region", { name: copy(locale).qa.title });
const viewer = (locale: Locale = "it") =>
  screen.getByRole("region", { name: copy(locale).viewer.title });
const row = (container: HTMLElement, field: string) => {
  const found = container.querySelector<HTMLElement>(`[data-field="${field}"]`);
  if (found === null) throw new Error(`no row ${field}`);
  return found;
};
const question = (
  id: keyof (typeof itMessages)["demos"]["docIntel"]["docs"]["invoice"]["questions"],
  locale: Locale = "it",
) => copy(locale).docs.invoice.questions[id].q;

describe("before the reading", () => {
  it("shows the first document and every field as not read yet, with the questions locked", () => {
    const { container } = renderDemo();
    const c = copy();

    expect(viewer()).toHaveTextContent("FT-2026/0142");
    expect(fields().querySelectorAll("[data-field]")).toHaveLength(12);
    expect(fields().querySelectorAll("[data-status='pending']")).toHaveLength(
      12,
    );
    expect(within(fields()).getAllByText(c.fields.pending)).toHaveLength(12);
    expect(container.querySelector("[data-qa-locked]")).not.toBeNull();
    for (const button of within(qa()).getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(container.querySelectorAll("mark")).toHaveLength(0);
  });

  it("has no way to bring in your own document or type your own question: no file input, no text box (negative)", () => {
    const { container } = renderDemo();

    expect(container.querySelector("input[type='file']")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(container.querySelector("[contenteditable]")).toBeNull();
    expect(container).toHaveTextContent(copy().limits.upload);
  });

  it("a locked question does nothing when forced (negative)", () => {
    renderDemo();

    fireEvent.click(
      within(qa()).getByRole("button", { name: question("amountDue") }),
    );

    expect(document.querySelector("[data-answer]")).toBeNull();
  });
});

describe("reading a document", () => {
  it("reads all twelve invoice fields, normalises their values and flags the unclear order number", async () => {
    const { container } = renderDemo();
    const c = copy();
    await read();

    expect(screen.getByRole("status")).toHaveTextContent(
      c.controls.done
        .replace("{total}", "12")
        .replace("{ok}", "11")
        .replace("{review}", "1"),
    );
    expect(row(container, "total")).toHaveTextContent(/1\.?220,00/);
    expect(row(container, "dueDate")).toHaveTextContent("13 aprile 2026");
    expect(row(container, "vatRate")).toHaveTextContent("22%");
    expect(row(container, "paymentDays")).toHaveTextContent("30 giorni");
    expect(row(container, "po")).toHaveAttribute("data-status", "review");
    expect(row(container, "po")).toHaveTextContent(c.fields.reason.ambiguous);
    expect(container.querySelectorAll("[data-status='read']")).toHaveLength(11);
    expect(container.querySelectorAll("mark")).toHaveLength(12);
    expect(container.querySelector("[data-sum-check]")).toHaveAttribute(
      "data-sum-check",
      "ok",
    );
  });

  it("a flagged value stays flagged until the person marks it, and the mark can be taken back", async () => {
    const { container } = renderDemo();
    const c = copy();
    await read();
    const box = within(row(container, "po")).getByRole("checkbox", {
      name: c.fields.check.replace("{field}", c.docs.invoice.fields.po),
    });

    expect(box).not.toBeChecked();
    fireEvent.click(box);

    expect(box).toBeChecked();
    expect(row(container, "po")).toHaveTextContent(c.fields.checked);
    fireEvent.click(box);
    expect(box).not.toBeChecked();
  });

  it("only flagged fields offer a check: a clean one has no checkbox (negative)", async () => {
    const { container } = renderDemo();
    await read();

    expect(within(row(container, "total")).queryByRole("checkbox")).toBeNull();
    expect(within(fields()).getAllByRole("checkbox")).toHaveLength(1);
  });

  it("the button is spent once the document is read; start over empties everything", async () => {
    const { container } = renderDemo();
    await read();

    expect(
      screen.getByRole("button", { name: copy().controls.read }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: messages.it.demos.shell.reset }),
    );

    expect(container.querySelectorAll("[data-status='pending']")).toHaveLength(
      12,
    );
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(container.querySelector("[data-qa-locked]")).not.toBeNull();
  });
});

describe("questions with citations", () => {
  it("answers from the extracted fields and cites the exact sentence, page and section", async () => {
    const { container } = renderDemo();
    const c = copy();
    await read();

    fireEvent.click(
      within(qa()).getByRole("button", { name: question("amountDue") }),
    );

    const answer = container.querySelector<HTMLElement>("[data-answer]");
    expect(answer).toHaveAttribute("data-answer", "answered");
    expect(answer).toHaveFocus();
    expect(answer).toHaveTextContent(/1\.?220,00/);
    expect(answer).toHaveTextContent("13 aprile 2026");
    const citations = answer?.querySelectorAll("[data-citation]") ?? [];
    expect([...citations].map((n) => n.getAttribute("data-citation"))).toEqual([
      "header",
      "totals",
    ]);
    expect(citations[0]).toHaveTextContent("Scadenza: 13/04/2026");
    expect(citations[1]).toHaveTextContent("Totale da pagare: € 1.220,00");
    expect(citations[1]).toHaveTextContent(
      c.qa.source
        .replace("{page}", "2")
        .replace("{section}", c.docs.invoice.sections.totals.heading),
    );
  });

  it("following a citation outlines that section in the document and says where", async () => {
    const { container } = renderDemo();
    const c = copy();
    await read();
    fireEvent.click(
      within(qa()).getByRole("button", { name: question("amountDue") }),
    );

    const totals = container.querySelector("[data-citation='totals']");
    fireEvent.click(within(totals as HTMLElement).getByRole("button"));

    const cited = container.querySelectorAll("[data-cited]");
    expect(cited).toHaveLength(1);
    expect(cited[0]).toHaveAttribute("data-section", "totals");
    expect(viewer()).toHaveTextContent(c.viewer.cited);
    expect(screen.getByRole("status")).toHaveTextContent(
      c.controls.showing
        .replace("{page}", "2")
        .replace("{section}", c.docs.invoice.sections.totals.heading),
    );
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("a question the document cannot answer says so, cites nothing and invents nothing (negative)", async () => {
    const { container } = renderDemo();
    const c = copy();
    await read();

    fireEvent.click(
      within(qa()).getByRole("button", { name: question("discount") }),
    );

    const answer = container.querySelector("[data-answer]");
    expect(answer).toHaveAttribute("data-answer", "notFound");
    expect(answer).toHaveTextContent(c.qa.notFound);
    expect(answer).toHaveTextContent(c.qa.noSource);
    expect(container.querySelectorAll("[data-citation]")).toHaveLength(0);
  });

  it("an answer resting on a doubtful value says so until that value is checked", async () => {
    const { container } = renderDemo();
    const c = copy();
    pick(c.docs.contract.name);
    await read();

    fireEvent.click(
      within(qa()).getByRole("button", {
        name: c.docs.contract.questions.fee.q,
      }),
    );
    expect(container.querySelector("[data-needs-check]")).not.toBeNull();

    fireEvent.click(within(row(container, "monthlyFee")).getByRole("checkbox"));
    expect(container.querySelector("[data-needs-check]")).toBeNull();
  });

  it("an answer that rests on clean values carries no warning", async () => {
    const { container } = renderDemo();
    const c = copy();
    pick(c.docs.contract.name);
    await read();

    fireEvent.click(
      within(qa()).getByRole("button", {
        name: c.docs.contract.questions.liability.q,
      }),
    );

    expect(container.querySelector("[data-answer='answered']")).not.toBeNull();
    expect(container.querySelector("[data-needs-check]")).toBeNull();
  });
});

describe("the other documents", () => {
  it("each document reads, and a document keeps its result when you come back to it", async () => {
    const { container } = renderDemo();
    const c = copy();
    await read();
    pick(c.docs.ddt.name);

    expect(viewer()).toHaveTextContent("2026/0877");
    expect(fields().querySelectorAll("[data-field]")).toHaveLength(10);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    await read();
    expect(row(container, "grossWeight")).toHaveAttribute(
      "data-status",
      "review",
    );
    expect(row(container, "packages")).toHaveTextContent("3");
    pick(c.docs.invoice.name);

    expect(container.querySelectorAll("mark")).toHaveLength(12);
  });

  it("the English page reads and answers in English, with English notation for the values", async () => {
    const { container } = renderDemo("en");
    const c = copy("en");
    await read("en");

    expect(row(container, "total")).toHaveTextContent("€1,220.00");
    expect(row(container, "dueDate")).toHaveTextContent("April 13, 2026");
    fireEvent.click(
      within(qa("en")).getByRole("button", {
        name: c.docs.invoice.questions.amountDue.q,
      }),
    );
    expect(container.querySelector("[data-answer]")).toHaveTextContent(
      "The invoice total is €1,220.00, due on April 13, 2026.",
    );
  });
});
