import { devRoutes, devURL } from "./support/servers";

/**
 * `next dev` compiles a route when it is first requested. When several
 * Playwright workers hit an uncompiled route at the same moment, the dev server
 * sometimes answers one of them with `SyntaxError: Unexpected end of JSON
 * input`, which fails whichever test came first. Compile every dev route once,
 * one after another, before any test runs. (Production routes need no warm-up.)
 */
export default async function globalSetup(): Promise<void> {
  for (const route of devRoutes) {
    let lastStatus = 0;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(`${devURL}${route}`);
      lastStatus = response.status;
      await response.text(); // wait for the full body: compilation is done by then
      if (response.ok) break;
    }
    if (lastStatus !== 200) {
      throw new Error(
        `dev route did not warm up: ${route} -> HTTP ${String(lastStatus)}`,
      );
    }
  }
}
