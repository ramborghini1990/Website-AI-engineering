# CONTENT.md — information architecture, content model and copy deck (P2.1)

Rules: CLAUDE.md §12 (every string through `next-intl` messages or locale MDX; Italian first, English adapted, not literal; client names, logos and metrics only with consent). ROADMAP P2.1. Decision D3 (MDX in the repo, Zod-validated frontmatter).

**Status: draft for your review.** Nothing here is approved until you say so (ROADMAP: "Copy approved by you"). Section 7 lists what only you can confirm.

## 1. Positioning

An independent AI Solutions and Full-Stack engineer in Turin, for startups, SMEs and enterprises in Italy and the EU.

**Offer, in one line:** custom autonomous agents, process automation, production web applications and enterprise document intelligence, from idea to release, with one accountable person.

**Voice:** first person singular ("costruisco", "I build"), second person informal in Italian (**tu**), plain, restrained, specific. No hype, no numbers that cannot be shown, no promises of results. AI is presented as a tool that is sometimes the wrong answer, and a person stays in the loop. (The register, "tu" versus "Lei", is yours to confirm: section 7.)

## 2. Pages (information architecture)

Paths are the same in both languages for now; the i18n `Link` adds `/it` or `/en`. The page list lives in `src/lib/content/site-map.ts` and the content gate checks that each page has a localized title and description.

| Key | Path | Purpose | Primary action | Copy lives in | Built in |
|---|---|---|---|---|---|
| `home` | `/` | state the offer, show how I work, route to services, demos and contact | Contact | messages `home.*` | P2.2 |
| `services` | `/services` | the four services; index and four detail pages | Contact, or the related demo | messages `services.*` + `content/services` | P2.3 |
| `work` | `/work` | demos and, later, client case studies; index and detail | Contact | messages `work.*` + `content/work` | P2.4 |
| `process` | `/process` | the four phases and the principles behind them | Contact | messages `process.*` | after P2.2 (not in the roadmap yet) |
| `about` | `/about` | who I am, how I work, what I care about | Contact | `content/pages/<locale>/about.mdx` + messages `about.*` | after P2.3 (not in the roadmap yet) |
| `contact` | `/contact` | what to send, what happens next | the inquiry form (P2.5) | messages `contact.*` | P2.5 |

Not in this deck: legal pages (P4.2, need professional review), the inquiry form's field labels and consent texts (P2.5), the demos' interface copy (Phase 3), blog (not planned).

The navigation (`src/lib/navigation.ts`) lists only pages that exist; flip `available` when a page ships.

## 3. Where copy lives

| Kind | Home | Why |
|---|---|---|
| Page titles and meta descriptions (all six pages) | `messages/*.json` → `metadata.<page>` | one place, typed, parity-checked |
| Short page copy: hero, section headings, CTAs, labels, process steps, contact | `messages/*.json` | UI-sized strings; `next-intl` types and parity tests apply |
| Long-form, structured, repeatable content: services, work entries, About | `content/<collection>/<locale>/<slug>.mdx` | prose with lists, reviewable in PRs, one file per item per language |

Message lists are **objects with named keys, never arrays**, and the order lives in code (`homeProofKeys`, `processStepKeys`, ...) so a page never depends on JSON key order.

## 4. Content model

```
content/
  services/{it,en}/<slug>.mdx     4 per language   ai-agents, workflow-automation, web-applications, document-intelligence
  work/{it,en}/<slug>.mdx         4 per language   the four planned demos, all drafts
  pages/{it,en}/about.mdx         1 per language
```

The **file name is the slug and the stable id**, identical in both languages (so hreflang and the language switcher need no mapping). Localized URL slugs are a possible SEO step later (section 6).

### Frontmatter

A file starts with a `---` line, **one JSON object**, a closing `---` line, then Markdown. JSON is valid YAML, so a YAML-aware MDX pipeline reads the same files later; until then no parser dependency is needed. Parser: `src/lib/content/frontmatter.ts`. Schemas (strict: an unknown key is an error): `src/lib/content/schemas.ts`.

**Service** (`serviceSchema`): `title`, `summary` (card sentence), `seoTitle`, `description`, `order` (1-4, unique), `idealFor` (2-4), `outcomes` (3-5), `deliverables` (3-6), `stack` (technologies actually used), `demo` (slug of a work entry, or `null`).

**Work entry** (`workSchema`): `title`, `summary`, `seoTitle`, `description`, `kind` (`demo` or `project`), `status` (`planned` or `live`), `draft`, `clientConsent`, `client?`, `sector`, `outcomes` (metrics, default none), `stack`, `service` (slug), `publishedAt?`. Rules the schema enforces:

- a client name or any result needs `clientConsent: true` (CLAUDE.md §12); a demo has no client, no results and no consent;
- a demo that is only `planned` cannot be published (`draft: false` requires `status: "live"`), so a demo cannot be advertised before it exists;
- a project must be `live`, and a published project needs a `publishedAt` date.

**Page** (`pageSchema`, About): `heading` (the h1) and `lead`. Its SEO title and description are in messages with the other pages.

Limits: SEO title 12-52 characters (the brand is appended, so this is the page part), description 80-160, service title up to 60, work title up to 90. They are about search results and cards, not taste.

### Body rules (checked)

`##` headings only (the page renders the h1) and the body starts with one; no `{ } < >` and no `import`/`export` (MDX would read them as code); links are internal known paths or https; services 110-400 words, work 60-250, About 150-500.

### Reading the content (server only)

`src/lib/content/read.ts` (`import "server-only"`): `getServices(locale)`, `getWork(locale, { includeDrafts })`, `getPage(locale, key)`. Every file is validated; an invalid one throws `ContentError` naming the file and the field. It returns the Markdown body as **text**; `src/lib/content/markdown.ts` parses the supported subset and `src/components/content/markdown.tsx` renders it on the server, with **no MDX library** (decision D28). The supported Markdown is `##` headings, paragraphs, `- ` lists, `**strong**`, `*emphasis*` and links; anything else is reported by `bodyProblems`. Links to pages that do not exist yet are shown as plain text, and `/contact` goes to the contact block until the page ships (`resolveInternalPath`). When pages read content at runtime on Vercel, add `outputFileTracingIncludes: { "/**": ["./content/**"] }` to `next.config.ts` so the files ship with the function. **Show a service's demo link only when that work entry is published** (`getWork` without drafts).

## 5. The gate

`src/lib/content/collections.test.ts` runs in `pnpm test` (so in `pnpm verify` and CI) over the real files and messages:

- every file parses and passes its schema; every `.mdx` on disk is read;
- Italian and English have the same slugs and the same structure (order, demo link, technologies, kind, status, draft, consent), and the English text is not a copy of the Italian;
- references resolve (service → demo, work → service); nothing about a client without consent; today every work entry is a planned draft, so `getWork()` returns nothing published;
- **titles and descriptions**: all six pages have both in both languages, within the length limits, unique across the pages and, together with every service and demo, unique per language, and different between the two languages;
- bodies and messages follow the editorial rules; the deck copy has **no unverifiable claims** (`src/lib/content/lint.ts`: years of experience, numbers of clients or projects, percentages, guarantees, compliance or certification claims, hype words, placeholders), no hard-coded brand (copy uses `{brand}` or nothing), and no email address or phone number.

Proven by mutation on the real files (each must fail the gate): a dangling demo link, a missing English file, a duplicated SEO title, "10 anni di esperienza" in a message, a planned demo published, a client named on a demo.

The claims rule is a safety net for the writer. It does not prove that copy is true.

## 6. Decisions

| # | Decision | Alternative | Why |
|---|---|---|---|
| C1 | Frontmatter is a JSON object between `---` lines | YAML with `gray-matter` or `yaml` | no new dependency now; valid YAML, so a later MDX pipeline reads it unchanged. Less pleasant to hand-edit (quotes, commas, no multi-line strings) |
| C2 | Services, work and About are MDX; everything else is messages | everything in MDX, or everything in messages | long-form lists and prose are natural in MDX; short UI copy benefits from `next-intl` typing and parity |
| C3 | Same slug and path in both languages | localized paths (`/it/servizi`) via `next-intl` `pathnames` | simplest routing, hreflang and switcher. Italian slugs are a small SEO gain that touches routing and every link: revisit before launch |
| C4 | The Work collection holds the four planned **demos as drafts**, no client projects | an empty collection | there are no client projects to publish and none may be invented; the demos are the real planned content, are needed by Home and the services pages, and the schema stops them from being published early |
| C5 | No biography in About | write a plausible biography | there are no facts yet (employers, years, domains, credentials); inventing them is not acceptable |
| C6 | Titles are the page part only (12-52 characters) | full title including the brand | the brand token is a placeholder, long (26 characters), and will change |

## 7. For you to confirm before the copy is approved

These are statements the site would make **as you**. I wrote them as proposals; I cannot know whether they are true or whether you want to be held to them.

**Voice and register**
1. Informal Italian ("tu") throughout, and first person singular. Enterprise buyers sometimes expect "Lei". It is a global choice, easier to change now than later.
2. English is adapted, not literal (e.g. "hold up in production", "Get in touch"); read it as a native-level check I cannot do.

**Commitments in the copy** (each appears on the site)
3. "Ti rispondo di persona" / "I reply personally" (Contact, About, metadata). No response time is promised.
4. "Una prima conversazione senza impegno" / "with no commitment" (Process): is the first call free?
5. "Codice, documentazione e accessi restano a te" and "Source code and access handed over to you" (Process, services): the intellectual-property terms of your contracts.
6. The method: a prototype evaluated on real cases before a large budget; short iterations with visible progress; "test automatici, accessibilità e prestazioni controllati prima di ogni rilascio"; monitoring and a handover; ongoing support available.
7. "Accessibility checks against WCAG 2.2 AA" and "speed measurements on mid-range devices" as part of your web work.
8. Integrations with Instagram and LinkedIn "only through official APIs, within the platforms' terms; I do not automate personal accounts": this follows BLUEPRINT §1 and is a positioning choice that limits what you sell.
9. "Mi rivolgo a startup, PMI e grandi aziende in Italia e nell'UE" and "Lavoro da Torino, in italiano e in inglese".
10. The technologies listed per service (TypeScript, Next.js, React, Tailwind CSS, PostgreSQL, Claude API) are the project's stack per BLUEPRINT, not a record of past client work. Correct them to what you actually offer.

**Facts only you have**
11. About has **no biography**: years in the field, past work, sectors, languages, certifications, publications, how you started. Say what you want shown, and I will add it (without numbers I cannot verify).
12. No client, logo, testimonial or result appears anywhere; Work shows planned demos only. When real projects exist, each needs the client's consent (`clientConsent: true`).
13. No email, phone or PEC is published (B2, B3). The Contact page has no contact details until the form (P2.5) and the footer numbers exist.

**Claims on privacy and AI, for professional review**
14. Document intelligence: "definiamo insieme dove vengono elaborati, che cosa viene conservato e per quanto tempo". I deliberately made no statement about where data is processed or stored. Anthropic (US) is a sub-processor for live AI features: the privacy notice (P4.2) must say so, and a lawyer should check anything on the site that touches data protection, the EU AI Act transparency duties or platform terms.
15. Demo pages (Phase 3) will need an AI disclosure (CLAUDE.md §10); the copy here only says the demos use synthetic data.

**Search listings**
16. Title lengths are checked against the placeholder brand. A shorter final brand leaves more room; a longer one can truncate. Descriptions are written to be read in a result, not stuffed with keywords.

## 8. Handing over to the next tasks

- **P2.2 Home (built):** `src/app/[locale]/page.tsx` composes `src/components/home/*` (hero, proof, services, demos, process, final call to action) from `home.*`, the services collection and `process.steps`. Decisions made there: the demos section renders nothing until a demo is published; links appear only for pages that exist (`isPageAvailable`), so today every Home link is an in-page anchor (`#services`, `#contact`); no metrics are shown. Original hand-over notes: read `home.*` (iterate `homeProofKeys`, `processStepKeys`); services cards from `getServices(locale)` (`title`, `summary`); show the demos section **only when at least one demo is published**; no testimonials or logos (none exist).
- **P2.3 Services (built):** `/services` (index) and `/services/<slug>` (detail) from `getServices`; the body goes through the in-repo Markdown renderer, the lists and labels come from the frontmatter and `services.labels`; JSON-LD (`ProfessionalService`, `Service`, `BreadcrumbList`) from `title`/`description`/`stack` and the business record, in `src/lib/structured-data.ts`; the demo is linked only if that work entry is published and `/work` exists (`demoFor`), which is not the case today; every page ends with the contact call to action.
- **P2.4 Work (built):** `/work` and `/work/<slug>` read published entries only (`getWork()`), so a draft is absent from the index and a 404 at its URL; the index shows the **empty state** (`work.empty`) while nothing is published and otherwise filters by type, sector and technology through the query string (Zod-parsed, link-based, no JavaScript needed); a client name and results are read only through `clientDisclosure()` (`src/lib/content/work-view.ts`), which returns nothing without `clientConsent: true`; there is no logo field and nothing renders an image. The non-empty UI is exercised on synthetic entries at `/_dev/work` (dev only).
- **P2.5 Contact (built):** `/contact` (the page copy from `contact.*`, plus the form copy written in P2.5 under `contact.form.*`, and the confirmation under `contact.thanks.*`) and `/contact/thanks`. The form copy (options, budget bands, validation messages, the privacy sentence, the marketing-consent wording, the Turnstile disclosure) is **new and needs your review**; the privacy sentence and the consent wording are legal text and need a qualified professional (CLAUDE.md §14). The marketing-consent wording is versioned (`CONSENT_VERSION` in `src/lib/inquiry/store.ts`): change it whenever that message changes. The privacy-notice link appears by itself when `/privacy` exists (P4.2; `resolveInternalPath`).
- **Metadata (P2.6, built):** every public page gets its metadata from one helper, `pageMetadata` in `src/lib/seo.ts` (title, description, canonical, hreflang with `x-default`, Open Graph, Twitter, share image); a gate test (`src/app/seo-coverage.test.ts`) fails if a page under `src/app/[locale]` does not use it, so a new page (About, Process) cannot ship without it: give it an `ogKey`, add that key to `src/lib/og/content.ts` and, if it is public, to `src/lib/sitemap-pages.ts`. Titles and descriptions still come from `metadata.<page>.*` and, for services and work entries, from `seoTitle` and `description`.
- **Share images (P2.6):** `/[locale]/og/<key>` draws the page's own h1 on the dark instrument-panel card (`src/lib/og/`). The text comes only from the approved messages and the content files, never from the request, and only for real, public pages: an unknown page, a draft work entry or the confirmation page is a 404. The colours are in `src/lib/og/palette.json`, a copy of the dark tokens that a test keeps equal to `globals.css`.
