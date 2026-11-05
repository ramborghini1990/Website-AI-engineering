"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny external store behind <Toaster />. Client-only on purpose: calling
 * toast() on the server would share state between requests.
 */

export type ToastVariant = "default" | "success" | "danger";

export type ToastAction = {
  label: string;
  /** Radix requires an alternative description for the action (screen readers and F8 hotkey users). */
  altText: string;
  onClick: () => void;
};

export type ToastOptions = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ToastAction;
};

export type ToastItem = ToastOptions & {
  id: string;
  variant: ToastVariant;
  open: boolean;
};

/** Newest toasts win; older ones are dropped beyond this many. */
const LIMIT = 3;
/** Keep a closed toast mounted long enough for its exit animation. */
const REMOVE_DELAY_MS = 600;

const EMPTY: readonly ToastItem[] = [];
let items: readonly ToastItem[] = EMPTY;
let counter = 0;
const listeners = new Set<() => void>();
const removalTimers = new Map<string, ReturnType<typeof setTimeout>>();

function setItems(next: readonly ToastItem[]) {
  items = next;
  for (const listener of listeners) listener();
}

export function dismissToast(id: string) {
  setItems(items.map((t) => (t.id === id ? { ...t, open: false } : t)));
  if (removalTimers.has(id)) return;
  removalTimers.set(
    id,
    setTimeout(() => {
      removalTimers.delete(id);
      setItems(items.filter((t) => t.id !== id));
    }, REMOVE_DELAY_MS),
  );
}

export function toast(options: ToastOptions): {
  id: string;
  dismiss: () => void;
} {
  counter += 1;
  const id = String(counter);
  setItems(
    [
      { ...options, variant: options.variant ?? "default", id, open: true },
      ...items,
    ].slice(0, LIMIT),
  );
  return {
    id,
    dismiss: () => {
      dismissToast(id);
    },
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useToasts(): readonly ToastItem[] {
  return useSyncExternalStore(
    subscribe,
    () => items,
    () => EMPTY,
  );
}
