# EMVY CHECK — CC 09/09 LAUNCH-DAY RUNBOOK v0.1

Status: SAFE PRE-LAUNCH OPERATIONS TASK
Repo: `HerGotSystems/EMVYCHECK`
Target: 09/09/2026

## Mission

The public site, security headers, contact path, privacy, multilingual help and first-customer templates are now substantially launch-ready. Use this pass to make the one-person launch operation easy to run when a real enquiry arrives.

This is NOT a redesign and NOT a feature build.

## 1. Build one launch-day runbook

Create:

`docs/LAUNCH-DAY-RUNBOOK-v0.1.md`

It must be concise enough to use while handling a real customer and should answer: "A message just arrived — what do I do now?"

Use the existing public site and these internal templates as source material:

- `docs/customer-ops/ORDER-CONFIRMATION-TEMPLATE-v0.1.md`
- `docs/customer-ops/PERSONAL-USE-RIGHTS-GRANT-v0.1.md`
- `docs/customer-ops/COMMERCIAL-USE-RIGHTS-GRANT-v0.1.md`
- `docs/customer-ops/INVOICE-AND-DELIVERY-CHECKLIST-v0.1.md`
- the current First Customer Sale Kit in `HerGotSystems/canvas-grid-public`

The runbook should cover this exact flow:

`ENQUIRY → INTAKE → QUOTE → CUSTOMER CONFIRMATION → PREVIEWS → CUSTOMER CHOICE → FINAL EXPORT → INVOICE/PAYMENT → DELIVERY → RIGHTS GRANT → RECORD RETAINED`

Include:

- where the next order number comes from (`EC-2026-001`, then increment);
- the standard order-folder structure;
- the 8-question intake maximum;
- the current introductory commission pricing model as already documented, without changing it;
- the exact evidence to retain: enquiry, agreed scope, customer confirmation, invoice/payment record, final files, rights grant;
- a short "do not promise" section: no exclusivity unless agreed, no Design Family rights, no automatic IP ownership transfer, no unsupported provenance promise;
- a short "if unsure" rule: do not guess commercial scope or rights; ask the customer before final delivery.

## 2. Create a customer-ops index

Create:

`docs/customer-ops/README.md`

Make it a simple index explaining which template is used at which stage. Do not duplicate full template content.

## 3. Perform a paper dry-run

Do a non-live fictional dry-run of one customer order using the current templates.

Do NOT send email, submit forms, generate invoices, take payment, touch D1, or create a real customer record.

Use a clearly fictional customer such as `TEST CUSTOMER — DO NOT SEND`.

Check whether the workflow can be completed without contradictory wording or missing required fields.

Report blockers rather than inventing information.

## 4. Payment/seller-detail readiness audit

Identify exactly which facts Mike still needs to supply before the first real invoice/order can be completed.

Expected examples may include:

- chosen payment method/account;
- seller legal name as it should appear on the invoice;
- seller address if legally/operationally required for the chosen invoice process;
- VAT/tax number only if one actually applies.

Do NOT invent any of these. Do NOT add personal banking details or credentials to GitHub.

If the current workflow can accept payment without a public checkout, say so clearly.

## 5. Consistency check

Check the public site and internal customer documents for contradictions in:

- contact email;
- introductory commission pricing;
- manual-order flow;
- personal vs commercial rights;
- delivery expectations;
- Recipe vs production export wording.

Do not change the £1,000/m² public statement in this task.

Only fix a typo or clearly contradictory safe text if necessary. Otherwise report it.

## 6. Launch freeze status

Create:

`docs/LAUNCH-FREEZE-STATUS-2026-09-07.md`

Keep it short. Separate:

- READY;
- NEEDS MIKE;
- ARTWORK PASS STILL OPEN;
- POST-LAUNCH / NOT A BLOCKER.

The Cloudflare Response Header Transform Rule has already been manually created and live-verified: all 14 intended response headers are present on `/`, `/contact.html`, and `/privacy.html`. Treat that blocker as CLOSED.

## Constraints

- direct `main` is acceptable for these docs-only changes;
- no PR;
- no `Co-Authored-By`;
- no public-site redesign;
- no renderer changes;
- no D1/auth/payment/subscription/migration work;
- no Paddle/Stripe;
- no Cloudflare rule changes;
- no new secrets or personal banking details in GitHub;
- no fake customer/testimonial/partner;
- no artwork placeholders;
- no changes to the £1,000/m² statement;
- no external messages or transactions.

## Final report

Report only:

- files created/changed;
- dry-run result;
- contradictions found/fixed;
- exact facts Mike must still provide before taking the first real payment;
- whether anything besides artwork/showcase integration remains a launch blocker.
