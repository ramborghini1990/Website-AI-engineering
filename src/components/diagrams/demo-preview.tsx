import { BusinessPreview } from "@/components/diagrams/previews/business-preview";
import { DocintelPreview } from "@/components/diagrams/previews/docintel-preview";
import { InstagramPreview } from "@/components/diagrams/previews/instagram-preview";
import { LinkedinPreview } from "@/components/diagrams/previews/linkedin-preview";
import { isInteractiveDemo } from "@/lib/demos/registry";

/**
 * The panel a preview sits on (a work card, a service's demo card, a Home
 * demo). Inside a `group`, hovering or focusing anywhere lifts the preview's
 * one accent element from 0.6 to full opacity: opacity only, so a reduced-motion
 * visitor loses nothing but the fade.
 */
export const PREVIEW_PANEL =
  "border-b border-border-subtle bg-surface-1 p-4 [&_.preview-accent]:opacity-60 [&_.preview-accent]:transition-opacity [&_.preview-accent]:duration-fast group-focus-within:[&_.preview-accent]:opacity-100 group-hover:[&_.preview-accent]:opacity-100";

/**
 * The wireframe preview of an interactive demo, picked by its work slug, or
 * nothing for any other slug (a project, a draft, an unknown entry): only a
 * demo that exists gets a picture. Decorative (`aria-hidden`): the card or page
 * text carries the meaning.
 */
export function DemoPreview({ slug }: { slug: string }) {
  if (!isInteractiveDemo(slug)) return null;
  switch (slug) {
    case "instagram-lead-agent":
      return <InstagramPreview />;
    case "linkedin-assisted-outreach":
      return <LinkedinPreview />;
    case "document-intelligence-demo":
      return <DocintelPreview />;
    case "business-management-app":
      return <BusinessPreview />;
  }
}
