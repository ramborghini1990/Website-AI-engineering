"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { useToasts } from "@/components/ui/use-toast";

// Radix Toast and its icons are a separate chunk, fetched when the first toast
// is raised and never otherwise. The queue itself (`use-toast.ts`) is tiny and
// always present, so a toast raised before the chunk arrives is not lost: the
// Toaster shows it as soon as it mounts.
const Toaster = dynamic(
  () => import("@/components/ui/toaster").then((module) => module.Toaster),
  { ssr: false },
);

/**
 * Mount once in the root layout, in place of `Toaster` (P4.7). No page of the
 * site raises a toast yet, and the eager Toaster put Radix Toast into the
 * start-up work of every page (about 11 kB of script and over 100 ms of
 * blocking time on the home page, measured with Lighthouse).
 *
 * Once a toast has been raised the Toaster stays mounted: unmounting it would
 * cut the closing animation and drop the labelled region.
 */
export function LazyToaster(props: {
  viewportLabel: string;
  closeLabel: string;
}) {
  const toasts = useToasts();
  const [wanted, setWanted] = useState(false);
  if (!wanted && toasts.length > 0) setWanted(true);
  return wanted ? <Toaster {...props} /> : null;
}
