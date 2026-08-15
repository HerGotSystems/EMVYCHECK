/* EMVY CHECK Living Art V2 — synchronisation.

   Three distinct, honestly-scoped layers (spec section 6):

   A. Deterministic offline sync
      Every panel computes the same scheduled seed/palette/family purely
      from UTC time + an installation seed. No network round trip needed,
      so a wall of independent panel players stays coordinated as long as
      their clocks agree - which is true of virtually all display hardware.

   B. BroadcastChannel / localStorage same-device sync
      If several player windows or tabs are open in the same browser on the
      same computer (e.g. testing a wall on one machine, or a signage box
      driving several outputs from one Chrome instance), controller changes
      apply to them instantly. This does NOT reach other physical devices.

   C. Cloud adapter interface (NOT implemented)
      A clean seam for a future Cloudflare Worker/Durable Object/WebSocket
      controller to plug into. Calling any method resolves to "not
      connected" - nothing in the UI may claim remote multi-device control
      is live unless CloudSyncAdapter.isConnected() is genuinely true. */
(function (global) {
  'use strict';

  // ---- A. deterministic offline schedule token -----------------------------
  function scheduleToken(interval, now) {
    now = now || new Date();
    const iso = now.toISOString();
    switch (interval) {
      case 'minute': return iso.slice(0, 16); // YYYY-MM-DDTHH:MM
      case 'hour': return iso.slice(0, 13);   // YYYY-MM-DDTHH
      case 'day': return iso.slice(0, 10);    // YYYY-MM-DD
      case 'week': {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const dayNum = (d.getUTCDay() + 6) % 7; // Monday=0
        d.setUTCDate(d.getUTCDate() - dayNum);
        return d.toISOString().slice(0, 10) + '-W';
      }
      default: return ''; // manual - no scheduled token
    }
  }
  function scheduledSeed(installSeed, interval, now) {
    const token = scheduleToken(interval, now);
    return token ? (installSeed || 'EMVY-0001') + '|' + token : null;
  }

  // ---- B. same-device live sync ---------------------------------------------
  function LiveChannel(name) {
    this.name = name;
    this.listeners = {};
    this.bc = null;
    if ('BroadcastChannel' in global) {
      try { this.bc = new BroadcastChannel(name); } catch (e) { this.bc = null; }
    }
    const self = this;
    if (this.bc) {
      this.bc.onmessage = function (ev) { self._dispatch(ev.data && ev.data.type, ev.data && ev.data.payload); };
    } else {
      // localStorage fallback: writing a key fires 'storage' in *other* tabs
      global.addEventListener('storage', function (ev) {
        if (ev.key !== self.name || !ev.newValue) return;
        try { const msg = JSON.parse(ev.newValue); self._dispatch(msg.type, msg.payload); } catch (e) {}
      });
    }
  }
  LiveChannel.prototype._dispatch = function (type, payload) {
    (this.listeners[type] || []).forEach(function (cb) { try { cb(payload); } catch (e) { console.error(e); } });
  };
  LiveChannel.prototype.on = function (type, cb) { (this.listeners[type] = this.listeners[type] || []).push(cb); return this; };
  LiveChannel.prototype.broadcast = function (type, payload) {
    if (this.bc) { this.bc.postMessage({ type: type, payload: payload }); return; }
    try { localStorage.setItem(this.name, JSON.stringify({ type: type, payload: payload, t: Date.now() })); } catch (e) { /* storage unavailable - same-device sync silently unavailable */ }
  };

  // ---- C. cloud adapter: inert by default, real once connect() is called ---
  // NullCloudSyncAdapter: kept as an explicit, always-inert fallback and for
  // anything that wants to guarantee no network activity is possible.
  function NullCloudSyncAdapter() {}
  NullCloudSyncAdapter.prototype.isConnected = function () { return false; };
  NullCloudSyncAdapter.prototype.connect = function (roomId) {
    console.info('[Living Art] Cloud sync requested for room "' + roomId + '" - this adapter is intentionally inert.');
    return Promise.resolve({ connected: false, reason: 'not-implemented' });
  };
  NullCloudSyncAdapter.prototype.disconnect = function () {};
  NullCloudSyncAdapter.prototype.pushState = function () { return Promise.resolve({ ok: false, reason: 'not-implemented' }); };
  NullCloudSyncAdapter.prototype.pushAudio = function () {};
  NullCloudSyncAdapter.prototype.onRemoteUpdate = function () {};
  NullCloudSyncAdapter.prototype.onRemoteAudio = function () {};
  NullCloudSyncAdapter.prototype.onStatusChange = function () {};
  NullCloudSyncAdapter.prototype.onPresence = function () {};

  const CLOUD_URL_STORAGE_KEY = 'emvy-living-art-cloud-url';
  /* The living-art-cloud Worker is deployed (see living-art-cloud/README.md
     and living-art/PRODUCT-STATUS.md "REMOTE CLOUD") - this is the real
     production room backend, not a placeholder. Override it per-browser
     without editing source (e.g. for local dev against `wrangler dev`) via:
       localStorage.setItem('emvy-living-art-cloud-url', 'ws://localhost:8787') */
  const DEFAULT_CLOUD_URL = 'wss://living-art-cloud.veltrusky-michal.workers.dev';

  function resolveCloudUrl() {
    try {
      const stored = localStorage.getItem(CLOUD_URL_STORAGE_KEY);
      if (stored) return stored;
    } catch (e) { /* storage unavailable - fall through to default */ }
    return DEFAULT_CLOUD_URL;
  }
  function wsToHttp(wsUrl) { return wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:'); }

  function uid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  const STATUS = { OFFLINE: 'OFFLINE', CONNECTING: 'CONNECTING', CONNECTED: 'CONNECTED', RECONNECTING: 'RECONNECTING', ERROR: 'ERROR' };
  const BACKOFF_STEPS = [500, 1000, 2000, 4000, 8000, 15000, 30000];

  function RemoteCloudSyncAdapter() {
    this.ws = null;
    this.status = STATUS.OFFLINE;
    this.room = null; // {roomId, token, role, panel, layout, playerId}
    this.revision = -1;
    this.liveEpoch = null;
    this.clientId = uid();
    this.reconnectAttempts = 0;
    this.reconnectTimer = 0;
    this.pingTimer = 0;
    this.lastPongAt = 0;
    this.intentionalClose = true;
    this.statusListeners = [];
    this.updateListeners = [];
    this.audioListeners = [];
    this.presenceListeners = [];
    this.audioThrottleAt = 0;
    // serverTime (ms, room DO's Date.now()) minus this device's Date.now() at
    // the moment each message arrived - refined opportunistically from every
    // hello/patch/state/presence message the room already sends, never from
    // a dedicated polling loop. Lets currentPhase() (app.js) compute the same
    // LIVE/MUSIC animation position on every panel regardless of how far off
    // an individual device's clock is from the room's.
    this.serverClockOffset = 0;
  }

  RemoteCloudSyncAdapter.prototype.isConnected = function () { return this.status === STATUS.CONNECTED; };
  RemoteCloudSyncAdapter.prototype.onStatusChange = function (cb) { this.statusListeners.push(cb); return this; };
  RemoteCloudSyncAdapter.prototype.onRemoteUpdate = function (cb) { this.updateListeners.push(cb); return this; };
  RemoteCloudSyncAdapter.prototype.onRemoteAudio = function (cb) { this.audioListeners.push(cb); return this; };
  RemoteCloudSyncAdapter.prototype.onPresence = function (cb) { this.presenceListeners.push(cb); return this; };

  RemoteCloudSyncAdapter.prototype._setStatus = function (s) {
    if (this.status === s) return;
    this.status = s;
    this.statusListeners.forEach(function (cb) { try { cb(s); } catch (e) { console.error(e); } });
  };

  /* Create a brand new room. Does not connect - call connect() with the
     returned roomId + a token afterwards. */
  RemoteCloudSyncAdapter.prototype.createRoom = function (name) {
    const base = wsToHttp(resolveCloudUrl());
    return fetch(base + '/api/room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    }).then(function (r) {
      if (!r.ok) throw new Error('Could not create room (http ' + r.status + ')');
      return r.json();
    });
  };

  /* room: {roomId, token, role: 'controller'|'player', panel, layout, playerId} */
  RemoteCloudSyncAdapter.prototype.connect = function (room) {
    this.room = room;
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    return this._open();
  };

  /* The bearer token still travels as a WebSocket URL query parameter here.
     That's deliberate, not an oversight (spec section 8): unlike the *page*
     URL (see player.js/app.js, which now keep room/token/ctrl only in the
     URL fragment - never sent to any server, never in browser history,
     never in a Referer header), this is the WebSocket handshake request
     itself. It is same-origin, initiated by script rather than navigation,
     never appears in the address bar or browser history, and browsers do
     not attach a Referer header to a WebSocket upgrade. The realistic
     exposure left is the room's own server access log and this device's
     DevTools Network tab, which is an acceptable, documented trade-off for
     not inventing a bespoke first-message auth handshake (explicitly out of
     scope per spec section 8) on top of the token+Origin checks the room
     already enforces server-side. */
  RemoteCloudSyncAdapter.prototype._open = function () {
    const self = this;
    this._setStatus(this.reconnectAttempts > 0 ? STATUS.RECONNECTING : STATUS.CONNECTING);

    const base = resolveCloudUrl();
    const params = new URLSearchParams({ token: this.room.token, clientId: this.clientId });
    if (this.room.role) params.set('role', this.room.role);
    if (this.room.panel != null) params.set('panel', this.room.panel);
    if (this.room.layout != null) params.set('layout', this.room.layout);
    if (this.room.playerId) params.set('playerId', this.room.playerId);
    try { params.set('ua', (navigator.userAgent || '').slice(0, 120)); } catch (e) {}

    let ws;
    try {
      ws = new WebSocket(base + '/api/room/' + encodeURIComponent(this.room.roomId) + '/ws?' + params.toString());
    } catch (err) {
      this._setStatus(STATUS.ERROR);
      this._scheduleReconnect();
      return Promise.resolve({ connected: false, reason: String(err) });
    }
    this.ws = ws;

    return new Promise(function (resolve) {
      let settled = false;
      const timeout = setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve({ connected: false, reason: 'timeout' });
      }, 6000);

      ws.onopen = function () { /* wait for the server's own hello before declaring CONNECTED */ };

      ws.onmessage = function (ev) {
        if (ev.data === 'pong') { self.lastPongAt = Date.now(); return; } // raw hibernation-safe keepalive reply, not JSON
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        self._handleMessage(msg);
        if (msg.type === 'hello' && !settled) {
          settled = true;
          clearTimeout(timeout);
          resolve({ connected: true, revision: msg.revision });
        }
      };

      ws.onclose = function () {
        clearTimeout(timeout);
        self._stopPing();
        if (self.ws === ws) self.ws = null;
        if (self.intentionalClose) { self._setStatus(STATUS.OFFLINE); return; }
        self._setStatus(STATUS.RECONNECTING);
        self._scheduleReconnect();
        if (!settled) { settled = true; resolve({ connected: false, reason: 'closed' }); }
      };

      ws.onerror = function () {
        if (!settled) { settled = true; clearTimeout(timeout); resolve({ connected: false, reason: 'error' }); }
      };
    });
  };

  RemoteCloudSyncAdapter.prototype._scheduleReconnect = function () {
    const self = this;
    clearTimeout(this.reconnectTimer);
    const step = Math.min(this.reconnectAttempts, BACKOFF_STEPS.length - 1);
    const delay = BACKOFF_STEPS[step] + Math.floor(Math.random() * 300); // jitter
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(function () {
      if (self.intentionalClose || !self.room) return;
      self._open();
    }, delay);
  };

  RemoteCloudSyncAdapter.prototype._handleMessage = function (msg) {
    if (!msg || typeof msg.type !== 'string') return;
    if (typeof msg.serverTime === 'number') this.serverClockOffset = msg.serverTime - Date.now();

    if (msg.type === 'hello') {
      this.reconnectAttempts = 0;
      this.revision = msg.revision;
      this.liveEpoch = msg.liveEpoch;
      this._setStatus(STATUS.CONNECTED);
      this._startPing();
      // Adopt the server's current state outright - a client's own possibly
      // stale local config is never pushed back over a fresher server state.
      this._emitUpdate({ revision: msg.revision, config: msg.config, liveEpoch: msg.liveEpoch, updatedAt: msg.updatedAt, full: true });
      return;
    }
    if (msg.type === 'patch') {
      if (typeof msg.revision === 'number' && msg.revision <= this.revision) return; // stale/duplicate, ignore
      this.revision = msg.revision;
      this.liveEpoch = msg.liveEpoch;
      this._emitUpdate({ revision: msg.revision, changes: msg.changes, liveEpoch: msg.liveEpoch, updatedAt: msg.updatedAt, originClientId: msg.originClientId, full: false });
      return;
    }
    if (msg.type === 'state' && msg.conflict) {
      // Our own patch was rejected as stale (baseRevision behind the room's
      // true revision) - adopt the authoritative state exactly like a full
      // remote update, so the UI reflects reality and the next local change
      // is built on the correct baseRevision instead of retrying blind.
      this.revision = msg.revision;
      this.liveEpoch = msg.liveEpoch;
      this._emitUpdate({ revision: msg.revision, config: msg.config, liveEpoch: msg.liveEpoch, updatedAt: msg.updatedAt, full: true, conflict: true });
      return;
    }
    if (msg.type === 'audio') {
      this.audioListeners.forEach(function (cb) { try { cb(msg); } catch (e) { console.error(e); } });
      return;
    }
    if (msg.type === 'presence') {
      this.presenceListeners.forEach(function (cb) { try { cb(msg); } catch (e) { console.error(e); } });
      return;
    }
    if (msg.type === 'error') {
      console.warn('[Living Art] room error:', msg.code, msg.message);
      return;
    }
  };

  RemoteCloudSyncAdapter.prototype._emitUpdate = function (payload) {
    this.updateListeners.forEach(function (cb) { try { cb(payload); } catch (e) { console.error(e); } });
  };

  /* Raw string "ping", not a JSON message: the room DO answers it via
     state.setWebSocketAutoResponse (see room.js), which the runtime handles
     without ever waking a hibernated Durable Object. This still gives the
     client the liveness check a plain WebSocket doesn't reliably provide on
     its own - some dead connections (device sleep, a vanished network) never
     fire onclose/onerror - by force-closing (and thus triggering the normal
     reconnect/backoff path below) if too many intervals pass with no pong. */
  RemoteCloudSyncAdapter.prototype._startPing = function () {
    const self = this;
    this._stopPing();
    this.lastPongAt = Date.now();
    this.pingTimer = setInterval(function () {
      if (!self.ws || self.ws.readyState !== 1) return;
      try { self.ws.send('ping'); } catch (e) {}
      if (Date.now() - self.lastPongAt > 55000) { try { self.ws.close(); } catch (e) {} }
    }, 20000);
  };
  RemoteCloudSyncAdapter.prototype._stopPing = function () { clearInterval(this.pingTimer); };

  /* changes: partial config object. resetPhase: true bumps the room's
     shared liveEpoch (a "new artwork" style change), false leaves LIVE
     motion timing alone (e.g. a density/speed tweak).

     Always names the revision this change was based on (optimistic
     concurrency - spec section 2). If another controller got there first,
     the room rejects this outright rather than merging, and replies with a
     'state' message carrying conflict:true, which _handleMessage adopts as
     the new authoritative state; this call never silently overwrites a
     newer server state. */
  RemoteCloudSyncAdapter.prototype.pushState = function (changes, resetPhase) {
    if (!this.isConnected()) return Promise.resolve({ ok: false, reason: 'not-connected' });
    try {
      this.ws.send(JSON.stringify({ type: 'patch', baseRevision: this.revision, changes: changes, resetPhase: !!resetPhase }));
      return Promise.resolve({ ok: true });
    } catch (err) {
      return Promise.resolve({ ok: false, reason: String(err) });
    }
  };

  /* Throttled to ~15/s regardless of how often the caller invokes this -
     the server also enforces its own floor as a backstop. */
  RemoteCloudSyncAdapter.prototype.pushAudio = function (a) {
    if (!this.isConnected()) return;
    const now = Date.now();
    if (now - this.audioThrottleAt < 66) return;
    this.audioThrottleAt = now;
    try {
      this.ws.send(JSON.stringify({ type: 'audio', bass: a.bass, mid: a.mid, treble: a.treble, energy: a.energy, kick: a.kick, transient: a.transient }));
    } catch (e) { /* connection hiccup - next frame will try again */ }
  };

  RemoteCloudSyncAdapter.prototype.disconnect = function () {
    this.intentionalClose = true;
    this.room = null;
    clearTimeout(this.reconnectTimer);
    this._stopPing();
    if (this.ws) { try { this.ws.close(); } catch (e) {} this.ws = null; }
    this._setStatus(STATUS.OFFLINE);
  };

  global.LivingArtSync = {
    scheduleToken: scheduleToken,
    scheduledSeed: scheduledSeed,
    LiveChannel: LiveChannel,
    STATUS: STATUS,
    CloudSyncAdapter: RemoteCloudSyncAdapter,
    NullCloudSyncAdapter: NullCloudSyncAdapter,
    resolveCloudUrl: resolveCloudUrl,
    CLOUD_URL_STORAGE_KEY: CLOUD_URL_STORAGE_KEY
  };
})(window);
