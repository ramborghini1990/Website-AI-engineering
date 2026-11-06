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
  { key: "services", href: "/services", available: false },
  { key: "work", href: "/work", available: false },
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

/**
 * The header's primary call to action. It points at the contact block in the
 * footer (present on every page) until the inquiry page exists (P2.5); then
 * change `href` to "/contact" and render it with the i18n `Link`.
 */
export const CONTACT_ANCHOR = "contact";
export const contactHref = `#${CONTACT_ANCHOR}`;
