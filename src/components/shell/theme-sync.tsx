"use client";

import { useLayoutEffect } from "react";

import { syncThemeFromStorage } from "@/lib/theme";

/**
 * Keeps the stored theme on <html> across navigations that remount the root
 * layout (switching language does). It runs in a layout effect, before the
 * browser paints, so there is no flash of the system theme. The first page load
 * is handled by the inline script in the layout instead (`themeInitScript`).
 * Renders nothing.
 */
export function ThemeSync() {
  useLayoutEffect(() => {
    syncThemeFromStorage();
  }, []);
  return null;
}
