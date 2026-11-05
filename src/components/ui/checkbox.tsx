"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The box is 24px; the pseudo-element extends the hit area to 44x44 without
 * changing the layout. Checked state is shown by fill AND an icon, never by
 * colour alone. Always render it next to a <Label htmlFor>.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "group peer relative size-6 shrink-0 rounded-xs border border-border-strong bg-surface-2 text-on-accent transition-colors duration-(--duration-fast) ease-standard after:absolute after:-inset-2.5 after:content-[''] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        <Check
          aria-hidden="true"
          className="hidden size-4 group-data-[state=checked]:block"
          strokeWidth={2.5}
        />
        <Minus
          aria-hidden="true"
          className="hidden size-4 group-data-[state=indeterminate]:block"
          strokeWidth={2.5}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
