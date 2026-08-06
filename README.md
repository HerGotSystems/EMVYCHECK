# PHUL Kit — Personal Human Use License
## EMVY CHECK / Michal Veltruský

Drop this kit into every project repo. Seven files plus one optional HTML head block. No dependencies.

---

## Files and Where They Go

| File | Destination | Purpose |
|------|-------------|---------|
| `robots.txt` | Repo root (served at `/robots.txt`) | Blocks all major AI crawlers by name |
| `llms.txt` | Repo root (served at `/llms.txt`) | Emerging AI agent standard — policy in plain language |
| `ai.txt` | Repo root (served at `/ai.txt`) | Machine-readable operator-level policy |
| `LICENSE-PHUL.txt` | Repo root (served at `/LICENSE-PHUL.txt`) | Full license text — the legal anchor |
| `_headers` | Repo root — Cloudflare Pages picks it up automatically | Injects license headers on every HTTP response |
| `meta-tags.html` | Copy the contents into `<head>` of every HTML page | In-page machine-readable signals |

---

## Before Deploying

1. Keep `emvycheck.com` if this is for EMVY CHECK projects. For other brands/domains, replace it consistently in `robots.txt`, `llms.txt`, `ai.txt`, `_headers`, `meta-tags.html`, `WELCOME.txt`, and `LICENSE-PHUL.txt`.
2. Put all `.txt` files and `_headers` in the repo root so they are served publicly.
3. Copy the contents of `meta-tags.html` into the `<head>` of every HTML page.
4. The `_headers` file works on Cloudflare Pages and Netlify. For Vercel, convert the same headers into `vercel.json`.

---

## What This Does

- **Removes plausible deniability** for AI companies and crawlers — notices exist at every layer (HTTP, robots, meta, structured data, plain text).
- **Establishes constructive notice** — the legal "parking sign" principle. You knew or should have known.
- **Covers four enforcement layers**: human-readable, machine-readable, HTTP, and contractual.
- **Positions you for future enforcement** as AI training regulations tighten.

## What This Does NOT Do

- Force bots to comply (nothing can). Rogue scrapers will scrape.
- Win you a lawsuit tomorrow against OpenAI/Google on its own.
- Replace a proper lawyer if you're pursuing serious infringement.

---

## Fingerprinting (Next Layer)

To go further — inject unique invisible markers into generated content,
downloadable files, or tool outputs. Then if your content appears in AI
training data or model outputs, you have forensic proof.

Ask Claude to build a fingerprinting injector when you're ready.

---

© EMVY CHECK / Michal Veltruský


## Version

PHUL v1.0 — reusable repo kit prepared for EMVY CHECK projects.
