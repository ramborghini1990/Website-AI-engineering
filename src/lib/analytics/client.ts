import {
  DEMO_EVENTS_PATH,
  type DemoEvent,
  type DemoEventName,
} from "@/lib/analytics/events";

/**
 * The browser side of the demo analytics (P3.5). Cookieless and stateless:
 * nothing goes into cookies, localStorage, sessionStorage or IndexedDB, and no
 * id is created. "Once per page view" is a Set in memory, gone on reload. The
 * request goes to this site only, carries `{ event, demo }`, and sends no
 * credentials.
 *
 * Respects Do Not Track and Global Privacy Control: with either on, nothing is
 * sent at all (stricter than the law requires for aggregate counters).
 */
const sent = new Set<string>();

type Signals = { doNotTrack?: string | null; globalPrivacyControl?: boolean };

export function isOptedOut(signals: Signals): boolean {
  return signals.doNotTrack === "1" || signals.globalPrivacyControl === true;
}

function post(event: DemoEvent): void {
  if (typeof window === "undefined") return;
  if (isOptedOut(navigator)) return;
  // keepalive: a click on the call to action leaves the page right after.
  fetch(DEMO_EVENTS_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
    credentials: "omit",
    cache: "no-store",
  }).catch(() => {
    // Analytics never disturbs the visitor: a failed report is simply lost.
  });
}

/**
 * Reports one event. `demo_started` and `demo_completed` count once per demo
 * per page view (a completed demo was started, so completing reports both);
 * `cta_clicked` counts every click.
 */
export function trackDemoEvent(
  event: DemoEventName,
  demo: DemoEvent["demo"],
): void {
  if (event === "cta_clicked") {
    post({ event, demo });
    return;
  }
  for (const name of event === "demo_completed"
    ? (["demo_started", "demo_completed"] as const)
    : (["demo_started"] as const)) {
    const key = `${name}:${demo}`;
    if (sent.has(key)) continue;
    sent.add(key);
    post({ event: name, demo });
  }
}

/** For tests: forget what was already reported in this page view. */
export function resetTrackedEvents(): void {
  sent.clear();
}
