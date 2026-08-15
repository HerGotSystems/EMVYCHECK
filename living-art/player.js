/* EMVY CHECK Living Art V2 — installation player: URL generation, the
   hidden control gesture, and recovery from reload/network/sleep/resize/
   fullscreen so a display can be left running unattended for a long time. */
(function (global) {
  'use strict';

  function fileLabel(index, cols) {
    const row = Math.floor((index - 1) / cols), col = (index - 1) % cols;
    return 'R' + (row + 1) + '-C' + (col + 1);
  }

  function buildUrl(state, kind, panelIndex) {
    const params = LivingArtState.toParams(state, { player: kind });
    if (kind === 'panel') params.set('panel', panelIndex);
    const url = new URL(location.href);
    url.search = params.toString();
    url.hash = '';
    return url.toString();
  }

  function buildPanelUrls(state) {
    const cols = state.layout === 1 ? 1 : state.layout === 4 ? 2 : 3;
    const out = [];
    for (let i = 1; i <= state.layout; i++) out.push({ index: i, label: fileLabel(i, cols), url: buildUrl(state, 'panel', i) });
    return out;
  }

  /* Room-aware player URLs: compact, room-driven (?player=panel&room=..&
     token=..&panel=N&layout=L) rather than the full local-param dump -
     the panel gets its real configuration from the room over WebSocket,
     the URL only needs enough to connect and render something sane before
     that first message arrives. */
  function buildRoomUrl(room, kind, panelIndex) {
    const params = new URLSearchParams({ player: kind, room: room.roomId, token: room.viewToken, layout: room.layout });
    if (kind === 'panel') params.set('panel', panelIndex);
    const url = new URL(location.href);
    url.search = params.toString();
    url.hash = '';
    return url.toString();
  }
  function buildRoomPanelUrls(room) {
    const cols = room.layout === 1 ? 1 : room.layout === 4 ? 2 : 3;
    const out = [];
    for (let i = 1; i <= room.layout; i++) out.push({ index: i, label: fileLabel(i, cols), url: buildRoomUrl(room, 'panel', i) });
    return out;
  }
  function buildRoomControllerUrl(room) {
    const params = new URLSearchParams({ room: room.roomId, ctrl: room.controlToken });
    const url = new URL(location.href);
    url.search = params.toString();
    url.hash = '';
    return url.toString();
  }

  /* Hidden control reveal: five taps/clicks inside a small corner hotzone
     within 3 seconds, or the backtick key on a physical keyboard. Nothing
     is visible in player mode until this fires. */
  function installHiddenGesture(onReveal) {
    let taps = [];
    document.addEventListener('pointerdown', function (ev) {
      const zone = 64;
      const inCorner = ev.clientX < zone && ev.clientY < zone;
      if (!inCorner) return;
      const now = Date.now();
      taps = taps.filter(function (t) { return now - t < 3000; });
      taps.push(now);
      if (taps.length >= 5) { taps = []; onReveal(); }
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === '`' || ev.key === '~') onReveal();
    });
  }

  /* Wires the recovery events the spec calls out. Callbacks are cheap and
     debounced where the browser can fire them in bursts (resize). */
  function installRecovery(handlers) {
    handlers = handlers || {};
    let resizeTimer = 0;
    global.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { if (handlers.onResize) handlers.onResize(); }, 140);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && handlers.onWake) handlers.onWake();
    });
    document.addEventListener('fullscreenchange', function () { if (handlers.onFullscreenChange) handlers.onFullscreenChange(!!document.fullscreenElement); });
    global.addEventListener('online', function () { if (handlers.onOnline) handlers.onOnline(); });
    global.addEventListener('offline', function () { if (handlers.onOffline) handlers.onOffline(); });
    global.addEventListener('pageshow', function (ev) { if (ev.persisted && handlers.onWake) handlers.onWake(); });
  }

  function requestFullscreen(el) {
    const target = el || document.documentElement;
    const req = target.requestFullscreen || target.webkitRequestFullscreen;
    if (req) return req.call(target).catch(function (err) { console.warn('[Living Art] fullscreen request failed', err); });
    return Promise.resolve();
  }
  function exitFullscreen() {
    if (document.fullscreenElement) return document.exitFullscreen().catch(function () {});
    return Promise.resolve();
  }

  global.LivingArtPlayer = {
    buildUrl: buildUrl,
    buildPanelUrls: buildPanelUrls,
    buildRoomUrl: buildRoomUrl,
    buildRoomPanelUrls: buildRoomPanelUrls,
    buildRoomControllerUrl: buildRoomControllerUrl,
    fileLabel: fileLabel,
    installHiddenGesture: installHiddenGesture,
    installRecovery: installRecovery,
    requestFullscreen: requestFullscreen,
    exitFullscreen: exitFullscreen
  };
})(window);
