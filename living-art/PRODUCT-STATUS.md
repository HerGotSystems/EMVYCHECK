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
- **Remote room control (new in V3)**: a phone/laptop "controller" can
  change seed, palette, family, density, speed, composition, display mode,
  aspect, ePaper, quality, sensitivity, source and auto-art settings on a
  room, and every connected wall/panel player updates over WebSocket.
  Verified end to end through real browser tabs against a locally running
  Worker: room creation, QR + copyable links, panel connect, a NEW ART
  patch reaching a connected panel and changing its rendered pixels in
  under a second, INSTALLATION STATUS correctly showing which screens are
  connected, DISCONNECT, and reconnection after a page reload.
- **Shared LIVE timing**: connected panels derive their animation phase
  from the room's `liveEpoch` (a server timestamp) instead of a local
  counter, so independently loaded screens move together instead of each
  starting at an unrelated phase.
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

## REMOTE CLOUD (requires deploying `living-art-cloud/` - not deployed by this change)

- Architecture: one Cloudflare Worker + one Durable Object per room,
  WebSocket transport, room config persisted in DO storage, revision
  counter for stale-update rejection, SHA-256-hashed view/control tokens
  (role is derived from which token matches, never trusted from a client
  claim). Full protocol in `living-art-cloud/PROTOCOL.md`.
- Verified locally via `wrangler dev` plus real browser tabs and a
  scripted 1-controller/9-panel WebSocket test harness covering: room
  creation, all panels connecting, patch propagation, palette/family
  changes, PAPER→LIVE, shared timing, audio telemetry relay, panel
  disconnect/reconnect, controller disconnect/reconnect, malformed
  messages, wrong tokens, and 1/4/9-screen rooms - see the completion
  report for the exact results.
- **Not yet deployed anywhere.** `CloudSyncAdapter` in `living-art/sync.js`
  points at a placeholder Worker URL until someone runs
  `wrangler deploy` and updates it (see `living-art-cloud/README.md` for
  the exact steps). Until that happens, every "remote room" UI action
  fails gracefully (a toast, nothing breaks) and the product runs exactly
  as it did before this pass.
- Reconnection uses exponential backoff (0.5s → 30s, jittered); a
  reconnecting client always adopts the server's current revision rather
  than pushing its own possibly-stale cached state back over it.

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
- No multi-controller conflict UI (two people editing at once both just
  win in server-arrival order - there is no "someone else is editing"
  indicator).
- AUTO ART's "favourites only" mode is deterministic per device, but
  favourites live in each device's own local library - true multi-panel
  sync for that one mode needs each panel to share the same saved
  favourites, which nothing currently keeps in sync.
- Publishing real Canvas Grid Studio artwork into the `CANVAS GRID` source
  type (populating real `masterImage`/`panels[].image` files) - the
  contract and loader are ready for this, nothing else needs to change.
- A real second controller UI for "who's currently in control" beyond the
  simple connected/not-connected presence list.
