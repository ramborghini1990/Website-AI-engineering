import { SectionHeader } from "@/components/home/section-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CONTACT_ANCHOR, resolveInternalPath } from "@/lib/navigation";

/**
 * The closing call to action of the content pages (services, work). The words
 * come from the page (its own messages); where it goes is decided here: the
 * contact page (`resolveInternalPath` falls back to the contact block if the
 * page is ever switched off).
 */
export function ContactCta({
  id,
  title,
  body,
  label,
}: {
  id: string;
  title: string;
  body: string;
  label: string;
}) {
  const target = resolveInternalPath("/contact");

  return (
    <section aria-labelledby={id} className="border-t border-border-subtle">
      <div className="mx-auto grid w-full max-w-page gap-8 px-gutter py-section">
        <SectionHeader id={id} title={title} lead={body} />
        <div>
          <Button asChild size="lg">
            {target.kind === "page" ? (
              <Link href={target.href}>{label}</Link>
            ) : (
              <a href={target.kind === "anchor" ? target.href : `#${CONTACT_ANCHOR}`}>
                {label}
              </a>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
