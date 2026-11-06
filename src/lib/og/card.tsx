import palette from "@/lib/og/palette.json";
import { OG_SIZE } from "@/lib/seo";

/**
 * The share card, in the site's identity (docs/DESIGN.md): the dark
 * "instrument panel" with a hairline grid, one amber accent, a mono-style
 * eyebrow and a heavy headline. It is JSX for satori (next/og), which supports
 * a CSS subset: every element with several children is `display: flex`, sizes
 * are in pixels, and colours cannot be CSS variables (see `palette.json`).
 *
 * Text only, no image and no personal data: the title is the page's own h1.
 */

const GRID = 48;

/** Headline size by length, so a short title is big and a long one still fits in four lines. */
export function titleFontSize(title: string): number {
  if (title.length <= 24) return 104;
  if (title.length <= 44) return 84;
  if (title.length <= 72) return 68;
  return 56;
}

const MAX_TITLE = 110;

export function OgCard({
  eyebrow,
  title,
  footer,
  locale,
}: {
  eyebrow: string;
  title: string;
  footer: string;
  locale: string;
}) {
  const shown =
    title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title;

  return (
    <div
      style={{
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 64,
        background: palette.bg,
        backgroundImage: `linear-gradient(to right, ${palette.surface2} 1px, transparent 1px), linear-gradient(to bottom, ${palette.surface2} 1px, transparent 1px)`,
        backgroundSize: `${String(GRID)}px ${String(GRID)}px`,
        color: palette.text,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              background: palette.accent,
              marginRight: 20,
            }}
          />
          <div
            style={{
              fontSize: 28,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: palette.textSecondary,
            }}
          >
            {eyebrow}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            padding: "6px 18px",
            border: `2px solid ${palette.borderStrong}`,
            fontSize: 26,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: palette.textSecondary,
          }}
        >
          {locale}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          maxWidth: 1040,
          fontSize: titleFontSize(shown),
          fontWeight: 700,
          lineHeight: 1.04,
          letterSpacing: -2,
          lineClamp: 4,
          color: palette.text,
        }}
      >
        {shown}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 96,
              height: 6,
              background: palette.accent,
              marginRight: 24,
            }}
          />
          <div
            style={{
              fontSize: 26,
              letterSpacing: 1,
              color: palette.textMuted,
            }}
          >
            {footer}
          </div>
        </div>
        {/* A row of scale ticks: decoration only, like the divisions of an instrument. */}
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          {Array.from({ length: 16 }, (_, index) => (
            <div
              key={index}
              style={{
                width: 2,
                height: index % 4 === 0 ? 28 : 16,
                marginLeft: 12,
                background:
                  index % 4 === 0 ? palette.borderStrong : palette.borderSubtle,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
