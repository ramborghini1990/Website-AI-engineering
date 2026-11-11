# Demo analytics (P3.5, decision D37)

First-party, cookieless, aggregate-only counters for the interactive demos. Nothing here needs consent: no cookie, no browser storage, no identifier, no third party. Disclose it in the privacy notice (P4.2) anyway.

## What is collected

Three events, each `{ event, demo }` and nothing else (`src/lib/analytics/events.ts`):

| Event | Fires when | Once per page view? |
|---|---|---|
| `demo_started` | the first click inside the demo | yes |
| `demo_completed` | the demo's own "done" moment (see below); also sends `demo_started` if it was missed | yes |
| `cta_clicked` | a click on the call to action under the demo | no, every click |

"Done" per demo: Instagram = one action **approved**; LinkedIn = one message **scheduled**; Document intelligence = one question **asked** (answered with its citation); Back-office = one **sale** rung up or one **order received**.

## What is stored

`demo_event_counts(day, demo, event, count)`, primary key `(day, demo, event)`: one counter per UTC day, demo and event, raised in place. No row per event or per visitor, no time finer than the day, no ip, user agent, referrer, path, language or id. Migration: `src/lib/db/migrations/0002_create_demo_event_counts.sql`.

The client address is hashed with `RATE_LIMIT_IP_SALT` only to feed the rate limiter's one-minute window (in process, 30 events per client per minute); the hash is never written to the counters or the logs.

## What the browser does

`POST /api/demo-events` on this site, JSON, `credentials: "omit"`, `keepalive`. Nothing is sent when Do Not Track or Global Privacy Control is on. "Once per page view" is a Set in memory, gone on reload. No script is loaded from anywhere; `NEXT_PUBLIC_PLAUSIBLE_ORIGIN` is not used.

## The endpoint

Same-origin only (403 otherwise), JSON only (415), ≤ 256 bytes (413), strict schema (400), over the limit → dropped with 204 (an error status would only put a red line in the visitor's console). 503 when a deployed site has no `DATABASE_URL` or salt yet (events are dropped; there is no in-memory stand-in in production).

## Reading the funnel

No dashboard yet. Query the table (EU Postgres, read-only role):

```sql
SELECT demo,
       sum(count) FILTER (WHERE event = 'demo_started')   AS started,
       sum(count) FILTER (WHERE event = 'demo_completed') AS completed,
       sum(count) FILTER (WHERE event = 'cta_clicked')    AS cta_clicked,
       round(100.0 * sum(count) FILTER (WHERE event = 'demo_completed')
             / nullif(sum(count) FILTER (WHERE event = 'demo_started'), 0), 1) AS completion_pct
FROM demo_event_counts
WHERE day >= current_date - 30
GROUP BY demo
ORDER BY started DESC;
```

`buildFunnel` (`src/lib/analytics/funnel.ts`) does the same in code for a future owner page. `cta_clicked` is a count, not a share of `started`: the call to action can be clicked without using the demo.

## Limits

- Counts, not people: no unique visitors, no returning-visitor view, no link from a demo to the inquiry that follows (that needs an identifier or a form field; not done on purpose).
- Reload = a new page view, so the same person can count twice. Events can be lost (offline, blocked, rate-limited), never invented; the completion rate is capped at 100%.
- The limiter is per server instance (not Redis): a script can inflate counts by a bounded amount per instance. It cannot read anything or store anything else.
