"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        "fixed inset-0 z-(--z-modal) bg-bg/80 data-[state=closed]:animate-overlay-out data-[state=open]:animate-overlay-in",
        className,
      )}
      {...props}
    />
  );
}

type DialogContentProps = React.ComponentProps<
  typeof DialogPrimitive.Content
> & {
  /** Accessible name of the close button. Required: copy comes from i18n messages, not from this component. */
  closeLabel: string;
};

/**
 * Modal dialog. Radix provides the focus trap, Escape to close, focus return
 * to the trigger and `aria-modal`. Always render a DialogTitle (and a
 * DialogDescription, or pass `aria-describedby={undefined}` deliberately).
 */
function DialogContent({
  className,
  children,
  closeLabel,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed top-1/2 left-1/2 z-(--z-modal) grid max-h-[85dvh] w-[calc(100%-var(--spacing-gutter)*2)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-md border border-border-subtle bg-surface-1 p-6 shadow-modal data-[state=closed]:animate-dialog-out data-[state=open]:animate-dialog-in",
          className,
        )}
        data-lenis-prevent
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute top-2 right-2 inline-flex size-11 items-center justify-center rounded-sm text-text-secondary transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-3 hover:text-text">
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">{closeLabel}</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5 pr-10", className)} {...props} />;
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn("text-xl font-semibold text-text", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-base text-text-secondary", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};
