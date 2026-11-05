/** Test server origins, shared by playwright.config.ts and e2e/global-setup.ts. */
export const prodPort = 3100;
export const devPort = 3200;
export const prodURL = `http://localhost:${String(prodPort)}`;
export const devURL = `http://localhost:${String(devPort)}`;

/** Dev-only routes. `next dev` compiles a route on its first request. */
export const devRoutes = ["/it/_dev/ui", "/it/_dev/motion"] as const;
