"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

import {
  applyTheme,
  readStoredTheme,
  subscribeTheme,
  type ThemeChoice,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "system", Icon: Monitor },
  { value: "dark", Icon: Moon },
  { value: "light", Icon: Sun },
] as const satisfies ReadonlyArray<{ value: ThemeChoice; Icon: typeof Sun }>;

const subscribeNever = () => () => undefined;

/**
 * Three-way theme choice: automatic, dark, light (docs/DESIGN.md §8).
 *
 * Native radio buttons in a fieldset, so the group, the arrow-key behaviour and
 * the selected state come from the browser, not from ARIA. Each option is a
 * 44 px icon button with a screen-reader label; the selected one is filled, so
 * it is not signalled by colour alone. Disabled until hydrated, because without
 * JavaScript a choice could not be applied.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const choice = useSyncExternalStore<ThemeChoice>(
    subscribeTheme,
    readStoredTheme,
    () => "system",
  );
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );

  return (
    <fieldset disabled={!hydrated} className={cn("min-w-0", className)}>
      <legend className="sr-only">{t("label")}</legend>
      <div className="flex rounded-sm border border-border-strong">
        {OPTIONS.map(({ value, Icon }) => (
          <label
            key={value}
            title={t(value)}
            className="relative inline-flex size-11 shrink-0 cursor-pointer items-center justify-center text-text-secondary transition-colors duration-(--duration-fast) ease-standard first:rounded-l-[inherit] last:rounded-r-[inherit] hover:text-text has-checked:bg-surface-3 has-checked:text-text has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={choice === value}
              onChange={() => {
                applyTheme(value);
              }}
              className="sr-only"
            />
            <Icon aria-hidden="true" className="size-5" />
            <span className="sr-only">{t(value)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
