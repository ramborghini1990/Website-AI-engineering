/**
 * Theme choice (docs/DESIGN.md §8): "system" follows the OS, "dark" and "light"
 * force a theme with a class on <html>. The choice is stored on the visitor's
 * device in ONE localStorage key, only when they pick dark or light (choosing
 * "system" removes it). It is a functional preference, set by the visitor's own
 * action, and must appear in the storage table of the cookie policy (P4.2).
 */
export const THEME_STORAGE_KEY = "theme";

export type ThemeChoice = "system" | "dark" | "light";

const CHANGE_EVENT = "themechange";

/** The stored choice, or "system". Never throws (storage can be blocked). */
export function readStoredTheme(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "dark" || value === "light" ? value : "system";
  } catch {
    return "system";
  }
}

function setRootClass(choice: ThemeChoice) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (choice !== "system") root.classList.add(choice);
}

/**
 * Put a STORED choice back on <html>. Needed after a client-side navigation
 * that remounts the root layout (switching language does): the new <html>
 * element never ran the pre-paint script.
 *
 * With nothing stored it does nothing, on purpose: a fresh <html> has no theme
 * class, and stripping classes here would clobber one set by anything else
 * (devtools, an extension, a test) the moment React hydrates. Removing a class
 * is the job of `applyTheme("system")` and of the cross-tab `storage` handler.
 */
export function syncThemeFromStorage() {
  const stored = readStoredTheme();
  if (stored !== "system") setRootClass(stored);
}

/** Apply a choice now and remember it (or forget it for "system"). */
export function applyTheme(choice: ThemeChoice) {
  setRootClass(choice);
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Subscribe to changes made in this tab (our own event) and in other tabs
 * (`storage`), keeping the class on <html> in step with the stored choice.
 */
export function subscribeTheme(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      setRootClass(readStoredTheme());
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Inline script that runs before first paint so a stored choice does not flash
 * the wrong theme. A constant: it contains no user input. It needs the CSP
 * nonce (the layout passes it) and must stay tiny and free of `<` and `&`.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"||t==="light"){document.documentElement.classList.add(t)}}catch(e){}})()`;
