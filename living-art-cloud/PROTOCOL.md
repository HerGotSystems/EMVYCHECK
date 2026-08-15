# Living Art cloud room protocol

One Durable Object instance (`LivingArtRoom`) owns one room. Clients (a
controller and any number of wall/panel players) connect over WebSocket
and exchange small JSON messages. No video/canvas frames are ever sent -
only configuration, timing and lightweight audio-analysis numbers.

The Durable Object uses the Hibernatable WebSocket API - see
"Hibernation" below - so an idle room (PAPER, or LIVE with nobody
changing anything) costs nothing between events instead of pinning the
object in memory for as long as any display has a connection open.

## HTTP (Worker)

### `POST /api/room`
Body: `{ "name": "Hotel Lobby" }`

Creates a room and returns its tokens **once**. The control token is not
retrievable again after this call - store it client-side.

Rate-limited per client IP (see `README.md` "Room creation rate
limiting") - this is the one anonymous, otherwise-unlimited
resource-creation endpoint. A limited request gets `429` with
`{"error":"rate-limited", ...}`. Normal art-change traffic over an
already-open room WebSocket is never subject to this.

Response:
```json
{
  "roomId": "HOTEL-LOBBY-a1b2c3",
  "name": "Hotel Lobby",
  "viewToken": "…",
  "controlToken": "…",
  "createdAt": 1730000000000
}
```

### `GET /api/room/:roomId`
Public info only, no tokens:
```json
{ "exists": true, "roomId": "...", "name": "...", "revision": 12, "updatedAt": 1730000000000, "connected": 4 }
```

### `GET /api/room/:roomId/ws?token=...&panel=...&layout=...&playerId=...&clientId=...&ua=...`
WebSocket upgrade. Two checks gate it, in this order:

1. **Origin** - the request's `Origin` header must be in the room's
   configured `ALLOWED_ORIGIN` allowlist, checked the same way as the
   Worker's own CORS handling (see `README.md`). This is defence-in-depth,
   not the primary authority - a same-origin request with a bad/missing
   token is still rejected.
2. **Token** - `token` is required. The room derives the connection's
   **actual** role from which stored token hash the presented token
   matches (control token → `controller`, view token → `player`). There is
   no client-supplied role parameter at all - a client cannot claim a role
   it does not hold a matching token for.

Either check failing returns a plain (non-upgraded) `403` JSON response.

`panel`/`layout`/`playerId`/`clientId`/`ua` are optional metadata used for
the installation status view; a controller connection can omit them.

The token still travels in this URL's query string rather than a
dedicated auth handshake - see `README.md` "WebSocket authentication" for
why that is an accepted, documented trade-off rather than an oversight.
It is a materially different exposure than a capability token in the
*page* URL: this is a same-origin request initiated by script, not a
navigation, so it is never placed in browser history and never sent as a
`Referer` to any third party. The frontend (`living-art/player.js`,
`living-art/app.js`) keeps `room`/`token`/`ctrl` only in the URL
**fragment** of the page it hands out - fragments are never transmitted
to any server at all.

### Message size limit

Any single WebSocket message over 32KB is rejected before it is even
`JSON.parse`d, with a clean `{type:'error', code:'message-too-large'}`
reply - the connection stays open and the room keeps running.

## WebSocket messages

All messages are JSON with a `type` field, **except** the keepalive
ping/pong, which are the raw strings `"ping"` / `"pong"` (see
"Keepalive & hibernation" below).

### Server → client

| type | when | fields |
|---|---|---|
| `hello` | immediately on connect | `roomId, name, revision, config, liveEpoch, updatedAt, serverTime, role` |
| `patch` | after any accepted config change | `revision, changes, updatedAt, liveEpoch, originClientId, serverTime` |
| `state` | reply to a *rejected* patch (`conflict: true`) | `revision, config, updatedAt, liveEpoch, conflict, serverTime` - the room's true current state; see "Revision / conflict rules" |
| `audio` | relayed from the controller during MUSIC mode | `t, bass, mid, treble, energy, kick, transient` |
| `presence` | whenever membership changes, or on request - **shape depends on the recipient's own role** | see "Presence privacy" below |
| `error` | malformed/forbidden/oversized request | `code, message` |

`config` always matches the Living Art V2 state shape (`seed, family,
palette, density, speed, layout, composition, displayMode, aspect,
epaper, quality, sensitivity, sourceType, canvasGridId, autoArt,
installSeed, independent`) - nothing new is invented here.

`liveEpoch` is a server timestamp (ms) marking when the current
composition's shared animation phase was last reset to zero. Every
client derives its LIVE motion phase from `(serverNow - liveEpoch)`,
where `serverNow` is corrected for this device's own clock offset (see
"Server clock offset" below) instead of a locally-accumulated counter, so
independently loaded panels stay visually coordinated even on devices
whose wall clocks disagree. `liveEpoch` is bumped whenever a patch is
sent with `resetPhase: true` (a "new artwork" style change), left alone
for a tweak like density or speed.

### Client → server

| type | who | fields |
|---|---|---|
| `hello` | any | `playerId, panel, layout, clientId, ua` - updates this connection's telemetry |
| `patch` | controller only | `baseRevision` (required), `changes: {...}`, `resetPhase: boolean` - see "Revision / conflict rules" |
| `audio` | controller only | `bass, mid, treble, energy, kick, transient` - throttle to ~10-20/s client-side; the server also enforces a ~25/s floor per connection as a backstop |
| `status-request` | any | requests an immediate `presence` reply |

A `patch` from a non-controller connection, a `patch` missing
`baseRevision`, or any message with an unrecognised `type`, gets a
`{type:'error', ...}` reply and is otherwise ignored - it never crashes
the room or disconnects the sender. Every field in `changes` is validated
server-side against an explicit allowlist of bounds/enums (see
`src/room.js` `sanitizeChanges`) - an out-of-range or wrong-type value is
either clamped, dropped, or replaced with the current value; the server
never persists an unbounded or unrecognised object, and a value it
doesn't like never silently makes it to other panels.

## Revision / conflict rules

The room uses optimistic concurrency, **reject-not-merge**:

- The Durable Object is the single source of truth. `revision` is a
  server-side counter incremented once per accepted patch; clients never
  assign their own revision numbers.
- Every `patch` a controller sends must name `baseRevision`: the revision
  it believes the room is currently at. If that matches the room's actual
  revision, the patch is applied and `revision` increments by one.
- If `baseRevision` is **behind** the room's actual revision - another
  controller's change landed first - the patch is rejected outright. It
  is never merged, never partially applied. The rejecting controller
  instead gets a `state` message (`conflict: true`) carrying the room's
  real current `revision`/`config`/`updatedAt`/`liveEpoch`. The frontend
  (`living-art/sync.js` `_handleMessage`) adopts that as the new
  authoritative state; the next patch the user sends is automatically
  built on the correct `baseRevision`, no special retry code needed.
- Tested explicitly: two controllers connect to the same room and observe
  the same revision (4). One successfully patches to revision 5. The
  other's patch, still naming `baseRevision: 4`, is rejected with a
  `conflict: true` `state` message carrying revision 5 and the *first*
  controller's config - not merged, not silently overwritten - and every
  connected panel only ever sees the one accepted change.
- On reconnect (`hello`), the client always gets the room's current
  revision/config and adopts it outright - a client's own possibly-stale
  locally-cached config is never pushed back over a newer server state.

### Multiple controllers (honest scope)

Nothing prevents more than one control-token holder from being connected
to a room at once - the control link is a bearer capability, not a seat.
Two controllers changing the same room "at the same time" is resolved
purely by the rule above: whichever patch reaches the Durable Object
first (server arrival order) wins, the other is rejected and resynced.
`presence` (sent to controllers) reports whether *a* controller is
connected, not *which* one or *how many* - there is no "someone else is
editing this" indicator, no live cursors, no collaborative-editing UX.
That is unbuilt, not merely undocumented; if two people are meant to
share control of one installation today, the practical answer is "the
second person watches, does not also drive."

## Presence privacy

`presence` is role-aware - a player only learns what it needs to render
correctly, not what the controller can see:

- **To the controller**: `{type:'presence', clients:[{role,panel,
  playerId,connectedAt,lastSeen,ua}], controllerConnected, serverTime}` -
  full per-connection detail for every player and the controller itself,
  the installation-health view the CONTROLLER STATUS / INSTALLATION
  STATUS UI is built from.
- **To a player**: `{type:'presence', playerCount, controllerConnected,
  serverTime}` - just a headcount and whether a controller is connected.
  A player is never sent other players' `playerId`/`ua`/timestamps, and
  never the controller's connection metadata beyond the fact that one is
  connected. This is presence for "is my installation healthy", not an
  analytics feed.

## Server clock offset

`hello`, `patch`, and `state` (conflict) messages all carry `serverTime`
(the room DO's own `Date.now()` at send time). Clients compute
`serverClockOffset = serverTime - Date.now()` on every one of these
messages (`living-art/sync.js`) and use `Date.now() + serverClockOffset`
as "now" when deriving the shared LIVE/MUSIC animation phase from
`liveEpoch`. This is refined opportunistically from messages the room
already sends for other reasons - there is no dedicated clock-sync
message and no polling loop.

## Keepalive & hibernation

The room registers a WebSocket auto-response pair
(`state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping',
'pong'))`, see `src/room.js`): the raw string `"ping"` gets the raw string
`"pong"` back, answered by the Workers runtime itself **without waking
the Durable Object**. There is no `setInterval`/`setTimeout` inside the
DO for this or anything else. Clients send a raw `"ping"` roughly every
20s and, if no `"pong"` has arrived in ~55s, force-close and reconnect -
some dead connections (a device that slept, a network that vanished
without a clean close) never fire a normal `onclose`/`onerror`, so this
liveness check is what actually triggers a reconnect for those.

Session metadata for hibernation-safe reconnection (`role, panel,
layout, playerId, clientId, ua, connectedAt, lastSeen, lastAudioAt`) is
stored per-connection via `serializeAttachment`/`deserializeAttachment`
and rebuilt from `state.getWebSockets()` every time the object is
(re)constructed - nothing about an open connection is kept only in a
plain in-memory `Map` that hibernation would wipe out. High-frequency
audio telemetry is never part of this attachment and never written to
`storage` - see "What is deliberately NOT sent" below. A room in PAPER,
or in LIVE with nobody changing anything, is fully hibernatable; a room
actively receiving MUSIC telemetry is expected to stay resident while
that traffic continues, since each message is itself an event the DO
must relay.

## What is deliberately NOT sent

- No canvas frames, no images, no audio itself - only small state/timing/
  telemetry messages.
- No permanent history of every audio telemetry tick; only meaningful
  config changes are persisted (`this.state.storage`), audio is relayed
  live and never written to storage.
- No unbounded or unrecognised client-supplied object - every `patch`
  field is validated/bounded server-side (see above) before it is ever
  applied or persisted.
