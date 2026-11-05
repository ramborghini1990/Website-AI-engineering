import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Picks up src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // `cacheComponents` and `partialPrefetching` (the create-next-app defaults)
  // are OFF on purpose (P1.7, docs/SECURITY.md §3): a nonce-based CSP needs
  // every page rendered per request, because the nonce can only be stamped on
  // scripts while the HTML is rendered. A prerendered shell has no nonce, so an
  // enforced policy would block its own scripts. Next documents the two as
  // incompatible; the root layout opts every route into dynamic rendering.
  rewrites() {
    // The dev gallery is served at /[locale]/_dev/ui. A folder named `_dev`
    // would be a private (non-routable) folder, and the `%5Fdev` escape makes
    // `next dev` and `next build` generate conflicting route types, so the
    // route lives in `dev-tools` and is exposed under `_dev` here.
    // Both URLs 404 outside development (src/app/[locale]/dev-tools/layout.tsx).
    return Promise.resolve([
      {
        source: "/:locale/_dev/:path*",
        destination: "/:locale/dev-tools/:path*",
      },
    ]);
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
