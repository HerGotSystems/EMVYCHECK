/* EMVY CHECK Living Art — LivingArtRoom Durable Object.
   One instance per room (addressed by env.ROOMS.idFromName(roomId)).
   Owns the room's persisted config + revision, and every live WebSocket
   connection for that room (controller + panel/wall players). See
   PROTOCOL.md for the message shapes this speaks.

   Security: a connecting client presents a bearer token in the /ws query
   string. Its ROLE is derived from which stored token hash it matches -
   a client cannot grant itself the controller role just by claiming
   ?role=controller. Tokens are stored hashed (SHA-256), never in plain
   text, mirroring the Web Crypto guidance in the spec.

   Uses the classic accept()/addEventListener WebSocket pattern (not the
   hibernation API) - rooms are low-traffic and this keeps behaviour
   simple and predictable. A room's DO instance stays warm for as long as
   it has open connections, which is the expected lifetime of an
   installation being actively controlled. */

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

const PATCHABLE_KEYS = Object.keys(DEFAULT_CONFIG);

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
}

function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

function clamp01(v) { v = Number(v); return Number.isFinite(v) ? Math.max(0, Math.min(1.4, v)) : 0; }

export class LivingArtRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.room = null;
    this.sessions = new Map(); // WebSocket -> metadata, for every currently-open connection
    this.state.blockConcurrencyWhile(async () => {
      this.room = (await this.state.storage.get('room')) || null;
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') return this.handleInit(request);
    if (url.pathname === '/info') return this.handleInfo();
    if (url.pathname === '/ws') return this.handleWsUpgrade(request, url);
    return jsonResponse({ error: 'not-found' }, 404);
  }

  async handleInit(request) {
    const body = await request.json();
    const viewTokenHash = await sha256Hex(body.viewToken);
    const controlTokenHash = await sha256Hex(body.controlToken);
    const now = Date.now();
    this.room = {
      roomId: body.roomId,
      name: body.name,
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
    const token = url.searchParams.get('token') || '';
    const tokenHash = await sha256Hex(token);

    let role = null;
    if (tokenHash === this.room.controlTokenHash) role = 'controller';
    else if (tokenHash === this.room.viewTokenHash) role = 'player';
    if (!role) return jsonResponse({ error: 'invalid-token' }, 403);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const meta = {
      role: role,
      panel: Math.max(0, Number(url.searchParams.get('panel')) || 0),
      layout: Number(url.searchParams.get('layout')) || null,
      playerId: (url.searchParams.get('playerId') || '').slice(0, 40) || null,
      clientId: (url.searchParams.get('clientId') || '').slice(0, 40) || null,
      ua: (url.searchParams.get('ua') || '').slice(0, 120) || null,
      lastAudioAt: 0,
      connectedAt: Date.now(),
      lastSeen: Date.now()
    };
    this.sessions.set(server, meta);

    server.addEventListener('message', (event) => this.onMessage(server, event.data));
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));

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
    try { ws.send(JSON.stringify(data)); } catch (e) { /* connection already gone - close handler will clean it up */ }
  }

  broadcast(data, excludeWs) {
    const text = JSON.stringify(data);
    for (const ws of this.sessions.keys()) {
      if (ws === excludeWs) continue;
      try { ws.send(text); } catch (e) { /* ignore - dead sockets are cleaned up via the close handler */ }
    }
  }

  clientsSnapshot() {
    const clients = [];
    let controllerConnected = false;
    for (const meta of this.sessions.values()) {
      if (meta.role === 'controller') controllerConnected = true;
      clients.push({ role: meta.role, panel: meta.panel, playerId: meta.playerId, connectedAt: meta.connectedAt, lastSeen: meta.lastSeen, ua: meta.ua });
    }
    return { clients: clients, controllerConnected: controllerConnected };
  }

  broadcastPresence() {
    const snap = this.clientsSnapshot();
    this.broadcast({ type: 'presence', clients: snap.clients, controllerConnected: snap.controllerConnected, serverTime: Date.now() });
  }

  async onMessage(ws, raw) {
    const meta = this.sessions.get(ws);
    if (!meta) return;
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

    if (msg.type === 'ping') {
      this.sendJson(ws, { type: 'pong', t: msg.t, serverTime: Date.now() });
      return;
    }

    if (msg.type === 'hello') {
      if (typeof msg.playerId === 'string') meta.playerId = msg.playerId.slice(0, 40);
      if (typeof msg.panel === 'number') meta.panel = msg.panel;
      if (typeof msg.layout === 'number') meta.layout = msg.layout;
      if (typeof msg.ua === 'string') meta.ua = msg.ua.slice(0, 120);
      if (typeof msg.clientId === 'string') meta.clientId = msg.clientId.slice(0, 40);
      this.broadcastPresence();
      return;
    }

    if (msg.type === 'status-request') {
      const snap = this.clientsSnapshot();
      this.sendJson(ws, { type: 'presence', clients: snap.clients, controllerConnected: snap.controllerConnected, serverTime: Date.now() });
      return;
    }

    if (msg.type === 'patch') {
      if (meta.role !== 'controller') {
        this.sendJson(ws, { type: 'error', code: 'forbidden', message: 'Only the controller can change room state' });
        return;
      }
      await this.applyPatch(msg, meta);
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

  async applyPatch(msg, meta) {
    const changes = (msg.changes && typeof msg.changes === 'object') ? msg.changes : {};
    const clean = {};
    for (const key of Object.keys(changes)) {
      if (PATCHABLE_KEYS.indexOf(key) !== -1) clean[key] = changes[key];
    }
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
      originClientId: meta.clientId || null
    });
  }

  onClose(ws) {
    this.sessions.delete(ws);
    this.broadcastPresence();
  }
}
