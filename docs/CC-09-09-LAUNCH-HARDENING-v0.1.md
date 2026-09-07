# EMVY CHECK — CC 09/09 LAUNCH HARDENING v0.1

Status: IMPLEMENTATION BRIEF FOR CLAUDE CODE / CC
Target: public business launch readiness by 09/09/2026
Repo: `HerGotSystems/EMVYCHECK`

## Mission

Make the existing EMVY CHECK public front door trustworthy, understandable and usable by a stranger who may become a paying customer.

This is a launch-hardening pass, not a redesign and not a payment-system build.

A visitor must be able to:

1. understand what EMVY CHECK / Canvas Grid does;
2. make something immediately;
3. understand how to commission work or ask for commercial use;
4. contact EMVY CHECK without confusion;
5. understand the current manual paid-customer route;
6. find basic help in several languages;
7. see real artwork examples once supplied;
8. use the site safely on mobile and desktop.

Do not make promises that the current system cannot fulfil.

---

## Verified current state — do not rebuild these unnecessarily

### Main EMVY CHECK site

`index.html` already contains the current business-front-door structure:

- MAKE / BUY / SELL / WORK WITH US / HELP routes;
- direct link to the public Canvas Grid Worker;
- beginner Canvas Grid quick guide;
- commercial-use explanation;
- custom artwork / business / partner sections;
- AI-assistance transparency;
- music route;
- contact CTA.

`contact.html` already contains:

- structured enquiry form;
- direct `emvycheck@gmail.com` address;
- topic routing;
- FormSubmit delivery;
- honeypot field;
- disclosure that AI may assist with message handling.

### Canvas Grid public

The current launch/customer-journey work in `HerGotSystems/canvas-grid-public` has already closed several older gaps:

- Free production export is gated;
- paid motif access follows account tier;
- failed `/api/me` access fails closed to Free;
- locked motifs and production-export refusals point to a real EMVY CHECK contact route;
- Free / Personal / Creator access states have been exercised;
- desktop and mobile customer journey QA has been performed.

Do not reopen or redesign Canvas Grid in this ticket unless a direct broken link from EMVYCHECK is discovered.

### Payments

There is still no real checkout/payment-provider lifecycle in Canvas Grid Public. That is known and deliberate for the 09/09 launch.

For 09/09, paying customers are handled through the real manual route:

ENQUIRY -> QUOTE -> CUSTOMER CONFIRMATION -> PREVIEW/WORK -> INVOICE/PAYMENT -> FINAL FILES + WRITTEN RIGHTS

Do NOT invent a checkout button, fake pricing flow, fake subscription activation or payment-provider integration in this ticket.

---

# P0 — MUST BE READY FOR 09/09

## A. Customer path / paying-customer clarity

Keep the current MAKE / BUY / SELL / WORK WITH US / HELP structure.

Add a very short customer-facing explanation near commission/commercial/contact CTAs:

**HOW A PAID ORDER WORKS**

1. Tell us what you need.
2. We confirm scope, price and rights.
3. You approve the order.
4. Payment is handled by invoice / agreed business payment method.
5. We deliver the agreed final files and written usage rights.

Do not publish unapproved subscription pricing.
Do not imply that saving a Recipe creates commercial rights.
Do not imply that the Canvas Grid public app has self-service checkout.

Where useful, route contact links with the existing topics:

- `?topic=custom`
- `?topic=commercial`
- `?topic=production`
- `?topic=partner`
- `?topic=support`

## B. Official social/contact links

Add the official public channels somewhere obvious but non-distracting, preferably footer + contact page:

- Instagram: `https://www.instagram.com/emvy_check`
- Facebook: `https://www.facebook.com/share/1QEQminc2y/` — treat as temporary/share URL until a permanent canonical page URL is supplied
- TikTok: `https://www.tiktok.com/@emvy.check`
- YouTube: `https://www.youtube.com/@EMVYCHECK`
- Email: `emvycheck@gmail.com`

Use `target="_blank" rel="noopener noreferrer"` for external social links where appropriate.

Do not add follower counts or claims that require live API verification.

## C. Security headers — real browser hardening, not security theatre

Current `_headers` contains licensing/AI-use notices but is missing ordinary browser hardening.

Add conservative headers that should not break the current site:

- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: SAMEORIGIN`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- a narrowly-scoped CSP for framing only if needed, e.g. `Content-Security-Policy: frame-ancestors 'self'`

Do NOT introduce a broad resource CSP in this launch ticket unless every Home / Art / Contact / Music dependency has first been enumerated and tested. The site contains inline CSS/JS and external media/forms; an over-aggressive CSP could break production days before launch.

Acceptance checks:

- homepage loads normally;
- `/art/` loads normally;
- `/music/` still plays normally;
- external media still loads;
- Canvas Grid links open;
- contact submission still works;
- no mixed-content errors;
- no new console errors caused by headers.

## D. Contact-form abuse / privacy

Current form uses FormSubmit and explicitly sets `_captcha=false`.

Launch goal: reduce trivial automated abuse without making genuine customer contact difficult.

Preferred safe change:

- keep honeypot;
- remove/disable the `_captcha=false` override so FormSubmit's normal anti-abuse path can operate;
- test one complete real submission before merge;
- preserve direct email as the clear fallback.

Do not add a custom backend just for the form in this ticket.

Add a simple Privacy page linked from Contact/footer. It should factually explain only what the current site actually does, including:

- information a person voluntarily sends through the contact form/email;
- purpose: responding to enquiries, quotes, orders, support and business communication;
- AI assistance may be used to read/organise/draft messages as already disclosed;
- the contact form currently uses FormSubmit as a third-party form-delivery service;
- users should not send passwords or payment-card details;
- contact address for privacy questions: `emvycheck@gmail.com`.

Do not invent retention periods, controller registrations, cookie practices or legal bases that have not been checked.

## E. Minimum viable languages

Do NOT attempt a full translation framework two days before launch.

Implement a lightweight **QUICK GUIDE / LANGUAGE HELP** surface that explains the core public journey in several languages while the full UI remains English.

Launch languages:

- English (EN)
- Czech (CS)
- Croatian (HR)
- German (DE)
- French (FR)
- Spanish (ES)
- Polish (PL)

For each language, translate only the essential orientation:

1. What is EMVY CHECK?
2. MAKE — open Canvas Grid and experiment.
3. BUY — commission artwork.
4. COMMERCIAL — ask about selling/printing/business use.
5. PARTNERS — work with EMVY CHECK.
6. HELP — contact us.
7. Canvas Grid basics: Motif / Format / Composition / Look / Colour / Seed / Preview / Save Recipe / Advanced.
8. Important distinction: Preview is not a production file; a saved Recipe is not a commercial licence.
9. Paid orders currently happen by conversation + confirmed quote/invoice, not automated checkout.

Implementation preference:

- small language selector or expandable language-help panel;
- static strings stored in one small JS object or a separate `language-help.js` file;
- no external translation service at runtime;
- no account requirement;
- remember selected language locally if trivial, otherwise skip persistence;
- English remains the authoritative legal/commercial wording.

Do not machine-translate licence terms and present them as legally authoritative.

## F. Real artwork showcase

Do not fill the homepage with fake placeholder art.

Follow `docs/SHOWCASE-UPLOAD-GUIDE-v0.1.md` and `docs/EMVYCHECK-MEDIA-SHOWCASE-ARCHITECTURE-V1.md`.

When the real images are supplied:

- create/use `showcase/` for the first small batch only;
- use web-size derivatives, not production masters;
- lazy-load non-hero images;
- keep first homepage payload small;
- use short factual captions;
- do not claim provenance/registration/licensing unless true for that exact work.

If images are not present in the repo yet, prepare the HTML/CSS integration cleanly but do NOT publish broken image boxes or stock placeholders.

Target first batch remains six images:

- hero / strongest colourful work;
- GRID9;
- multi-panel;
- calm direction;
- aggressive EMVY direction;
- related-variation / design-family demonstration.

## G. Theft / misuse / hacking — realistic protection boundary

Do not promise that public web artwork can be made impossible to copy. Screenshots and browser-visible assets cannot be made theft-proof.

Launch protection should instead be layered:

- keep private engine/source repositories private;
- never expose secrets/API keys in browser code or Git;
- serve reduced-size showcase derivatives rather than production masters;
- keep production files outside public showcase paths;
- preserve copyright/licensing notices;
- preserve provenance/identity systems where actually supported;
- prevent clickjacking and obvious browser attack classes using headers;
- fail closed for paid Canvas Grid entitlements;
- keep commercial rights explicit and written;
- do not rely on disabled right-click, CSS tricks or DRM theatre.

Do not add visible watermarks globally unless requested separately; they can harm the artwork and still do not prevent screenshots.

## H. Link / launch QA

Before merge, test as a stranger rather than only source-reading.

Required routes:

- `/`
- `/art/`
- `/contact.html`
- `/music/`
- Canvas Grid public Worker
- Instagram
- Facebook
- TikTok
- YouTube

Test desktop and mobile widths.

Check:

- no dead links;
- no clipped controls;
- keyboard focus remains visible;
- contact form labels are usable;
- all external links use safe rel attributes where needed;
- no obvious secrets in source;
- no production-master image accidentally added to Git;
- no draft prices accidentally published;
- no fake checkout language;
- customer knows exactly how to pay after a quote;
- customer knows where to ask for help.

---

# P1 — AFTER 09/09 / AFTER REAL PAID VALIDATION

Do not include these in the launch-hardening merge unless separately authorised:

- Paddle/Stripe/other checkout integration;
- payment webhooks;
- subscription activation/renewal/cancellation automation;
- one-off `license_grants` architecture;
- automated invoice/receipt system;
- DRM or screenshot blocking;
- full multilingual routing / translated legal pages;
- large creator gallery backend;
- major music shell refactor;
- new D1 migrations;
- new Cloudflare production secrets;
- renderer changes.

The current manual paid-customer route is sufficient for the first real transactions and gives us evidence before building payment infrastructure.

---

# Working rules for this ticket

- Work in `HerGotSystems/EMVYCHECK` only unless a directly broken cross-repo link is proven.
- Do not touch `canvas-grid` renderer/code.
- Do not touch Canvas Grid Public D1/auth/entitlements/payment architecture.
- No Wrangler/D1 live-write smoke tests.
- No payment-provider changes.
- No production deployment until the final diff and stranger-flow QA are reviewed.
- No `Co-Authored-By`.
- Prefer one coherent launch-hardening edit over many tiny patches.
- Preserve the existing visual identity; do not redesign from scratch.

Suggested branch if a branch is required by the working environment:

`cc/emvy-0909-launch-hardening-v01`

---

# Definition of done for this ticket

A stranger can land on EMVY CHECK and, without knowing the project history:

- understand the business in seconds;
- open Canvas Grid;
- understand the basic controls even if English is not their first language;
- see how to commission work or ask about commercial use;
- find official socials and email;
- understand that current paid orders are handled by confirmed quote/invoice rather than fake checkout;
- contact the business through a form or direct email;
- browse without obvious mobile/layout failures;
- receive ordinary browser security protections;
- never be served production-master art files merely for showcase;
- never be falsely told that copying public pixels can be technically prevented.
