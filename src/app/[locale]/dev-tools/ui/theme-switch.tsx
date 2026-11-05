"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

type Mode = "system" | "dark" | "light";
const MODES: readonly Mode[] = ["system", "dark", "light"];

/**
 * Dev-only preview of the theme model from docs/DESIGN.md §8 (class on <html>,
 * none = follow the system). The real switch and its storage key come with P1.8.
 */
export function ThemeSwitch() {
  const [mode, setMode] = useState<Mode>("system");

  function apply(next: Mode) {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (next !== "system") root.classList.add(next);
    setMode(next);
  }

  return (
    <div
      role="group"
      aria-label="Theme preview"
      className="flex flex-wrap gap-2"
    >
      {MODES.map((m) => (
        <Button
          key={m}
          variant={mode === m ? "primary" : "secondary"}
          aria-pressed={mode === m}
          onClick={() => {
            apply(m);
          }}
        >
          {m}
        </Button>
      ))}
    </div>
  );
}
