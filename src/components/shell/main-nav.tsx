"use client";

import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import type { NavItem } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/**
 * Main navigation. Only the items it is given are rendered (see
 * `availableNavItems`): no link to a page that does not exist. The current
 * page carries `aria-current="page"` and is also underlined, so it is not
 * signalled by colour alone. Items wrap onto a second line on narrow screens;
 * with more than about five items, switch to a menu (Sheet) instead.
 */
export function MainNav({
  items,
  className,
}: {
  items: readonly Pick<NavItem, "key" | "href">[];
  className?: string;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  if (items.length === 0) return null;

  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex flex-wrap gap-1">
        {items.map(({ key, href }) => {
          const current =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-sm px-3 text-base transition-colors duration-(--duration-fast) ease-standard",
                  current
                    ? "font-semibold text-text underline decoration-accent decoration-2 underline-offset-8"
                    : "text-text-secondary hover:text-text",
                )}
              >
                {t(`items.${key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
