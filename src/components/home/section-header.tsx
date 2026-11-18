import type { ReactNode } from "react";

/**
 * A section's heading block: an h2 and an optional lead. Sections are bands
 * with a hairline on top (docs/DESIGN.md §7), not cards.
 *
 * `index` adds the instrument-panel label "NN / Label" above the h2. It is
 * orientation only and repeats nearby text, so it is hidden from assistive
 * technology (docs/DESIGN.md §7).
 */
export function SectionHeader({
  id,
  title,
  lead,
  index,
}: {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  index?: { n: number; label: string };
}) {
  return (
    <div className="grid gap-4">
      {index ? (
        // A span, not a paragraph: it is decoration, not prose.
        <span
          aria-hidden="true"
          className="font-mono text-xs text-text-muted uppercase"
        >
          {String(index.n).padStart(2, "0")} / {index.label}
        </span>
      ) : null}
      <h2 id={id} className="max-w-3xl text-3xl text-text">
        {title}
      </h2>
      {lead ? (
        <p className="max-w-prose text-lg text-text-secondary">{lead}</p>
      ) : null}
    </div>
  );
}
