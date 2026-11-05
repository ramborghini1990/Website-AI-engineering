import type { ReactNode } from "react";

import { meshOpacity } from "@/components/fx/fx-tokens";
import { cn } from "@/lib/utils";

const BLOB =
  "absolute bg-[radial-gradient(closest-side,var(--color-accent),transparent)]";

/**
 * Ambient background: three large, very faint accent blobs that drift slowly.
 * Wrap the content that sits on it; the wrapper isolates the layers so nothing
 * leaks behind the rest of the page, and clips them so they never add scroll.
 *
 * Server component, no JavaScript: the blobs are CSS (transform-only keyframes
 * from the `--animate-mesh-*` tokens). Without CSS animation (reduced motion,
 * tokens set to `none`) the same blobs are simply still. They are decorative
 * (`aria-hidden`), carry no information, and `fx-contrast.test.ts` proves text
 * contrast over them.
 *
 * Deliberately not a `<canvas>`: no frame loop to own or pause, no pixel cost,
 * and a static fallback that is the same markup.
 */
export function GradientMesh({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-fx="gradient-mesh"
      className={cn("relative isolate overflow-hidden", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div
          className={cn(BLOB, "-top-1/3 -left-1/4 size-3/4 animate-mesh-a")}
          style={{ opacity: meshOpacity.a }}
        />
        <div
          className={cn(BLOB, "top-1/4 -right-1/4 size-2/3 animate-mesh-b")}
          style={{ opacity: meshOpacity.b }}
        />
        <div
          className={cn(BLOB, "-bottom-1/3 left-1/4 size-3/4 animate-mesh-c")}
          style={{ opacity: meshOpacity.c }}
        />
      </div>
      {children}
    </div>
  );
}
