# Living Art — product status

Last updated with the V3 remote-control pass. This reflects what is
actually true right now, not what is planned. Anything not listed as
working should be assumed not working.

## WORKING NOW

- **Built-in EMVY MUSIC player**: loads the real catalogue from
  `https://media.emvycheck.com/playlist.json` (the same source the main
  site uses), plays real tracks, transport controls, shuffle, volume.
- **YOUR MUSIC**: a locally picked file, played and analysed the same way;
  never uploaded anywhere.
- **DEMO BEAT**: fully synthetic, no audio playback, for silent demos.
- **Web Audio analysis**: bass/mid/treble bucketed from one AnalyserNode,
  energy/kick/transient/smoothedEnergy derived with attack/release
  smoothing, CALM/NORMAL/HARD sensitivity curves.
- **16 procedural families**, each mapping bass/kick/mid/treble to a
  distinct visual parameter (verified: continuous-mode reassembly is
  pixel-identical across panels; deterministic - same seed/settings
  reproduce the same base composition).
- **1 / 2×2 / 3×3 layouts**, ONE ARTWORK / SEED FAMILY / INDEPENDENT
  COLLECTION composition.
- **PAPER**: genuinely static - draws once, cancels its own animation
  frame, verified 0 `requestAnimationFrame` scheduling calls while idle
  (including with an open, keepalive-pinging room WebSocket).
- **Local library** (IndexedDB, localStorage fallback): save / favourite /
  rename / delete, portable ART CODE JSON export/import.
- **AUTO ART** scheduler (manual/minute/hour/day/week ×
  new-art/same-palette/same-family/favourites), fires only on a genuine
  schedule boundary, never immediately when turned on.
- **Canvas Grid source type**: real JSON contract, loader, and three
  sample artworks - rendered by this repo's own public engine, not the
  private Canvas Grid Studio generator (see "FUTURE" below).
- **Presentation mode**: ~75s honest looping demo, including a clearly
  labelled *simulated* remote-control section.
- **Remote room control (V3, hardened)**: a phone/laptop "controller" can
  change seed, palette, family, density, speed, composition, display mode,
  aspect, ePaper, quality, sensitivity, source and auto-art settings on a
  room, and every connected wall/panel player updates over WebSocket.
  Verified end to end through real browser tabs against a locally running
  Worker: room creation, QR + copyable links, panel connect, a NEW ART
  patch reaching a connected panel and changing its rendered pixels in
  under a second, INSTALLATION STATUS correctly showing which screens are
  connected, DISCONNECT, and reconnection after a page reload. Every
  capability link (controller and panel) carries its room/token in the
  URL fragment, never the query string, so it is never sent to any
  server on navigation - see `living-art-cloud/PROTOCOL.md`.
- **Shared LIVE timing**: connected panels derive their animation phase
  from the room's `liveEpoch` (a server timestamp), corrected for this
  device's own clock offset from the room's clock, instead of a local
  counter - so independently loaded screens move together even when
  their wall clocks disagree, instead of each starting at an unrelated
  phase.
- **Remote MUSIC telemetry**: the controller's live audio analysis
  (bass/mid/treble/energy/kick/transient - never raw audio) is relayed to
  connected players so a single phone/computer playing EMVY music can
  drive the whole wall's reaction together.

## LOCAL / OFFLINE (works with zero setup, no cloud needed)

- Everything under "WORKING NOW" except the remote-room bullets works
  fully offline. Someone can open the product URL and understand it
  immediately - remote control is an *additional* capability, not a gate.
- **Deterministic offline scheduling**: independently loaded panel players
  compute the same generation from UTC time + an installation seed, no
  network call.
- **Same-device sync** (BroadcastChannel/localStorage): multiple player
  windows on one browser/computer follow controller changes instantly.
  This does not reach other physical devices - that requires the remote
  room.

## REMOTE CLOUD: LIVE / DEPLOYED

- **Worker:** `living-art-cloud`
- **Production backend:** `https://living-art-cloud.veltrusky-michal.workers.dev`
- **Verified live** (real production room, real Durable Object writes, real
  WebSocket connections - not just `wrangler dev`): room creation,
  controller/player connection, 1 remote player, NEW ART, palette,
  family/style, PAPER, LIVE, shared timing (server-clock-offset-corrected
  animation phase matching between controller and player), stale-revision
  rejection, remote audio telemetry, disconnect/reconnect, wrong-token
  rejection, bad-Origin rejection.
- This is a separate Cloudflare project from the main `emvycheck.com`
  site/Worker - see "Architecture separation" below. Deploying or
  changing `living-art-cloud` never touches `emvycheck.com`, and vice
  versa.
- Architecture: one Cloudflare Worker + one Durable Object per room,
  using **SQLite-backed DO storage** and the **Hibernatable WebSocket
  API** (so an idle room - PAPER, or LIVE with nobody changing anything -
  costs nothing between events instead of pinning the object in memory
  for as long as any display has a connection open, the expected
  lifetime for a 24/7 installation). Room config persisted in DO storage,
  a server-side revision counter with **reject-not-merge optimistic
  concurrency** (a stale patch is never applied or merged - the sender
  gets the true current state back and resyncs), SHA-256-hashed
  view/control tokens (role is derived from which token matches, never
  trusted from a client claim), Origin-header validation on every
  WebSocket upgrade as defence-in-depth alongside the token, and a
  strict server-side validator (explicit bounds/enums per field) on every
  patch rather than a bare top-level-key allowlist. Full protocol and the
  reasoning behind each of these in `living-art-cloud/PROTOCOL.md` and
  `living-art-cloud/README.md`.
- Presence is role-aware: the controller sees full per-connection detail
  for installation health, a player only learns a headcount and whether a
  controller is connected - never other players' or the controller's
  metadata.
- `POST /api/room` (the one anonymous, unlimited-by-default endpoint) is
  rate-limited per client IP via the Workers Rate Limiting binding, with
  a documented fallback if that binding isn't available on a given
  account/plan (see `living-art-cloud/README.md` "Room creation rate
  limiting").
- Re-verified after the full hardening pass via `wrangler dev` plus a
  rewritten scripted WebSocket test harness (96 assertions, 0 failures)
  covering: room creation, all 9 panels connecting, patch propagation,
  palette/family changes, a stale-revision conflict between two
  controllers (both start at the same revision, one succeeds, the
  other's stale attempt is rejected and resynced - the panels only ever
  see the winning change), server-side validation rejecting out-of-range/
  malformed patch values, an oversized-message rejection, duplicate room
  `/init` rejection, wrong-token and wrong/missing-Origin rejection,
  role-aware presence payload shape, PAPER→LIVE, shared timing with
  server-clock-offset correction, audio telemetry relay, hibernation-safe
  reconnection (session metadata correctly rebuilt from
  `getWebSockets()`), controller/panel disconnect+reconnect, malformed
  messages, wrong-role patch rejection, and 1/4/9-screen rooms. `wrangler
  deploy --dry-run` confirms the SQLite DO migration, rate-limit binding,
  and production `ALLOWED_ORIGIN` all resolve cleanly with no deployment.
- `CloudSyncAdapter` in `living-art/sync.js` (`DEFAULT_CLOUD_URL`) points
  at the real deployed Worker above by default; override per-browser for
  local dev without editing source via
  `localStorage.setItem('emvy-living-art-cloud-url', 'ws://localhost:8787')`.
  The V3 frontend itself is not yet deployed to `emvycheck.com` - see
  "Architecture separation" below for what that would take.
- Reconnection uses exponential backoff (0.5s → 30s, jittered); a
  reconnecting client always adopts the server's current revision rather
  than pushing its own possibly-stale cached state back over it. A raw
  (non-JSON) ping/pong keepalive, answered by the Workers runtime's own
  auto-response without waking the Durable Object, lets the client detect
  a silently-dead connection (e.g. a device that slept) and reconnect
  even when the browser never fires a normal `onclose`.

## Architecture separation

Two separate Cloudflare projects, deliberately kept apart:

- **`emvycheck`** → `emvycheck.com` → the frontend/music/Living Art
  browser application (this repo's `living-art/` and the rest of the
  public site).
- **`living-art-cloud`** → `living-art-cloud.veltrusky-michal.workers.dev`
  → Durable Objects / rooms / WebSockets / remote control only.

The `emvycheck` project's deploy config is never pointed at
`/living-art-cloud/`, and the cloud backend never replaces or serves the
main site. The frontend only *talks to* `living-art-cloud` over WSS, the
same way it would talk to any other API.

## SIMULATED

- The presentation-mode "REMOTE INSTALLATION CONTROL" section is
  explicitly labelled SIMULATED DEMO in its own on-screen text - one
  browser cannot show a real second device, so it narrates the concept
  rather than claiming a live connection.
- The three Canvas Grid sample artworks are rendered live by this
  repo's public engine using locked parameters, not real exports from the
  private Canvas Grid Studio. `masterImage`/`panels[].image` are `null` on
  all three - the contract exists for real Studio exports to fill in
  later without touching the rest of the app.
- ePaper preview is a CSS colour/contrast approximation, not a Samsung or
  Philips-accurate colour simulation - labelled as such in the UI.

## FUTURE / NOT BUILT (intentionally, per scope)

- No accounts, billing, subscriptions, admin CRM, analytics platform, D1
  database, e-commerce, or SDK wrappers for specific display vendors.
- No multi-controller conflict UI: nothing stops more than one
  control-token holder from connecting to a room at once, and two
  controllers changing the same room "at the same time" resolves purely
  by server-arrival order (whichever patch reaches the room first wins;
  the other is rejected and resynced, never merged - see
  `living-art-cloud/PROTOCOL.md` "Multiple controllers"). There is no
  "someone else is editing" indicator, no live cursors, no collaborative-
  editing UX.
- AUTO ART's "favourites only" mode is deterministic per device, but
  favourites live in each device's own local library - true multi-panel
  sync for that one mode needs each panel to share the same saved
  favourites, which nothing currently keeps in sync.
- Publishing real Canvas Grid Studio artwork into the `CANVAS GRID` source
  type (populating real `masterImage`/`panels[].image` files) - the
  contract and loader are ready for this, nothing else needs to change.
- A real second controller UI for "who's currently in control" beyond the
  simple connected/not-connected presence list.
