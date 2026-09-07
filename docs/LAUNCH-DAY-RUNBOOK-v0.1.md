# EMVY CHECK — LAUNCH-DAY RUNBOOK v0.1

**A message just arrived. What do I do now?** Read this section first, then follow the flow below.

Source material: `docs/customer-ops/` templates, and the current
First Customer Sale Kit in `HerGotSystems/canvas-grid-public`
(`docs/FIRST-CUSTOMER-SALE-KIT-v0.1.md`) — this runbook does not repeat
their full content, only sequences them. See
`docs/customer-ops/README.md` for which template to open at each step.

---

## The flow

```
ENQUIRY → INTAKE → QUOTE → CUSTOMER CONFIRMATION → PREVIEWS →
CUSTOMER CHOICE → FINAL EXPORT → INVOICE/PAYMENT → DELIVERY →
RIGHTS GRANT → RECORD RETAINED
```

### 1. ENQUIRY

A message arrives via the contact form (`/contact.html`, delivered
through FormSubmit to `emvycheck@gmail.com`) or direct email. It may
already carry a topic (`Canvas Grid support`, `Custom artwork`,
`Commercial use / licence`, `Production / printing`, `Partnership / work
with us`, `Gallery / school / event project`, `Press / media`, or
`Something else`).

If AI assistance is used to read/triage it, that's already disclosed on
the site (`privacy.html`, homepage "How EMVY CHECK works" section) — no
extra disclosure needed per message.

### 2. INTAKE

Ask the 8-question maximum (Sale Kit §4) — as a short message, not a
form:

1. What's the artwork for?
2. Personal use or business/commercial use?
3. What size or shape / where will it be used?
4. Colours to include or avoid?
5. Mood or style?
6. Any text or logo to include?
7. Reference images or brand material? (optional)
8. Deadline?

### 3. QUOTE

Open `docs/customer-ops/ORDER-CONFIRMATION-TEMPLATE-v0.1.md`, fill in
the fields, and send it. Price comes from the current introductory
commission pricing (Sale Kit §2 — Personal / Small business commercial /
Broader commercial) — say plainly that these are introductory test
prices while EMVY CHECK takes on its first commissions. This is a
**different offer** from the `£1,000 per m²` bespoke space-artwork
design fee on the homepage `#art` section; don't mix the two up when
quoting.

**Next order number**: check `docs/customer-ops/` order folders (see
folder structure below) for the highest existing `EC-2026-0NN`, and
increment. The very first real order is `EC-2026-001`.

### 4. CUSTOMER CONFIRMATION

Get the confirmation line back (reply, signature, or an unambiguous
written "yes") **before** starting paid work. This reply is retained as
evidence of what was agreed (see "Evidence to retain" below) — save it
into the order folder now, don't wait until delivery.

### 5. PREVIEWS

Create the agreed number of preview options (normally 2–4) in Canvas
Grid. Send the Sale Kit §6 preview message. Previews are visual
mock-ups — same rule as the public site: a Preview is not a production
file.

### 6. CUSTOMER CHOICE

Customer picks a direction. Apply the agreed number of small adjustment
rounds if requested.

### 7. FINAL EXPORT

Produce the high-resolution production export for the chosen direction.
This is a paid Canvas Grid capability (Personal/Creator tier) — the
public app's own access rules apply here exactly as they do for any
other customer; nothing about a manual commission bypasses them.

### 8. INVOICE / PAYMENT

Open `docs/customer-ops/INVOICE-AND-DELIVERY-CHECKLIST-v0.1.md`. **Stop
here if the seller-detail and payment-method placeholders in that
checklist are still unfilled** — see "What Mike must still supply"
below. Do not invent them. Invoice is due before final file delivery.

### 9. DELIVERY

Send final files + the correct rights grant + the invoice/payment
reference together, per the Sale Kit §7 delivery message and the
Invoice/Delivery checklist's delivery section.

### 10. RIGHTS GRANT

Use exactly one of:

- `docs/customer-ops/PERSONAL-USE-RIGHTS-GRANT-v0.1.md` — personal,
  non-commercial use.
- `docs/customer-ops/COMMERCIAL-USE-RIGHTS-GRANT-v0.1.md` — commercial
  use, **with a specific scope filled in** (never "all business use").

One grant per one delivered artwork. A different artwork, or a broader
scope later, needs its own new grant — never edit an issued one.

### 11. RECORD RETAINED

File everything (see folder structure) and keep it — invoices and order
records may be needed for accounting/tax purposes, independent of
whether the customer ever writes again.

---

## Order folder structure (Sale Kit §10)

```
EC-2026-001_Customer_Project/
  01_INTAKE/
  02_PREVIEWS/
  03_FINAL/
  04_ORDER-INVOICE/
  05_RIGHTS/
```

`EC-2026-001` = EMVY CHECK, year, sequential order number.

## Evidence to retain, per order

- The enquiry itself
- The agreed scope (the sent Order Confirmation)
- The customer's confirmation (reply/signature/clear written yes)
- Invoice and payment record
- Final delivered files
- The signed/sent rights grant

## Do not promise

- **No exclusivity** unless separately agreed and priced.
- **No Design Family rights** — one artwork per grant, never a broader
  or implied set.
- **No automatic IP ownership transfer** — every grant is a usage
  licence; EMVY CHECK / Michal Veltruský remains the copyright holder.
- **No unsupported provenance promise** — provenance registration is an
  optional, free extra step for eligible work, never a prerequisite for
  the sale, and never guaranteed for artwork types that don't currently
  support it (e.g. External Image / Panel Builder composites).

## If unsure

**Do not guess commercial scope or rights.** If what the customer
actually needs is unclear, wider than what you can precisely describe,
or touches exclusivity / territory / manufacturing / white-label /
unusual large-scale use, ask before final delivery — see the "NEEDS
MIKE DECISION" list in `docs/EMVY-BUSINESS-FRONT-DOOR-v0.1.md`. A vague
grant is worse than a delayed one.

## What Mike must still supply before the first real invoice

These are placeholders in `INVOICE-AND-DELIVERY-CHECKLIST-v0.1.md` —
nothing below has been invented, and none of it blocks quoting,
previewing, or agreeing an order, only the invoice/payment step:

- Chosen payment method/account (bank transfer details, or whichever
  method is actually in use)
- Seller legal name as it should appear on an invoice
- Seller address, only if actually required for the chosen invoice
  process
- VAT/tax number, only if one actually applies

**No public checkout is required to take the first payment** — invoicing
plus a manual payment method (e.g. bank transfer) is sufficient for the
current manual-order model; see
`docs/CC-09-09-LAUNCH-HARDENING-v0.1.md`'s payments section.
