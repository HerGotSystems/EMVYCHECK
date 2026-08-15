/* EMVY CHECK Living Art V2 — central state: defaults, URL params, persistence. */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'emvy-living-art-v2';

  function defaultState() {
    return {
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
  }

  const STRING_KEYS = { seed: 'seed', installSeed: 'iseed', composition: 'comp', aspect: 'aspect', displayMode: 'mode', quality: 'q', musicSource: 'music', sensitivity: 'sens', sourceType: 'source', canvasGridId: 'cg' };
  const NUMBER_KEYS = { family: 'fam', palette: 'pal', density: 'den', speed: 'spd', layout: 'layout', volume: 'vol' };
  const BOOL_KEYS = { epaper: 'epaper', shuffle: 'shuffle' };

  function readStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeStorage(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable - state still works in-memory */ }
  }

  function applyParams(state, params) {
    Object.keys(STRING_KEYS).forEach(function (k) { const p = STRING_KEYS[k]; if (params.has(p)) state[k] = params.get(p); });
    Object.keys(NUMBER_KEYS).forEach(function (k) { const p = NUMBER_KEYS[k]; if (params.has(p)) { const n = Number(params.get(p)); if (Number.isFinite(n)) state[k] = n; } });
    Object.keys(BOOL_KEYS).forEach(function (k) { const p = BOOL_KEYS[k]; if (params.has(p)) state[k] = params.get(p) === '1'; });
    if (params.has('ai') || params.has('am')) {
      state.autoArt = { interval: params.get('ai') || state.autoArt.interval, mode: params.get('am') || state.autoArt.mode };
    }
    if (params.has('ind')) {
      try {
        state.independent = params.get('ind').split(',').map(function (chunk) {
          const parts = chunk.split(':');
          return { seed: parts[0] || '', family: Number(parts[1]) || 0, palette: Number(parts[2]) || 0 };
        });
      } catch (e) { /* ignore malformed ind param, keep generated defaults */ }
    }
    return state;
  }

  function sanitize(state) {
    const d = defaultState();
    const out = Object.assign({}, d, state || {});
    out.layout = [1, 4, 9].indexOf(out.layout) >= 0 ? out.layout : 9;
    out.composition = ['continuous', 'family', 'independent'].indexOf(out.composition) >= 0 ? out.composition : 'continuous';
    out.aspect = ['square', 'wide', 'classic'].indexOf(out.aspect) >= 0 ? out.aspect : 'square';
    out.displayMode = ['paper', 'live', 'music'].indexOf(out.displayMode) >= 0 ? out.displayMode : 'paper';
    out.quality = ['auto', 'low', 'normal', 'high'].indexOf(out.quality) >= 0 ? out.quality : 'auto';
    out.musicSource = ['none', 'emvy', 'local', 'demo'].indexOf(out.musicSource) >= 0 ? out.musicSource : 'none';
    out.sensitivity = ['calm', 'normal', 'hard'].indexOf(out.sensitivity) >= 0 ? out.sensitivity : 'normal';
    out.sourceType = ['generative', 'canvasgrid'].indexOf(out.sourceType) >= 0 ? out.sourceType : 'generative';
    out.density = Math.max(20, Math.min(100, Number(out.density) || 58));
    out.speed = Math.max(5, Math.min(100, Number(out.speed) || 28));
    out.volume = Math.max(0, Math.min(1, Number(out.volume) || 0.8));
    out.seed = String(out.seed || 'EMVY-0001').slice(0, 40);
    if (!Array.isArray(out.independent)) out.independent = [];
    if (!out.autoArt || typeof out.autoArt !== 'object') out.autoArt = { interval: 'manual', mode: 'new-art' };
    return out;
  }

  /* A room-connected player/controller link (see player.js buildRoomUrl /
     buildRoomControllerUrl) carries its player/panel/room/token markers in
     the URL fragment, never the query string - fragments are never sent to
     any server, so a capability token in one never leaks via an access log
     or a Referer header. A local, non-room player/panel link (buildUrl /
     buildPanelUrls) is unaffected - it carries no credential, so it stays a
     plain query string as before. The fragment is checked first so a room
     link always wins if a page somehow carries both. */
  function load() {
    const search = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash ? location.hash.replace(/^#/, '') : '');
    const isPlayer = hashParams.has('player') || search.has('player');
    const playerSource = hashParams.has('player') ? hashParams : search;
    let state = defaultState();
    if (!isPlayer) {
      const stored = readStorage();
      if (stored) state = Object.assign(state, stored);
    }
    applyParams(state, search);
    return { state: sanitize(state), isPlayer: isPlayer, playerKind: playerSource.get('player'), panel: Math.max(1, Number(playerSource.get('panel')) || 1) };
  }

  function save(state, isPlayer) {
    if (isPlayer) return; // player windows must never clobber the control app's saved config
    writeStorage(state);
  }

  function toParams(state, extra) {
    const p = new URLSearchParams();
    Object.keys(STRING_KEYS).forEach(function (k) { if (state[k]) p.set(STRING_KEYS[k], state[k]); });
    Object.keys(NUMBER_KEYS).forEach(function (k) { p.set(NUMBER_KEYS[k], state[k]); });
    Object.keys(BOOL_KEYS).forEach(function (k) { if (state[k]) p.set(BOOL_KEYS[k], '1'); });
    if (state.autoArt) { p.set('ai', state.autoArt.interval); p.set('am', state.autoArt.mode); }
    if (state.composition === 'independent' && state.independent.length) {
      p.set('ind', state.independent.map(function (e) { return (e.seed || '') + ':' + (e.family || 0) + ':' + (e.palette || 0); }).join(','));
    }
    if (extra) Object.keys(extra).forEach(function (k) { p.set(k, extra[k]); });
    return p;
  }

  global.LivingArtState = { defaultState, sanitize, load, save, toParams, STORAGE_KEY };
})(window);
