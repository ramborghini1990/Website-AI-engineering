import type * as React from "react";

import { cn } from "@/lib/utils";

/** Same field language as Input; grows vertically only. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full min-w-0 resize-y rounded-sm border border-border-strong bg-surface-2 px-3 py-2.5 text-base text-text transition-colors duration-(--duration-fast) ease-standard placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
