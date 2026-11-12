"use client";

import type { CSSProperties } from "react";

/**
 * The last-resort error page (P4.4): rendered instead of the root layout when
 * the layout itself fails (`app/[locale]/error.tsx` cannot catch that). It
 * replaces `<html>`, so there is no provider, no stylesheet and no message
 * catalogue: that is why the text is a fixed pair (Italian first, the site's
 * default, then English) and the styling is inline, using system colours that
 * follow the visitor's light or dark preference. Inline `style` attributes are
 * allowed by the CSP (`style-src-attr`); there is no inline script.
 *
 * It receives neither the error nor its digest, and shows nothing about them:
 * details belong in the server logs, never on the page (CLAUDE.md §7).
 */

const page: CSSProperties = {
  display: "flex",
  minHeight: "100dvh",
  flexDirection: "column",
  justifyContent: "center",
  gap: "1.5rem",
  margin: 0,
  padding: "4rem 1.5rem",
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1.5,
  colorScheme: "light dark",
  background: "Canvas",
  color: "CanvasText",
};

const button: CSSProperties = {
  alignSelf: "flex-start",
  minHeight: "2.75rem",
  padding: "0 1.5rem",
  font: "inherit",
  cursor: "pointer",
};

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="it">
      <body style={page}>
        <main style={{ maxWidth: "40rem" }}>
          <h1 lang="it" style={{ fontSize: "2rem", margin: 0 }}>
            Qualcosa è andato storto
          </h1>
          <p lang="it">
            Si è verificato un errore imprevisto. Riprova: se il problema
            continua, torna più tardi.
          </p>
          <p lang="en">
            <strong>Something went wrong.</strong> An unexpected error occurred.
            Please try again; if it keeps happening, come back later.
          </p>
          <button type="button" style={button} onClick={reset}>
            Riprova / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
