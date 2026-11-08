import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ComponentProps, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactView } from "@/components/contact/contact-view";
import { ThanksView } from "@/components/contact/thanks-view";
import { contactNextKeys, contactPrepareKeys } from "@/lib/content/site-map";
import type { Locale } from "@/i18n/routing";
import en from "../../../messages/en.json";
import it_ from "../../../messages/it.json";

vi.mock("@/i18n/navigation", async () => {
  const { createElement } = await import("react");
  return {
    usePathname: () => "/",
    Link: (props: { href: string } & ComponentProps<"a">) =>
      createElement("a", { ...props, href: `/it${props.href}` }),
  };
});

const messages = { it: it_, en } as const;

function renderIn(locale: Locale, ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe.each(["it", "en"] as const)("ContactView (%s)", (locale) => {
  const copy = messages[locale].contact;

  it("has one h1 and the approved lead, with the form where it belongs", () => {
    renderIn(
      locale,
      <ContactView available form={<form aria-label="the form" />} />,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      copy.title,
    );
    expect(screen.getByText(copy.lead)).toBeInTheDocument();
    expect(screen.getByText(copy.informal)).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "the form" })).toBeInTheDocument();
  });

  it("lists what helps and what happens next, from the approved copy, in order", () => {
    renderIn(locale, <ContactView available form={null} />);

    const prepare = screen.getByRole("region", { name: copy.prepare.title });
    expect(
      within(prepare)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(contactPrepareKeys.map((key) => copy.prepare.items[key].title));
    const next = screen.getByRole("region", { name: copy.next.title });
    expect(
      within(next)
        .getAllByRole("heading", { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(contactNextKeys.map((key) => copy.next.items[key].title));
  });

  it("promises no response time (nothing is invented)", () => {
    const { container } = renderIn(
      locale,
      <ContactView available form={null} />,
    );

    expect(container.textContent).not.toMatch(
      /\d+\s?(?:ore|giorni|hours|days|h\b)|24\/7|entro/i,
    );
  });

  it("when the site cannot take inquiries it says so and shows no form (negative)", () => {
    renderIn(
      locale,
      <ContactView available={false} form={<form aria-label="the form" />} />,
    );

    expect(screen.queryByRole("form")).toBeNull();
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent(copy.form.unavailable.title);
    expect(notice).toHaveTextContent(copy.form.unavailable.body);
  });

  it("shows the booking option after the form and the lists when one is given, and nothing when it is not", () => {
    const { container } = renderIn(
      locale,
      <ContactView
        available
        form={<form aria-label="the form" />}
        booking={<section aria-label="the booking" />}
      />,
    );

    const form = screen.getByRole("form", { name: "the form" });
    const booking = screen.getByRole("region", { name: "the booking" });
    expect(
      form.compareDocumentPosition(booking) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    cleanup();

    const without = renderIn(
      locale,
      <ContactView available form={<form aria-label="the form" />} />,
    );
    expect(without.container.textContent).not.toContain(
      container.querySelector("[aria-label='the booking']")?.textContent ??
        "never",
    );
    expect(screen.queryByRole("region", { name: "the booking" })).toBeNull();
  });

  it("the form is unchanged by the booking option: same form, same place", () => {
    renderIn(
      locale,
      <ContactView
        available
        form={<form aria-label="the form" />}
        booking={<div>booking</div>}
      />,
    );

    expect(screen.getByRole("form", { name: "the form" })).toBeInTheDocument();
  });

  it("keeps heading levels in order: h1, then h2 sections, then h3 items", () => {
    renderIn(locale, <ContactView available form={null} />);

    const levels = screen
      .getAllByRole("heading")
      .map((h) => Number(h.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]).toBeLessThanOrEqual((levels[i - 1] ?? 0) + 1);
    }
  });
});

describe.each(["it", "en"] as const)("ThanksView (%s)", (locale) => {
  const copy = messages[locale].contact.thanks;

  it("confirms in one h1 and says what happens next, without repeating anything the visitor sent", () => {
    const { container } = renderIn(locale, <ThanksView />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      copy.title,
    );
    expect(screen.getByText(copy.body)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/@/);
  });

  it("offers a way back that exists", () => {
    renderIn(locale, <ThanksView />);

    expect(screen.getByRole("link", { name: copy.home })).toHaveAttribute(
      "href",
      "/it/",
    );
  });
});
