# Living Art cloud control

A small Cloudflare Worker + one Durable Object per room, giving a phone or
laptop "controller" the ability to change a Living Art installation and
have every connected wall/panel player update live over WebSocket. See
`PROTOCOL.md` for the exact message shapes.

This is intentionally isolated from `/living-art/` (the static frontend).
Nothing here is bundled into the public site; the frontend only talks to
it over HTTPS/WSS once a Worker URL is configured (see below).

## Local development (no deployment)

```bash
cd living-art-cloud
npm install
npm run dev
```

`wrangler dev` runs the Worker and a local Durable Object instance on
`http://localhost:8787` (default port). No Cloudflare account mutation
happens for `wrangler dev` - it is a local simulator.

Point the frontend at it for local testing by setting, in a browser
console on the Living Art page before connecting:

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

This creates the Worker (`living-art-cloud`) and its Durable Object
namespace (`ROOMS` / `LivingArtRoom`) under your Cloudflare account and
prints the deployed URL, typically:

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

### Restricting CORS

`wrangler.toml` sets `ALLOWED_ORIGIN = "*"` for development. Before
relying on this for a real installation, change it to the real site
origin, e.g. `ALLOWED_ORIGIN = "https://emvycheck.com"`, and redeploy.

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
