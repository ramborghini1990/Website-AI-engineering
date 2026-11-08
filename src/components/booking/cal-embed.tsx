/**
 * The Cal.com booking page in an iframe. It is only ever rendered as the child
 * of `<ConsentGate>`, so nothing is requested before the visitor clicks. The URL
 * is the configured EU-instance page (`NEXT_PUBLIC_CAL_URL`, validated against
 * the host allow-list in `env-schema.ts`); the CSP allows exactly its origin in
 * `frame-src`.
 *
 * Hardening of the frame: a sandbox that grants only what a booking form needs
 * (scripts, its own origin, forms, popups for the confirmation), no device
 * permissions (`allow` empty), and the referrer cut to our origin, so the path
 * of the page the visitor came from is not sent.
 */
export function CalEmbed({ url, title }: { url: string; title: string }) {
  return (
    <iframe
      src={url}
      title={title}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
      allow=""
      referrerPolicy="strict-origin"
      // 44rem: tall enough for Cal's month view and the time slots without an inner scrollbar on a phone.
      className="h-176 w-full border border-border-strong bg-surface-2"
    />
  );
}
