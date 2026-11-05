import { useSyncExternalStore } from "react";

/**
 * True while `query` matches; follows changes live. `false` on the server and
 * during hydration, so server HTML and the first client render agree.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => {
        list.removeEventListener("change", onChange);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
