import { useEffect, useState } from "react";

/** Becomes true once the browser is idle, so loading motion code never competes with first render. */
export function useAfterIdle(): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback(
        () => {
          setIdle(true);
        },
        { timeout: 2000 },
      );
      return () => {
        cancelIdleCallback(handle);
      };
    }
    const handle = window.setTimeout(() => {
      setIdle(true);
    }, 200);
    return () => {
      window.clearTimeout(handle);
    };
  }, []);
  return idle;
}
