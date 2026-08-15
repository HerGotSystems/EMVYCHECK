# Living Art cloud room protocol

One Durable Object instance (`LivingArtRoom`) owns one room. Clients (a
controller and any number of wall/panel players) connect over WebSocket
and exchange small JSON messages. No video/canvas frames are ever sent -
only configuration, timing and lightweight audio-analysis numbers.

## HTTP (Worker)

### `POST /api/room`
Body: `{ "name": "Hotel Lobby" }`

Creates a room and returns its tokens **once**. The control token is not
retrievable again after this call - store it client-side.

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

### `GET /api/room/:roomId/ws?token=...&role=...&panel=...&layout=...&playerId=...&clientId=...&ua=...`
WebSocket upgrade. `token` is required. The room derives the connection's
**actual** role from which stored token hash the presented token matches
(control token → `controller`, view token → `player`) - the `role` query
parameter is informational only and is never trusted for authorization.

`panel`/`layout`/`playerId`/`clientId`/`ua` are optional metadata used for
the installation status view; a controller connection can omit them.

## WebSocket messages

All messages are JSON with a `type` field.

### Server → client

| type | when | fields |
|---|---|---|
| `hello` | immediately on connect | `roomId, name, revision, config, liveEpoch, updatedAt, serverTime, role` |
| `patch` | after any accepted config change | `revision, changes, updatedAt, liveEpoch, originClientId` |
| `audio` | relayed from the controller during MUSIC mode | `t, bass, mid, treble, energy, kick, transient` |
| `presence` | whenever membership changes, or on request | `clients:[{role,panel,playerId,connectedAt,lastSeen,ua}], controllerConnected, serverTime` |
| `pong` | reply to `ping` | `t` (echoed), `serverTime` |
| `error` | malformed/forbidden request | `code, message` |

`config` always matches the Living Art V2 state shape (`seed, family,
palette, density, speed, layout, composition, displayMode, aspect,
epaper, quality, sensitivity, sourceType, canvasGridId, autoArt,
installSeed, independent`) - nothing new is invented here.

`liveEpoch` is a server timestamp (ms) marking when the current
composition's shared animation phase was last reset to zero. Every
client derives its LIVE motion phase from `(now - liveEpoch)` instead of
a locally-accumulated counter, so independently loaded panels stay
visually coordinated. It is bumped whenever a patch is sent with
`resetPhase: true` (a "new artwork" style change), left alone for a
tweak like density or speed.

### Client → server

| type | who | fields |
|---|---|---|
| `hello` | any | `playerId, panel, layout, clientId, ua` - updates this connection's telemetry |
| `patch` | controller only | `changes: {...}, resetPhase: boolean` |
| `audio` | controller only | `bass, mid, treble, energy, kick, transient` - throttle to ~10-20/s client-side; the server also enforces a ~25/s floor per connection as a backstop |
| `status-request` | any | requests an immediate `presence` reply |
| `ping` | any | `t` - round trip / keepalive |

A `patch` from a non-controller connection, or any message with an
unrecognised `type`, gets a `{type:'error', ...}` reply and is otherwise
ignored - it never crashes the room or disconnects the sender.

## Revision / conflict rules

- The Durable Object is the single source of truth. `revision` is a
  server-side counter incremented once per accepted patch; clients never
  assign their own revision numbers.
- Clients apply an incoming `patch`/`hello`'s config only if its
  `revision` is greater than the highest revision they have already
  applied. This makes a stale/duplicate message harmless.
- On reconnect, the client always gets a fresh `hello` with the room's
  current revision/config and simply adopts it - a client's own
  possibly-stale locally-cached config is never pushed back over a newer
  server state.

## What is deliberately NOT sent

- No canvas frames, no images, no audio itself - only small state/timing/
  telemetry messages.
- No permanent history of every audio telemetry tick; only meaningful
  config changes are persisted (`this.state.storage`), audio is relayed
  live and never written to storage.
