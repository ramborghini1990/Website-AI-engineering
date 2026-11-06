/**
 * The site's navigation, as data. Planned information architecture (P2.1):
 * Home, Services, Work, Process, About, plus the contact call to action.
 *
 * A link is rendered only when its page exists (`available: true`), so the
 * header never points a visitor at a 404. When a page ships, flip its flag.
 * Labels live in messages (`nav.items.<key>`); `href` is locale-less and the
 * i18n `Link` adds the prefix.
 */
export const navItems = [
  { key: "home", href: "/", available: true },
  { key: "services", href: "/services", available: true },
  { key: "work", href: "/work", available: true },
  { key: "process", href: "/process", available: false },
  { key: "about", href: "/about", available: false },
] as const;

export type NavItem = (typeof navItems)[number];

export const availableNavItems: readonly NavItem[] = navItems.filter(
  (item) => item.available,
);

/**
 * Whether the page behind a navigation key exists yet. Pages use this to decide
 * whether to render a link to it (no link to a 404): the services cards on Home
 * link to `/services/<slug>` only once the services pages ship.
 */
export function isPageAvailable(key: NavItem["key"]): boolean {
  return navItems.some((item) => item.key === key && item.available);
}

/** Whether the inquiry page (P2.5) exists. Flip it when `/contact` ships. */
const pageExists: Record<"contact", boolean> = { contact: false };

/**
 * Where an internal link written in content (`/contact`, `/services/ai-agents`)
 * can point today, so Markdown bodies never produce a link to a 404:
 * - `page`: the page exists, link to it (the i18n `Link` adds the locale);
 * - `anchor`: the page does not exist yet but the action has an in-page
 *   equivalent (contact → the contact block in the footer);
 * - `none`: no page and no substitute, so the text is shown without a link.
 */
export type InternalTarget =
  | { kind: "page"; href: string }
  | { kind: "anchor"; href: string }
  | { kind: "none" };

export function resolveInternalPath(path: string): InternalTarget {
  const first = path.split("/")[1] ?? "";
  if (first === "contact") {
    return pageExists.contact
      ? { kind: "page", href: path }
      : { kind: "anchor", href: contactHref };
  }
  const item = navItems.find((candidate) => candidate.key === first);
  if (item !== undefined && !item.available) return { kind: "none" };
  return { kind: "page", href: path };
}

/**
 * The header's primary call to action. It points at the contact block in the
 * footer (present on every page) until the inquiry page exists (P2.5); then
 * change `href` to "/contact" and render it with the i18n `Link`.
 */
export const CONTACT_ANCHOR = "contact";
export const contactHref = `#${CONTACT_ANCHOR}`;
