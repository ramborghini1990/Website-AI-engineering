# SECURITY.md — headers, CSP and environment validation (P1.7)

Rules: CLAUDE.md §6 and §10, BLUEPRINT §3 "Security baseline". This file is how they are implemented and what to do next. Legal and compliance wording elsewhere still needs a qualified reviewer; this is engineering documentation.

## 1. Where things live

| Piece | File | Notes |
|---|---|---|
| Env schemas and rules | `src/lib/env-schema.ts` | Pure (no `process.env`, no `server-only`): every variable, its type, the cross-field rules, `SKIP_ENV_VALIDATION` logic |
| Server env | `src/lib/env.ts` | `import "server-only"`; validates once at import; exports `env`, `isDevelopment`, `siteUrl` |
| Browser env | `src/lib/env.client.ts` | `NEXT_PUBLIC_*` only; safe to import anywhere; never throws |
| CSP and headers (pure) | `src/lib/security/csp.ts` | `buildCsp`, `generateNonce`, `securityHeaders`, `cspHeaderName` |
| Applied per request | `src/proxy.ts` | Next 16's `middleware`: nonce, CSP, headers, then next-intl's redirect |
| Rendering opt-in | `src/app/[locale]/layout.tsx` | `await connection()`: every page is rendered per request |
| Nonce consumers in the app | `src/app/[locale]/layout.tsx` | the theme pre-paint script (`<script nonce>`, read from the `x-nonce` request header); Next stamps its own scripts itself |

## 2. Environment variables

- **Two modules read `process.env`**: `env.ts` and `env.client.ts`. An ESLint rule (`no-restricted-syntax`) and `env.process-env.test.ts` enforce it.
- **Server/client split is a build error, not a convention.** `env.ts` starts with `import "server-only"`: a client component that imports it (directly or through other files) fails `next build` with an import trace. `env.guard.test.ts` finds the same mistake in milliseconds, with a negative control. Client code uses `publicEnv` from `env.client.ts`, which can only contain `NEXT_PUBLIC_*` names (tested).
- **Validation fails the build.** Every variable is parsed by Zod when `env.ts` is first imported (build and startup). Errors list the variable and the rule, never the value, and all problems at once.
- **Blank means unset** (`KEY=` in a `.env` file). **Groups must be complete or absent**: Turnstile (site key + secret), Upstash (URL + token), email (key + from + notify address). `DEMOS_LIVE_ENABLED` is a fail-closed kill switch (only the exact string `true` turns it on) and, when on, requires the Anthropic key and the Redis budget guard.
- **Required in production: nothing yet, on purpose.** `REQUIRED_IN_PRODUCTION` in `env-schema.ts` is empty because no code reads those services and requiring them would fail the live Vercel build before the services exist. The mechanism is tested (with an injected list). **When a task adds a consumer, add its variables to the list in that task** (P2.5: `DATABASE_URL`, `UPSTASH_*`, `TURNSTILE_*`, `EMAIL_*`, `RATE_LIMIT_IP_SALT`), and give the CI `e2e` job synthetic values for them.
- **`SKIP_ENV_VALIDATION=1`** is for CI jobs without secrets. It is honoured only while `next build` runs (`NEXT_PHASE=phase-production-build`) and **ignored at runtime**, so it cannot put an unvalidated app in front of visitors (proved: a server started with the flag and a bad value answers HTTP 500). When honoured, valid values are kept, invalid ones are dropped and typed defaults apply, and no rule is enforced. Set only in the CI `verify` job. Never set it on Vercel.
- **A new variable** goes in four places: `env-schema.ts` (schema), `env.ts` list is derived from it, `.env.example` (placeholder), `docs/DEPLOYMENT.md` table. `env-schema.test.ts` checks that `.env.example` and the schema agree and that its placeholders pass the strict schema, so a fresh clone builds.

## 3. Rendering: why every page is dynamic

A nonce is generated per request and Next stamps it on its scripts *while rendering*. A prerendered page has no request, so it has no nonce, and an enforced CSP would block its own scripts. Next's docs say so ("Partial Prerendering is incompatible with nonce-based CSP"), and I confirmed it on this app: with `cacheComponents` on, `/it` was served from the cache (`x-nextjs-prerender: 1`, `s-maxage=31536000`) with **zero** `nonce=` attributes on its inline and external scripts.

What was changed, and what was tried:

| Attempt | Result |
|---|---|
| Keep `cacheComponents`, add `connection()` to the layout | Build error: uncached data outside `<Suspense>` |
| …plus `export const instant = false` | Builds; `/it` dynamic with nonces, but unknown paths answered **200** (a soft 404, bad for SEO) and the 404 catch-all stayed a prerendered shell |
| **`cacheComponents` and `partialPrefetching` off, `await connection()` in the root layout** | All pages dynamic, every script carries the nonce, unknown paths return a real **404**, redirects unchanged. **This is what ships.** |

Consequences (a decision for you, see PROJECT_STATE):

- HTML is no longer served from the CDN; each page view runs a Vercel Function in `fra1`. Expect a higher TTFB than the static version and more function invocations. Static assets stay on the CDN with long cache headers. The cost is real for a marketing site; Core Web Vitals were measured only locally.
- `Cache-Control` on HTML is `private, no-cache, no-store`: a cached page would replay an old nonce.
- The two settings were the `create-next-app` defaults and nothing in the app used them. `next/root-params` (i18n) works without them.
- **The alternative** that keeps static pages is Next's experimental SRI (hash-based) CSP, but Next's inline bootstrap scripts then need `'unsafe-inline'`, so the script policy is much weaker. That is the trade: strict nonce CSP with dynamic HTML, or static HTML with a weak script policy. `e2e/security.spec.ts` fails if someone re-enables static rendering without noticing (a mutation removing `connection()` fails five tests).

## 4. The Content Security Policy

Built per request in `buildCsp` (default values, production):

```
default-src 'self'
script-src 'self' 'nonce-…' 'strict-dynamic'
style-src 'self' 'nonce-…'
style-src-attr 'unsafe-inline'
img-src 'self' data: blob:
font-src 'self'
connect-src 'self'
frame-src 'none'
object-src 'none'
base-uri 'none'
form-action 'self'
frame-ancestors 'none'
upgrade-insecure-requests          (enforce mode only)
```

- **The booking page (P2.7):** when `NEXT_PUBLIC_CAL_URL` is set, its ORIGIN (`https://cal.eu`, never the path) is allowed in `frame-src` and nowhere else, so the page can be embedded, after a click (`<ConsentGate>`), and nothing else can. Without the variable `frame-src` stays `'none'`. The URL must be on `cal.eu` or `app.cal.eu` (EU instance) or the build fails. The origin is global (the policy is per request, not per page); allowing a frame is not loading it. The iframe itself is sandboxed (scripts, its own origin, forms and popups only: no top navigation, no modals), has no device permissions and sends only our origin as referrer.
- **Origins we allow:** our own, plus **only when configured**: Cloudflare Turnstile (`https://challenges.cloudflare.com` in `script-src` and `frame-src`, when both Turnstile keys are set; per Cloudflare's CSP page the nonce on the `api.js` tag propagates and `strict-dynamic` works) and the analytics origin from `NEXT_PUBLIC_PLAUSIBLE_ORIGIN` (`script-src` and `connect-src`). **Unverified:** Plausible's docs say "add plausible.io to your CSP" without listing directives; scripts and the event POST are my assumption. Check it in a browser when P2.6 wires analytics. Nothing loads from either origin today: adding the origin to the CSP allows it, it does not load it. Third-party scripts still go through `<ConsentGate>` (CLAUDE.md §10) and the cookie policy (P4.2).
- **`style-src-attr 'unsafe-inline'`** is the one deliberate looseness: React renders `style="…"` attributes (Radix, the FX layers) and a nonce cannot be put on an attribute. Attributes cannot run script. Style *elements* need the nonce.
- **`strict-dynamic`** means scripts created at runtime by a trusted (nonced) script are allowed whatever their host. That is how Next's chunks and Turnstile load, and also why a hostile *parser-inserted* tag or inline handler is blocked while a script appended by already-running trusted code is not. The `script-src` host list is ignored by modern browsers and kept only for old ones.
- **Development** (`next dev`) adds `'unsafe-eval'` (React's debugging), `'unsafe-inline'` styles and `ws:`; never in production (tested).
- **`CSP_MODE`** (P4.4: enforced by default): unset means `enforce` in production and `report-only` in `next dev` (`resolveCspMode`, `src/lib/security/csp.ts`). `enforce` sends `Content-Security-Policy`, `report-only` sends `Content-Security-Policy-Report-Only` (the production rollback, below), `off` sends none and is honoured **only outside production**: a production deployment ignores it and enforces. Next reads the nonce from either header name. `upgrade-insecure-requests` is left out of a report-only policy (browsers ignore it there and warn). `CSP_REPORT_URI` adds a `report-uri`; leave it unset unless you run a collector, because a third-party collector is a processor and reports contain URLs.
- **The e2e production server runs `enforce`** (`playwright.config.ts`). In it the site loads, hydrates, runs Lenis and navigates with zero violations, and the negative tests show it blocks an injected inline handler, a `<base>`, a `fetch`/image/iframe/form to another origin, and being framed.

### Rollout and rollback

The policy is enforced from the first production deploy (the e2e suite has run against `enforce` since P1.7 with zero violations). Still, after the first deploy open the site in a real browser with the console open, in both languages and a couple of interactions: a violation shows as `Refused to …`.

- **Rollback** (a real page is blocked and you need time): set `CSP_MODE=report-only` in Vercel Production and redeploy. Violations are then only logged in the browser console. Remove the variable afterwards. There is no `off` in production.
- There is no collector. If you want reports centrally, set `CSP_REPORT_URI` to a collector you control (and list it in the privacy notice), or add a small report route handler later (Zod-validated, rate-limited, no request bodies in logs).

## 5. Fixed headers

On every page response (and redirect) through `proxy.ts`:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` (legacy twin of `frame-ancestors 'none'`, which a report-only policy does not enforce) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only) |

Scope: the proxy matcher is unchanged, so static files (`/_next/static`, `/favicon.ico`, `robots.txt`, `.well-known`) do not get these headers from the app; on Vercel the edge adds HSTS. If a scanner flags `nosniff` on assets, add `headers()` in `next.config.ts` for those paths.

`X-Powered-By` is switched off (`poweredByHeader: false` in `next.config.ts`).

**`/.well-known/security.txt`** (RFC 9116, P4.4) is a route handler (`src/app/.well-known/security.txt/route.ts`, builder in `src/lib/security/security-txt.ts`), not a static file, because `Expires` is required and must be under a year away: a typed-in date would silently go stale. It is the last second of the month six months ahead, so it changes once a month. Fields: `Contact` (a `mailto:` for `SECURITY_CONTACT` when set, always the contact page), `Expires`, `Preferred-Languages`, `Canonical`. No `Policy` or `Encryption` yet (no disclosure policy page and no PGP key exist; add them if you create either). Served as `text/plain; charset=utf-8`; it is outside the proxy matcher, so it gets `nosniff` from the handler only.

**Bad input never reaches the framework's 500.** A path with a broken percent-escape (`/it/%E0%A4%A`) is answered `400`, no body, by the proxy; before P4.4 Next answered `500`. Under `/api/*` (outside the proxy) Next still answers a broken escape with a plain `500 Internal Server Error` (no detail, no stack); the matcher is not widened for it because the API routes need none of the page headers.

**HSTS preload is a commitment.** `includeSubDomains; preload` is the BLUEPRINT value, but it only means something on your own domain (B6 is undecided) and, if you later submit the domain to the preload list, every subdomain must stay on HTTPS. Do not submit before the domain is final.

## 6. What is tested

| Claim | Evidence |
|---|---|
| Every rule of the env contract, including negatives and that errors never echo a value | `src/lib/env-schema.test.ts` |
| Import-time failure, `SKIP_ENV_VALIDATION` honoured only in the build phase | `src/lib/env.module.test.ts` |
| No client file reaches `env.ts`; `process.env` only in the two modules | `src/lib/env.guard.test.ts`, `env.process-env.test.ts`, ESLint rule |
| `next build` fails when a client component imports the server env | mutation, recorded in PROJECT_STATE §9 |
| CSP content per option, nonce quality, headers | `src/lib/security/csp.test.ts` |
| The proxy applies them, nonce reaches the app, hostile headers are overwritten, redirects keep them | `src/proxy.test.ts` |
| Real browser, enforced: headers, nonce on every script, fresh per request, zero violations, blocks injection, 404 stays 404 | `e2e/security.spec.ts` |
| Enforced by default in production, `off` ignored there, broken escapes answered 400 | `src/lib/security/csp.test.ts`, `src/proxy.test.ts` |
| `security.txt` valid (Contact, Expires future and < 1 year for every day of a year, Canonical) | `src/lib/security/security-txt.test.ts`, `e2e/security.spec.ts` |
| Errors leak nothing: API errors and 404s carry no stack, path, digest or connection string; no `X-Powered-By`; the detector is checked against known leaks | `e2e/security.spec.ts`, `src/app/global-error.test.tsx`, `src/app/[locale]/error.test.tsx` |
| Rate limits: sliding window per hashed client | `rate-limit*.test.ts`, `src/lib/consent/receipt.test.ts` |

**Error pages.** `app/[locale]/error.tsx` (segment errors) and `app/global-error.tsx` (a failing root layout, which replaces `<html>`) receive no error object and print nothing about it; `not-found.tsx` is static copy. In production Next itself replaces a server error's message with a generic one and an opaque digest, and the digest is not rendered. `global-error.tsx` cannot use the message catalogue (no provider exists when it renders), so its text is a fixed Italian/English pair with inline styles.

**Rate limits (P4.4 review).** Inquiry form 5 per 10 min (Upstash when configured, in-process otherwise); consent receipts 10 per 10 min and demo events 30 per minute, both **in-process**, so on Vercel the limit is per serverless instance, not global. For consent receipts that is a known gap (the endpoint writes a row); moving it to Upstash would send a hashed client key to Upstash for every visitor who answers the banner, whereas the registry and the privacy notice name Upstash for the contact form only, so it waits for your decision (P4.4 task report). The thresholds are proposals from reasoning, not from traffic: a shared office or mobile carrier NAT looks like one client, so five inquiries in ten minutes is generous for a person and tight for a script. Re-tune after real traffic (the `ratelimit.*` log events say how often it fires). Fail-open on a Redis timeout is deliberate for the form (Turnstile and the honeypot still stop bots) and logged.

Not covered: a `securityheaders.com` / Mozilla Observatory grade (needs a deployed preview: the ROADMAP's "grade A" criterion is still to check by you); CSP behaviour in Firefox and Safari; the Plausible and Turnstile origins in a real page (nothing loads them yet).

## 7. The inquiry funnel (P2.5)

The contact form (`/[locale]/contact`) is the one place the site accepts visitor input. Controls, in the order they run (`src/lib/inquiry/process.ts`):

1. **Honeypot** (`website`, hidden from people and assistive technology): a filled one gets a normal-looking success and nothing is stored, sent or counted.
2. **Validation** with Zod (`src/lib/inquiry/schema.ts`): enums for need, budget and timeline; length limits; control characters and line breaks refused in names; unknown fields ignored.
3. **Rate limit**: five accepted requests per ten minutes per client. The client is a salted HMAC of the address (`RATE_LIMIT_IP_SALT`), never the address; Upstash Redis (sliding window) when configured, an in-process limiter otherwise.
4. **Bot check**: Cloudflare Turnstile token verified server-side (`src/lib/security/turnstile.ts`), fail-closed; the widget script is loaded only when the visitor reaches the last step.
5. **Storage** (`inquiries` table, Drizzle over postgres.js) with exactly the schema's columns, then a **plain-text email** to the owner (Resend REST). A failed email is logged and does not fail the inquiry (it is already stored); a failed insert is reported as unavailable.
6. **Logging**: only through `src/lib/logger.ts`, an allow-list of fields plus redaction. No submitted value, address or token can be logged.

Server Actions are origin-checked by Next.js; the CSP already allows the Turnstile origin only when both keys are set.

**Local, CI and `next start` on a laptop** (`VERCEL_ENV` unset): whatever is not configured is replaced by an in-process stand-in (memory limiter, store and mailbox, a bot check that passes), so the form works with no network and no secrets. **On Vercel** (`VERCEL_ENV` set): every service is required; if one is missing the page says the form is unavailable and the action refuses. A lead is never accepted and dropped.

| Claim | Evidence |
|---|---|
| Validation, negative cases, one error per field | `src/lib/inquiry/schema.test.ts` |
| Order of checks, honeypot, rate limit, bot check, failures typed, nothing personal logged | `src/lib/inquiry/process.test.ts` |
| Client key is a hash, per client, the sixth request is refused; fields the schema does not know never reach the record | `src/app/[locale]/contact/actions.test.ts` |
| Rate limiter (memory and Upstash), Turnstile (fail-closed), email, IP parsing | `src/lib/security/*.test.ts`, `src/lib/email/resend.test.ts`, `src/lib/inquiry/client-ip.test.ts` |
| Stored row has only schema columns; SQL migration equals the Drizzle schema | `src/lib/inquiry/store.test.ts` |
| Logger redaction and allow-list | `src/lib/logger.test.ts` |
| Deployed site without a service is unavailable, not mocked | `src/lib/inquiry/deps.test.ts` |
| Client code never reaches server code; `"use server"` modules are a boundary | `src/lib/env.guard.test.ts` |
| No `console`, no browser storage, Cloudflare origin only in the widget | `src/components/contact/contact-structure.test.ts` |
| Browser flow, error summary, redirect, rate-limit message, no third-party request, CSP, axe | `e2e/contact.spec.ts` |

## 8. Third-party embeds and the booking option (P2.7)

Rule (CLAUDE.md §10): a third-party script or embed loads only through `<ConsentGate category="...">` (`src/components/consent/consent-gate.tsx`), after the visitor's own click. Until then its children are **not rendered**: no iframe, no script, no preconnect, so the browser makes no request. The gate does not remember the click (no cookie, no storage); each visit starts blocked. It always offers a plain link that needs no embed and no JavaScript (the button is hidden where scripting is off).

Every third party is listed in `src/lib/consent/registry.ts` (provider, category, trigger, what it receives, the CSP rule): the source for the cookie and privacy notices (P4.2). Adding one means: a registry entry, the gate, its origin in `src/lib/security/csp.ts`, and the notices.

| Claim | Evidence |
|---|---|
| Before the click nothing is rendered, fetched or stored; after it the embed renders and takes focus; the choice is not remembered | `src/components/consent/consent-gate.test.tsx` |
| The booking frame is titled and sandboxed without top navigation or modals | `src/components/contact/booking-section.test.tsx` |
| An `<iframe>` exists only in the booking embed, as a child of the gate; no `next/script`; no hard-coded provider URL; every category registered | `src/components/consent/consent-structure.test.ts` |
| The booking URL must be on the EU instance, https, without credentials | `src/lib/env-schema.test.ts` |
| `frame-src` gets the booking origin only when configured, and nothing else gets it | `src/lib/security/csp.test.ts`, `src/proxy.test.ts`, `e2e/booking.spec.ts` |
| Real browser, enforced CSP: no request to the booking host before the click however the page is used, exactly the configured page after it, no violation, no hint in `<head>`, not remembered after a reload, link-only without JavaScript, the form still works, axe in both themes | `e2e/booking.spec.ts` |

## 9. Observability: errors, health, telemetry, spend (P4.5)

**Error reporting is an allow-list, not a filter.** A report is *built* from a few safe facts; it is never a copy of the error with things removed (`src/lib/observability/scrub.ts`).

| Sent (log and tracker) | Never read, never sent |
|---|---|
| error class name, Next's `digest`, route **pattern** (`/[locale]/work/[slug]`), HTTP method, route type, stack as `function (file:line:col)` with the file's base name only | the error **message** (it can quote form input), the request path and query, headers (cookies, `authorization`, forwarded IPs), bodies, user agent, any directory name (it can hold a user name) |

- **Second layer:** everything that is sent still passes `redactString` (`src/lib/logger.ts`): emails, IPv4/IPv6, phones, IBANs, fiscal codes, bearer tokens, JWTs, `token=`/`key=`/`password=` pairs, vendor key prefixes (`sk-ant-`, `re_`, `ghp_`, `AKIA`…) and any 32+ character opaque run that contains a digit. A UUID (the request id) is exempt. **Names of people cannot be recognised by a pattern**: that is why the message is not sent at all.
- **Where it runs:** Next's `onRequestError` (`src/instrumentation.ts`) covers unhandled server errors in renders, route handlers, Server Actions and the proxy. Errors our own handlers catch are logged there by class only. **The browser reports nothing**: `app/[locale]/error.tsx` and `app/global-error.tsx` do not receive the error, do not log and do not fetch (a test enforces it), so the CSP needs no tracker origin. Consequence: a crash that happens only in the browser is not seen; accept that, or add a consented, separate channel later.
- **The sink** (`sink.ts`) is a single HTTPS POST to the EU ingest host in `SENTRY_DSN`, without an SDK (an SDK collects request data, cookies and IPs by default). The env schema refuses any DSN whose host does not end in `.de.sentry.io`, so a US host fails the build. Unset (the default; always in dev and CI) = nothing leaves the server. 2 s timeout, never throws, `credentials: omit`, `redirect: error`.
- **Enabling it is a legal step first:** Sentry becomes a processor (the DSN's public key and the report). Add it to `src/lib/consent/registry.ts`, `docs/ROPA.md` and the privacy notice **before** setting the variable. Server-side project settings in Sentry: *Prevent Storing of IP Addresses* on, *Data Scrubber* and *Use Default Scrubbers* on, short event retention, EU data storage chosen **at organisation creation** (it cannot be changed later). Sentry's own page says some account data (e.g. DSN keys) is stored in the US: read it before signing the DPA.
- **Not verified against a live project** (no account). The unit tests prove what the payload contains with a fake `fetch`; the first real report must be checked by eye (DEPLOYMENT.md §8).

**Health endpoint.** `GET /api/health` returns `{"status":"ok"}`, `no-store`, `noindex`, nothing else: no version, commit, region, uptime, or list of configured services. It deliberately does not call Postgres, Redis or any provider: a public URL that fans out to paid or rate-limited services is a way to exhaust them, and "the database is down" is not for strangers. It proves the build, the environment validation and the function runtime work.

**Telemetry stays off.** Vercel Web Analytics and Speed Insights are **not installed** (no `@vercel/analytics`, no `@vercel/speed-insights`, no `/_vercel/insights` script, no insights origin in the CSP) and a test fails if that changes, or if any analytics, replay or error-tracking SDK appears in `package.json`. The only analytics is the cookieless demo counter on our own server (docs/ANALYTICS.md). Check the Vercel dashboard once as well: Project → Analytics and Speed Insights must say *disabled*, because enabling them there injects a script without a code change.

**Spend alerts** (Vercel and Anthropic) are account settings, not code: DEPLOYMENT.md §8. Rule: a budget alert is a smoke detector, not a cap. Only the Anthropic workspace limit and `DEMOS_LIVE_ENABLED=false` actually stop spending.

| Claim | Evidence |
|---|---|
| Planted emails, IPs, phones, names, keys, cookies, paths in message, stack, URL, headers never reach the report or the envelope | `src/lib/observability/scrub.test.ts`, `sink.test.ts`, `request-error.test.ts` |
| Only EU Sentry hosts are accepted (US host, suffix and prefix tricks, http, password, port, query refused) | `src/lib/observability/dsn.test.ts`, `src/lib/env-schema.test.ts` |
| Redaction of JWTs, key pairs, vendor keys, long hex; UUID and long identifiers kept | `src/lib/logger.test.ts` |
| The reporter never throws, even if the tracker, the logger or the error is hostile | `src/lib/observability/request-error.test.ts` |
| The error pages carry no reporter; no analytics/replay/error SDK; no Vercel insights | `src/lib/observability/telemetry-off.test.ts` |
| Health body and headers leak nothing; uncached; HEAD works, POST is 405 | `src/app/api/health/route.test.ts`, `e2e/health.spec.ts` |
