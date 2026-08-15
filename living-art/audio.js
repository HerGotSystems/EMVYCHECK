/* EMVY CHECK Living Art V2 — music source + Web Audio analysis.

   Reuses the EXISTING EMVY CHECK catalogue instead of inventing a second
   playlist system: it fetches the same https://media.emvycheck.com/playlist.json
   the main site loads (see index.html "LOAD PLAYLIST" section), so there is
   nothing to keep in sync by hand and no track URLs are duplicated here.

   Three music sources:
     emvy  - built-in EMVY CHECK catalogue (default when MUSIC is pressed
             with nothing selected)
     local - a file the visitor picks; never leaves the device
     demo  - a fully synthetic beat pattern, no audio playback at all

   Audio failure (blocked autoplay, no Web Audio support, CORS edge case,
   network failure loading the catalogue) must never blank or break the
   artwork - everything here degrades to a safe synthetic analysis instead
   of throwing past its own boundary. */
(function (global) {
  'use strict';

  const PLAYLIST_URL = 'https://media.emvycheck.com/playlist.json';

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function createState() {
    return {
      source: 'none',            // none | emvy | local | demo
      albums: null,               // raw ALBUMS shape from playlist.json
      flat: [],                   // flattened [{ai,ti,title,albumName,src}]
      order: [],                  // shuffle order (indexes into flat)
      orderPos: -1,
      shuffle: false,
      playing: false,
      volume: 0.8,
      currentTitle: '',
      currentAlbum: '',
      duration: 0,
      position: 0,
      playlistError: null,
      analysisReal: false,
      sensitivity: 'normal'       // calm | normal | hard
    };
  }

  const SENSITIVITY = {
    calm: { gain: 0.62, attack: 0.35, release: 0.06, kickThreshold: 1.55 },
    normal: { gain: 1.0, attack: 0.55, release: 0.1, kickThreshold: 1.4 },
    hard: { gain: 1.45, attack: 0.75, release: 0.18, kickThreshold: 1.22 }
  };

  function LivingArtAudio() {
    const self = this;
    this.state = createState();
    this.listeners = {};
    this.el = null;
    this.ctx = null;
    this.analyser = null;
    this.freqData = null;
    this.sourceNode = null;
    this.playlistPromise = null;

    // rolling bass history for kick/transient onset detection (fixed-size,
    // allocated once - no per-frame allocation)
    this.bassHistory = new Float32Array(43); // ~1s at 60fps-ish sampling
    this.bassHistoryPos = 0;
    this.lastKickAt = 0;
    this.smoothed = { bass: 0, mid: 0, treble: 0, energy: 0, smoothedEnergy: 0 };
    this.demoClock = 0;
    this.out = { bass: 0, mid: 0, treble: 0, energy: 0, kick: 0, transient: 0, smoothedEnergy: 0 };
  }

  LivingArtAudio.prototype.on = function (event, cb) {
    (this.listeners[event] = this.listeners[event] || []).push(cb);
    return this;
  };
  LivingArtAudio.prototype.emit = function (event, payload) {
    (this.listeners[event] || []).forEach(function (cb) { try { cb(payload); } catch (e) { console.error(e); } });
  };

  LivingArtAudio.prototype.ensureElement = function () {
    if (this.el) return this.el;
    const el = document.createElement('audio');
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.setAttribute('playsinline', '');
    el.style.display = 'none';
    document.body.appendChild(el);
    const self = this;
    el.addEventListener('timeupdate', function () {
      self.state.position = el.currentTime || 0;
      self.state.duration = el.duration || 0;
      self.emit('progress', { position: self.state.position, duration: self.state.duration });
    });
    el.addEventListener('ended', function () { self.next(); });
    el.addEventListener('error', function () {
      self.state.playlistError = 'Track failed to load';
      self.emit('error', 'track-load-failed');
      self.next();
    });
    this.el = el;
    return el;
  };

  // ---- EMVY catalogue -----------------------------------------------------
  LivingArtAudio.prototype.loadPlaylist = function () {
    if (this.playlistPromise) return this.playlistPromise;
    const self = this;
    this.playlistPromise = fetch(PLAYLIST_URL, { mode: 'cors' })
      .then(function (r) { if (!r.ok) throw new Error('playlist http ' + r.status); return r.json(); })
      .then(function (data) {
        const albums = (data && data.albums) || [];
        const flat = [];
        albums.forEach(function (album, ai) {
          (album.tracks || []).forEach(function (track, ti) {
            flat.push({ ai: ai, ti: ti, title: track.title, albumName: album.name, src: track.src });
          });
        });
        self.state.albums = albums;
        self.state.flat = flat;
        self.state.playlistError = flat.length ? null : 'Catalogue empty';
        self.emit('playlist-ready', { count: flat.length });
        return flat;
      })
      .catch(function (err) {
        console.warn('[Living Art] EMVY catalogue failed to load, EMVY MUSIC will fall back to DEMO BEAT', err);
        self.state.playlistError = 'Could not load EMVY catalogue';
        self.emit('playlist-error', err);
        return [];
      });
    return this.playlistPromise;
  };

  LivingArtAudio.prototype.buildOrder = function () {
    const n = this.state.flat.length;
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    if (this.state.shuffle) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }
    }
    this.state.order = order;
  };

  // ---- Web Audio graph ------------------------------------------------------
  LivingArtAudio.prototype.ensureGraph = function () {
    if (this.ctx) return true;
    try {
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) throw new Error('Web Audio not supported');
      this.ctx = new AC();
      const el = this.ensureElement();
      this.sourceNode = this.ctx.createMediaElementSource(el);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.analyser.smoothingTimeConstant = 0.55;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.state.analysisReal = true;
      return true;
    } catch (err) {
      console.warn('[Living Art] Web Audio analysis unavailable, using synthetic fallback', err);
      this.state.analysisReal = false;
      this.ctx = null; this.analyser = null; this.freqData = null;
      return false;
    }
  };

  function binForFreq(freq, sampleRate, binCount) {
    return clamp(Math.round(freq / (sampleRate / 2) * binCount), 0, binCount - 1);
  }

  LivingArtAudio.prototype.readBands = function () {
    if (!this.analyser || !this.freqData) return null;
    this.analyser.getByteFrequencyData(this.freqData);
    const sr = this.ctx.sampleRate || 44100;
    const n = this.freqData.length;
    const bassHi = binForFreq(250, sr, n), midHi = binForFreq(4000, sr, n), trebHi = binForFreq(12000, sr, n);
    let bassSum = 0, bassCount = 0, midSum = 0, midCount = 0, trebSum = 0, trebCount = 0;
    for (let i = 0; i < n; i++) {
      const v = this.freqData[i];
      if (i <= bassHi) { bassSum += v; bassCount++; }
      else if (i <= midHi) { midSum += v; midCount++; }
      else if (i <= trebHi) { trebSum += v; trebCount++; }
    }
    return {
      bass: bassCount ? bassSum / bassCount / 255 : 0,
      mid: midCount ? midSum / midCount / 255 : 0,
      treble: trebCount ? trebSum / trebCount / 255 : 0
    };
  };

  // ---- demo beat (fully synthetic, no audio element involved) -------------
  LivingArtAudio.prototype.readDemoBeat = function (dtSeconds) {
    this.demoClock += dtSeconds;
    const t = this.demoClock;
    const beat = Math.pow(Math.max(0, Math.sin(t * 2.4)), 6);
    const bass = 0.25 + 0.75 * beat;
    const mid = 0.3 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 1.35 + 1)), 3);
    const treble = 0.2 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 3.1 + 2)), 2);
    return { bass: bass, mid: mid, treble: treble };
  };

  /* Call once per animation frame. Never throws. Returns the shared `out`
     object (reused every call - callers must read, not retain). */
  LivingArtAudio.prototype.tick = function (dtSeconds) {
    const s = this.state;
    const sens = SENSITIVITY[s.sensitivity] || SENSITIVITY.normal;
    let bands;
    if (s.source === 'demo') {
      bands = this.readDemoBeat(dtSeconds);
    } else if (s.source === 'emvy' || s.source === 'local') {
      bands = this.readBands();
      if (!bands) bands = this.readDemoBeat(dtSeconds); // analysis blocked -> keep motion alive
    } else {
      bands = { bass: 0, mid: 0, treble: 0 };
    }

    const bass = clamp(bands.bass * sens.gain, 0, 1.4);
    const mid = clamp(bands.mid * sens.gain, 0, 1.4);
    const treble = clamp(bands.treble * sens.gain, 0, 1.4);
    const energy = clamp((bass * 0.5 + mid * 0.3 + treble * 0.2), 0, 1.4);

    // attack/release smoothing so nothing strobes
    const sm = this.smoothed;
    sm.bass += (bass - sm.bass) * (bass > sm.bass ? sens.attack : sens.release);
    sm.mid += (mid - sm.mid) * (mid > sm.mid ? sens.attack : sens.release);
    sm.treble += (treble - sm.treble) * (treble > sm.treble ? sens.attack : sens.release);
    sm.energy += (energy - sm.energy) * (energy > sm.energy ? sens.attack : sens.release);
    sm.smoothedEnergy += (energy - sm.smoothedEnergy) * 0.04;

    // kick / transient onset detection off the bass history ring buffer
    const hist = this.bassHistory;
    let avg = 0;
    for (let i = 0; i < hist.length; i++) avg += hist[i];
    avg /= hist.length;
    hist[this.bassHistoryPos] = sm.bass;
    this.bassHistoryPos = (this.bassHistoryPos + 1) % hist.length;

    const now = (global.performance ? performance.now() : Date.now());
    let kick = 0, transient = 0;
    if (avg > 0.02 && sm.bass > avg * sens.kickThreshold && now - this.lastKickAt > 140) {
      kick = clamp((sm.bass - avg) * 2.2, 0, 1);
      transient = kick;
      this.lastKickAt = now;
    } else if (now - this.lastKickAt < 160) {
      const decay = 1 - (now - this.lastKickAt) / 160;
      kick = Math.max(0, decay) * 0.6;
    }

    const out = this.out;
    out.bass = sm.bass; out.mid = sm.mid; out.treble = sm.treble;
    out.energy = sm.energy; out.smoothedEnergy = sm.smoothedEnergy;
    out.kick = kick; out.transient = transient;
    return out;
  };

  // ---- transport ------------------------------------------------------------
  LivingArtAudio.prototype.setSensitivity = function (level) { this.state.sensitivity = SENSITIVITY[level] ? level : 'normal'; };
  LivingArtAudio.prototype.setVolume = function (v) { this.state.volume = clamp(v, 0, 1); if (this.el) this.el.volume = this.state.volume; };
  LivingArtAudio.prototype.setShuffle = function (on) { this.state.shuffle = !!on; this.buildOrder(); };

  LivingArtAudio.prototype.playIndex = function (flatIndex) {
    const track = this.state.flat[flatIndex];
    if (!track) return false;
    const el = this.ensureElement();
    el.src = track.src;
    el.volume = this.state.volume;
    this.state.currentTitle = track.title;
    this.state.currentAlbum = track.albumName;
    this.orderPosForFlat(flatIndex);
    this.ensureGraph();
    const self = this;
    const p = el.play();
    if (p && p.catch) p.catch(function (err) {
      console.warn('[Living Art] playback blocked until user interacts', err);
      self.emit('error', 'playback-blocked');
    });
    this.state.playing = true;
    this.emit('track', { title: track.title, album: track.albumName });
    return true;
  };

  LivingArtAudio.prototype.orderPosForFlat = function (flatIndex) {
    const pos = this.state.order.indexOf(flatIndex);
    this.state.orderPos = pos >= 0 ? pos : 0;
  };

  LivingArtAudio.prototype.useEmvy = function () {
    const self = this;
    this.state.source = 'emvy';
    return this.loadPlaylist().then(function (flat) {
      if (self.state.source !== 'emvy') return; // user switched away while loading
      if (!flat.length) { self.useDemo(); return; }
      if (!self.state.order.length) self.buildOrder();
      const start = self.state.orderPos >= 0 ? self.state.order[self.state.orderPos] : self.state.order[0];
      self.playIndex(start);
    });
  };

  LivingArtAudio.prototype.useLocalFile = function (file) {
    if (!file) return;
    this.state.source = 'local';
    const el = this.ensureElement();
    el.src = URL.createObjectURL(file);
    el.loop = true;
    el.volume = this.state.volume;
    this.state.currentTitle = file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 60);
    this.state.currentAlbum = 'Your music';
    this.ensureGraph();
    const self = this;
    el.play().catch(function (err) { console.warn('[Living Art] local playback blocked', err); self.emit('error', 'playback-blocked'); });
    this.state.playing = true;
    this.emit('track', { title: this.state.currentTitle, album: 'Your music' });
  };

  LivingArtAudio.prototype.useDemo = function () {
    this.state.source = 'demo';
    this.state.playing = true;
    this.state.currentTitle = 'Demo beat';
    this.state.currentAlbum = 'No audio playback';
    if (this.el) { try { this.el.pause(); } catch (e) {} }
    this.emit('track', { title: 'Demo beat', album: 'No audio playback' });
  };

  LivingArtAudio.prototype.stop = function () {
    this.state.source = 'none';
    this.state.playing = false;
    if (this.el) { try { this.el.pause(); } catch (e) {} }
  };

  LivingArtAudio.prototype.togglePlayPause = function () {
    if (this.state.source === 'demo') { this.state.playing = !this.state.playing; return; }
    const el = this.el;
    if (!el) return;
    if (el.paused) { el.play().catch(function () {}); this.state.playing = true; }
    else { el.pause(); this.state.playing = false; }
  };

  LivingArtAudio.prototype.next = function () {
    if (this.state.source === 'demo' || !this.state.flat.length) return;
    if (!this.state.order.length) this.buildOrder();
    const pos = (this.state.orderPos + 1) % this.state.order.length;
    this.state.orderPos = pos;
    this.playIndex(this.state.order[pos]);
  };

  LivingArtAudio.prototype.prev = function () {
    if (this.state.source === 'demo' || !this.state.flat.length) return;
    if (!this.state.order.length) this.buildOrder();
    const pos = (this.state.orderPos - 1 + this.state.order.length) % this.state.order.length;
    this.state.orderPos = pos;
    this.playIndex(this.state.order[pos]);
  };

  LivingArtAudio.prototype.seekFraction = function (f) {
    if (this.el && this.el.duration) this.el.currentTime = clamp(f, 0, 1) * this.el.duration;
  };

  global.LivingArtAudio = LivingArtAudio;
})(window);
