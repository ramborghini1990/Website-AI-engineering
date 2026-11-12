/**
 * `/.well-known/security.txt` (RFC 9116), as a pure function: the route handler
 * feeds it the site origin, the optional reporting address and the clock.
 *
 * `Expires` is required by the RFC and must be less than a year away. A fixed
 * date would silently go stale (an expired file is worse than none), so it is
 * derived from the clock: the last second of the month six months ahead. It
 * moves once a month, which keeps the file stable for caches and scanners.
 */

/** Last second (UTC) of the month `months` after the one `now` is in. */
export function expiresAt(now: Date, months = 6): string {
  const end = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth() + months + 1,
    0,
    23,
    59,
    59,
  );
  return new Date(end).toISOString().replace(".000Z", "Z");
}

export function buildSecurityTxt(options: {
  /** `https://host`, no path (the site origin). */
  origin: string;
  /** Email address that receives reports, when configured. */
  contactEmail?: string | undefined;
  now: Date;
}): string {
  const { origin, contactEmail, now } = options;
  const lines = [
    // Most preferred first (RFC 9116 §2.5.3).
    ...(contactEmail !== undefined ? [`Contact: mailto:${contactEmail}`] : []),
    `Contact: ${origin}/en/contact`,
    `Expires: ${expiresAt(now)}`,
    "Preferred-Languages: en, it",
    `Canonical: ${origin}/.well-known/security.txt`,
  ];
  return `${lines.join("\n")}\n`;
}
