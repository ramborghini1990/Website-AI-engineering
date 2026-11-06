import type { ReactNode } from "react";

/**
 * A section's heading block: an h2 and an optional lead. Sections are bands
 * with a hairline on top (docs/DESIGN.md §7), not cards.
 */
export function SectionHeader({
  id,
  title,
  lead,
}: {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <div className="grid gap-4">
      <h2 id={id} className="max-w-3xl text-3xl text-text">
        {title}
      </h2>
      {lead ? (
        <p className="max-w-prose text-lg text-text-secondary">{lead}</p>
      ) : null}
    </div>
  );
}
