# INVOICE AND DELIVERY CHECKLIST — INTERNAL OPERATIONAL TEMPLATE v0.1

**Status: INTERNAL. Not a public page. Not automated.**

Based strictly on `docs/FIRST-CUSTOMER-SALE-KIT-v0.1.md` (canvas-grid-public
repo) Sections 7, 9 and 10, and the current manual order model. Use this
after the customer approves a preview, and before/at final delivery.

---

## Before invoicing — fields Mike must confirm (do not invent these)

These are **placeholders**. Nothing below is a real, verified business
detail — fill each in with the actual current information before the
first real invoice goes out:

- `[SELLER LEGAL NAME]` — how EMVY CHECK / Michal Veltruský should be
  named on an invoice
- `[SELLER ADDRESS]` — only if one is actually required/used; do not
  invent one
- `[SELLER VAT/TAX NUMBER]` — only if actually registered; leave blank
  and note "not VAT-registered" if that is currently true, rather than
  guessing
- `[PAYMENT METHOD / ACCOUNT DETAILS]` — the current agreed way customers
  actually pay (bank transfer details, or whichever method is really in
  use)
- `[INVOICE NUMBERING CONVENTION]` — if different from the order
  reference convention below

## Order reference convention (from Sale Kit §10)

```
EC-2026-001_Customer_Project/
  01_INTAKE/
  02_PREVIEWS/
  03_FINAL/
  04_ORDER-INVOICE/
  05_RIGHTS/
```

`EC-2026-001` = EMVY CHECK, year, sequential order number. Increment per
order.

## Invoice checklist

- [ ] Order reference matches the confirmed order (`ORDER-CONFIRMATION-TEMPLATE-v0.1.md`)
- [ ] Customer name / business name correct
- [ ] Description of what was delivered (one line is enough)
- [ ] Price matches the confirmed order — no silent price changes
- [ ] Seller details filled in from the confirmed placeholders above,
      not invented
- [ ] Payment method matches what was actually agreed with the customer
- [ ] Invoice date and due date (normally: due before final file
      delivery, per the order confirmation)
- [ ] Invoice saved into `04_ORDER-INVOICE/` for this order
- [ ] Payment received and recorded (reference/confirmation kept) before
      final files are released

## Delivery checklist

Deliver together, not separately:

- [ ] Final high-resolution file(s), matching what was agreed
- [ ] The correct written rights grant for the agreed use —
      `PERSONAL-USE-RIGHTS-GRANT-v0.1.md` or
      `COMMERCIAL-USE-RIGHTS-GRANT-v0.1.md`, filled in for this exact
      order and artwork
- [ ] Invoice / payment confirmation reference
- [ ] A short delivery message (see Sale Kit §7 for tone/wording) telling
      the customer what's attached and to keep the rights document with
      their records
- [ ] Everything filed under this order's folder
      (`03_FINAL/`, `04_ORDER-INVOICE/`, `05_RIGHTS/`)
- [ ] Customer's order-confirmation approval (from
      `ORDER-CONFIRMATION-TEMPLATE-v0.1.md`) is retained in the order
      record as evidence of what was agreed and when

## After delivery

- [ ] Record kept for accounting/legal purposes (invoice, order
      confirmation, correspondence) — do not delete these
- [ ] If the artwork happens to be provenance-eligible, provenance
      registration is an optional, free extra step — never a
      prerequisite for the sale or for the rights grant already issued
