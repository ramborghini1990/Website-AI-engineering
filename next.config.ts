import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
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

export default nextConfig;
