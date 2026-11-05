import type { Metadata } from "next";

import { UiGallery } from "./ui-gallery";

export const metadata: Metadata = {
  title: "UI primitives (dev)",
  robots: { index: false, follow: false },
};

export default function UiGalleryPage() {
  return <UiGallery />;
}
