import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { isDevelopment } from "@/lib/env";

// Public URL is /[locale]/_dev/..., rewritten to this folder in next.config.ts.
export const metadata: Metadata = {
  title: "Dev tools",
  robots: { index: false, follow: false },
};

/** Everything under /[locale]/dev-tools (and its /_dev alias) is development-only: 404 in production builds. */
export default function DevLayout({ children }: { children: ReactNode }) {
  if (!isDevelopment) notFound();
  return children;
}
