"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { trackDemoEvent } from "@/lib/analytics/client";
import type { InteractiveDemo } from "@/lib/demos/registry";

/**
 * The three leaves that report the demo funnel (P3.5). They only call
 * `trackDemoEvent`, which sends `{ event, demo }` to this site: no storage, no
 * id, no third party. The demos themselves import nothing but `useDemoCompleted`.
 */

/** Wraps the demo: the first click inside it (a keyboard press on a button is a click too) is `demo_started`. */
export function DemoStartTracker({
  demo,
  children,
}: {
  demo: InteractiveDemo;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (node === null) return;
    const onClick = () => {
      trackDemoEvent("demo_started", demo);
    };
    node.addEventListener("click", onClick, { capture: true, once: true });
    return () => {
      node.removeEventListener("click", onClick, { capture: true });
    };
  }, [demo]);

  return <div ref={ref}>{children}</div>;
}

/** A demo calls this with its own "done" condition; the event fires when it first becomes true. */
export function useDemoCompleted(demo: InteractiveDemo, completed: boolean) {
  useEffect(() => {
    if (completed) trackDemoEvent("demo_completed", demo);
  }, [demo, completed]);
}

/** The call to action under a demo: a normal link into the inquiry form, plus `cta_clicked`. */
export function DemoCta({
  demo,
  href,
  label,
}: {
  demo: InteractiveDemo;
  href: string;
  label: string;
}) {
  return (
    <Button asChild size="lg">
      <Link
        href={href}
        onClick={() => {
          trackDemoEvent("cta_clicked", demo);
        }}
      >
        {label}
      </Link>
    </Button>
  );
}
