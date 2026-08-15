/* EMVY CHECK Living Art V2 — app bootstrap: state, render loop, UI wiring. */
(function () {
  'use strict';

  const engine = window.LivingArtEngine;
  const StateMod = window.LivingArtState;
  const Sync = window.LivingArtSync;
  const Library = window.LivingArtLibrary;
  const ArtCode = window.LivingArtArtCode;
  const CanvasGrid = window.LivingArtCanvasGrid;
  const Player = window.LivingArtPlayer;
  const Presentation = window.LivingArtPresentation;

  const $ = function (s) { return document.querySelector(s); };
  const $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  // ---------------------------------------------------------------- state --
  const loaded = StateMod.load();
  let state = loaded.state;
  const isPlayer = loaded.isPlayer;
  const playerKind = loaded.playerKind; // 'wall' | 'panel' | null
  const panelNumber = loaded.panel;

  if (isPlayer) {
    document.body.classList.add('player');
    if (playerKind === 'panel') document.body.classList.add('panel');
  }

  const audio = new window.LivingArtAudio();
  const cloudAdapter = new Sync.CloudSyncAdapter(); // inert until connect() is actually called - see sync.js
  const liveChannel = new Sync.LiveChannel('emvy-living-art-sync-v2');
  const ROOM_STORAGE_KEY = 'emvy-living-art-room-v3';

  let remoteAudio = null;       // last {bass,mid,treble,energy,kick,transient} received over the room, or null
  let remoteAudioAt = 0;
  let remoteConfigApplying = false;

  function readRoomStorage() {
    try { const raw = localStorage.getItem(ROOM_STORAGE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeRoomStorage(room) {
    try {
      if (room) localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(room));
      else localStorage.removeItem(ROOM_STORAGE_KEY);
    } catch (e) { /* storage unavailable - room control still works for this session */ }
  }
  function playerSessionId() {
    try {
      let id = sessionStorage.getItem('emvy-living-art-player-id');
      if (!id) { id = 'p' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('emvy-living-art-player-id', id); }
      return id;
    } catch (e) { return 'p' + Math.random().toString(36).slice(2, 10); }
  }

  let roomRole = null;   // null | 'controller' | 'player'
  let roomInfo = null;   // {roomId, name, viewToken?, controlToken?}
  let latestPresence = null;

  function connectToRoom(room, role) {
    roomRole = role;
    roomInfo = room;
    const payload = {
      roomId: room.roomId,
      token: role === 'controller' ? room.controlToken : room.viewToken,
      role: role
    };
    if (role === 'player') {
      payload.panel = playerKind === 'panel' ? panelNumber : 0;
      payload.layout = state.layout;
      payload.playerId = playerSessionId();
    }
    if (role === 'controller') writeRoomStorage(room);
    return cloudAdapter.connect(payload);
  }

  cloudAdapter.onRemoteUpdate(function (payload) {
    if (payload.originClientId && payload.originClientId === cloudAdapter.clientId) return; // our own echoed patch
    remoteConfigApplying = true;
    try {
      if (payload.full) applyPatch(StateMod.sanitize(payload.config), { fromRemote: true, resetPhase: true });
      else applyPatch(payload.changes || {}, { fromRemote: true, resetPhase: false });
    } finally { remoteConfigApplying = false; }
  });
  cloudAdapter.onRemoteAudio(function (msg) {
    remoteAudio = { bass: msg.bass, mid: msg.mid, treble: msg.treble, energy: msg.energy, kick: msg.kick, transient: msg.transient, smoothedEnergy: msg.energy };
    remoteAudioAt = Date.now();
  });
  cloudAdapter.onPresence(function (msg) { latestPresence = msg; renderStatusList(); });
  cloudAdapter.onStatusChange(function () { updateRemoteStatusUI(); });

  let paused = false;
  let presenting = false;
  let phase = 0;
  let lastFrameAt = 0;
  let rafHandle = 0;
  let loopRunning = false;
  let lastScheduleToken = '';
  let favouritesCache = [];

  function persist() { StateMod.save(state, isPlayer); }

  // ---------------------------------------------------------------- DOM ----
  const grid = $('#grid'), gridWrap = $('#gridWrap');
  const toastEl = $('#toast');
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.classList.remove('on'); }, 1500);
  }

  // -------------------------------------------------------- geometry/grid --
  function layoutDims(layout) { return layout === 1 ? [1, 1] : layout === 4 ? [2, 2] : [3, 3]; }

  let tiles = []; // [{el, canvas, ctx, lastW, lastH}]
  function rebuildGrid() {
    const isPanelPlayer = playerKind === 'panel';
    const count = isPanelPlayer ? 1 : state.layout;
    const [cols, rows] = isPanelPlayer ? [1, 1] : layoutDims(state.layout);
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'repeat(' + cols + ',1fr)';
    grid.style.gridTemplateRows = 'repeat(' + rows + ',1fr)';
    tiles = [];
    for (let i = 0; i < count; i++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      const canvas = document.createElement('canvas');
      tile.appendChild(canvas);
      grid.appendChild(tile);
      tiles.push({ el: tile, canvas: canvas, ctx: canvas.getContext('2d'), lastW: 0, lastH: 0 });
    }
    gridWrap.classList.toggle('epaper', !!state.epaper);
    applyAspect();
    syncUI();
    scheduleRender(true);
  }

  function applyAspect() {
    if (playerKind === 'panel') { gridWrap.style.aspectRatio = 'auto'; return; }
    const ratio = state.aspect === 'wide' ? 16 / 9 : state.aspect === 'classic' ? 4 / 3 : 1;
    gridWrap.style.aspectRatio = String(ratio);
  }

  // ------------------------------------------------------------- quality ---
  function currentQuality() { return engine.resolveQuality(state.quality); }

  // ----------------------------------------------------- recipe resolution -
  function baseRecipe() {
    if (state.sourceType === 'canvasgrid' && state.canvasGridId && cgActiveDef) {
      return CanvasGrid.previewRecipe(cgActiveDef, engine);
    }
    return { seed: state.seed, family: state.family, palette: state.palette };
  }

  function panelRecipe(index, count) {
    const base = baseRecipe();
    if (state.composition === 'independent') {
      const entry = state.independent[index];
      if (entry && entry.seed) return { seed: entry.seed, family: entry.family || 0, palette: entry.palette || 0 };
      return { seed: base.seed + '|IND' + index, family: (base.family + index) % engine.FAMILIES.length, palette: (base.palette + index) % engine.PALETTES.length };
    }
    if (state.composition === 'family') {
      return { seed: base.seed + '|P' + index, family: base.family, palette: base.palette };
    }
    return base; // continuous - all panels share one recipe, resolved as a crop
  }

  function ensureIndependentDefaults() {
    if (state.composition !== 'independent') return;
    const count = state.layout;
    while (state.independent.length < count) {
      const i = state.independent.length;
      const base = baseRecipe();
      state.independent.push({ seed: base.seed + '|IND' + i, family: (base.family + i) % engine.FAMILIES.length, palette: (base.palette + i) % engine.PALETTES.length });
    }
  }

  // --------------------------------------------------------- audio state --
  const LIVE_AMBIENT_AUDIO = { bass: 0.22, mid: 0.22, treble: 0.16, energy: 0.28, kick: 0, transient: 0, smoothedEnergy: 0.24 };
  function audioForFrame(dtSeconds) {
    // A room player showing MUSIC mode has no real audio of its own - it
    // visualises whatever the controller is broadcasting. Falls back to
    // the calm LIVE pattern if telemetry goes quiet, never freezes.
    if (state.displayMode === 'music' && isPlayer && cloudAdapter.isConnected()) {
      if (remoteAudio && Date.now() - remoteAudioAt < 1500) return remoteAudio;
      return LIVE_AMBIENT_AUDIO;
    }
    if (state.displayMode === 'music') {
      const a = audio.tick(dtSeconds);
      // Let a phone/computer playing EMVY music make a whole remote wall
      // react together - never the raw audio itself, just these numbers,
      // and only when this window is actually the controller.
      if (roomRole === 'controller' && cloudAdapter.isConnected()) cloudAdapter.pushAudio(a);
      return a;
    }
    if (state.displayMode === 'live') return LIVE_AMBIENT_AUDIO;
    return engine.NEUTRAL_AUDIO;
  }

  // ------------------------------------------------------------ rendering -
  function drawFrame() {
    const quality = currentQuality();
    const a = audioForFrame(loopRunning ? 0.05 : 0);
    const framePhase = currentPhase();
    ensureIndependentDefaults();
    const isPanelPlayer = playerKind === 'panel';
    const count = tiles.length;
    const [cols, rows] = isPanelPlayer ? [layoutDims(state.layout)[0], layoutDims(state.layout)[1]] : layoutDims(state.layout);

    tiles.forEach(function (tile, i) {
      const rect = tile.el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
      let w, h;
      if (isPanelPlayer) { w = Math.min(1600, window.innerWidth * dpr); h = Math.min(1600, window.innerHeight * dpr); }
      else { w = Math.min(1000, Math.max(200, rect.width * dpr)); h = Math.min(1000, Math.max(200, rect.height * dpr)); }
      w = Math.round(w); h = Math.round(h);
      engine.ensureCanvasSize(tile.canvas, w, h);
      const ctx = tile.ctx;

      const panelIndex = isPanelPlayer ? Math.min(state.layout, panelNumber) - 1 : i;
      if (state.composition === 'continuous') {
        const fullW = w * cols, fullH = h * rows;
        const tileX = (panelIndex % cols) * w, tileY = Math.floor(panelIndex / cols) * h;
        const recipe = Object.assign({ phase: framePhase, density: state.density }, panelRecipe(panelIndex, count));
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
        ctx.translate(-tileX, -tileY);
        engine.renderRecipe(ctx, fullW, fullH, recipe, a, quality);
        ctx.restore();
      } else {
        const recipe = Object.assign({ phase: framePhase, density: state.density }, panelRecipe(panelIndex, count));
        engine.renderRecipe(ctx, w, h, recipe, a, quality);
      }
    });
  }

  /* When connected to a remote room, LIVE/MUSIC motion is derived from the
     room's shared liveEpoch (a server timestamp) instead of a locally
     accumulated counter, so every independently-loaded panel computes the
     same phase at the same wall-clock moment and the wall reads as one
     coordinated artwork rather than nine unrelated ones. Offline/local use
     is completely unchanged - it keeps accumulating `phase` per frame. */
  function currentPhase() {
    if (cloudAdapter.isConnected() && cloudAdapter.liveEpoch != null && (state.displayMode === 'live' || state.displayMode === 'music')) {
      const elapsedSeconds = Math.max(0, (Date.now() - cloudAdapter.liveEpoch) / 1000);
      return elapsedSeconds * state.speed * 0.36;
    }
    return phase;
  }

  function loop(ts) {
    rafHandle = requestAnimationFrame(loop);
    if (paused) return;
    if (state.displayMode === 'paper') { stopLoop(); return; } // PAPER: draw once, then go idle
    const quality = currentQuality();
    if (ts - lastFrameAt < quality.frameMs) return;
    const dt = Math.min(0.25, (ts - (lastFrameAt || ts)) / 1000);
    lastFrameAt = ts;
    phase += state.speed * 0.006 * (1 + (state.displayMode === 'music' ? audio.out.energy * 0.6 : 0));
    drawFrame();
  }

  function startLoop() {
    if (loopRunning) return;
    loopRunning = true;
    lastFrameAt = 0;
    rafHandle = requestAnimationFrame(loop);
  }
  function stopLoop() {
    loopRunning = false;
    cancelAnimationFrame(rafHandle);
  }

  /* Central re-render entry point. PAPER draws exactly once and stays idle
     (near-zero CPU); LIVE/MUSIC ensure the animation loop is running. */
  function scheduleRender(resetPhase) {
    if (resetPhase) phase = 0;
    if (state.displayMode === 'paper') { drawFrame(); stopLoop(); }
    else startLoop();
  }

  // ------------------------------------------------------------- UI sync --
  function setSeg(sel, attr, value) {
    $$(sel + ' [data-' + attr + ']').forEach(function (b) { b.classList.toggle('on', b.dataset[attr] === String(value)); });
  }
  function syncUI() {
    const [cols, rows] = layoutDims(state.layout);
    $('#lblLayout').textContent = cols + ' × ' + rows;
    $('#lblComposition').textContent = state.composition === 'continuous' ? 'One artwork' : state.composition === 'family' ? 'Seed family' : 'Independent collection';
    $('#lblMode').textContent = state.displayMode.charAt(0).toUpperCase() + state.displayMode.slice(1);
    $('#lblAspect').textContent = state.aspect === 'wide' ? '16:9' : state.aspect === 'classic' ? '4:3' : 'Square';
    $('#lblFamily').textContent = engine.FAMILIES[state.family % engine.FAMILIES.length].name;
    $('#lblDensity').textContent = state.density;
    $('#lblSpeed').textContent = state.speed;
    $('#lblQuality').textContent = state.quality.charAt(0).toUpperCase() + state.quality.slice(1);
    $('#lblSensitivity').textContent = state.sensitivity.charAt(0).toUpperCase() + state.sensitivity.slice(1);
    $('#lblSource').textContent = state.sourceType === 'canvasgrid' ? 'Canvas Grid' : 'Generative';
    $('#lblEpaper').textContent = state.epaper ? 'On' : 'Off';
    $('#seedInput').value = state.seed;
    $('#installSeedInput').value = state.installSeed;
    $('#rangeDensity').value = state.density;
    $('#rangeSpeed').value = state.speed;
    $('#rangeVolume').value = Math.round(state.volume * 100);
    $('#selectAutoInterval').value = state.autoArt.interval;
    $('#selectAutoMode').value = state.autoArt.mode;
    setSeg('#segLayout', 'layout', state.layout);
    setSeg('#segComposition', 'composition', state.composition);
    setSeg('#segMode', 'mode', state.displayMode);
    setSeg('#segAspect', 'aspect', state.aspect);
    setSeg('.sidebar', 'sensitivity', state.sensitivity);
    setSeg('.sidebar', 'quality', state.quality);
    setSeg('.sidebar', 'source', state.sourceType);
    $('#canvasGridPicker').hidden = state.sourceType !== 'canvasgrid';
    $('#musicSection').style.opacity = state.displayMode === 'music' ? '1' : '.55';
    $('#playerBar').style.display = (state.musicSource === 'emvy' || state.musicSource === 'local') ? 'grid' : 'none';
    $('#lblMusicTrack').textContent = audio.state.currentTitle || 'not playing';
    $('#btnPlayPause').textContent = audio.state.playing ? '⏸' : '▶';
    $('#btnShuffle').classList.toggle('on', audio.state.shuffle);
    gridWrap.classList.toggle('epaper', !!state.epaper);
  }

  // -------------------------------------------------------- remote status -
  function updateRemoteStatusUI() {
    const section = $('#remoteStatusSection');
    if (!section) return;
    if (!roomInfo) { section.hidden = true; return; }
    section.hidden = false;
    $('#remoteRoomName').textContent = roomInfo.name || roomInfo.roomId;
    const dot = $('#remoteStatusDot'), text = $('#remoteStatusText');
    const status = cloudAdapter.status;
    dot.className = 'status-dot ' + status.toLowerCase();
    const labels = { OFFLINE: 'Offline', CONNECTING: 'Connecting…', CONNECTED: 'Connected', RECONNECTING: 'Reconnecting…', ERROR: 'Connection problem' };
    text.textContent = labels[status] || status;
  }

  function renderRoomDetails() {
    const details = $('#roomDetails');
    if (!details) return;
    if (!roomInfo || roomRole !== 'controller' || !roomInfo.controlToken) { details.hidden = true; return; }
    details.hidden = false;
    $('#roomIdLabel').textContent = roomInfo.roomId;
    const room = { roomId: roomInfo.roomId, viewToken: roomInfo.viewToken, layout: state.layout };
    const controllerUrl = Player.buildRoomControllerUrl({ roomId: roomInfo.roomId, controlToken: roomInfo.controlToken });
    try { window.LivingArtQR.renderToCanvas($('#qrController'), window.LivingArtQR.encode(controllerUrl, 'M'), { scale: 5 }); }
    catch (err) { console.warn('[Living Art] could not render controller QR code', err); }

    const listHolder = $('#roomPanelList');
    listHolder.innerHTML = '';
    Player.buildRoomPanelUrls(room).forEach(function (row) {
      const el = document.createElement('div');
      el.className = 'room-panel-row';
      el.innerHTML = '<span>SCREEN ' + row.index + '</span><button data-copy>COPY</button>';
      el.querySelector('[data-copy]').onclick = function () {
        if (navigator.clipboard) navigator.clipboard.writeText(row.url).then(function () { toast('Screen ' + row.index + ' link copied'); });
      };
      listHolder.appendChild(el);
    });
  }

  function renderStatusList() {
    const holder = $('#statusList');
    if (!holder) return;
    if (!roomInfo) { holder.innerHTML = '<div class="note">Not connected to a remote room.</div>'; return; }
    $('#statusRoomLine').textContent = 'ROOM: ' + (roomInfo.name || roomInfo.roomId) + ' (' + roomInfo.roomId + ')';
    if (!latestPresence) { holder.innerHTML = '<div class="note">Waiting for status…</div>'; return; }
    const expected = state.layout;
    const present = {};
    latestPresence.clients.forEach(function (c) { if (c.role === 'player' && c.panel) present[c.panel] = c; });
    let rows = '';
    for (let i = 1; i <= expected; i++) {
      const c = present[i];
      rows += '<div class="status-row"><span class="' + (c ? 'ok' : 'missing') + '">' + (c ? '✓' : '✕') + '</span>' +
        '<span>Screen ' + i + '</span>' +
        '<span class="meta">' + (c ? 'connected ' + timeAgo(c.connectedAt) : 'not connected') + '</span></div>';
    }
    rows += '<div class="status-row"><span class="' + (latestPresence.controllerConnected ? 'ok' : 'missing') + '">' +
      (latestPresence.controllerConnected ? '✓' : '✕') + '</span><span>Controller</span></div>';
    holder.innerHTML = rows;
  }
  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    return Math.round(s / 3600) + 'h ago';
  }

  // ----------------------------------------------------------- mutations --
  function applyPatch(patch, opts) {
    opts = opts || {};
    Object.assign(state, patch);
    state = StateMod.sanitize(state);
    persist();
    if (patch.layout !== undefined) {
      rebuildGrid(); // rebuilds tiles, then syncs UI and renders itself
    } else {
      applyAspect();
      syncUI();
      scheduleRender(opts.resetPhase !== false);
    }
    if (!opts.silentSync) liveChannel.broadcast('state', state);
    // Push to the room only for genuinely local, controller-originated
    // changes - never for updates that just arrived FROM the room (that
    // would echo straight back and could loop) and never from a player,
    // which the server would reject anyway.
    if (!opts.fromRemote && !remoteConfigApplying && roomRole === 'controller' && cloudAdapter.isConnected()) {
      cloudAdapter.pushState(patch, opts.resetPhase !== false);
    }
  }

  function randomSeed() { return 'EMVY-' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0'); }

  // ---------------------------------------------------- Canvas Grid source -
  let cgActiveDef = null;
  function buildCanvasGridPicker() {
    const holder = $('#canvasGridPicker');
    holder.innerHTML = '<div class="note">Loading catalogue…</div>';
    CanvasGrid.listCatalog().then(function (list) {
      if (!list.length) { holder.innerHTML = '<div class="note">No published Canvas Grid artwork yet.</div>'; return; }
      holder.innerHTML = '';
      list.forEach(function (item) {
        const btn = document.createElement('div');
        btn.className = 'cg-item' + (state.canvasGridId === item.id ? ' on' : '');
        btn.textContent = item.title;
        btn.onclick = function () {
          CanvasGrid.loadArtwork(item.id).then(function (def) {
            cgActiveDef = def;
            applyPatch({ canvasGridId: item.id, layout: CanvasGrid.layoutToCount(def.layout), composition: def.compositionMode });
            toast('Loaded "' + def.title + '"');
          }).catch(function (err) { console.error(err); toast('Could not load that artwork'); });
        };
        holder.appendChild(btn);
      });
    });
  }

  // --------------------------------------------------------- AUTO ART -----
  function refreshFavouritesCache() {
    Library.list().then(function (list) { favouritesCache = list.filter(function (e) { return e.favourite; }); });
  }
  /* Call whenever autoArt becomes active (boot, or the interval is changed)
     so the schedule only fires on the NEXT genuine boundary crossing -
     never immediately just because the feature was just turned on. */
  function armAutoArt() {
    const interval = state.autoArt.interval;
    lastScheduleToken = interval === 'manual' ? '' : Sync.scheduleToken(interval);
  }
  function checkAutoArt() {
    const interval = state.autoArt.interval;
    if (interval === 'manual') { lastScheduleToken = ''; return; }
    const token = Sync.scheduleToken(interval);
    if (token === lastScheduleToken) return;
    lastScheduleToken = token;
    const installSeed = state.installSeed || state.seed;
    const mode = state.autoArt.mode;
    if (mode === 'favourites') {
      if (!favouritesCache.length) { refreshFavouritesCache(); return; }
      const idx = engine.hashString(installSeed + '|' + token) % favouritesCache.length;
      applyPatch(StateMod.sanitize(favouritesCache[idx].state));
      return;
    }
    if (mode === 'same-palette') {
      const palette = engine.hashString(installSeed + '|' + token + '|pal') % engine.PALETTES.length;
      applyPatch({ palette: palette });
      return;
    }
    if (mode === 'same-family') {
      applyPatch({ seed: installSeed + '|' + token });
      return;
    }
    // new-art
    const seed = installSeed + '|' + token;
    applyPatch({ seed: seed, family: engine.hashString(seed) % engine.FAMILIES.length, palette: engine.hashString(seed + '|pal') % engine.PALETTES.length });
  }
  setInterval(checkAutoArt, 1000);

  // ------------------------------------------------------------ library ---
  function renderLibraryList() {
    Library.list().then(function (list) {
      const holder = $('#libraryList');
      holder.innerHTML = '';
      if (!list.length) { holder.innerHTML = '<div class="note">Nothing saved yet.</div>'; return; }
      list.forEach(function (entry) {
        const row = document.createElement('div');
        row.className = 'lib-row';
        row.innerHTML = '<span class="lname"></span>' +
          '<button data-act="load">LOAD</button>' +
          '<button data-act="fav" class="fav' + (entry.favourite ? ' on' : '') + '">★</button>' +
          '<button data-act="rename">RENAME</button>' +
          '<button data-act="delete">DELETE</button>';
        row.querySelector('.lname').textContent = entry.name;
        row.querySelector('[data-act="load"]').onclick = function () { applyPatch(StateMod.sanitize(entry.state)); closeModal('modalLibrary'); toast('Loaded "' + entry.name + '"'); };
        row.querySelector('[data-act="fav"]').onclick = function () { Library.toggleFavourite(entry.id).then(function () { renderLibraryList(); refreshFavouritesCache(); }); };
        row.querySelector('[data-act="rename"]').onclick = function () {
          const name = prompt('Rename artwork', entry.name);
          if (name) Library.rename(entry.id, name).then(renderLibraryList);
        };
        row.querySelector('[data-act="delete"]').onclick = function () {
          if (confirm('Delete "' + entry.name + '"?')) Library.remove(entry.id).then(function () { renderLibraryList(); refreshFavouritesCache(); });
        };
        holder.appendChild(row);
      });
    });
  }

  function openModal(id) { $('#' + id).classList.add('on'); }
  function closeModal(id) { $('#' + id).classList.remove('on'); }
  $$('[data-close]').forEach(function (b) { b.onclick = function () { closeModal(b.dataset.close); }; });

  // ------------------------------------------------------------ controls --
  if (!isPlayer) {
    $('#btnNewArt').onclick = function () { applyPatch({ seed: randomSeed() }); toast('New artwork'); };
    $('#btnPalette').onclick = function () { applyPatch({ palette: (state.palette + 1) % engine.PALETTES.length }); toast('New colour'); };
    $('#btnStyle').onclick = function () { applyPatch({ family: (state.family + 1) % engine.FAMILIES.length }); toast(engine.FAMILIES[state.family].name); };
    $('#btnFamilyPrev').onclick = function () { applyPatch({ family: (state.family - 1 + engine.FAMILIES.length) % engine.FAMILIES.length }); };
    $('#btnFamilyNext').onclick = function () { applyPatch({ family: (state.family + 1) % engine.FAMILIES.length }); };
    $('#btnSeedApply').onclick = function () { applyPatch({ seed: ($('#seedInput').value.trim() || 'EMVY-0001').toUpperCase() }); };
    $('#installSeedInput').onchange = function (e) { applyPatch({ installSeed: e.target.value.trim() }, { resetPhase: false }); };

    $$('#segLayout [data-layout]').forEach(function (b) { b.onclick = function () { applyPatch({ layout: Number(b.dataset.layout) }); }; });
    $$('#segComposition [data-composition]').forEach(function (b) { b.onclick = function () { applyPatch({ composition: b.dataset.composition }); }; });
    $$('#segMode [data-mode]').forEach(function (b) { b.onclick = function () { setDisplayMode(b.dataset.mode); }; });
    $$('#segAspect [data-aspect]').forEach(function (b) { b.onclick = function () { applyPatch({ aspect: b.dataset.aspect }); }; });
    $$('.sidebar [data-quality]').forEach(function (b) { b.onclick = function () { applyPatch({ quality: b.dataset.quality }, { resetPhase: false }); }; });
    $$('.sidebar [data-source]').forEach(function (b) { b.onclick = function () { applyPatch({ sourceType: b.dataset.source }); if (b.dataset.source === 'canvasgrid') buildCanvasGridPicker(); }; });
    $$('.sidebar [data-sensitivity]').forEach(function (b) { b.onclick = function () { audio.setSensitivity(b.dataset.sensitivity); applyPatch({ sensitivity: b.dataset.sensitivity }, { resetPhase: false }); }; });

    $('#rangeDensity').oninput = function (e) { applyPatch({ density: Number(e.target.value) }, { resetPhase: false }); };
    $('#rangeSpeed').oninput = function (e) { state.speed = Number(e.target.value); persist(); syncUI(); };
    $('#btnEpaperToggle').onclick = function () { applyPatch({ epaper: !state.epaper }, { resetPhase: false }); };

    $('#selectAutoInterval').onchange = function (e) { applyPatch({ autoArt: Object.assign({}, state.autoArt, { interval: e.target.value }) }, { resetPhase: false }); armAutoArt(); };
    $('#selectAutoMode').onchange = function (e) { applyPatch({ autoArt: Object.assign({}, state.autoArt, { mode: e.target.value }) }, { resetPhase: false }); };

    $('#btnFullscreen').onclick = function () { document.fullscreenElement ? Player.exitFullscreen() : Player.requestFullscreen(); };
    $('#btnPresent').onclick = function () { presenting ? stopPresentation() : startPresentation(); };

    // ---- music controls ----
    function setDisplayMode(mode) {
      applyPatch({ displayMode: mode }, { resetPhase: false });
      if (mode === 'music' && state.musicSource === 'none') startMusic('emvy'); // default per spec
    }
    function startMusic(source) {
      applyPatch({ musicSource: source, displayMode: 'music' }, { resetPhase: false });
      if (source === 'emvy') audio.useEmvy();
      else if (source === 'demo') audio.useDemo();
      syncUI();
    }
    $$('[data-music]').forEach(function (b) { b.onclick = function () { if (b.dataset.music === 'local') $('#audioFile').click(); else startMusic(b.dataset.music); }; });
    $('#audioFile').onchange = function (e) { const f = e.target.files[0]; if (f) { audio.useLocalFile(f); applyPatch({ musicSource: 'local', displayMode: 'music' }, { resetPhase: false }); } };
    $('#btnPlayPause').onclick = function () { audio.togglePlayPause(); syncUI(); };
    $('#btnNext').onclick = function () { audio.next(); };
    $('#btnPrev').onclick = function () { audio.prev(); };
    $('#btnShuffle').onclick = function () { audio.setShuffle(!audio.state.shuffle); applyPatch({ shuffle: audio.state.shuffle }, { resetPhase: false }); };
    $('#rangeVolume').oninput = function (e) { const v = Number(e.target.value) / 100; audio.setVolume(v); applyPatch({ volume: v }, { resetPhase: false }); };
    $('#rangeProgress').oninput = function (e) { audio.seekFraction(Number(e.target.value) / 1000); };
    audio.on('progress', function (p) { if (p.duration) $('#rangeProgress').value = Math.round((p.position / p.duration) * 1000); });
    audio.on('track', function () { syncUI(); });
    audio.on('error', function (reason) { toast(reason === 'playback-blocked' ? 'Tap play once to start audio' : 'Music had a problem - artwork keeps running'); });
    audio.on('playlist-error', function () { toast('EMVY catalogue unavailable - using demo beat'); startMusic('demo'); });

    // ---- library / save / art code ----
    $('#btnSaveArtwork').onclick = function () {
      $('#saveNameInput').value = '';
      $('#artCodeOut').value = ArtCode.encode(state);
      openModal('modalSave');
    };
    $('#btnConfirmSave').onclick = function () {
      const name = $('#saveNameInput').value.trim() || (engine.FAMILIES[state.family].name + ' ' + state.seed);
      Library.save(name, state).then(function () { toast('Saved "' + name + '"'); refreshFavouritesCache(); closeModal('modalSave'); });
    };
    $('#btnCopyArtCode').onclick = function () {
      const code = ArtCode.encode(state);
      navigator.clipboard ? navigator.clipboard.writeText(code).then(function () { toast('Art code copied'); }) : toast('Copy not supported here');
    };
    $('#btnDownloadArtCode').onclick = function () {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'living-art-' + state.seed + '.json';
      document.body.appendChild(a); a.click(); a.remove();
    };
    $('#btnImportArtCode').onclick = function () {
      try {
        const parsed = ArtCode.decode($('#artCodeIn').value);
        applyPatch(StateMod.sanitize(parsed));
        toast('Art code loaded');
        closeModal('modalSave');
      } catch (err) { toast(err.message || 'Could not read that art code'); }
    };
    $('#btnMyArt').onclick = function () { renderLibraryList(); openModal('modalLibrary'); };

    // ---- install / player links ----
    function refreshInstallModal() {
      const rows = Player.buildPanelUrls(state);
      $('#installUrls').value = rows.map(function (r) { return 'SCREEN ' + r.index + ' (' + r.label + ')\n' + r.url; }).join('\n\n');
    }
    $('#btnInstall').onclick = function () { refreshInstallModal(); openModal('modalInstall'); };
    $('#btnOpenWallPlayer').onclick = function () { window.open(Player.buildUrl(state, 'wall'), '_blank'); };
    $('#btnCopyPanelLinks').onclick = function () {
      refreshInstallModal();
      const text = $('#installUrls').value;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Links copied'); });
      else { $('#installUrls').select(); document.execCommand('copy'); toast('Links copied'); }
    };

    // ---- remote room ----
    $('#btnCreateRoom').onclick = function () {
      const name = prompt('Name this installation (e.g. "Hotel Lobby")', 'Living Art Room');
      if (name == null) return;
      cloudAdapter.createRoom(name).then(function (room) {
        return connectToRoom(room, 'controller').then(function (result) {
          if (!result.connected) { toast('Could not reach the cloud room service'); return; }
          renderRoomDetails();
          toast('Remote room created');
          updateRemoteStatusUI();
        });
      }).catch(function (err) {
        console.error('[Living Art] room creation failed', err);
        toast('Could not create a remote room - check living-art-cloud is deployed and configured');
      });
    };
    $('#btnCopyControllerLink').onclick = function () {
      if (!roomInfo) return;
      const url = Player.buildRoomControllerUrl({ roomId: roomInfo.roomId, controlToken: roomInfo.controlToken });
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('Controller link copied'); });
    };
    $('#btnCopyRoomPanelLinks').onclick = function () {
      if (!roomInfo) return;
      const rows = Player.buildRoomPanelUrls({ roomId: roomInfo.roomId, viewToken: roomInfo.viewToken, layout: state.layout });
      const text = rows.map(function (r) { return 'SCREEN ' + r.index + '\n' + r.url; }).join('\n\n');
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Screen links copied'); });
    };
    $('#btnRemoteDisconnect').onclick = function () {
      cloudAdapter.disconnect();
      roomRole = null; roomInfo = null; latestPresence = null;
      writeRoomStorage(null);
      updateRemoteStatusUI();
      $('#roomDetails').hidden = true;
      toast('Disconnected from remote room');
    };
    $('#remoteStatusRow').onclick = function () { renderStatusList(); openModal('modalStatus'); };

    // ---- mobile dock ----
    $('#mobileNew').onclick = function () { applyPatch({ seed: randomSeed() }); };
    $('#mobileColour').onclick = function () { applyPatch({ palette: (state.palette + 1) % engine.PALETTES.length }); };
    $('#mobileMode').onclick = function () { const order = ['paper', 'live', 'music']; setDisplayMode(order[(order.indexOf(state.displayMode) + 1) % order.length]); };
    $('#mobileGrid').onclick = function () { const order = [1, 4, 9]; applyPatch({ layout: order[(order.indexOf(state.layout) + 1) % order.length] }); };
  }

  // -------------------------------------------------------- presentation --
  function startPresentation() {
    presenting = true;
    $('#btnPresent').classList.add('on');
    Presentation.start({
      applyPatch: function (patch) { applyPatch(patch, { resetPhase: false }); if (patch.musicSource === 'demo') audio.useDemo(); },
      onText: function (text) { const el = $('#presentText'); el.textContent = text; el.classList.toggle('on', !!text); }
    });
    ['pointerdown', 'keydown'].forEach(function (ev) { document.addEventListener(ev, stopPresentationOnce, { once: true }); });
  }
  function stopPresentationOnce() { if (presenting) stopPresentation(); }
  function stopPresentation() {
    presenting = false;
    $('#btnPresent').classList.remove('on');
    Presentation.stop();
  }

  // -------------------------------------------------------------- player --
  if (isPlayer) {
    document.body.classList.add(playerKind === 'panel' ? 'panel' : 'wall');
    Player.installHiddenGesture(function () {
      const overlay = $('#playerOverlay');
      overlay.hidden = !overlay.hidden;
      $('#playerInfo').textContent = state.seed + ' · ' + engine.FAMILIES[state.family].name + (playerKind === 'panel' ? ' · Screen ' + panelNumber : '');
    });
    $('#playerExit').onclick = function () { location.href = 'index.html' + location.search.replace(/([?&])player=[^&]*&?/, '$1').replace(/&$/, ''); };
    $('#playerNewArt').onclick = function () { applyPatch({ seed: randomSeed() }); };
    // player windows still receive live control updates when run on the
    // same device/browser as the control page (see sync.js layer B).
    liveChannel.on('state', function (incoming) { state = StateMod.sanitize(incoming); rebuildGrid(); });
  }

  // --------------------------------------------------------- recovery -----
  Player.installRecovery({
    onResize: function () { scheduleRender(false); },
    onWake: function () {
      lastFrameAt = 0; scheduleRender(false);
      // a sleeping/backgrounded device's WebSocket is often already dead by
      // the time it wakes - nudge a reconnect rather than waiting out the
      // backoff timer against a connection that silently died hours ago.
      if (roomInfo && !cloudAdapter.isConnected()) connectToRoom(roomInfo, roomRole);
    },
    onFullscreenChange: function () { scheduleRender(false); },
    onOnline: function () {
      if (state.musicSource === 'emvy' && !audio.state.flat.length) audio.useEmvy();
      if (roomInfo && !cloudAdapter.isConnected()) connectToRoom(roomInfo, roomRole);
    },
    onOffline: function () { /* audio element keeps playing whatever is buffered; deterministic offline rendering is unaffected either way */ }
  });

  // ------------------------------------------------------------- boot -----
  audio.setVolume(state.volume);
  audio.setSensitivity(state.sensitivity);
  audio.setShuffle(state.shuffle);
  if (!isPlayer) refreshFavouritesCache();

  /* Remote room auto-connect. A player URL carries ?room=&token= (the view
     token); a shared controller link carries ?room=&ctrl= (the control
     token); otherwise a controller page falls back to whatever room it
     was last connected to, remembered locally. None of this blocks first
     render - the room connects in the background and the art is already
     on screen (deterministic local rendering) before or regardless of
     whether the cloud responds. */
  function autoConnectRoom() {
    const params = new URLSearchParams(location.search);
    if (isPlayer && params.has('room') && params.has('token')) {
      connectToRoom({ roomId: params.get('room'), viewToken: params.get('token') }, 'player')
        .then(function (result) { if (!result.connected) console.warn('[Living Art] could not join room as player:', result.reason); });
      return;
    }
    if (isPlayer) return; // panel/wall URL with no room credentials - stays purely local/offline
    if (params.has('room') && params.has('ctrl')) {
      const room = { roomId: params.get('room'), controlToken: params.get('ctrl'), name: params.get('room') };
      connectToRoom(room, 'controller').then(function (result) {
        if (result.connected) { renderRoomDetails(); updateRemoteStatusUI(); toast('Connected to remote room'); }
        else toast('Could not reach the remote room');
      });
      return;
    }
    const saved = readRoomStorage();
    if (saved && saved.roomId && saved.controlToken) {
      connectToRoom(saved, 'controller').then(function (result) {
        if (result.connected) { renderRoomDetails(); updateRemoteStatusUI(); }
        // a failed silent reconnect is not worth interrupting the visitor with a toast
      });
    }
  }

  function boot() {
    armAutoArt(); // never fire a scheduled change immediately on load - only on the next real boundary
    const finish = function () { rebuildGrid(); };
    if (state.sourceType === 'canvasgrid' && state.canvasGridId) {
      CanvasGrid.loadArtwork(state.canvasGridId).then(function (def) { cgActiveDef = def; finish(); }).catch(function () { finish(); });
      if (!isPlayer) buildCanvasGridPicker();
    } else {
      finish();
    }
    if (state.displayMode === 'music') {
      if (state.musicSource === 'emvy') audio.useEmvy();
      else if (state.musicSource === 'demo') audio.useDemo();
      // 'local' music cannot resume automatically after reload - the file
      // handle is gone by design (local files never leave the device and
      // are not persisted); the artwork itself still renders normally.
    }
    autoConnectRoom();
  }
  boot();

  window.addEventListener('beforeunload', function () { persist(); });
})();
