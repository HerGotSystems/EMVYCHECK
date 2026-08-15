/* EMVY CHECK Living Art — LivingArtRoom Durable Object.
   One instance per room (addressed by env.ROOMS.idFromName(roomId)).
   Owns the room's persisted config + revision, every live WebSocket
   connection for that room (controller + panel/wall players), and the
   join/patch/audio/presence protocol (see PROTOCOL.md).

   Hibernation: this class uses the Hibernatable WebSocket API
   (state.acceptWebSocket + webSocketMessage/webSocketClose/webSocketError)
   so the object can be evicted from memory between events instead of
   staying pinned for as long as any display has a connection open - the
   expected lifetime for a 24/7 installation. Session metadata is stored
   per-connection via serializeAttachment/deserializeAttachment and
   rebuilt from state.getWebSockets() on every construction; nothing about
   an open connection is kept only in a plain in-memory Map.

   Security: a connecting client presents a bearer token in the /ws query
   string. Its ROLE is derived from which stored token hash it matches -
   a client cannot grant itself the controller role just by claiming
   ?role=controller. Tokens are stored hashed (SHA-256). The Origin header
   is also checked against the configured allowlist as a defence-in-depth
   layer; token authentication remains the primary authority. */

const DEFAULT_CONFIG = {
  seed: 'EMVY-0001',
  installSeed: '',
  family: 0,
  palette: 0,
  density: 58,
  speed: 28,
  layout: 9,
  composition: 'continuous',
  independent: [],
  aspect: 'square',
  displayMode: 'paper',
  quality: 'auto',
  epaper: false,
  musicSource: 'none',
  sensitivity: 'normal',
  shuffle: false,
  volume: 0.8,
  sourceType: 'generative',
  canvasGridId: null,
  autoArt: { interval: 'manual', mode: 'new-art' }
};

const MAX_MESSAGE_BYTES = 32 * 1024;
const MAX_NAME_LENGTH = 60;
const MAX_SEED_LENGTH = 60;
const MAX_ID_LENGTH = 80;
const MAX_META_LENGTH = 40;
const MAX_UA_LENGTH = 120;

const ENUMS = {
  layout: [1, 4, 9],
  composition: ['continuous', 'family', 'independent'],
  aspect: ['square', 'wide', 'classic'],
  displayMode: ['paper', 'live', 'music'],
  quality: ['auto', 'low', 'normal', 'high'],
  musicSource: ['none', 'emvy', 'local', 'demo'],
  sensitivity: ['calm', 'normal', 'hard'],
  sourceType: ['generative', 'canvasgrid'],
  autoInterval: ['manual', 'minute', 'hour', 'day', 'week'],
  autoMode: ['new-art', 'same-palette', 'same-family', 'favourites']
};

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

function clamp01(v) { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.min(1.4, v)) : 0; }
function clampInt(v, min, max, fallback) {
  v = Math.trunc(Number(v));
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}
function clampNum(v, min, max, fallback) {
  v = Number(v);
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
}
function boundedString(v, maxLen, fallback) {
  return typeof v === 'string' ? v.slice(0, maxLen) : fallback;
}
function oneOf(v, allowedKey, fallback) {
  return ENUMS[allowedKey].indexOf(v) !== -1 ? v : fallback;
}

/* Strict server-side validation. Every recognised key is bounded/enum
   -checked against the current config as a fallback; anything not listed
   here is silently dropped - the server never persists an unbounded or
   unrecognised user-supplied object. */
function sanitizeChanges(raw, current) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  if ('seed' in raw) { const s = boundedString(raw.seed, MAX_SEED_LENGTH, ''); if (s) out.seed = s; }
  if ('installSeed' in raw) out.installSeed = boundedString(raw.installSeed, MAX_SEED_LENGTH, '');
  if ('family' in raw) out.family = clampInt(raw.family, 0, 999, current.family);
  if ('palette' in raw) out.palette = clampInt(raw.palette, 0, 999, current.palette);
  if ('density' in raw) out.density = clampInt(raw.density, 20, 100, current.density);
  if ('speed' in raw) out.speed = clampInt(raw.speed, 5, 100, current.speed);
  if ('layout' in raw) out.layout = ENUMS.layout.indexOf(raw.layout) !== -1 ? raw.layout : current.layout;
  if ('composition' in raw) out.composition = oneOf(raw.composition, 'composition', current.composition);
  if ('aspect' in raw) out.aspect = oneOf(raw.aspect, 'aspect', current.aspect);
  if ('displayMode' in raw) out.displayMode = oneOf(raw.displayMode, 'displayMode', current.displayMode);
  if ('quality' in raw) out.quality = oneOf(raw.quality, 'quality', current.quality);
  if ('epaper' in raw) out.epaper = !!raw.epaper;
  if ('musicSource' in raw) out.musicSource = oneOf(raw.musicSource, 'musicSource', current.musicSource);
  if ('sensitivity' in raw) out.sensitivity = oneOf(raw.sensitivity, 'sensitivity', current.sensitivity);
  if ('shuffle' in raw) out.shuffle = !!raw.shuffle;
  if ('volume' in raw) out.volume = clampNum(raw.volume, 0, 1, current.volume);
  if ('sourceType' in raw) out.sourceType = oneOf(raw.sourceType, 'sourceType', current.sourceType);
  if ('canvasGridId' in raw) out.canvasGridId = raw.canvasGridId === null ? null : boundedString(raw.canvasGridId, MAX_ID_LENGTH, null);
  if ('autoArt' in raw) out.autoArt = sanitizeAutoArt(raw.autoArt, current.autoArt);
  if ('independent' in raw) out.independent = sanitizeIndependent(raw.independent);
  return out;
}
function sanitizeAutoArt(v, fallback) {
  if (!v || typeof v !== 'object') return fallback;
  return { interval: oneOf(v.interval, 'autoInterval', fallback.interval), mode: oneOf(v.mode, 'autoMode', fallback.mode) };
}
function sanitizeIndependent(v) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 9).map(function (entry) {
    if (!entry || typeof entry !== 'object') return { seed: '', family: 0, palette: 0 };
    return {
      seed: boundedString(entry.seed, MAX_SEED_LENGTH, ''),
      family: clampInt(entry.family, 0, 999, 0),
      palette: clampInt(entry.palette, 0, 999, 0)
    };
  });
}

export class LivingArtRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.room = null;
    this.sessions = new Map(); // WebSocket -> metadata, rebuilt below on every (re)construction

    // Ping/pong keepalive handled entirely by the runtime, without ever
    // waking this object - see PROTOCOL.md "Keepalive & hibernation".
    try { this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch (e) { /* fine locally on older simulators */ }

    this.state.blockConcurrencyWhile(async () => {
      this.room = (await this.state.storage.get('room')) || null;
      for (const ws of this.state.getWebSockets()) {
        const meta = safeDeserialize(ws);
        if (meta) this.sessions.set(ws, meta);
      }
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') return this.handleInit(request);
    if (url.pathname === '/info') return this.handleInfo();
    if (url.pathname === '/ws') return this.handleWsUpgrade(request, url);
    return jsonResponse({ error: 'not-found' }, 404);
  }

  /* Idempotent: an already-initialised room's token hashes can never be
     silently rotated by a repeat /init call (e.g. a retried request). */
  async handleInit(request) {
    if (this.room) return jsonResponse({ error: 'already-initialized' }, 409);
    const body = await request.json();
    const name = boundedString(body.name, MAX_NAME_LENGTH, 'Living Art Room') || 'Living Art Room';
    const viewTokenHash = await sha256Hex(body.viewToken);
    const controlTokenHash = await sha256Hex(body.controlToken);
    const now = Date.now();
    this.room = {
      roomId: body.roomId,
      name: name,
      revision: 0,
      updatedAt: now,
      createdAt: now,
      controllerId: null,
      config: Object.assign({}, DEFAULT_CONFIG),
      liveEpoch: now,
      viewTokenHash: viewTokenHash,
      controlTokenHash: controlTokenHash
    };
    await this.state.storage.put('room', this.room);
    return jsonResponse({ ok: true });
  }

  handleInfo() {
    if (!this.room) return jsonResponse({ exists: false });
    return jsonResponse({
      exists: true,
      roomId: this.room.roomId,
      name: this.room.name,
      revision: this.room.revision,
      updatedAt: this.room.updatedAt,
      connected: this.sessions.size
    });
  }

  async handleWsUpgrade(request, url) {
    if (!this.room) return jsonResponse({ error: 'room-not-found' }, 404);

    if (!isAllowedOrigin(request.headers.get('Origin'), this.env.ALLOWED_ORIGIN)) {
      return jsonResponse({ error: 'origin-not-allowed' }, 403);
    }

    const token = url.searchParams.get('token') || '';
    const tokenHash = await sha256Hex(token);
    let role = null;
    if (tokenHash === this.room.controlTokenHash) role = 'controller';
    else if (tokenHash === this.room.viewTokenHash) role = 'player';
    if (!role) return jsonResponse({ error: 'invalid-token' }, 403);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    const meta = {
      role: role,
      panel: clampInt(url.searchParams.get('panel'), 0, 9, 0),
      layout: ENUMS.layout.indexOf(Number(url.searchParams.get('layout'))) !== -1 ? Number(url.searchParams.get('layout')) : null,
      playerId: boundedString(url.searchParams.get('playerId'), MAX_META_LENGTH, null),
      clientId: boundedString(url.searchParams.get('clientId'), MAX_META_LENGTH, null),
      ua: boundedString(url.searchParams.get('ua'), MAX_UA_LENGTH, null),
      lastAudioAt: 0,
      connectedAt: Date.now(),
      lastSeen: Date.now()
    };
    server.serializeAttachment(meta);
    this.state.acceptWebSocket(server);
    this.sessions.set(server, meta);

    this.sendJson(server, {
      type: 'hello',
      roomId: this.room.roomId,
      name: this.room.name,
      revision: this.room.revision,
      config: this.room.config,
      liveEpoch: this.room.liveEpoch,
      updatedAt: this.room.updatedAt,
      serverTime: Date.now(),
      role: role
    });
    this.broadcastPresence();

    return new Response(null, { status: 101, webSocket: client });
  }

  sendJson(ws, data) {
    try { ws.send(JSON.stringify(data)); } catch (e) { /* connection already gone - webSocketClose will clean it up */ }
  }

  broadcast(data, excludeWs) {
    const text = JSON.stringify(data);
    for (const ws of this.sessions.keys()) {
      if (ws === excludeWs) continue;
      try { ws.send(text); } catch (e) { /* ignore - dead sockets are cleaned up via webSocketClose */ }
    }
  }

  /* Presence is role-aware (spec section 13): the controller gets full
     installation-health detail (panel/playerId/connectedAt/lastSeen/ua
     for every connection); a player only learns whether the room's
     controller is connected and how many players are present in total -
     never other players' individual metadata. */
  broadcastPresence() {
    let controllerConnected = false;
    let playerCount = 0;
    const detail = [];
    for (const [ws, meta] of this.sessions) {
      if (meta.role === 'controller') controllerConnected = true;
      if (meta.role === 'player') playerCount++;
      const lastSeen = Math.max(meta.lastSeen || 0, autoResponseMs(this.state, ws));
      detail.push({ role: meta.role, panel: meta.panel, playerId: meta.playerId, connectedAt: meta.connectedAt, lastSeen: lastSeen, ua: meta.ua });
    }
    for (const [ws, meta] of this.sessions) {
      if (meta.role === 'controller') {
        this.sendJson(ws, { type: 'presence', clients: detail, controllerConnected: controllerConnected, serverTime: Date.now() });
      } else {
        this.sendJson(ws, { type: 'presence', playerCount: playerCount, controllerConnected: controllerConnected, serverTime: Date.now() });
      }
    }
  }

  async webSocketMessage(ws, raw) {
    const byteLength = typeof raw === 'string' ? raw.length : raw.byteLength;
    if (byteLength > MAX_MESSAGE_BYTES) {
      this.sendJson(ws, { type: 'error', code: 'message-too-large', message: 'Message exceeds the size limit' });
      return;
    }

    let meta = this.sessions.get(ws);
    if (!meta) { meta = safeDeserialize(ws); if (meta) this.sessions.set(ws, meta); else return; }
    meta.lastSeen = Date.now();

    let msg;
    try { msg = JSON.parse(raw); } catch (e) {
      this.sendJson(ws, { type: 'error', code: 'bad-json', message: 'Message was not valid JSON' });
      return;
    }
    if (!msg || typeof msg.type !== 'string') {
      this.sendJson(ws, { type: 'error', code: 'bad-message', message: 'Missing message type' });
      return;
    }

    if (msg.type === 'hello') {
      if (typeof msg.playerId === 'string') meta.playerId = msg.playerId.slice(0, MAX_META_LENGTH);
      if (typeof msg.panel === 'number') meta.panel = clampInt(msg.panel, 0, 9, meta.panel);
      if (ENUMS.layout.indexOf(msg.layout) !== -1) meta.layout = msg.layout;
      if (typeof msg.ua === 'string') meta.ua = msg.ua.slice(0, MAX_UA_LENGTH);
      if (typeof msg.clientId === 'string') meta.clientId = msg.clientId.slice(0, MAX_META_LENGTH);
      ws.serializeAttachment(meta);
      this.broadcastPresence();
      return;
    }

    if (msg.type === 'status-request') {
      this.broadcastPresence();
      return;
    }

    if (msg.type === 'patch') {
      if (meta.role !== 'controller') {
        this.sendJson(ws, { type: 'error', code: 'forbidden', message: 'Only the controller can change room state' });
        return;
      }
      await this.applyPatch(msg, meta, ws);
      return;
    }

    if (msg.type === 'audio') {
      if (meta.role !== 'controller') return; // players never source audio telemetry
      const now = Date.now();
      if (now - meta.lastAudioAt < 40) return; // defensive throttle floor (~25/s) even if a client misbehaves
      meta.lastAudioAt = now;
      this.broadcast({
        type: 'audio', t: now,
        bass: clamp01(msg.bass), mid: clamp01(msg.mid), treble: clamp01(msg.treble),
        energy: clamp01(msg.energy), kick: clamp01(msg.kick), transient: clamp01(msg.transient)
      }, ws);
      return;
    }

    this.sendJson(ws, { type: 'error', code: 'unknown-type', message: 'Unknown message type: ' + msg.type });
  }

  /* Optimistic-concurrency patch: the controller must name the revision
     its change was based on. If the room has already moved on, the patch
     is rejected outright (never applied, never merged) and the caller
     gets the room's actual current state back to resync from - a client's
     own possibly-stale view can never silently overwrite a newer one. */
  async applyPatch(msg, meta, ws) {
    if (typeof msg.baseRevision !== 'number') {
      this.sendJson(ws, { type: 'error', code: 'missing-base-revision', message: 'patch requires baseRevision' });
      return;
    }
    if (msg.baseRevision !== this.room.revision) {
      this.sendJson(ws, {
        type: 'state', revision: this.room.revision, config: this.room.config,
        updatedAt: this.room.updatedAt, liveEpoch: this.room.liveEpoch, conflict: true,
        serverTime: Date.now()
      });
      return;
    }

    const clean = sanitizeChanges(msg.changes, this.room.config);
    if (!Object.keys(clean).length) return;

    Object.assign(this.room.config, clean);
    this.room.revision += 1;
    this.room.updatedAt = Date.now();
    this.room.controllerId = meta.clientId || meta.playerId || 'controller';
    if (msg.resetPhase) this.room.liveEpoch = Date.now();

    await this.state.storage.put('room', this.room);

    this.broadcast({
      type: 'patch',
      revision: this.room.revision,
      changes: clean,
      updatedAt: this.room.updatedAt,
      liveEpoch: this.room.liveEpoch,
      originClientId: meta.clientId || null,
      serverTime: Date.now()
    });
  }

  webSocketClose(ws, code, reason, wasClean) {
    try { ws.close(code, reason); } catch (e) {}
    this.sessions.delete(ws);
    this.broadcastPresence();
  }

  webSocketError(ws) {
    this.sessions.delete(ws);
    this.broadcastPresence();
  }
}

function safeDeserialize(ws) {
  try { return ws.deserializeAttachment(); } catch (e) { return null; }
}
function autoResponseMs(state, ws) {
  try { const d = state.getWebSocketAutoResponseTimestamp(ws); return d ? d.getTime() : 0; } catch (e) { return 0; }
}
function isAllowedOrigin(origin, allowedOriginConfig) {
  const allowed = String(allowedOriginConfig || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (allowed.indexOf('*') !== -1) return true; // explicit opt-in only (local dev) - never the production default
  return !!origin && allowed.indexOf(origin) !== -1;
}
