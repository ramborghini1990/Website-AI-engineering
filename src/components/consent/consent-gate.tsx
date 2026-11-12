"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { allows, useConsent } from "@/lib/consent/client";
import type { ConsentCategory } from "@/lib/consent/registry";

/**
 * Wrapper for a third-party embed (CLAUDE.md §10). `children` are NOT RENDERED
 * until the visitor allows them: no iframe, no script, no image, no preconnect,
 * so the browser makes no request to the provider (ROADMAP P2.7). Two ways in:
 * the visitor presses the button (for this page view only), or has said yes to
 * this category in the cookie banner (P4.1), which the cookie remembers. Every
 * new cookie decision (reject, withdraw) closes the gate again. This component
 * itself writes nothing: the choice lives in `lib/consent/client.ts`.
 *
 * It says who the third party is and what it will receive, before the click, and
 * always offers a plain link as an alternative that needs no embed and no
 * JavaScript (opening it is the visitor's own navigation). Without JavaScript the
 * button is hidden (`@media (scripting: none)`) so only the link is offered.
 *
 * After loading, focus moves to the embed's region so keyboard and screen-reader
 * users land on it.
 */
export function ConsentGate({
  category,
  provider,
  title,
  body,
  loadLabel,
  fallbackHref,
  fallbackLabel,
  newTabLabel,
  children,
}: {
  category: ConsentCategory;
  provider: string;
  title: string;
  body: string;
  loadLabel: string;
  fallbackHref: string;
  fallbackLabel: string;
  /** Screen-reader text appended to the fallback link: "(opens in a new tab)". */
  newTabLabel: string;
  children: ReactNode;
}) {
  const consent = useConsent();
  // The revision of the choice at the moment of the click; `null` = not clicked.
  const [clickedAt, setClickedAt] = useState<number | null>(null);
  const region = useRef<HTMLDivElement>(null);

  // Open for a stored "yes" to this category, or for the visitor's own click.
  // A click holds only until the next decision about cookies: rejecting or
  // withdrawing unloads the embed, as easy as accepting loaded it.
  const allowed = allows(consent, category);
  const clicked = clickedAt !== null && clickedAt === consent.revision;
  const loaded = allowed || clicked;

  useEffect(() => {
    // Only the visitor's click moves focus; an embed opened by a stored "yes" must not steal it.
    if (clicked && !allowed) region.current?.focus();
  }, [clicked, allowed]);

  return (
    <div
      data-consent-gate={category}
      data-provider={provider}
      data-state={loaded ? "loaded" : "blocked"}
      className="grid gap-4"
    >
      {loaded ? (
        <div
          ref={region}
          role="region"
          aria-label={title}
          tabIndex={-1}
          className="outline-none"
        >
          {children}
        </div>
      ) : (
        <div className="grid gap-4 border border-border-strong bg-surface-2 p-6">
          <p className="text-lg font-medium text-text">{title}</p>
          <p className="max-w-prose text-base text-text-secondary">{body}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="button"
              size="lg"
              className="[@media(scripting:none)]:hidden"
              onClick={() => {
                setClickedAt(consent.revision);
              }}
            >
              {loadLabel}
            </Button>
          </div>
        </div>
      )}
      <a
        href={fallbackHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 w-fit items-center text-base text-accent underline decoration-accent underline-offset-4 hover:text-accent-hover"
      >
        {fallbackLabel}
        {/* The space is outside the sr-only span so the name reads "label (opens in a new tab)". */}{" "}
        <span className="sr-only">{newTabLabel}</span>
      </a>
    </div>
  );
}
