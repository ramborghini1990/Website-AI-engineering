import { vi } from "vitest";

type Listener = (event: { matches: boolean; media: string }) => void;

/**
 * jsdom has no `matchMedia`. This fake answers the reduced-motion queries from
 * one flag, answers the pointer query from another, and lets a test flip them
 * while the code under test is subscribed.
 *
 *   const media = mockReducedMotion(false);
 *   media.set(true); // fires "change" on every subscribed query
 *   mockReducedMotion(false, { finePointer: true }); // a desktop mouse
 */
export function mockReducedMotion(
  initial: boolean,
  options: { finePointer?: boolean } = {},
) {
  let reduced = initial;
  const finePointer = options.finePointer ?? false;
  const subscribers = new Map<string, Set<Listener>>();

  const matchesFor = (query: string) => {
    if (query.includes("prefers-reduced-motion: reduce")) return reduced;
    if (query.includes("prefers-reduced-motion: no-preference"))
      return !reduced;
    if (query.includes("hover: hover") && query.includes("pointer: fine"))
      return finePointer;
    return false;
  };

  const matchMedia = vi.fn((query: string) => {
    const listeners = subscribers.get(query) ?? new Set<Listener>();
    subscribers.set(query, listeners);
    return {
      get matches() {
        return matchesFor(query);
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, listener: Listener) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: Listener) => {
        listeners.delete(listener);
      },
      // legacy API, used by GSAP's matchMedia
      addListener: (listener: Listener) => {
        listeners.add(listener);
      },
      removeListener: (listener: Listener) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    };
  });

  vi.stubGlobal("matchMedia", matchMedia);
  window.matchMedia = matchMedia as unknown as typeof window.matchMedia;

  return {
    set(next: boolean) {
      reduced = next;
      for (const [query, listeners] of subscribers) {
        for (const listener of [...listeners]) {
          listener({ matches: matchesFor(query), media: query });
        }
      }
    },
    /** Number of live subscriptions, to prove cleanup. */
    listenerCount() {
      let count = 0;
      for (const listeners of subscribers.values()) count += listeners.size;
      return count;
    },
  };
}
