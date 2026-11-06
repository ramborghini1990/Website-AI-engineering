import { createNavigation } from "next-intl/navigation";

import { routing } from "@/i18n/routing";

// Locale-aware wrappers around Next.js navigation. Use these instead of
// `next/link` and `next/navigation` for internal links. `createNavigation`
// also returns `useRouter` and `getPathname`: add them to the destructuring
// below when a page needs them (knip rejects unused exports).
export const { Link, usePathname, redirect } = createNavigation(routing);
