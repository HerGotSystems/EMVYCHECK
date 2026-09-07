# EMVY CHECK — LAUNCH FREEZE STATUS — 2026-09-07

Target: 09/09/2026 public business launch. Repo: `HerGotSystems/EMVYCHECK`.

## READY

- Public site structure: MAKE / BUY / SELL / WORK WITH US / HELP, live Canvas Grid link, AI-transparency section.
- Security headers live on `emvycheck.com` via Cloudflare Response Header Transform Rule — all 14 headers verified present on `/`, `/contact.html`, `/privacy.html`. **CLOSED.**
- Contact form: honeypot + FormSubmit's own anti-abuse (production form already activated and has delivered real test submissions).
- `privacy.html`: controller identity, categories of data, purposes, plain-English lawful basis, actual service providers, no-automated-decisions statement, necessity-based retention, language-preference/localStorage explanation, user rights + ICO complaint route. No invented facts.
- Multilingual quick guide (`language-help.js`): EN/CS/HR/DE/FR/ES/PL, including the clarified Save Recipe explanation in all 7.
- "How a paid order works" (5 steps) on the homepage and contact page.
- Official socials (Instagram/Facebook/TikTok/YouTube/email) on homepage footer + contact page.
- Canonical URLs, Open Graph, Twitter card, favicon references on all main public pages. `robots.txt` + `sitemap.xml` present and consistent.
- `docs/customer-ops/` (order confirmation, personal-use grant, commercial-use grant, invoice/delivery checklist) + `docs/customer-ops/README.md` index + `docs/LAUNCH-DAY-RUNBOOK-v0.1.md`. Fictional dry-run (`TEST CUSTOMER — DO NOT SEND`, small-business commercial order) completed end-to-end with no contradictory wording and no missing fields other than the already-flagged Mike-only placeholders below.
- Privacy correction: the runbook and customer-ops index now explicitly state that real customer records (names, contact details, enquiries, confirmations, invoices, payment records, filled-in rights grants, delivered files) live in private storage outside this public repository — never in `docs/customer-ops/` or anywhere else in `HerGotSystems/EMVYCHECK`. The order-number lookup now points at the private store, not this repo.
- Consistency check: contact email, pricing, manual-order flow, personal/commercial rights, delivery expectations, and Recipe-vs-production-export wording all agree across the site and customer-ops docs. One real inconsistency found and fixed: `music/index.html`'s `<meta name="contact">` said `contact@emvycheck.com`; corrected to `emvycheck@gmail.com` to match everywhere else.
- `/music/` and `/art/` working; the earlier first-visit navigation bug (missing Home/Art links before the service worker takes control) stays fixed and reconfirmed live.

## NEEDS MIKE

- **Payment method/account** for the first real invoice (bank transfer details or whichever method is actually in use).
- **Seller legal name** as it should appear on an invoice.
- **Seller address**, only if actually required for the chosen invoice process.
- **VAT/tax number**, only if one actually applies.
- Facebook link is still the temporary share URL (`facebook.com/share/1QEQminc2y/`) pending a permanent page URL.
- **Private customer-record storage** has not been chosen yet — the runbook now says so explicitly rather than implying this public repo. A private local folder is an acceptable stand-in for the first order, but a real choice (and, later, backup) is still needed from Mike.

No public checkout is required to unblock the first sale — invoicing plus a manual payment method is sufficient once the above is supplied.

## ARTWORK PASS STILL OPEN

- Homepage showcase: 6-image batch not yet supplied. `showcase/` folder + `showcase.js` are ready to receive them without further code changes (empty state shows an honest note, never a broken box).
- `og:image`: deliberately not added — will come from the real showcase batch.
- `£1,000/m²` bespoke-space statement: untouched per instruction; still carries the standing "requires Mike's review" note from `docs/EMVY-BUSINESS-FRONT-DOOR-v0.1.md`.

## POST-LAUNCH / NOT A BLOCKER

- Paddle/Stripe or any payment-provider integration, `license_grants` schema, automated invoice/receipt issuance.
- Full translated/legal-page multilingual routing (the quick-guide panel is sufficient for launch).
- Persistent cross-page audio / major music shell refactor (see `docs/EMVYCHECK-MEDIA-SHOWCASE-ARCHITECTURE-V1.md` §1).
- Large public creator-gallery backend.
- `account-ui.js` display staleness vs. access-control fail-closed timing during a prolonged backend outage (documented watch item from the customer-journey QA pass).
- Minor copy polish: the Hold-tier Art Code refusal message is truthful but slightly redundant (same source).
