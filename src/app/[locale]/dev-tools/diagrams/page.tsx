import type { Metadata } from "next";

import { Diagram } from "@/components/diagrams/diagram";
import { DemoPreview, PREVIEW_PANEL } from "@/components/diagrams/demo-preview";
import { ServiceGlyph } from "@/components/diagrams/service-glyph";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { interactiveDemos } from "@/lib/demos/registry";
import { diagramRegistry } from "@/lib/diagrams/registry";
import { SERVICE_SLUGS } from "@/lib/diagrams/services";

export const metadata: Metadata = {
  title: "Diagrams (dev)",
  robots: { index: false, follow: false },
};

// Dev-only gallery (English, hard-coded on purpose, like the UI and FX galleries;
// the diagrams themselves use the page's locale). It renders every diagram of
// the registry twice, as it plays and as it renders without animation, so a new
// diagram is seen in both states by adding it to the registry alone.
export default function DiagramsDevPage() {
  return (
    <div className="mx-auto grid w-full max-w-page gap-12 px-gutter py-16">
      <header className="grid gap-4">
        <h1 className="text-4xl text-text">Diagrams</h1>
        <p className="max-w-prose text-lg text-text-secondary">
          Development-only gallery (404 in production). Every diagram of
          src/lib/diagrams/registry.ts, once with its entrance animation and
          once static. Reduced motion shows both the same.
        </p>
        <div>
          <Button asChild variant="secondary">
            <Link href="/_dev/ui">UI primitives</Link>
          </Button>
        </div>
      </header>

      {diagramRegistry.map(({ diagram, namespace }) => (
        <section
          key={diagram.id}
          aria-labelledby={`gallery-${diagram.id}`}
          className="grid gap-8 border-t border-border-subtle pt-12"
        >
          <h2
            id={`gallery-${diagram.id}`}
            className="font-mono text-xl text-text"
          >
            {diagram.id}
          </h2>
          <div className="grid gap-12 md:grid-cols-2">
            <div data-gallery-variant="animated" className="max-w-md">
              <Diagram diagram={diagram} namespace={namespace} animate />
            </div>
            <div data-gallery-variant="static" className="max-w-md">
              <Diagram
                diagram={diagram}
                namespace={namespace}
                animate={false}
              />
            </div>
          </div>
        </section>
      ))}

      <section
        aria-labelledby="gallery-previews"
        className="grid gap-8 border-t border-border-subtle pt-12"
      >
        <h2 id="gallery-previews" className="font-mono text-xl text-text">
          demo previews
        </h2>
        <ul className="grid gap-8 md:grid-cols-2">
          {interactiveDemos.map((slug) => (
            <li key={slug} className="group grid max-w-md gap-2">
              <div className={PREVIEW_PANEL}>
                <DemoPreview slug={slug} />
              </div>
              <span className="font-mono text-xs text-text-muted">{slug}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="gallery-glyphs"
        className="grid gap-8 border-t border-border-subtle pt-12"
      >
        <h2 id="gallery-glyphs" className="font-mono text-xl text-text">
          service glyphs
        </h2>
        <ul className="flex flex-wrap gap-8">
          {SERVICE_SLUGS.map((slug) => (
            <li key={slug} className="grid gap-2">
              <span className="w-20">
                <ServiceGlyph slug={slug} />
              </span>
              <span className="font-mono text-xs text-text-muted">{slug}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
