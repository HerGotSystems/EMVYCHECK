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

  // ---- C. cloud adapter (stub, intentionally not implemented) ---------------
  function NullCloudSyncAdapter() {}
  NullCloudSyncAdapter.prototype.isConnected = function () { return false; };
  NullCloudSyncAdapter.prototype.connect = function (roomId) {
    console.info('[Living Art] Cloud sync requested for room "' + roomId + '" - no cloud controller exists yet. This is a reserved interface for a future Cloudflare Worker/Durable Object/WebSocket backend.');
    return Promise.resolve({ connected: false, reason: 'not-implemented' });
  };
  NullCloudSyncAdapter.prototype.pushState = function (/* {roomId, revision, updatedAt, config} */) {
    return Promise.resolve({ ok: false, reason: 'not-implemented' });
  };
  NullCloudSyncAdapter.prototype.onRemoteUpdate = function (/* callback */) { /* never fires - no transport exists */ };
  NullCloudSyncAdapter.prototype.disconnect = function () {};

  global.LivingArtSync = {
    scheduleToken: scheduleToken,
    scheduledSeed: scheduledSeed,
    LiveChannel: LiveChannel,
    CloudSyncAdapter: NullCloudSyncAdapter
  };
})(window);
