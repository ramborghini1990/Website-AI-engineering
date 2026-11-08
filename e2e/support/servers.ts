/** Test server origins, shared by playwright.config.ts and e2e/global-setup.ts. */
export const prodPort = 3100;
export const devPort = 3200;
export const prodURL = `http://localhost:${String(prodPort)}`;
export const devURL = `http://localhost:${String(devPort)}`;

/**
 * The booking page the test server is configured with (NEXT_PUBLIC_CAL_URL). It is
 * a placeholder on the EU instance's host: the tests never reach it, they
 * intercept every request to it (e2e/booking.spec.ts).
 */
export const bookingURL = "https://cal.eu/example-handle/intro";
export const bookingOrigin = "https://cal.eu";

/** Dev-only routes. `next dev` compiles a route on its first request. */
export const devRoutes = [
  "/it/_dev/ui",
  "/it/_dev/motion",
  "/it/_dev/fx",
  "/it/_dev/work",
] as const;
