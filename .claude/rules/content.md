---
paths:
  - "content/**"
  - "messages/**"
  - "src/i18n/**"
  - "src/lib/content/**"
---

# Content & i18n rules

- Italian is the default locale; English is a full translation adapted for the market, not literal. Every user-facing string goes through `next-intl` messages or locale MDX.
- Legal pages exist in both languages; Italian is authoritative.
- Client names, logos and metrics appear only when the case study frontmatter has `clientConsent: true`.
- `messages/it.json` and `messages/en.json` are ~26 KB each: Grep for the key path (e.g. `"contact":`) and Read that range; edit both files in the same change. Copy deck and tone: Grep `docs/CONTENT.md` for the section.
