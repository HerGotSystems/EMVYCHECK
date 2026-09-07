# Customer-ops templates — index

## ⚠️ BLANK TEMPLATES ONLY — NEVER STORE CUSTOMER DATA IN THIS PUBLIC REPOSITORY

`HerGotSystems/EMVYCHECK` is a **public** repository. Every file in this
folder must stay a blank, reusable template. Never commit a filled-in
copy here, and never let a real customer's name, email, postal address,
enquiry content, confirmation, invoice, payment record, bank/payment
details, a rights grant containing their data, or any delivered
customer file end up in this folder or anywhere else in this repo.

Real order records live in **private customer-record storage selected
by Mike, outside this repository** (a private local folder is
acceptable for the first order if nothing else is set up yet). To use a
template: copy its content out of this repo into that private storage,
fill it in there, and send it from there.

Internal operational templates only. Not public pages, not automated.
See `docs/LAUNCH-DAY-RUNBOOK-v0.1.md` for the full step-by-step flow —
this file just says which template to open at which stage.

| Stage | Template |
|---|---|
| Quote, after intake | `ORDER-CONFIRMATION-TEMPLATE-v0.1.md` |
| Delivery, personal use order | `PERSONAL-USE-RIGHTS-GRANT-v0.1.md` |
| Delivery, commercial use order | `COMMERCIAL-USE-RIGHTS-GRANT-v0.1.md` |
| Invoicing and delivery | `INVOICE-AND-DELIVERY-CHECKLIST-v0.1.md` |

All four are built strictly from `HerGotSystems/canvas-grid-public`'s
`docs/FIRST-CUSTOMER-SALE-KIT-v0.1.md` and the current manual-order
model. One rights grant per one delivered artwork; commercial grants
must state a specific scope, never "all business use"; no Design Family
rights; no automatic IP transfer; non-exclusive/no sublicensing/no
raw-file resale by default.

Fields still requiring Mike's input before the first real invoice
(payment method, seller legal name/address/VAT) are listed at the
bottom of `docs/LAUNCH-DAY-RUNBOOK-v0.1.md`.
