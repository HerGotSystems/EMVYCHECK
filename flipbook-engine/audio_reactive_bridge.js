// Audio Reactive Bridge v1
// Purpose:
// Connect real audio analysis to dancer-scene-engine.js and scene-timeline-system.js
// so the visual world reacts live instead of relying only on BPM timelines.
//
// Gives you:
//   - frequency band energy tracking
//   - kick / snare / hat proxies
//   - bass pressure
//   - onset / transient detection
//   - smoothed normalized values
//   - scene + dancer modulation hooks
//
// Works with either:
//   - <audio> element
//   - MediaElementAudioSourceNode
//   - existing AudioContext
//
// Main flow:
//   audio -> analyser -> bands -> events -> scene modulation
//
// Usage:
//   const reactive = await createAudioReactiveBridge({
//     audioElement,
//     scene,
//     timeline
//   });
//   reactive.start();

export async function createAudioReactiveBridge(options = {}) {
  const bridge = new AudioReactiveBridge(options);
  await bridge.init();
  return bridge;
}

export class AudioReactiveBridge {
  constructor(options = {}) {
    this.scene = options.scene || null;
    this.timeline = options.timeline || null;
    this.audioElement = options.audioElement || null;
    this.audioContext = options.audioContext || null;
    this.sourceNode = options.sourceNode || null;
    this.connectDestination = options.connectDestination !== false;

    this.fftSize = options.fftSize || 2048;
    this.smoothingTimeConstant = options.smoothingTimeConstant ?? 0.68;
    this.minDb = options.minDecibels ?? -90;
    this.maxDb = options.maxDecibels ?? -10;

    this.analyser = null;
    this.freqData = null;
    this.timeData = null;
    this.binHz = 0;

    this.isRunning = false;
    this.lastFrame = 0;
    this.startedAt = 0;
    this._tick = this.tick.bind(this);

    this.metrics = {
      master: 0,
      rms: 0,
      peak: 0,
      low: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      high: 0,
      air: 0,
      kick: 0,
      snare: 0,
      hat: 0,
      bassPressure: 0,
      transient: 0,
      brightness: 0,
      motionDrive: 0
    };

    this.prevMetrics = { ...this.metrics };

    this.history = {
      low: ring(43),
      mid: ring(43),
      high: ring(43),
      master: ring(43),
      transient: ring(43),
      kick: ring(24),
      snare: ring(24),
      hat: ring(24)
    };

    this.events = {
      kick: { active: false, cooldown: 0, threshold: options.kickThreshold ?? 0.17 },
      snare: { active: false, cooldown: 0, threshold: options.snareThreshold ?? 0.16 },
      hat: { active: false, cooldown: 0, threshold: options.hatThreshold ?? 0.11 },
      drop: { active: false, cooldown: 0, threshold: options.dropThreshold ?? 0.32 }
    };

    this.signal = {
      kickPulse: 0,
      snarePulse: 0,
      hatPulse: 0,
      dropPulse: 0,
      bassBreath: 0,
      flashDrive: 0,
      cameraShake: 0
    };

    this.settings = {
      enableSceneModulation: options.enableSceneModulation !== false,
      enableTimelineAssist: options.enableTimelineAssist !== false,
      enableDancerModulation: options.enableDancerModulation !== false,
      allowAutoBlackoutOnDrop: options.allowAutoBlackoutOnDrop ?? true,
      allowAutoModeJump: options.allowAutoModeJump ?? false,
      autoModeJumpThreshold: options.autoModeJumpThreshold ?? 0.52,
      leaderKickBoost: options.leaderKickBoost ?? 1.15,
      crowdHatJitter: options.crowdHatJitter ?? 1,
      bassShadowScale: options.bassShadowScale ?? 1,
      globalFlashGain: options.globalFlashGain ?? 1,
      motionGain: options.motionGain ?? 1
    };

    this.onEvent = options.onEvent || null;
    this.onFrame = options.onFrame || null;
  }

  async init() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('Web Audio API not supported in this browser.');

    if (!this.audioContext) {
      this.audioContext = new AudioCtx();
    }

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
    this.analyser.minDecibels = this.minDb;
    this.analyser.maxDecibels = this.maxDb;

    if (!this.sourceNode) {
      if (!this.audioElement) throw new Error('audioElement or sourceNode is required.');
      this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
    }

    this.sourceNode.connect(this.analyser);
    if (this.connectDestination) {
      this.analyser.connect(this.audioContext.destination);
    }

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
    this.binHz = this.audioContext.sampleRate / this.analyser.fftSize;
  }

  async resume() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async start() {
    await this.resume();
    this.isRunning = true;
    this.startedAt = performance.now();
    this.lastFrame = this.startedAt;
    requestAnimationFrame(this._tick);
  }

  stop() {
    this.isRunning = false;
  }

  tick(now) {
    if (!this.isRunning) return;

    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastFrame) / 1000));
    this.lastFrame = now;

    this.sample();
    this.computeMetrics(dt);
    this.detectEvents(dt);
    this.modulateScene(dt);

    if (this.onFrame) {
      this.onFrame({
        time: this.getTime(),
        dt,
        metrics: this.metrics,
        signal: this.signal,
        bridge: this
      });
    }

    requestAnimationFrame(this._tick);
  }

  getTime() {
    if (this.audioElement && Number.isFinite(this.audioElement.currentTime)) return this.audioElement.currentTime;
    return (performance.now() - this.startedAt) / 1000;
  }

  sample() {
    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);
  }

  computeMetrics(dt) {
    this.prevMetrics = { ...this.metrics };

    const low = this.getBandEnergy(20, 90);
    const lowMid = this.getBandEnergy(90, 250);
    const mid = this.getBandEnergy(250, 2000);
    const highMid = this.getBandEnergy(2000, 5000);
    const high = this.getBandEnergy(5000, 10000);
    const air = this.getBandEnergy(10000, 18000);

    const rms = this.computeRMS();
    const peak = this.computePeak();
    const master = clamp((low + lowMid + mid + highMid + high + air) / 6, 0, 1);

    const kickBand = this.getBandEnergy(35, 110);
    const snareBody = this.getBandEnergy(140, 320);
    const snareCrack = this.getBandEnergy(1800, 4200);
    const hatBand = this.getBandEnergy(6000, 12000);
    const transient = clamp(Math.max(0, peak - rms) * 1.75 + Math.max(0, high - this.prevMetrics.high) * 1.8, 0, 1);

    const kick = smoothPulse(this.prevMetrics.kick, kickBand * 0.82 + Math.max(0, kickBand - avgRing(this.history.low)) * 1.3, dt, 0.10);
    const snare = smoothPulse(
      this.prevMetrics.snare,
      snareBody * 0.45 + snareCrack * 0.85 + Math.max(0, snareCrack - avgRing(this.history.mid)) * 1.4,
      dt,
      0.11
    );
    const hat = smoothPulse(
      this.prevMetrics.hat,
      hatBand * 0.75 + Math.max(0, air - this.prevMetrics.air) * 1.3,
      dt,
      0.06
    );

    const bassPressure = smoothValue(this.prevMetrics.bassPressure, low * 0.8 + lowMid * 0.35, dt, 7.5);
    const brightness = clamp((high + air) * 0.65 + transient * 0.25, 0, 1);
    const motionDrive = clamp(master * 0.45 + transient * 0.35 + kick * 0.35 + snare * 0.28, 0, 1);

    this.metrics.low = low;
    this.metrics.lowMid = lowMid;
    this.metrics.mid = mid;
    this.metrics.highMid = highMid;
    this.metrics.high = high;
    this.metrics.air = air;
    this.metrics.master = master;
    this.metrics.rms = rms;
    this.metrics.peak = peak;
    this.metrics.kick = clamp(kick, 0, 1.5);
    this.metrics.snare = clamp(snare, 0, 1.5);
    this.metrics.hat = clamp(hat, 0, 1.5);
    this.metrics.transient = transient;
    this.metrics.bassPressure = bassPressure;
    this.metrics.brightness = brightness;
    this.metrics.motionDrive = motionDrive;

    pushRing(this.history.low, low);
    pushRing(this.history.mid, mid);
    pushRing(this.history.high, high);
    pushRing(this.history.master, master);
    pushRing(this.history.transient, transient);
    pushRing(this.history.kick, this.metrics.kick);
    pushRing(this.history.snare, this.metrics.snare);
    pushRing(this.history.hat, this.metrics.hat);
  }

  detectEvents(dt) {
    decayEvent(this.events.kick, dt);
    decayEvent(this.events.snare, dt);
    decayEvent(this.events.hat, dt);
    decayEvent(this.events.drop, dt);

    const kickRise = this.metrics.kick - avgRing(this.history.kick);
    const snareRise = this.metrics.snare - avgRing(this.history.snare);
    const hatRise = this.metrics.hat - avgRing(this.history.hat);
    const lowSwell = this.metrics.bassPressure - this.prevMetrics.bassPressure;

    if (!this.events.kick.cooldown && kickRise > this.events.kick.threshold) {
      this.trigger('kick', { strength: clamp(kickRise * 2.3 + this.metrics.kick * 0.4, 0, 1.5) });
      this.events.kick.cooldown = 0.11;
    }

    if (!this.events.snare.cooldown && snareRise > this.events.snare.threshold) {
      this.trigger('snare', { strength: clamp(snareRise * 2 + this.metrics.snare * 0.3, 0, 1.5) });
      this.events.snare.cooldown = 0.10;
    }

    if (!this.events.hat.cooldown && hatRise > this.events.hat.threshold) {
      this.trigger('hat', { strength: clamp(hatRise * 2.2 + this.metrics.hat * 0.2, 0, 1.25) });
      this.events.hat.cooldown = 0.045;
    }

    if (
      !this.events.drop.cooldown &&
      this.metrics.bassPressure > 0.46 &&
      this.metrics.transient > 0.34 &&
      lowSwell > 0.04
    ) {
      this.trigger('drop', { strength: clamp(this.metrics.bassPressure + this.metrics.transient, 0, 1.5) });
      this.events.drop.cooldown = 0.8;
    }

    this.signal.kickPulse = Math.max(0, this.signal.kickPulse - dt * 5.8);
    this.signal.snarePulse = Math.max(0, this.signal.snarePulse - dt * 7.5);
    this.signal.hatPulse = Math.max(0, this.signal.hatPulse - dt * 12.0);
    this.signal.dropPulse = Math.max(0, this.signal.dropPulse - dt * 2.0);
    this.signal.flashDrive = Math.max(0, this.signal.flashDrive - dt * 4.2);
    this.signal.cameraShake = Math.max(0, this.signal.cameraShake - dt * 4.8);
    this.signal.bassBreath = smoothValue(this.signal.bassBreath, this.metrics.bassPressure, dt, 6.0);
  }

  trigger(type, payload = {}) {
    const t = this.getTime();

    switch (type) {
      case 'kick':
        this.signal.kickPulse = Math.max(this.signal.kickPulse, payload.strength || 1);
        this.signal.flashDrive = Math.max(this.signal.flashDrive, (payload.strength || 1) * 0.32);
        this.signal.cameraShake = Math.max(this.signal.cameraShake, (payload.strength || 1) * 0.22);
        break;
      case 'snare':
        this.signal.snarePulse = Math.max(this.signal.snarePulse, payload.strength || 1);
        this.signal.flashDrive = Math.max(this.signal.flashDrive, (payload.strength || 1) * 0.42);
        this.signal.cameraShake = Math.max(this.signal.cameraShake, (payload.strength || 1) * 0.18);
        break;
      case 'hat':
        this.signal.hatPulse = Math.max(this.signal.hatPulse, payload.strength || 1);
        break;
      case 'drop':
        this.signal.dropPulse = Math.max(this.signal.dropPulse, payload.strength || 1);
        this.signal.flashDrive = Math.max(this.signal.flashDrive, (payload.strength || 1) * 0.8);
        this.signal.cameraShake = Math.max(this.signal.cameraShake, (payload.strength || 1) * 0.5);
        break;
    }

    if (this.onEvent) {
      this.onEvent({ type, time: t, payload, metrics: this.metrics, signal: this.signal, bridge: this });
    }
  }

  modulateScene(dt) {
    if (!this.scene || !this.settings.enableSceneModulation) return;

    const scene = this.scene;
    const m = this.metrics;
    const s = this.signal;

    // Global scene modulation
    scene.globalEnergy = Math.max(scene.globalEnergy, m.motionDrive * this.settings.motionGain * 0.85);
    scene.flash += s.flashDrive * this.settings.globalFlashGain * dt * 1.6;
    scene.cameraPulse += s.cameraShake * dt * 1.6;

    // Optional auto-drop assistance when no dense timeline exists
    if (this.settings.enableTimelineAssist) {
      if (s.dropPulse > 0.85 && this.settings.allowAutoBlackoutOnDrop) {
        scene.blackout = Math.max(scene.blackout, 0.45 + s.dropPulse * 0.25);
        scene.dropAmount = Math.max(scene.dropAmount, 0.7 + s.dropPulse * 0.25);
      }

      if (this.settings.allowAutoModeJump && s.dropPulse > this.settings.autoModeJumpThreshold) {
        const nextMode = scene.mode === 'windowGrid' ? 'sharedStage' : 'windowGrid';
        scene.setMode(nextMode);
        scene.relayout();
      }
    }

    // Palette breathing
    const glowBase = 0.04 + m.brightness * 0.12 + s.dropPulse * 0.18;
    scene.scenePalette.frameGlow = `rgba(255,255,255,${clamp(glowBase, 0.02, 0.3)})`;
    scene.scenePalette.floor = `rgba(255,255,255,${clamp(0.04 + m.bassPressure * 0.08, 0.03, 0.16)})`;

    if (this.settings.enableDancerModulation && Array.isArray(scene.dancers)) {
      for (const dancer of scene.dancers) {
        const leaderBoost = dancer.role === 'lead' ? this.settings.leaderKickBoost : 1;
        const kickDrive = s.kickPulse * leaderBoost;
        const snareDrive = s.snarePulse;
        const hatDrive = s.hatPulse * this.settings.crowdHatJitter;
        const bassDrive = s.bassBreath;

        dancer.motionAmount = Math.max(
          dancer.motionAmount,
          clamp(m.motionDrive * 0.65 + kickDrive * 0.38 + snareDrive * 0.22, 0, 1.6)
        );

        dancer.accentScale = Math.max(dancer.accentScale || 0, kickDrive * 0.06 + snareDrive * 0.04);
        dancer.signatureFlash = Math.max(dancer.signatureFlash || 0, snareDrive * 0.3);

        if (dancer.role === 'lead') {
          dancer.bounce += kickDrive * 0.06;
          dancer.lean += (Math.random() - 0.5) * snareDrive * 0.015;
        } else if (dancer.role === 'follow') {
          dancer.bounce += kickDrive * 0.04;
        } else if (dancer.role === 'crowd') {
          dancer.microOffsetX += (Math.random() - 0.5) * hatDrive * 0.5;
          dancer.microOffsetY += (Math.random() - 0.5) * hatDrive * 0.35;
        } else if (dancer.role === 'ambient') {
          dancer.lean += Math.sin(this.getTime() * 1.4 + dancer.depth * 3) * bassDrive * 0.004;
        }

        if (scene.mode === 'windowGrid' && snareDrive > 0.2 && dancer.role !== 'idle') {
          dancer.screenShakeX += (Math.random() - 0.5) * snareDrive * 2.1;
          dancer.screenShakeY += (Math.random() - 0.5) * snareDrive * 1.4;
        }
      }
    }
  }

  getBandEnergy(minHz, maxHz) {
    const start = hzToIndex(minHz, this.binHz, this.freqData.length);
    const end = hzToIndex(maxHz, this.binHz, this.freqData.length);
    if (end <= start) return 0;

    let sum = 0;
    let count = 0;
    for (let i = start; i <= end; i++) {
      sum += this.freqData[i] / 255;
      count++;
    }
    return count ? sum / count : 0;
  }

  computeRMS() {
    let sum = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = (this.timeData[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / this.timeData.length);
  }

  computePeak() {
    let peak = 0;
    for (let i = 0; i < this.timeData.length; i++) {
      const v = Math.abs((this.timeData[i] - 128) / 128);
      if (v > peak) peak = v;
    }
    return peak;
  }

  getSnapshot() {
    return {
      time: this.getTime(),
      metrics: { ...this.metrics },
      signal: { ...this.signal }
    };
  }
}

// -----------------------------------------------------------------------------
// Optional bridge helpers for common hookup patterns
// -----------------------------------------------------------------------------

export async function connectAudioReactiveScene({ audioElement, scene, timeline, options = {} }) {
  const bridge = await createAudioReactiveBridge({
    audioElement,
    scene,
    timeline,
    ...options
  });

  const startOnPlay = async () => {
    await bridge.resume();
    if (!bridge.isRunning) bridge.start();
  };

  if (audioElement) {
    audioElement.addEventListener('play', startOnPlay);
    audioElement.addEventListener('pause', () => bridge.stop());
    audioElement.addEventListener('ended', () => bridge.stop());
  }

  return bridge;
}

export function makeReactiveHooks(bridge) {
  return {
    isKick() {
      return bridge.signal.kickPulse > 0.25;
    },
    isSnare() {
      return bridge.signal.snarePulse > 0.25;
    },
    isHat() {
      return bridge.signal.hatPulse > 0.18;
    },
    isDrop() {
      return bridge.signal.dropPulse > 0.55;
    },
    bass() {
      return bridge.metrics.bassPressure;
    },
    motion() {
      return bridge.metrics.motionDrive;
    },
    brightness() {
      return bridge.metrics.brightness;
    },
    transient() {
      return bridge.metrics.transient;
    },
    snapshot() {
      return bridge.getSnapshot();
    }
  };
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function hzToIndex(hz, binHz, maxLen) {
  return clampInt(Math.floor(hz / binHz), 0, maxLen - 1);
}

function smoothValue(current, target, dt, speed) {
  const a = 1 - Math.exp(-speed * dt);
  return current + (target - current) * a;
}

function smoothPulse(current, target, dt, release) {
  if (target > current) return target;
  return Math.max(0, current - dt / Math.max(0.0001, release));
}

function ring(size) {
  return { arr: new Array(size).fill(0), i: 0, size, filled: false };
}

function pushRing(r, v) {
  r.arr[r.i] = v;
  r.i = (r.i + 1) % r.size;
  if (r.i === 0) r.filled = true;
}

function avgRing(r) {
  const len = r.filled ? r.size : r.i;
  if (len <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < len; i++) sum += r.arr[i];
  return sum / len;
}

function decayEvent(e, dt) {
  e.cooldown = Math.max(0, e.cooldown - dt);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function clampInt(v, min, max) {
  return Math.max(min, Math.min(max, v | 0));
}

// -----------------------------------------------------------------------------
// Example integration
// -----------------------------------------------------------------------------
// import { scenePresets } from './dancer-scene-engine.js';
// import { bindTimelineToScene, timelinePresets } from './scene-timeline-system.js';
// import { connectAudioReactiveScene } from './audio-reactive-bridge.js';
//
// const canvas = document.querySelector('canvas');
// const audio = document.querySelector('audio');
// const scene = scenePresets.dnbWall({ canvas, bpm: 174 });
// scene.start();
// const timeline = bindTimelineToScene({ scene, audio, timelineData: timelinePresets.dnbEnergyWall });
//
// // add dancers first, then:
// const reactive = await connectAudioReactiveScene({
//   audioElement: audio,
//   scene,
//   timeline,
//   options: {
//     allowAutoBlackoutOnDrop: true,
//     enableTimelineAssist: true,
//     enableDancerModulation: true,
//     globalFlashGain: 1.2,
//     motionGain: 1.1
//   }
// });
//
// Result:
// timeline gives structure
// audio gives live detail
// together they make the world feel inhabited
