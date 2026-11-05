import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge our custom token names (see src/app/globals.css) so
// `shadow-popover` / `ease-standard` merge with their Tailwind siblings.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      shadow: [{ shadow: ["popover", "modal", "glow-accent"] }],
      ease: [{ ease: ["standard"] }],
    },
  },
});

/** Compose class names (clsx) and resolve Tailwind conflicts (tailwind-merge). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
