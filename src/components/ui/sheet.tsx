"use client";

import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

// A sheet is a dialog docked to an edge: same Radix behaviour (focus trap,
// Escape, focus return), different geometry and animation.
const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;
const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-(--z-modal) bg-bg/80 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in",
        className,
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  "fixed z-(--z-modal) flex flex-col gap-4 overflow-y-auto border-border-subtle bg-surface-1 p-6 shadow-modal",
  {
    variants: {
      side: {
        right:
          "inset-y-0 right-0 h-full w-3/4 max-w-sm border-l data-[state=closed]:animate-sheet-right-out data-[state=open]:animate-sheet-right-in",
        left: "inset-y-0 left-0 h-full w-3/4 max-w-sm border-r data-[state=closed]:animate-sheet-left-out data-[state=open]:animate-sheet-left-in",
        top: "inset-x-0 top-0 max-h-[85dvh] border-b data-[state=closed]:animate-sheet-top-out data-[state=open]:animate-sheet-top-in",
        bottom:
          "inset-x-0 bottom-0 max-h-[85dvh] border-t data-[state=closed]:animate-sheet-bottom-out data-[state=open]:animate-sheet-bottom-in",
      },
    },
    defaultVariants: { side: "right" },
  },
);

type SheetContentProps = React.ComponentProps<typeof SheetPrimitive.Content> &
  VariantProps<typeof sheetVariants> & {
    /** Accessible name of the close button. Required: copy comes from i18n messages. */
    closeLabel: string;
  };

function SheetContent({
  className,
  children,
  side,
  closeLabel,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        className={cn(sheetVariants({ side }), className)}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-sm text-text-secondary transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-3 hover:text-text">
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">{closeLabel}</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5 pr-10", className)} {...props} />;
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mt-auto flex flex-col gap-2", className)} {...props} />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      className={cn("text-xl font-semibold text-text", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      className={cn("text-base text-text-secondary", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
