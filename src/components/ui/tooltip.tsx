"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tooltips only supplement an accessible name; they must never be the only
 * place information lives (touch users and some assistive tech never see them).
 * Mount one TooltipProvider near the root of the tree that uses tooltips.
 */
function TooltipProvider({
  delayDuration = 300,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-(--z-popover) max-w-xs rounded-sm border border-border-subtle bg-surface-3 px-3 py-1.5 text-sm text-text shadow-popover data-[state=closed]:animate-popover-out data-[state=delayed-open]:animate-popover-in data-[state=instant-open]:animate-popover-in",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
