# Living Art cloud control

A small Cloudflare Worker + one Durable Object per room, giving a phone or
laptop "controller" the ability to change a Living Art installation and
have every connected wall/panel player update live over WebSocket. See
`PROTOCOL.md` for the exact message shapes and the hardening rationale
behind each design decision below.

This is intentionally isolated from `/living-art/` (the static frontend).
Nothing here is bundled into the public site; the frontend only talks to
it over HTTPS/WSS once a Worker URL is configured (see below).

## Storage

The `LivingArtRoom` Durable Object uses **SQLite-backed storage**
(`new_sqlite_classes` in `wrangler.toml`'s `[[migrations]]`), the current
requirement for a new (non-legacy) Durable Object namespace - the older
key-value-only backend is no longer available to new classes. Code-wise
this is invisible: `this.state.storage.get`/`.put` work exactly the same
either way, only the underlying engine differs.

`wrangler.toml` also documents why this uses `[[migrations]]` rather than
the newer declarative `[exports]` block: `exports` is real and covers
class lifecycle states (renamed/deleted/transferred) across later
deployments, which is genuine complexity this project doesn't have yet -
one class, first deployment, nothing to migrate away from.

## Local development (no deployment)

```bash
cd living-art-cloud
npm install
npm run dev
```

`wrangler dev` runs the Worker and a local Durable Object instance on
`http://localhost:8787` (default port). No Cloudflare account mutation
happens for `wrangler dev` - it is a local simulator. It also simulates
the SQLite DO storage and the rate-limiting binding locally.

Local dev needs its own `ALLOWED_ORIGIN` (see "CORS & WebSocket Origin"
below) since the production default only allows `https://emvycheck.com`.
Create `living-art-cloud/.dev.vars` (gitignored, never committed):

```
ALLOWED_ORIGIN=http://localhost:8936
```

(matching whatever local origin actually serves `living-art/`;
`wrangler dev` loads `.dev.vars` automatically and it is never used by
`wrangler deploy`). Point the frontend at the local Worker for testing by
setting, in a browser console on the Living Art page before connecting:

```js
localStorage.setItem('emvy-living-art-cloud-url', 'ws://localhost:8787');
```

(The default, unset value points at a placeholder production URL that
does not exist yet - see "Deploying" below.)

## Deploying (NOT done by this change - do this yourself when ready)

```bash
cd living-art-cloud
npx wrangler login          # once, opens a browser to authorise
npx wrangler deploy
```

Before your first real deploy, validate the config without touching
Cloudflare at all:

```bash
npx wrangler deploy --dry-run
```

This bundles the Worker and prints every binding it resolved (Durable
Object, rate limiter, `ALLOWED_ORIGIN`) without creating or changing
anything remotely - confirm the bindings look right and `ALLOWED_ORIGIN`
is your real production origin, not `*` or a local one, before running
the real `deploy`.

`wrangler deploy` creates the Worker (`living-art-cloud`) and its Durable
Object namespace (`ROOMS` / `LivingArtRoom`) under your Cloudflare
account and prints the deployed URL, typically:

```
https://living-art-cloud.<your-subdomain>.workers.dev
```

To use a custom domain instead (e.g. `cloud.emvycheck.com`), add a route
or a `[[routes]]` entry to `wrangler.toml` and create the DNS record in
the Cloudflare dashboard - neither is done by this change.

### After deploying

Update the frontend's Worker URL constant in `living-art/sync.js`
(`DEFAULT_CLOUD_URL`, documented inline) to the real deployed URL, or set
it at runtime the same way as local dev:

```js
localStorage.setItem('emvy-living-art-cloud-url', 'wss://living-art-cloud.<your-subdomain>.workers.dev');
```

## CORS & WebSocket Origin

`wrangler.toml`'s production default is `ALLOWED_ORIGIN =
"https://emvycheck.com"` - **not** a wildcard. This value gates two
independent things:

1. The Worker's own CORS headers on `POST /api/room` and `GET
   /api/room/:id` (`corsHeaders` in `src/worker.js`).
2. The Origin header check the Durable Object performs on every
   WebSocket upgrade (`isAllowedOrigin` in `src/room.js`) - HTTP CORS
   alone does not restrict who can open a WebSocket, so this is a
   separate, explicit check. It is defence-in-depth alongside the bearer
   token, which remains the primary authority: a same-origin request
   with a bad token is still rejected, and this check exists to narrow
   who can even attempt a token guess from a browser context.

If you genuinely need more than one production origin (e.g. a staging
domain), make it a comma-separated list:
`ALLOWED_ORIGIN = "https://emvycheck.com,https://staging.emvycheck.com"`.
Never ship `"*"` as the production value - local dev overrides it
per-environment via `.dev.vars` instead (see above).

## WebSocket authentication

The room WebSocket URL still carries the bearer token as a query
parameter (`?token=...`), not a dedicated first-message auth handshake.
That was a deliberate choice, not an oversight: a WebSocket upgrade URL
is a same-origin request made by script, not a page navigation - it is
never placed in the browser's address bar or history, and browsers do
not send a `Referer` header for it. The realistic remaining exposure is
this device's own DevTools Network tab and the room's server-side access
log, which is an acceptable trade-off against inventing a bespoke
first-message challenge/response on top of the token + Origin checks the
room already enforces. What *does* get moved off the query string is the
capability link a human actually clicks/scans (the page URL) - see
"Room creation" below and `PROTOCOL.md`.

## Room creation rate limiting

`POST /api/room` is the one anonymous, otherwise-unlimited
resource-creation endpoint, so it is the one thing rate-limited here.
`wrangler.toml` configures a Workers Rate Limiting binding:

```toml
[[ratelimits]]
name = "ROOM_CREATE_LIMITER"
namespace_id = "1001"
  [ratelimits.simple]
  limit = 5
  period = 60
```

`namespace_id` just needs to be a unique-to-you integer string
identifying this limiter's bucket namespace within your account -
`"1001"` is an arbitrary placeholder that works as-is; there is nothing
to look up or provision for it. `limit`/`period` (5 requests per 60s per
key) is a starting point, not a tuned production value - adjust to taste
once you have a sense of real installation-creation traffic. The Worker
keys each check on `CF-Connecting-IP` (`src/worker.js`), so this is a
per-client-IP ceiling, not a global one, and it never touches normal
art-change traffic over an already-open room WebSocket.

**Fallback if the binding is unavailable** (e.g. an account/plan that
doesn't have Rate Limiting enabled): `src/worker.js` wraps the
`env.ROOM_CREATE_LIMITER.limit()` call in a try/catch and simply skips
the check if it throws, rather than inventing an ad hoc in-memory
counter that would silently stop working the moment the Worker scales to
more than one instance. If you deploy somewhere without this binding,
room creation is anonymous and unlimited until you add your own
enforcement - that is an explicit, visible gap, not a fake protection.

## Storage

Only the Durable Object's own transactional storage is used (`this.state.
storage`) to persist each room's latest config, revision and hashed
tokens. There is no D1 database and none is needed for this feature.

## What this does NOT do yet

- No accounts, no billing, no admin dashboard.
- No cross-room discovery or listing - a room is only reachable if you
  have its ID and a valid token.
- No TURN/relay for anything other than small JSON messages - it is not
  a media server.
- No "someone else is editing" UI for multiple simultaneous controllers -
  see `PROTOCOL.md` "Multiple controllers (honest scope)".
