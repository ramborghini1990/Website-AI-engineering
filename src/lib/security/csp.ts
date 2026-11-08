/**
 * Content Security Policy and security headers, as pure functions (no
 * `process.env`, no `server-only`: `src/proxy.ts` feeds them from `env.ts`).
 *
 * Policy (docs/SECURITY.md): our own origin plus, only when configured,
 * Cloudflare Turnstile and the cookieless analytics origin. Scripts need the
 * per-request nonce; `'strict-dynamic'` lets a nonced script load its own
 * dependencies (Turnstile's `api.js`, Next's chunks) without an allow-list.
 */

export type CspMode = "report-only" | "enforce" | "off";

/** Where Cloudflare Turnstile loads its script and widget iframe from. */
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

export type CspOptions = {
  nonce: string;
  /** `next dev` needs `eval` (React's debugging) and inline styles. Never in production. */
  development: boolean;
  /** Add Turnstile's origin to `script-src` and `frame-src`. */
  turnstile: boolean;
  /** Origin of the analytics script and event endpoint, e.g. https://plausible.io */
  analyticsOrigin?: string | undefined;
  /**
   * Origin of the booking page (the EU Cal.com instance, P2.7), allowed in
   * `frame-src` ONLY. Allowing a frame is not loading it: the page is embedded
   * after a click (ConsentGate), so nothing is requested before.
   */
  bookingOrigin?: string | undefined;
  /** Optional `report-uri` collector. */
  reportUri?: string | undefined;
  /**
   * Include directives that browsers ignore, and warn about, in a
   * Report-Only policy (`upgrade-insecure-requests`).
   */
  enforcing: boolean;
};

/** 128 bits of randomness, base64: unguessable and unique per request. */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export function buildCsp(options: CspOptions): string {
  const {
    nonce,
    development,
    turnstile,
    analyticsOrigin,
    bookingOrigin,
    reportUri,
  } = options;

  const script = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(development ? ["'unsafe-eval'"] : []),
    ...(turnstile ? [TURNSTILE_ORIGIN] : []),
    ...(analyticsOrigin ? [analyticsOrigin] : []),
  ];

  const frames = [
    ...(turnstile ? [TURNSTILE_ORIGIN] : []),
    ...(bookingOrigin ? [bookingOrigin] : []),
  ];

  const directives: Array<[string, readonly string[]]> = [
    ["default-src", ["'self'"]],
    ["script-src", script],
    // Production: only styles that carry our nonce (Next adds it to the ones it
    // generates). `next dev` injects styles without one.
    [
      "style-src",
      development
        ? ["'self'", "'unsafe-inline'"]
        : ["'self'", `'nonce-${nonce}'`],
    ],
    // React renders `style="..."` attributes (Radix, our FX layers) and a nonce
    // cannot be put on an attribute. Attributes cannot run script; the element
    // rule above stays strict.
    ["style-src-attr", ["'unsafe-inline'"]],
    ["img-src", ["'self'", "data:", "blob:"]],
    ["font-src", ["'self'"]],
    [
      "connect-src",
      [
        "'self'",
        ...(analyticsOrigin ? [analyticsOrigin] : []),
        ...(development ? ["ws:", "wss:"] : []),
      ],
    ],
    ["frame-src", frames.length > 0 ? frames : ["'none'"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'none'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", ["'none'"]],
  ];

  const parts = directives.map(
    ([name, sources]) => `${name} ${sources.join(" ")}`,
  );
  if (options.enforcing && !development)
    parts.push("upgrade-insecure-requests");
  if (reportUri) parts.push(`report-uri ${reportUri}`);
  return parts.join("; ");
}

/** The response header that carries the policy for `mode`, or null when CSP is off. */
export function cspHeaderName(mode: CspMode): string | null {
  switch (mode) {
    case "enforce":
      return "Content-Security-Policy";
    case "report-only":
      return "Content-Security-Policy-Report-Only";
    case "off":
      return null;
  }
}

/**
 * Headers that do not change per request. HSTS only in production: on a plain
 * http dev server it would be ignored at best.
 */
export function securityHeaders(options: {
  production: boolean;
}): Array<[name: string, value: string]> {
  return [
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    // Legacy twin of `frame-ancestors 'none'`, which a Report-Only CSP does not enforce.
    ["X-Frame-Options", "DENY"],
    [
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    ],
    ["Cross-Origin-Opener-Policy", "same-origin"],
    ...(options.production
      ? ([
          [
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload",
          ],
        ] as Array<[string, string]>)
      : []),
  ];
}
