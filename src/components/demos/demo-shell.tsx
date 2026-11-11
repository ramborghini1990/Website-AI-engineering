import type { ReactNode } from "react";

import { DemoCta, DemoStartTracker } from "@/components/demos/demo-funnel";
import type { InteractiveDemo } from "@/lib/demos/registry";

/**
 * The frame every demo sits in (a small start of P3.0's demo shell): a title
 * with a "Simulation" badge, the disclosure of what the visitor is looking at
 * (visible BEFORE the first interaction), a notice for visitors without
 * JavaScript, the demo itself, and a call to action into the inquiry funnel
 * that pre-selects the service (`?service=`), never any personal data.
 *
 * Server-renderable: the disclosure and the call to action are in the HTML. The
 * `demo` slug only names the funnel the cookieless counters (P3.5) belong to.
 */
export function DemoShell({
  demo,
  id,
  title,
  badge,
  disclosure,
  noscript,
  cta,
  children,
}: {
  demo: InteractiveDemo;
  id: string;
  title: string;
  badge: string;
  disclosure: { title: string; body: string };
  noscript: string;
  cta: { title: string; body: string; label: string; href: string };
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid gap-8 border-t border-border-subtle pt-12"
    >
      <div className="flex flex-wrap items-center gap-4">
        <h2 id={`${id}-title`} className="text-3xl text-text">
          {title}
        </h2>
        <span className="border border-accent px-3 py-1 font-mono text-xs text-text uppercase">
          {badge}
        </span>
      </div>

      <div
        data-demo-disclosure=""
        className="grid max-w-3xl gap-2 border border-border-strong bg-surface-2 p-5"
      >
        <p className="font-medium text-text">{disclosure.title}</p>
        <p className="text-base text-text-secondary">{disclosure.body}</p>
      </div>

      {/* Shown only where scripting is off; people with JavaScript never see it. */}
      <p
        data-no-js-notice=""
        className="hidden max-w-3xl border border-border-strong p-4 text-base text-text [@media(scripting:none)]:block"
      >
        {noscript}
      </p>

      <DemoStartTracker demo={demo}>{children}</DemoStartTracker>

      <div className="grid max-w-3xl gap-4 border-t border-border-strong pt-8">
        <h3 className="text-2xl text-text">{cta.title}</h3>
        <p className="text-base text-text-secondary">{cta.body}</p>
        <div>
          <DemoCta demo={demo} href={cta.href} label={cta.label} />
        </div>
      </div>
    </section>
  );
}
