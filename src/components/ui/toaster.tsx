"use client";

import { CircleAlert, CircleCheck, Info } from "lucide-react";

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import {
  dismissToast,
  useToasts,
  type ToastVariant,
} from "@/components/ui/use-toast";

const ICONS = {
  default: { Icon: Info, className: "text-trace" },
  success: { Icon: CircleCheck, className: "text-success" },
  danger: { Icon: CircleAlert, className: "text-danger" },
} satisfies Record<ToastVariant, { Icon: typeof Info; className: string }>;

/**
 * Renders the toast queue. Mount once near the root. Errors stay until the
 * visitor dismisses them (WCAG 2.2.1: no timed message that cannot be
 * extended); others close after 8s, paused while hovered or focused (Radix).
 * Both labels are translated by the caller.
 */
export function Toaster({
  viewportLabel,
  closeLabel,
}: {
  viewportLabel: string;
  closeLabel: string;
}) {
  const toasts = useToasts();

  return (
    <ToastProvider duration={8000}>
      {toasts.map(({ id, title, description, variant, action, open }) => {
        const { Icon, className } = ICONS[variant];
        return (
          <Toast
            key={id}
            variant={variant}
            open={open}
            type={variant === "danger" ? "foreground" : "background"}
            duration={variant === "danger" ? Infinity : undefined}
            onOpenChange={(next) => {
              if (!next) dismissToast(id);
            }}
          >
            <Icon
              aria-hidden="true"
              className={`mt-0.5 size-5 shrink-0 ${className}`}
            />
            <div className="grid gap-1">
              {title ? <ToastTitle>{title}</ToastTitle> : null}
              {description ? (
                <ToastDescription>{description}</ToastDescription>
              ) : null}
              {action ? (
                <ToastAction altText={action.altText} onClick={action.onClick}>
                  {action.label}
                </ToastAction>
              ) : null}
            </div>
            <ToastClose label={closeLabel} />
          </Toast>
        );
      })}
      <ToastViewport label={viewportLabel} />
    </ToastProvider>
  );
}
