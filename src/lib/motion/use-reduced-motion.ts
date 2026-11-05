import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", onChange);
  return () => {
    list.removeEventListener("change", onChange);
  };
}

/**
 * True while the visitor asks for reduced motion. It follows changes live (the
 * OS setting can change while the page is open).
 *
 * On the server and during hydration it is `false`: content is server-rendered
 * in its final state either way, and the real value takes over right after
 * hydration without a mismatch warning.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
