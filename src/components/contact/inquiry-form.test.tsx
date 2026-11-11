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
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SubmitResult } from "@/lib/inquiry/result";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

const action = vi.hoisted(() => vi.fn());

vi.mock("@/app/[locale]/contact/actions", () => ({ submitInquiry: action }));
vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => "/",
    Link: (props: { href: string } & ComponentProps<"a">) =>
      createElement("a", { ...props, href: `/it${props.href}` }),
  };
});

const { InquiryForm } = await import("@/components/contact/inquiry-form");

const messages = { it: it_, en } as const;
type L = keyof typeof messages;

function renderForm(
  locale: L = "it",
  props: {
    turnstileSiteKey?: string;
    initialNeed?:
      | "ai-agents"
      | "workflow-automation"
      | "web-application"
      | "document-intelligence";
  } = {},
) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={{ contact: { form: messages[locale].contact.form } }}
    >
      <InquiryForm {...props} />
    </NextIntlClientProvider>,
  );
}

const DESCRIPTION =
  "A synthetic description that is long enough to pass validation.";

beforeEach(() => {
  // Radix's Checkbox measures itself; jsdom has no ResizeObserver.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {
        // nothing to observe in jsdom
      }
      unobserve() {
        // nothing to observe in jsdom
      }
      disconnect() {
        // nothing to observe in jsdom
      }
    },
  );
  action.mockReset();
  action.mockResolvedValue({ status: "idle" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const next = (locale: L = "it") =>
  screen.getByRole("button", {
    name: messages[locale].contact.form.buttons.next,
  });

function choose(label: string) {
  fireEvent.click(screen.getByRole("radio", { name: label }));
}

function stepOne(locale: L = "it") {
  const f = messages[locale].contact.form;
  choose(f.need.options["ai-agents"]);
  fireEvent.change(screen.getByLabelText(f.need.descriptionLabel), {
    target: { value: DESCRIPTION },
  });
  fireEvent.click(next(locale));
}

function toContactStep(locale: L = "it") {
  const f = messages[locale].contact.form;
  stepOne(locale);
  choose(f.budget.options["5k-15k"]);
  fireEvent.click(next(locale));
  choose(f.timeline.options.asap);
  fireEvent.click(next(locale));
}

function fillContact(locale: L = "it") {
  const f = messages[locale].contact.form;
  fireEvent.change(screen.getByLabelText(f.contact.nameLabel), {
    target: { value: "Anna Test" },
  });
  fireEvent.change(screen.getByLabelText(f.contact.emailLabel), {
    target: { value: "anna.test@example.com" },
  });
}

async function submit(locale: L = "it") {
  await act(async () => {
    await Promise.resolve();
    fireEvent.click(
      screen.getByRole("button", {
        name: messages[locale].contact.form.buttons.submit,
      }),
    );
  });
}

describe.each(["it", "en"] as const)("InquiryForm (%s)", (locale) => {
  const f = messages[locale].contact.form;

  it("starts on step 1 with a visible heading, a progress list and a labelled question", () => {
    renderForm(locale);

    expect(
      screen.getByRole("heading", { level: 2, name: f.title }),
    ).toBeInTheDocument();
    const progress = screen.getByRole("navigation", { name: f.progressLabel });
    const items = within(progress).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("group", { name: f.need.legend }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(
      screen
        .getAllByRole("radio")
        .every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);
    expect(
      screen.getByText(
        f.progress.replace("{current}", "1").replace("{total}", "4"),
      ),
    ).toBeInTheDocument();
  });

  it("sends the page's language with the form (the Server Action cannot ask next-intl for it)", async () => {
    renderForm(locale);
    toContactStep(locale);
    fillContact(locale);

    await submit(locale);

    expect((action.mock.calls[0]?.[1] as FormData).get("locale")).toBe(locale);
  });

  it("has a no-JavaScript notice in the HTML that is hidden unless scripting is off", () => {
    const { container } = renderForm(locale);

    const notice = container.querySelector("[data-no-js-notice]");
    expect(notice).toHaveTextContent(f.noscript);
    expect(notice?.className).toContain("hidden");
    expect(notice?.className).toContain("[@media(scripting:none)]:block");
  });

  it("every control has a visible label, a hint and no placeholder-only field", () => {
    renderForm(locale);

    const description = screen.getByLabelText(f.need.descriptionLabel);
    expect(description).toHaveAccessibleDescription(f.need.descriptionHint);
    expect(description).not.toHaveAttribute("placeholder");
  });

  it("does not move on when nothing is chosen: an error summary takes focus and each field says what is wrong", () => {
    renderForm(locale);

    fireEvent.click(next(locale));

    const summary = screen.getByRole("alert");
    expect(summary).toHaveTextContent(f.errors.summaryTitle);
    expect(summary).toHaveFocus();
    expect(
      within(summary).getByText(new RegExp(f.fields.need)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: f.need.legend }),
    ).toHaveAccessibleDescription(f.errors.choose);
    const description = screen.getByLabelText(f.need.descriptionLabel);
    expect(description).toHaveAttribute("aria-invalid", "true");
    expect(description).toHaveAccessibleDescription(
      `${f.need.descriptionHint} ${f.errors.required}`,
    );
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
      f.steps.need,
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("links an error in the summary to the field it belongs to", () => {
    renderForm(locale);

    fireEvent.click(next(locale));

    const link = within(screen.getByRole("alert")).getByRole("link", {
      name: f.fields.description,
    });
    expect(link.getAttribute("href")).toBe(
      `#${screen.getByLabelText(f.need.descriptionLabel).id}`,
    );
  });

  it("a too short description is `too short`, not `required`", () => {
    renderForm(locale);
    choose(f.need.options["ai-agents"]);
    fireEvent.change(screen.getByLabelText(f.need.descriptionLabel), {
      target: { value: "short" },
    });

    fireEvent.click(next(locale));

    expect(
      screen.getByLabelText(f.need.descriptionLabel),
    ).toHaveAccessibleDescription(
      `${f.need.descriptionHint} ${f.errors.tooShort}`,
    );
  });

  it("moves through the four steps and puts the focus on each step's heading", () => {
    renderForm(locale);

    stepOne(locale);
    expect(
      screen.getByRole("group", { name: f.budget.legend }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3 })).toHaveFocus();
    expect(
      screen
        .getByRole("navigation", { name: f.progressLabel })
        .querySelector('[aria-current="step"]'),
    ).toHaveTextContent(f.steps.budget);

    choose(f.budget.options["5k-15k"]);
    fireEvent.click(next(locale));
    expect(
      screen.getByRole("group", { name: f.timeline.legend }),
    ).toBeInTheDocument();

    choose(f.timeline.options.asap);
    fireEvent.click(next(locale));
    expect(screen.getByLabelText(f.contact.nameLabel)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: f.buttons.submit }),
    ).toBeInTheDocument();
  });

  it("going back keeps the answers", () => {
    renderForm(locale);
    stepOne(locale);

    fireEvent.click(screen.getByRole("button", { name: f.buttons.back }));

    expect(
      screen.getByRole("radio", { name: f.need.options["ai-agents"] }),
    ).toBeChecked();
    expect(
      screen.getByLabelText<HTMLTextAreaElement>(f.need.descriptionLabel).value,
    ).toBe(DESCRIPTION);
  });

  it("step 1 has no Back button", () => {
    renderForm(locale);

    expect(screen.queryByRole("button", { name: f.buttons.back })).toBeNull();
  });

  it("checks the details step: a bad email says so in words", () => {
    renderForm(locale);
    toContactStep(locale);
    fireEvent.change(screen.getByLabelText(f.contact.nameLabel), {
      target: { value: "Anna Test" },
    });
    fireEvent.change(screen.getByLabelText(f.contact.emailLabel), {
      target: { value: "not-an-email" },
    });

    fireEvent.click(screen.getByRole("button", { name: f.buttons.submit }));

    expect(
      screen.getByLabelText(f.contact.emailLabel),
    ).toHaveAccessibleDescription(
      `${f.contact.emailHint} ${f.errors.emailInvalid}`,
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("sends the whole inquiry in one submission, earlier steps included", async () => {
    renderForm(locale);
    toContactStep(locale);
    fillContact(locale);

    await submit(locale);

    expect(action).toHaveBeenCalledTimes(1);
    const data = action.mock.calls[0]?.[1] as FormData;
    expect(data.get("need")).toBe("ai-agents");
    expect(data.get("description")).toBe(DESCRIPTION);
    expect(data.get("budget")).toBe("5k-15k");
    expect(data.get("timeline")).toBe("asap");
    expect(data.get("name")).toBe("Anna Test");
    expect(data.get("email")).toBe("anna.test@example.com");
  });

  it("the marketing consent is a separate checkbox, unticked by default, and sending works without it", async () => {
    renderForm(locale);
    toContactStep(locale);
    fillContact(locale);

    const checkbox = screen.getByRole("checkbox", {
      name: f.consent.marketing,
    });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAccessibleDescription(f.consent.marketingHint);
    await submit(locale);

    const data = action.mock.calls[0]?.[1] as FormData;
    expect(data.get("marketingConsent")).toBeNull();
  });

  it("a ticked marketing consent is sent, and only when ticked", async () => {
    renderForm(locale);
    toContactStep(locale);
    fillContact(locale);
    fireEvent.click(
      screen.getByRole("checkbox", { name: f.consent.marketing }),
    );

    await submit(locale);

    expect(
      (action.mock.calls[0]?.[1] as FormData).get("marketingConsent"),
    ).toBe("on");
  });

  it("the marketing consent is not required: the checkbox has no required marker", () => {
    renderForm(locale);
    toContactStep(locale);

    expect(
      screen.getByRole("checkbox", { name: f.consent.marketing }),
    ).not.toBeRequired();
  });

  it("carries an empty honeypot that people never reach (hidden from assistive tech, out of the tab order)", async () => {
    const { container } = renderForm(locale);
    toContactStep(locale);
    fillContact(locale);

    const honeypot = container.querySelector('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
    await submit(locale);
    expect((action.mock.calls[0]?.[1] as FormData).get("website")).toBe("");
  });

  it("shows the privacy sentence with its legal basis; the notice is plain text until its page exists (no dead link)", () => {
    renderForm(locale);
    toContactStep(locale);

    const text = locale === "it" ? "informativa privacy" : "privacy notice";
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
    expect(screen.getByText(/art\. 6/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(text) })).toBeNull();
  });

  it("only the details step shows the privacy sentence", () => {
    renderForm(locale);

    expect(screen.queryByText(/art\. 6/)).toBeNull();
  });

  it("disables the button and marks it busy while the request is in flight (no double send)", async () => {
    // The request is held open and released at the end: React keeps a pending
    // action in a global queue, so one that never settles would stall later tests.
    let release: (result: SubmitResult) => void = () => undefined;
    action.mockReturnValue(
      new Promise<SubmitResult>((resolve) => {
        release = resolve;
      }),
    );
    renderForm(locale);
    toContactStep(locale);
    fillContact(locale);

    await submit(locale);

    const busy = screen.getByRole("button", { name: f.buttons.sending });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");

    await act(async () => {
      await Promise.resolve();
      release({ status: "error", code: "unavailable" });
    });
  });

  it.each([
    [
      "bot_check_failed",
      { status: "error", code: "bot_check_failed" },
      f.failure.bot_check_failed,
    ],
    [
      "unavailable",
      { status: "error", code: "unavailable" },
      f.failure.unavailable,
    ],
  ])(
    "shows a %s failure in words, in an alert that takes focus",
    async (_name, result, expected) => {
      action.mockResolvedValue(result);
      renderForm(locale);
      toContactStep(locale);
      fillContact(locale);

      await submit(locale);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(expected);
      await waitFor(() => {
        expect(alert).toHaveFocus();
      });
      expect(screen.getByLabelText(f.contact.nameLabel)).toBeInTheDocument(); // the visitor keeps what they typed
      expect(
        screen.getByLabelText<HTMLInputElement>(f.contact.nameLabel).value,
      ).toBe("Anna Test");
    },
  );

  it("tells a rate-limited visitor how long to wait, in minutes, rounded up", async () => {
    action.mockResolvedValue({
      status: "error",
      code: "rate_limited",
      retryAfterSec: 125,
    });
    renderForm(locale);
    toContactStep(locale);
    fillContact(locale);

    await submit(locale);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      f.failure.rate_limited.replace("{minutes}", "3"),
    );
  });

  it("sends the visitor back to the step the server rejected, with the error shown", async () => {
    action.mockResolvedValue({
      status: "error",
      code: "validation",
      fieldErrors: { budget: "invalid" },
    });
    renderForm(locale);
    toContactStep(locale);
    fillContact(locale);

    await submit(locale);

    expect(
      await screen.findByRole("group", { name: f.budget.legend }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(f.fields.budget);
    expect(
      screen.getByRole("group", { name: f.budget.legend }),
    ).toHaveAccessibleDescription(`${f.budget.hint} ${f.errors.invalid}`);
  });
});

describe("InquiryForm and Turnstile", () => {
  it("renders no Cloudflare container without a site key", () => {
    const { container } = renderForm("it");
    toContactStep("it");

    expect(container.querySelector("[data-turnstile]")).toBeNull();
    expect(screen.queryByText(it_.contact.form.turnstile)).toBeNull();
  });

  it("does not load Cloudflare on the first three steps, even with a site key (negative)", () => {
    const { container } = renderForm("it", {
      turnstileSiteKey: "1x00000000000000000000AA",
    });

    expect(container.querySelector("[data-turnstile]")).toBeNull();
    stepOne();
    expect(container.querySelector("[data-turnstile]")).toBeNull();
    expect(
      document.querySelector('script[src*="challenges.cloudflare.com"]'),
    ).toBeNull();
  });

  it("mounts the widget, with its disclosure and a token field, only on the details step", () => {
    const { container } = renderForm("it", {
      turnstileSiteKey: "1x00000000000000000000AA",
    });
    toContactStep("it");

    expect(container.querySelector("[data-turnstile]")).not.toBeNull();
    expect(screen.getByText(it_.contact.form.turnstile)).toBeInTheDocument();
    expect(container.querySelector('input[name="turnstileToken"]')).toHaveValue(
      "",
    );
  });
});

describe("InquiryForm: a pre-selected need (?service= from a service or a demo)", () => {
  it("starts with that option chosen and the rest unchosen, so the visitor only adds the description", () => {
    renderForm("it", { initialNeed: "ai-agents" });

    expect(
      screen.getByRole("radio", {
        name: it_.contact.form.need.options["ai-agents"],
      }),
    ).toBeChecked();
    expect(
      screen
        .getAllByRole("radio")
        .filter((radio) => (radio as HTMLInputElement).checked),
    ).toHaveLength(1);
  });

  it("can be changed: it is a suggestion, not a lock", () => {
    renderForm("it", { initialNeed: "ai-agents" });

    fireEvent.click(
      screen.getByRole("radio", {
        name: it_.contact.form.need.options["web-application"],
      }),
    );

    expect(
      screen.getByRole("radio", {
        name: it_.contact.form.need.options["web-application"],
      }),
    ).toBeChecked();
  });

  it("still asks for the description before moving on", () => {
    renderForm("it", { initialNeed: "ai-agents" });

    fireEvent.click(next("it"));

    expect(screen.getByRole("alert")).toHaveTextContent(
      it_.contact.form.fields.description,
    );
  });

  it("without it, nothing is chosen (negative)", () => {
    renderForm("it");

    expect(
      screen
        .getAllByRole("radio")
        .every((radio) => !(radio as HTMLInputElement).checked),
    ).toBe(true);
  });

  it("sends the pre-selected need with the form", async () => {
    renderForm("it", { initialNeed: "workflow-automation" });
    fireEvent.change(
      screen.getByLabelText(it_.contact.form.need.descriptionLabel),
      {
        target: {
          value:
            "A synthetic description that is long enough to pass validation.",
        },
      },
    );
    fireEvent.click(next("it"));
    choose(it_.contact.form.budget.options["5k-15k"]);
    fireEvent.click(next("it"));
    choose(it_.contact.form.timeline.options.asap);
    fireEvent.click(next("it"));
    fillContact("it");

    await submit("it");

    expect((action.mock.calls[0]?.[1] as FormData).get("need")).toBe(
      "workflow-automation",
    );
  });
});
