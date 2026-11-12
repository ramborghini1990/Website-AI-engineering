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

/**
 * Whether pages outside the main navigation exist. `contact` shipped in P2.5
 * and `privacy` (the privacy notice) in P4.2. A page that is switched off
 * is shown as plain text, never as a dead link.
 */
const pageExists: Record<"contact" | "privacy", boolean> = {
  contact: true,
  privacy: true,
};

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
  if (first === "contact" || first === "privacy") {
    if (pageExists[first]) return { kind: "page", href: path };
    // Without the contact page the action has an in-page equivalent (the contact block).
    return first === "contact"
      ? { kind: "anchor", href: contactHref }
      : { kind: "none" };
  }
  const item = navItems.find((candidate) => candidate.key === first);
  if (item !== undefined && !item.available) return { kind: "none" };
  return { kind: "page", href: path };
}

/**
 * The contact block in the footer (identity and address, on every page) carries
 * this id. Since P2.5 the calls to action go to `/contact`; the anchor remains
 * the fallback `resolveInternalPath` uses if that page is ever switched off.
 */
export const CONTACT_ANCHOR = "contact";
const contactHref = `#${CONTACT_ANCHOR}`;
