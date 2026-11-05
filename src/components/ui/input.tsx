import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * 44px high, 16px text (no iOS zoom on focus), boundary in `border-strong`
 * (3:1 against the surfaces, docs/DESIGN.md §2). Pair with a visible <Label>;
 * errors: set `aria-invalid` and link the message with `aria-describedby`.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full min-w-0 rounded-sm border border-border-strong bg-surface-2 px-3 text-base text-text transition-colors duration-(--duration-fast) ease-standard placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
