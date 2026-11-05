# IDENTITY.md — who the site belongs to, and where that is configured

The site is the web presence of an **independent AI engineering and solutions practice** based in Turin, run by **Ramin Rashidi Alavijeh**. It is not a company: an earlier draft assumed a different, wrong business name and legal form, and every trace of it was removed in P1.8 (`src/lib/identity.test.ts` fails if it comes back). The trade name is **not decided yet**, so the brand is a placeholder token.

## One file

Everything about identity lives in [`src/lib/business.ts`](../src/lib/business.ts). Nothing else in the code, the messages or the docs spells the brand name:

| Field | Today | Used by |
|---|---|---|
| `brand.name` | `AI Solutions & Engineering` (placeholder token) | header wordmark, page titles (`… \| <brand>`), home heading, footer, `applicationName` |
| `owner.name` | `Ramin Rashidi Alavijeh` | footer "Owner" and the rights line |
| `location` | Corso Regina Margherita, Torino (TO) | footer "Location" (street and province as given; no street number or postcode has been provided, so none is shown) |
| `vatNumber` | `null` | footer "VAT number (Partita IVA)" |
| `reaNumber` | `null` | footer "REA number" |
| `pec` | `null` | footer "PEC" (becomes a `mailto:` link) |

Messages carry the name as a `{brand}` variable (`messages/*.json`), so a rename is one edit in `business.ts`. The identity test also checks that the placeholder string appears in no other source file or message.

## When you choose the trade name

1. Change `brand.name` in `business.ts`. Titles, heading, footer and the metadata follow.
2. Search the docs for the placeholder if you want it in prose (`docs/*.md` mention it only in examples).
3. Re-check the design direction against any logo or brand colours (docs/DESIGN.md §11, item 5).

## When you have your fiscal registration

Fill the three fields; they are validated at build time, so a typo fails the build instead of reaching visitors:

- `vatNumber`: 11 digits, **with a correct check digit** (the Italian algorithm), no `IT` prefix. Example of the format only: `12345678903` is a textbook number, not a registration.
- `reaNumber`: province code, a dash, the number, e.g. `TO-1234567`.
- `pec`: a valid email address.

Until then the footer shows **"Not yet available"** (Italian: "Non ancora disponibile") in muted italics, marked `data-status="pending"`. Nothing is invented and no value is implied.

**`reaNumber: false`** means "does not apply to this legal form" and removes the REA row. Which disclosures apply (REA and the Registro Imprese entry, PEC, capital, the Art. 2250 c.c. items) depends on the legal form: an individual practice and a company differ. **This file does not decide that and is not legal advice: confirm with your accountant**, and see docs/GDPR_CHECKLIST.md ("Business identification in footer").

## Not covered here

- **Privacy contact email and retention period** (B3) are separate and still open; no email address is published anywhere in the footer today.
- **Legal pages** (privacy, cookie policy, terms) are P4.2 and need review by a qualified professional. The footer does not link to them yet because they do not exist; add the links when they do.
