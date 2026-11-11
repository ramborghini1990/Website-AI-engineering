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

const { LinkedinDemo } =
  await import("@/components/demos/linkedin/linkedin-demo");

const messages = { it: itMessages, en: enMessages } as const;

function renderDemo(locale: Locale = "it") {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ demos: messages[locale].demos }}
    >
      <LinkedinDemo />
    </NextIntlClientProvider>,
  );
}

const copy = (locale: Locale = "it") => messages[locale].demos.linkedin;

beforeEach(() => {
  reducedMotion.value = true;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function research(locale: Locale = "it") {
  await act(async () => {
    await Promise.resolve();
    fireEvent.click(
      screen.getByRole("button", { name: copy(locale).controls.research }),
    );
  });
  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent(
      copy(locale).controls.done.split("{")[0] ?? "",
    );
  });
}

const list = (locale: Locale = "it") =>
  screen.getByRole("region", { name: copy(locale).prospects.title });
const detail = (locale: Locale = "it") =>
  screen.getByRole("region", { name: copy(locale).detail.title });
const queue = (locale: Locale = "it") =>
  screen.getByRole("region", { name: copy(locale).queue.title });
const pick = (
  id: keyof typeof itMessages.demos.linkedin.items,
  l: Locale = "it",
) =>
  fireEvent.click(
    within(list(l)).getByRole("button", {
      name: new RegExp(copy(l).items[id].name.replace(".", String.raw`\.`)),
    }),
  );
const approveButton = (l: Locale = "it") =>
  within(detail(l)).queryByRole("button", { name: copy(l).gate.approve });
const confirmBox = (l: Locale = "it") =>
  within(detail(l)).getByRole("checkbox", { name: copy(l).gate.confirm });

describe("LinkedinDemo: before the research", () => {
  it("shows the six invented prospects, none researched, the first selected", () => {
    renderDemo();

    expect(within(list()).getAllByRole("button")).toHaveLength(6);
    expect(screen.getAllByText(copy().status.new)).toHaveLength(6);
    expect(document.querySelectorAll("[aria-current='true']")).toHaveLength(1);
    expect(screen.getByText(copy().detail.unresearched)).toBeInTheDocument();
  });

  it("offers no approval before the research: nothing exists to approve yet (negative)", () => {
    renderDemo();

    expect(approveButton()).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(copy().queue.empty)).toBeInTheDocument();
  });

  it("states the compliant approach and what it never does, before any interaction", () => {
    renderDemo();

    for (const key of ["official", "assisted", "qualify", "minimal"] as const) {
      expect(screen.getByText(copy().compliance[key])).toBeInTheDocument();
    }
    for (const key of [
      "scraping",
      "automation",
      "bulk",
      "unapproved",
    ] as const) {
      expect(screen.getByText(copy().forbidden[key])).toBeInTheDocument();
    }
    expect(screen.getByText(copy().boundary.approval)).toBeInTheDocument();
  });

  it("has no bulk control at all: no approve-all, send-all or schedule-all button (negative)", async () => {
    renderDemo();
    await research();

    for (const button of screen.getAllByRole("button")) {
      expect(button.textContent).not.toMatch(
        /tutt[ie]|\ball\b|everyone|bulk|in massa/i,
      );
    }
  });
});

describe("LinkedinDemo: the research", () => {
  it("rates and drafts exactly as the rules say, and announces the result", async () => {
    renderDemo();
    await research();

    expect(screen.getByRole("status")).toHaveTextContent(
      copy()
        .controls.done.replace("{total}", "6")
        .replace("{drafts}", "3")
        .replace("{pending}", "3"),
    );
    pick("alfa");
    expect(
      within(detail()).getByText(
        copy().detail.scoreOf.replace("{score}", "100"),
      ),
    ).toBeInTheDocument();
    pick("eco");
    expect(within(detail()).getByText(copy().detail.blockedNote)).toBeVisible();
    expect(within(detail()).queryByRole("meter")).toBeNull();
    expect(within(detail()).queryByRole("textbox")).toBeNull();
  });

  it("only a prospect worth contacting has a message and an approval; the others have neither (negative)", async () => {
    renderDemo();
    await research();

    for (const id of ["cima", "delta", "eco"] as const) {
      pick(id);
      expect(within(detail()).queryByRole("textbox"), id).toBeNull();
      expect(approveButton(), id).toBeNull();
      expect(within(detail()).queryByRole("checkbox"), id).toBeNull();
    }
    for (const id of ["alfa", "borgo", "fiume"] as const) {
      pick(id);
      expect(within(detail()).getByRole("textbox"), id).toBeInTheDocument();
      expect(approveButton(), id).toBeInTheDocument();
    }
  });

  it("the message refers to the news item, or to what the company does, and offers a way out", async () => {
    renderDemo("en");
    await research("en");

    pick("alfa", "en");
    const alfa = within(detail("en")).getByRole<HTMLTextAreaElement>("textbox");
    expect(alfa.value).toContain(copy("en").news.expansion);
    expect(alfa.value).toContain(copy("en").draft.optOut);
    pick("fiume", "en");
    const fiume = within(detail("en")).getByRole<HTMLTextAreaElement>(
      "textbox",
    );
    expect(fiume.value).toContain(copy("en").items.fiume.about);
  });
});

describe("LinkedinDemo: the approval gate", () => {
  it("the approve button is disabled until the person confirms they read the message (negative)", async () => {
    renderDemo();
    await research();
    pick("alfa");

    expect(approveButton()).toBeDisabled();
    expect(screen.getByText(copy().gate.needConfirm)).toBeInTheDocument();
    fireEvent.click(approveButton() as HTMLElement);
    expect(within(queue()).queryByRole("table")).toBeNull();
    expect(screen.queryByText(copy().gate.simulated)).toBeNull();
  });

  it("confirm, then approve: the message is scheduled, listed in the queue, the draft is locked, and it says nothing was sent", async () => {
    renderDemo();
    await research();
    pick("alfa");
    fireEvent.click(confirmBox());

    expect(approveButton()).toBeEnabled();
    fireEvent.click(approveButton() as HTMLElement);

    expect(within(detail()).getByText(copy().gate.simulated)).toBeVisible();
    expect(approveButton()).toBeNull();
    expect(within(detail()).getByRole("textbox")).toHaveAttribute("readonly");
    const table = within(queue()).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByText(copy().items.alfa.name)).toBeInTheDocument();
    expect(within(list()).getAllByText(copy().status.scheduled)).toHaveLength(
      1,
    );
    expect(within(list()).getAllByText(copy().status.pending)).toHaveLength(2);
  });

  it("editing the message after confirming takes the confirmation back", async () => {
    renderDemo();
    await research();
    pick("alfa");
    fireEvent.click(confirmBox());
    expect(approveButton()).toBeEnabled();

    fireEvent.change(within(detail()).getByRole("textbox"), {
      target: { value: "Un testo diverso" },
    });

    expect(confirmBox()).not.toBeChecked();
    expect(approveButton()).toBeDisabled();
  });

  it("approving one prospect leaves every other one waiting (negative)", async () => {
    renderDemo();
    await research();
    pick("borgo");
    fireEvent.click(confirmBox());
    fireEvent.click(approveButton() as HTMLElement);

    pick("alfa");
    expect(approveButton()).toBeDisabled();
    expect(confirmBox()).not.toBeChecked();
    pick("fiume");
    expect(approveButton()).toBeDisabled();
  });

  it("discarding schedules nothing and is final", async () => {
    renderDemo();
    await research();
    pick("fiume");

    fireEvent.click(
      within(detail()).getByRole("button", { name: copy().gate.discard }),
    );

    expect(within(list()).getAllByText(copy().status.discarded)).toHaveLength(
      1,
    );
    expect(within(queue()).queryByRole("table")).toBeNull();
    expect(approveButton()).toBeNull();
    expect(screen.queryByText(copy().gate.simulated)).toBeNull();
  });

  it("reset starts over: unresearched, nothing scheduled", async () => {
    renderDemo();
    await research();
    pick("alfa");
    fireEvent.click(confirmBox());
    fireEvent.click(approveButton() as HTMLElement);

    fireEvent.click(
      screen.getByRole("button", { name: messages.it.demos.shell.reset }),
    );

    expect(screen.getAllByText(copy().status.new)).toHaveLength(6);
    expect(screen.getByText(copy().queue.empty)).toBeInTheDocument();
    expect(screen.queryByText(copy().gate.simulated)).toBeNull();
  });
});

describe("LinkedinDemo: pacing and language", () => {
  it("with motion allowed the agent works through the list one prospect at a time and announces progress", async () => {
    reducedMotion.value = false;
    vi.useFakeTimers();
    renderDemo();

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: copy().controls.research }),
      );
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(
      screen.getByRole("button", { name: copy().controls.researching }),
    ).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450 * 3);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /Ricercati [1-5] di 6/,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450 * 6);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      copy().controls.done.split("{")[0] ?? "",
    );
  });

  it("renders the English copy in English", async () => {
    renderDemo("en");
    await research("en");

    pick("alfa", "en");
    expect(
      within(detail("en")).getByText(copy("en").gate.needConfirm),
    ).toBeInTheDocument();
    expect(screen.queryByText(copy("it").gate.needConfirm)).toBeNull();
  });
});
