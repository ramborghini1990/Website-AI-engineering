import type { Request } from "@playwright/test";

/**
 * The ONE request a demo may make since P3.5: the cookieless funnel event, a
 * POST to this site's `/api/demo-events` whose body is exactly `{ event, demo }`.
 * The demo specs that prove "nothing leaves the page" let this through and still
 * flag every other request, including a demo event with any extra field.
 */
export function isDemoEvent(request: Request, origin: string): boolean {
  if (request.method() !== "POST") return false;
  const url = new URL(request.url());
  if (url.origin !== origin || url.pathname !== "/api/demo-events") {
    return false;
  }
  try {
    const body = JSON.parse(request.postData() ?? "") as Record<
      string,
      unknown
    >;
    return Object.keys(body).sort().join() === "demo,event";
  } catch {
    return false;
  }
}
