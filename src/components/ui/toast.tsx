"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import type * as React from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitive.Provider;

/** Radix makes the viewport reachable with the F8 hotkey; it needs a translated `label`. */
function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Viewport>) {
  return (
    <ToastPrimitive.Viewport
      className={cn(
        "pointer-events-none fixed right-0 bottom-0 z-(--z-toast) flex max-h-dvh w-full flex-col-reverse gap-2 p-4 sm:max-w-sm",
        className,
      )}
      {...props}
    />
  );
}

/** Status is carried by the icon and the text too (see Toaster), not by the border colour alone. */
const toastVariants = cva(
  "pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border bg-surface-2 p-4 pr-12 text-text shadow-popover data-[state=closed]:animate-toast-out data-[state=open]:animate-toast-in data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x) data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)",
  {
    variants: {
      variant: {
        default: "border-border-strong",
        success: "border-success",
        danger: "border-danger",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Toast({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Root> &
  VariantProps<typeof toastVariants>) {
  return (
    <ToastPrimitive.Root
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
}

function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Title>) {
  return (
    <ToastPrimitive.Title
      className={cn("text-base font-semibold text-text", className)}
      {...props}
    />
  );
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Description>) {
  return (
    <ToastPrimitive.Description
      className={cn("text-sm text-text-secondary", className)}
      {...props}
    />
  );
}

function ToastAction({
  className,
  ...props
}: React.ComponentProps<typeof ToastPrimitive.Action>) {
  return (
    <ToastPrimitive.Action
      className={cn(
        buttonVariants({ variant: "secondary" }),
        "mt-2",
        className,
      )}
      {...props}
    />
  );
}

function ToastClose({
  className,
  label,
  ...props
}: Omit<React.ComponentProps<typeof ToastPrimitive.Close>, "children"> & {
  /** Accessible name of the close button (translated by the caller). */
  label: string;
}) {
  return (
    <ToastPrimitive.Close
      className={cn(
        "absolute top-1 right-1 inline-flex size-11 items-center justify-center rounded-sm text-text-secondary transition-colors duration-(--duration-fast) ease-standard hover:bg-surface-3 hover:text-text",
        className,
      )}
      {...props}
    >
      <X aria-hidden="true" className="size-5" />
      <span className="sr-only">{label}</span>
    </ToastPrimitive.Close>
  );
}

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
};
