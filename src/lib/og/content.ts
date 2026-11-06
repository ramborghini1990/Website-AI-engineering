import "server-only";

import type { Locale } from "@/i18n/routing";
import { business } from "@/lib/business";
import { getServices, getWork } from "@/lib/content/read";
import { slugSchema } from "@/lib/content/schemas";
import en from "../../../messages/en.json";
import it from "../../../messages/it.json";

/**
 * What a share image says, for a page key (`home`, `services`,
 * `services/<slug>`, `work`, `work/<slug>`, `contact`). The text is always the
 * page's own h1, read from the approved messages or the content files, never
 * from the request: nobody can make our domain render text of their choosing.
 *
 * Returns `null` for anything that is not a real, public page: an unknown key,
 * an unknown slug, a draft work entry. The route turns that into a 404.
 */

export type OgContent = { eyebrow: string; title: string; footer: string };

const messages = { it, en } as const;

export function resolveOgContent(
  locale: Locale,
  key: readonly string[],
  host: string,
): OgContent | null {
  const m = messages[locale];
  const make = (title: string): OgContent => ({
    eyebrow: business.brand.name,
    title,
    footer: `${host}/${locale}${key[0] === "home" ? "" : `/${key.join("/")}`}`,
  });

  if (key.length === 0 || key.length > 2) return null;
  const section = key[0];
  const slug = key.at(1);

  if (slug === undefined) {
    switch (section) {
      case "home":
        return make(m.home.hero.headline);
      case "services":
        return make(m.services.title);
      case "work":
        return make(m.work.title);
      case "contact":
        return make(m.contact.title);
      default:
        return null;
    }
  }

  if (!slugSchema.safeParse(slug).success) return null;
  if (section === "services") {
    const service = getServices(locale).find((entry) => entry.slug === slug);
    return service ? make(service.data.title) : null;
  }
  if (section === "work") {
    // `getWork` leaves drafts out: a planned demo has no share image either.
    const work = getWork(locale).find((entry) => entry.slug === slug);
    return work ? make(work.data.title) : null;
  }
  return null;
}
