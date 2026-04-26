// Dancer Scene Engine v1
// Drop-in module for pose-grid / flipbook dancer systems.
// Purpose: make dancers feel like they exist together instead of isolated jumping tiles.
// Modes:
//   - windowGrid: each dancer in a shared visual grid with synchronized timing
//   - sharedStage: all dancers composited into one scene with floor line, shadows, depth
//
// Assumptions:
//   - You already have pose images or pose frame metadata per dancer.
//   - Your existing engine can draw a pose frame to canvas.
//   - Beat / transport data is available or approximated from BPM.
//
// Main ideas:
//   - Global clock = all dancers live in one rhythm universe
//   - Local personality = each dancer interprets the beat differently
//   - Role system = lead, follow, idle, ambient, crowd
//   - Shared scene = floor line, shadows, color wash, depth, window frames
//
// Usage sketch:
//   const scene = new DancerSceneEngine({ canvas, bpm: 174, mode: 'windowGrid' });
//   scene.addDancer({
//     id: 'punk_1',
//     spriteSet: punkPoseSet,
//     archetype: 'punkIgnition',
//     role: 'lead'
//   });
//   scene.start();

export class DancerSceneEngine {
  constructor(options = {}) {
    this.canvas = options.canvas;
    this.ctx = this.canvas.getContext('2d');

    this.width = this.canvas.width;
    this.height = this.canvas.height;

    this.bpm = options.bpm || 120;
    this.mode = options.mode || 'windowGrid';
    this.backgroundMode = options.backgroundMode || 'club';
    this.floorY = options.floorY || Math.round(this.height * 0.82);
    this.beatsPerBar = options.beatsPerBar || 4;
    this.swing = options.swing || 0;

    this.dancers = [];
    this.time = 0;
    this.startTime = 0;
    this.lastFrameTime = 0;
    this.isRunning = false;

    this.globalEnergy = 0;
    this.dropAmount = 0;
    this.flash = 0;
    this.masterHueShift = 0;

    this.leaderId = null;
    this.cameraPulse = 0;
    this.blackout = 0;

    this.scenePalette = {
      bgTop: '#090909',
      bgBottom: '#141414',
      floor: 'rgba(255,255,255,0.08)',
      glow: 'rgba(255,255,255,0.06)',
      shadow: 'rgba(0,0,0,0.35)',
      frame: 'rgba(255,255,255,0.10)',
      frameGlow: 'rgba(255,255,255,0.04)'
    };

    this.transport = {
      beat: 0,
      bar: 0,
      phase: 0,
      secondsPerBeat: 60 / this.bpm,
      lastBeatIndex: -1
    };

    this.events = [];
    this.frameHooks = [];
    this.debug = !!options.debug;

    this.windowGrid = {
      cols: options.gridCols || 4,
      rows: options.gridRows || 3,
      gap: options.gridGap || 14,
      margin: options.gridMargin || 24,
      borderRadius: options.gridRadius || 14,
      flickerChance: options.gridFlickerChance || 0.025
    };

    this.sharedStage = {
      horizonY: Math.round(this.height * 0.48),
      depthBlur: true,
      crowdScaleMin: 0.55,
      crowdScaleMax: 1.15
    };

    this.onBeat = options.onBeat || null;
    this.onBar = options.onBar || null;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setBpm(bpm) {
    this.bpm = bpm;
    this.transport.secondsPerBeat = 60 / this.bpm;
  }

  setLeader(id) {
    this.leaderId = id;
    for (const d of this.dancers) {
      d.isLeader = d.id === id;
    }
  }

  addEvent(event) {
    this.events.push({
      time: event.time || 0,
      type: event.type || 'flash',
      amount: event.amount ?? 1,
      consumed: false
    });
  }

  addDancer(config) {
    const dancer = createDancer(config, this);
    this.dancers.push(dancer);
    if (dancer.role === 'lead' && !this.leaderId) this.setLeader(dancer.id);
    this.relayout();
    return dancer;
  }

  removeDancer(id) {
    this.dancers = this.dancers.filter(d => d.id !== id);
    if (this.leaderId === id) {
      const nextLead = this.dancers.find(d => d.role === 'lead') || this.dancers[0] || null;
      this.leaderId = nextLead ? nextLead.id : null;
      if (nextLead) nextLead.isLeader = true;
    }
    this.relayout();
  }

  relayout() {
    if (this.mode === 'windowGrid') {
      this.layoutWindowGrid();
    } else {
      this.layoutSharedStage();
    }
  }

  layoutWindowGrid() {
    const { cols, gap, margin } = this.windowGrid;
    const cellW = Math.floor((this.width - margin * 2 - gap * (cols - 1)) / cols);
    const rows = Math.max(1, Math.ceil(this.dancers.length / cols));
    const cellH = Math.floor((this.height - margin * 2 - gap * (rows - 1)) / rows);

    this.windowGrid.rows = rows;

    this.dancers.forEach((d, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      d.layout = {
        x: margin + col * (cellW + gap),
        y: margin + row * (cellH + gap),
        w: cellW,
        h: cellH,
        floorY: margin + row * (cellH + gap) + Math.floor(cellH * 0.88)
      };
      d.depth = row / Math.max(1, rows - 1);
    });
  }

  layoutSharedStage() {
    const count = Math.max(1, this.dancers.length);
    const spread = this.width * 0.8;
    const startX = (this.width - spread) / 2;

    this.dancers.forEach((d, i) => {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = startX + spread * t;
      const depth = Math.abs(t - 0.5) * 2;
      const scale = lerp(this.sharedStage.crowdScaleMax, this.sharedStage.crowdScaleMin, depth * 0.85);
      const yOffset = lerp(0, -70, depth);

      d.layout = {
        x,
        y: this.floorY + yOffset,
        w: 180 * scale,
        h: 220 * scale,
        floorY: this.floorY + yOffset
      };
      d.depth = depth;
      d.scale = scale;
    });

    this.dancers.sort((a, b) => a.depth - b.depth);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastFrameTime = this.startTime;
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.isRunning = false;
  }

  tick = (now) => {
    if (!this.isRunning) return;

    const deltaMs = now - this.lastFrameTime;
    this.lastFrameTime = now;
    this.time = (now - this.startTime) / 1000;

    this.updateTransport();
    this.consumeEvents();
    this.updateGlobalFX(deltaMs / 1000);
    this.updateDancers(deltaMs / 1000);

    if (this.frameHooks.length) {
      const ctx = { now, deltaMs, scene: this };
      for (let i = 0; i < this.frameHooks.length; i++) {
        try {
          this.frameHooks[i](ctx);
        } catch (e) {
          console.error('frameHook error:', e);
        }
      }
    }

    this.render();

    requestAnimationFrame(this.tick);
  };

  updateTransport() {
    const spb = this.transport.secondsPerBeat;
    const rawBeat = this.time / spb;
    const beatIndex = Math.floor(rawBeat);
    const phase = rawBeat - beatIndex;

    this.transport.phase = phase;
    this.transport.beat = beatIndex;
    this.transport.bar = Math.floor(beatIndex / this.beatsPerBar);

    if (beatIndex !== this.transport.lastBeatIndex) {
      const beatInBar = beatIndex % this.beatsPerBar;
      this.handleBeat(beatIndex, beatInBar);
      this.transport.lastBeatIndex = beatIndex;
    }
  }

  handleBeat(beatIndex, beatInBar) {
    const isKickAnchor = beatInBar === 0 || beatInBar === 2;
    this.globalEnergy = isKickAnchor ? 1 : 0.72;
    this.flash += isKickAnchor ? 0.8 : 0.35;
    this.cameraPulse += isKickAnchor ? 1 : 0.4;

    if (beatInBar === 0 && this.onBar) this.onBar({ bar: this.transport.bar, beat: beatIndex });
    if (this.onBeat) this.onBeat({ beat: beatIndex, beatInBar, bar: this.transport.bar });

    for (const d of this.dancers) {
      d.reactToBeat(beatIndex, beatInBar, this);
    }
  }

  consumeEvents() {
    for (const event of this.events) {
      if (event.consumed) continue;
      if (this.time >= event.time) {
        event.consumed = true;
        if (event.type === 'blackout') this.blackout = Math.max(this.blackout, event.amount);
        if (event.type === 'drop') this.dropAmount = Math.max(this.dropAmount, event.amount);
        if (event.type === 'flash') this.flash += event.amount;
      }
    }
  }

  updateGlobalFX(dt) {
    this.globalEnergy = Math.max(0, this.globalEnergy - dt * 1.65);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.cameraPulse = Math.max(0, this.cameraPulse - dt * 2.2);
    this.dropAmount = Math.max(0, this.dropAmount - dt * 0.7);
    this.blackout = Math.max(0, this.blackout - dt * 2.5);
    this.masterHueShift += dt * 5;
  }

  updateDancers(dt) {
    const leader = this.dancers.find(d => d.id === this.leaderId) || null;

    for (const d of this.dancers) {
      const neighbors = this.getNeighbors(d, 2);
      d.update(dt, {
        scene: this,
        leader,
        neighbors
      });
    }
  }

  getNeighbors(dancer, count = 2) {
    const others = this.dancers.filter(d => d !== dancer);
    return others
      .map(d => ({ d, dist: Math.abs((d.layout?.x || 0) - (dancer.layout?.x || 0)) + Math.abs((d.layout?.y || 0) - (dancer.layout?.y || 0)) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, count)
      .map(item => item.d);
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.renderBackground();

    if (this.mode === 'windowGrid') {
      this.renderWindowGrid();
    } else {
      this.renderSharedStage();
    }

    if (this.blackout > 0) {
      this.ctx.save();
      this.ctx.globalAlpha = clamp(this.blackout, 0, 1);
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.width, this.height);
      this.ctx.restore();
    }

    if (this.debug) this.renderDebug();
  }

  renderBackground() {
    const { ctx } = this;
    const g = ctx.createLinearGradient(0, 0, 0, this.height);
    g.addColorStop(0, this.scenePalette.bgTop);
    g.addColorStop(1, this.scenePalette.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.backgroundMode === 'club') this.renderClubWash();
    if (this.backgroundMode === 'windows') this.renderWindowWallBackground();
    if (this.backgroundMode === 'bar') this.renderBarBackground();
  }

  renderClubWash() {
    const { ctx } = this;
    const pulse = this.globalEnergy * 0.25 + this.flash * 0.08;
    for (let i = 0; i < 3; i++) {
      const x = this.width * (0.2 + i * 0.3);
      const y = this.height * (0.18 + (i % 2) * 0.12);
      const r = 180 + Math.sin(this.time * 1.2 + i) * 30 + pulse * 150;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255,255,255,${0.05 + pulse * 0.25})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, this.floorY, this.width, 2);
    ctx.restore();
  }

  renderWindowWallBackground() {
    const { ctx } = this;
    const cols = 6;
    const rows = 4;
    const pad = 18;
    const gap = 12;
    const ww = (this.width - pad * 2 - gap * (cols - 1)) / cols;
    const wh = (this.height - pad * 2 - gap * (rows - 1)) / rows;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = pad + c * (ww + gap);
        const y = pad + r * (wh + gap);
        const flicker = 0.03 + Math.max(0, Math.sin(this.time * 2.2 + r * 0.7 + c * 0.33)) * 0.02 + this.flash * 0.03;
        ctx.fillStyle = `rgba(255,255,255,${flicker})`;
        roundRect(ctx, x, y, ww, wh, 10, true, true);
      }
    }
    ctx.restore();
  }

  renderBarBackground() {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(this.width * 0.08, this.height * 0.58, this.width * 0.84, this.height * 0.06);
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(this.width * 0.12, this.height * 0.34, this.width * 0.7, this.height * 0.18);
    ctx.restore();
  }

  renderWindowGrid() {
    for (const d of this.dancers) {
      this.renderWindowCell(d);
    }
  }

  renderWindowCell(dancer) {
    const { ctx } = this;
    const { x, y, w, h, floorY } = dancer.layout;
    const flickerHit = Math.random() < this.windowGrid.flickerChance * (1 + this.flash * 0.5);

    ctx.save();

    ctx.fillStyle = `rgba(255,255,255,${0.03 + this.globalEnergy * 0.04})`;
    roundRect(ctx, x, y, w, h, this.windowGrid.borderRadius, true, false);

    ctx.strokeStyle = flickerHit
      ? `rgba(255,255,255,${0.35 + this.flash * 0.2})`
      : this.scenePalette.frame;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x, y, w, h, this.windowGrid.borderRadius, false, true);

    ctx.fillStyle = this.scenePalette.frameGlow;
    roundRect(ctx, x + 3, y + 3, w - 6, h - 6, this.windowGrid.borderRadius - 2, true, false);

    ctx.beginPath();
    ctx.moveTo(x + 10, floorY);
    ctx.lineTo(x + w - 10, floorY);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.stroke();

    this.renderShadow(dancer, dancer.layout.x + dancer.layout.w / 2, floorY + 2, dancer.layout.w * 0.30, 14);

    this.renderDancerInBox(dancer);

    if (dancer.role === 'lead') {
      ctx.strokeStyle = `rgba(255,255,255,${0.20 + this.flash * 0.15})`;
      ctx.lineWidth = 2;
      roundRect(ctx, x - 2, y - 2, w + 4, h + 4, this.windowGrid.borderRadius + 2, false, true);
    }

    ctx.restore();
  }

  renderSharedStage() {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, this.floorY, this.width, 2);
    ctx.restore();

    for (const d of this.dancers) {
      const cx = d.layout.x;
      const cy = d.layout.floorY;
      this.renderShadow(d, cx, cy + 3, d.layout.w * 0.22, 12 * d.scale);
    }

    for (const d of this.dancers) {
      this.renderDancerOnStage(d);
    }
  }

  renderShadow(dancer, x, y, rx, ry) {
    const { ctx } = this;
    const alpha = 0.18 + dancer.motionAmount * 0.12;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.scenePalette.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderDancerInBox(dancer) {
    const { x, y, w, h, floorY } = dancer.layout;
    const anchorX = x + w / 2 + dancer.screenShakeX;
    const anchorY = floorY + dancer.screenShakeY;
    this.drawDancerSprite(dancer, anchorX, anchorY, Math.min(w, h) * 0.72, 'box');
  }

  renderDancerOnStage(dancer) {
    const anchorX = dancer.layout.x + dancer.screenShakeX;
    const anchorY = dancer.layout.floorY + dancer.screenShakeY;
    this.drawDancerSprite(dancer, anchorX, anchorY, dancer.layout.h, 'stage');
  }

  drawDancerSprite(dancer, anchorX, anchorY, maxSize, spaceMode) {
    const { ctx } = this;
    const pose = dancer.getCurrentPose();

    ctx.save();

    const bounce = dancer.bounce;
    const lean = dancer.lean;
    const scale = (dancer.scale || 1) * (1 + dancer.motionAmount * 0.04 + dancer.accentScale);
    const y = anchorY - bounce * maxSize * 0.08;

    ctx.translate(anchorX, y);
    ctx.rotate(lean);
    ctx.scale(scale, scale);

    const opacity = dancer.role === 'ambient' ? 0.75 : 1;
    ctx.globalAlpha = opacity;

    if (pose && typeof dancer.spriteSet.drawPose === 'function') {
      dancer.spriteSet.drawPose(ctx, pose, {
        x: 0,
        y: 0,
        size: maxSize,
        anchor: 'bottom-center',
        variant: spaceMode,
        mirror: dancer.mirror,
        microOffsetX: dancer.microOffsetX,
        microOffsetY: dancer.microOffsetY
      });
    } else {
      // Fallback placeholder silhouette
      drawFallbackSilhouette(ctx, maxSize, dancer);
    }

    if (dancer.signatureFlash > 0) {
      ctx.globalAlpha = dancer.signatureFlash * 0.35;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -maxSize * 0.55, maxSize * 0.22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  renderDebug() {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`mode: ${this.mode}`, 14, 18);
    ctx.fillText(`beat: ${this.transport.beat}`, 14, 34);
    ctx.fillText(`bar: ${this.transport.bar}`, 14, 50);
    ctx.fillText(`dancers: ${this.dancers.length}`, 14, 66);
    ctx.restore();
  }
}

function createDancer(config, scene) {
  const archetype = archetypes[config.archetype] || archetypes.generic;
  const syncBias = config.syncBias ?? archetype.syncBias;
  const energyGain = config.energyGain ?? archetype.energyGain;
  const motionSmoothness = config.motionSmoothness ?? archetype.motionSmoothness;
  const signatureInterval = config.signatureInterval ?? archetype.signatureInterval;

  return {
    id: config.id,
    spriteSet: config.spriteSet || {},
    role: config.role || 'crowd',
    archetype: config.archetype || 'generic',
    paletteTag: config.paletteTag || null,
    poseIndex: 0,
    poseDirection: 1,
    poseTimer: 0,
    poseHold: 0,
    bounce: 0,
    lean: 0,
    accentScale: 0,
    motionAmount: 0,
    screenShakeX: 0,
    screenShakeY: 0,
    microOffsetX: 0,
    microOffsetY: 0,
    signatureFlash: 0,
    signatureCounter: 0,
    lastBeatSeen: -1,
    syncBias,
    energyGain,
    motionSmoothness,
    signatureInterval,
    influenceWeight: config.influenceWeight ?? 0.4,
    independence: config.independence ?? 0.45,
    followDelayBeats: config.followDelayBeats ?? archetype.followDelayBeats,
    beatStride: config.beatStride ?? archetype.beatStride,
    mirror: !!config.mirror,
    isLeader: false,
    depth: 0,
    scale: 1,
    layout: null,

    reactToBeat(beatIndex, beatInBar, scene) {
      this.lastBeatSeen = beatIndex;
      this.motionAmount = clamp(this.motionAmount + this.energyGain * (beatInBar === 0 ? 0.75 : 0.45), 0, 1.4);
      this.accentScale += beatInBar === 0 ? 0.08 : 0.03;

      const wantsSignature = this.signatureCounter % this.signatureInterval === 0;
      if (wantsSignature && this.role !== 'idle') {
        this.signatureFlash = 1;
        this.poseDirection *= Math.random() > 0.5 ? 1 : -1;
      }
      this.signatureCounter++;

      const step = this.beatStride + (beatInBar === 0 ? 1 : 0);
      if (this.role === 'lead') {
        this.advancePose(step);
      } else if (this.role === 'follow') {
        if (beatInBar === 0 || Math.random() < this.syncBias) this.advancePose(step);
      } else if (this.role === 'ambient') {
        if (Math.random() < 0.5) this.advancePose(1);
      } else if (this.role === 'idle') {
        if (Math.random() < 0.2) this.advancePose(1);
      } else {
        if (Math.random() < 0.75) this.advancePose(step);
      }
    },

    update(dt, context) {
      const { leader, neighbors, scene } = context;

      const leaderInfluence = leader && leader !== this ? leader.poseIndex : null;
      const neighborPose = neighbors.length ? average(neighbors.map(n => n.poseIndex)) : this.poseIndex;
      const targetPose = resolveTargetPose(this, leaderInfluence, neighborPose);
      this.poseIndex = dampPose(this.poseIndex, targetPose, dt, 8 * (1 - this.motionSmoothness) + 2);

      const transportPhase = scene.transport.phase;
      const pulseWave = Math.sin(transportPhase * Math.PI * 2);
      const personality = archetypes[this.archetype] || archetypes.generic;

      this.bounce = lerp(this.bounce, pulseWave * personality.bounceAmount * this.motionAmount, dt * 10);
      this.lean = lerp(this.lean, Math.sin(scene.time * personality.leanSpeed + this.depth * 3) * personality.leanAmount, dt * 8);

      if (this.role === 'follow' && leader && leader !== this) {
        this.lean += leader.lean * 0.2;
      }

      this.screenShakeX = (Math.random() - 0.5) * this.motionAmount * personality.shakeX;
      this.screenShakeY = (Math.random() - 0.5) * this.motionAmount * personality.shakeY;

      this.microOffsetX = Math.sin(scene.time * personality.microFreqX + this.depth) * personality.microAmpX;
      this.microOffsetY = Math.cos(scene.time * personality.microFreqY + this.depth) * personality.microAmpY;

      this.motionAmount = Math.max(0, this.motionAmount - dt * (0.8 + this.independence * 0.3));
      this.accentScale = Math.max(0, this.accentScale - dt * 0.7);
      this.signatureFlash = Math.max(0, this.signatureFlash - dt * 2.4);
    },

    advancePose(step = 1) {
      const count = this.spriteSet.poseCount || this.spriteSet.poses?.length || 8;
      this.poseIndex += this.poseDirection * step;
      while (this.poseIndex < 0) this.poseIndex += count;
      while (this.poseIndex >= count) this.poseIndex -= count;
    },

    getCurrentPose() {
      const count = this.spriteSet.poseCount || this.spriteSet.poses?.length || 0;
      if (!count) return null;
      const idx = ((Math.round(this.poseIndex) % count) + count) % count;
      return this.spriteSet.poses ? this.spriteSet.poses[idx] : idx;
    }
  };
}

const archetypes = {
  generic: {
    syncBias: 0.72,
    energyGain: 0.65,
    motionSmoothness: 0.42,
    signatureInterval: 8,
    followDelayBeats: 1,
    beatStride: 1,
    bounceAmount: 0.35,
    leanAmount: 0.06,
    leanSpeed: 4.2,
    shakeX: 0.9,
    shakeY: 0.5,
    microFreqX: 2.4,
    microFreqY: 1.8,
    microAmpX: 0.8,
    microAmpY: 0.6
  },
  punkIgnition: {
    syncBias: 0.86,
    energyGain: 0.92,
    motionSmoothness: 0.18,
    signatureInterval: 4,
    followDelayBeats: 0,
    beatStride: 2,
    bounceAmount: 0.7,
    leanAmount: 0.12,
    leanSpeed: 7.5,
    shakeX: 2.2,
    shakeY: 1.6,
    microFreqX: 7.8,
    microFreqY: 5.2,
    microAmpX: 1.1,
    microAmpY: 0.9
  },
  serpentGroover: {
    syncBias: 0.44,
    energyGain: 0.52,
    motionSmoothness: 0.76,
    signatureInterval: 12,
    followDelayBeats: 2,
    beatStride: 1,
    bounceAmount: 0.16,
    leanAmount: 0.13,
    leanSpeed: 2.6,
    shakeX: 0.4,
    shakeY: 0.25,
    microFreqX: 1.4,
    microFreqY: 1.2,
    microAmpX: 1.8,
    microAmpY: 1.1
  },
  mechanicalBreaker: {
    syncBias: 0.91,
    energyGain: 0.84,
    motionSmoothness: 0.1,
    signatureInterval: 6,
    followDelayBeats: 0,
    beatStride: 1,
    bounceAmount: 0.22,
    leanAmount: 0.03,
    leanSpeed: 8.6,
    shakeX: 1.6,
    shakeY: 1.0,
    microFreqX: 10.5,
    microFreqY: 8.3,
    microAmpX: 0.5,
    microAmpY: 0.4
  },
  expressiveStoryteller: {
    syncBias: 0.63,
    energyGain: 0.58,
    motionSmoothness: 0.54,
    signatureInterval: 5,
    followDelayBeats: 1,
    beatStride: 1,
    bounceAmount: 0.3,
    leanAmount: 0.1,
    leanSpeed: 3.6,
    shakeX: 0.7,
    shakeY: 0.5,
    microFreqX: 2.8,
    microFreqY: 2.2,
    microAmpX: 1.4,
    microAmpY: 1.2
  },
  minimalGlitchEntity: {
    syncBias: 0.22,
    energyGain: 0.36,
    motionSmoothness: 0.88,
    signatureInterval: 16,
    followDelayBeats: 3,
    beatStride: 1,
    bounceAmount: 0.08,
    leanAmount: 0.02,
    leanSpeed: 1.6,
    shakeX: 0.15,
    shakeY: 0.12,
    microFreqX: 0.8,
    microFreqY: 0.6,
    microAmpX: 0.4,
    microAmpY: 0.3
  },
  rubberHoseChaosGirl: {
    syncBias: 0.74,
    energyGain: 0.88,
    motionSmoothness: 0.28,
    signatureInterval: 3,
    followDelayBeats: 0,
    beatStride: 2,
    bounceAmount: 0.82,
    leanAmount: 0.18,
    leanSpeed: 9.4,
    shakeX: 1.8,
    shakeY: 1.4,
    microFreqX: 6.5,
    microFreqY: 5.8,
    microAmpX: 1.6,
    microAmpY: 1.2
  }
};

function resolveTargetPose(dancer, leaderPose, neighborPose) {
  const selfWeight = dancer.independence;
  const neighborWeight = dancer.influenceWeight;
  const leaderWeight = dancer.role === 'follow' ? 0.7 : dancer.role === 'crowd' ? 0.25 : 0.1;

  const leaderComponent = leaderPose == null ? dancer.poseIndex : leaderPose;

  return (
    dancer.poseIndex * selfWeight +
    neighborPose * neighborWeight +
    leaderComponent * leaderWeight
  ) / (selfWeight + neighborWeight + leaderWeight);
}

function dampPose(current, target, dt, speed) {
  const alpha = 1 - Math.exp(-speed * dt);
  return current + (target - current) * alpha;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

function drawFallbackSilhouette(ctx, size, dancer) {
  const bodyH = size * 0.62;
  const bodyW = size * 0.20;
  const headR = size * 0.10;
  const armSwing = Math.sin(dancer.poseIndex * 0.8) * size * 0.12;
  const legSwing = Math.cos(dancer.poseIndex * 0.8) * size * 0.08;

  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(2, size * 0.02);
  ctx.lineCap = 'round';

  // Head
  ctx.beginPath();
  ctx.arc(0, -bodyH - headR * 1.6, headR, 0, Math.PI * 2);
  ctx.stroke();

  // Torso
  ctx.beginPath();
  ctx.moveTo(0, -bodyH);
  ctx.lineTo(0, -size * 0.18);
  ctx.stroke();

  // Arms
  ctx.beginPath();
  ctx.moveTo(0, -bodyH * 0.72);
  ctx.lineTo(-bodyW - armSwing, -bodyH * 0.42);
  ctx.moveTo(0, -bodyH * 0.72);
  ctx.lineTo(bodyW + armSwing, -bodyH * 0.38);
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.18);
  ctx.lineTo(-bodyW * 0.7 - legSwing, 0);
  ctx.moveTo(0, -size * 0.18);
  ctx.lineTo(bodyW * 0.7 + legSwing, 0);
  ctx.stroke();
}

// Optional helper for building pose sets from 5x4 sheet metadata.
export function createPoseSheetSet({ image, columns = 5, rows = 4, poseCount = 20, padding = 0 }) {
  const poses = Array.from({ length: poseCount }, (_, i) => i);

  return {
    image,
    columns,
    rows,
    poseCount,
    poses,
    drawPose(ctx, poseIndex, options = {}) {
      const col = poseIndex % columns;
      const row = Math.floor(poseIndex / columns);
      const sw = image.width / columns;
      const sh = image.height / rows;
      const sx = col * sw + padding;
      const sy = row * sh + padding;
      const dw = options.size * 0.58;
      const dh = options.size;
      const dx = options.x - dw / 2 + (options.microOffsetX || 0);
      const dy = options.y - dh + (options.microOffsetY || 0);

      ctx.save();
      if (options.mirror) {
        ctx.translate(options.x * 2, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(image, sx, sy, sw - padding * 2, sh - padding * 2, dx, dy, dw, dh);
      ctx.restore();
    }
  };
}

// Example scene presets.
export const scenePresets = {
  dnbWall({ canvas, bpm = 174 }) {
    return new DancerSceneEngine({
      canvas,
      bpm,
      mode: 'windowGrid',
      backgroundMode: 'windows',
      gridCols: 4,
      gridGap: 12
    });
  },
  warehouseStage({ canvas, bpm = 168 }) {
    return new DancerSceneEngine({
      canvas,
      bpm,
      mode: 'sharedStage',
      backgroundMode: 'club',
      floorY: Math.round(canvas.height * 0.84)
    });
  },
  smokyBar({ canvas, bpm = 96 }) {
    return new DancerSceneEngine({
      canvas,
      bpm,
      mode: 'sharedStage',
      backgroundMode: 'bar',
      floorY: Math.round(canvas.height * 0.86)
    });
  }
};

// Example integration:
//
// import { scenePresets, createPoseSheetSet } from './dancer-scene-engine.js';
//
// const canvas = document.querySelector('canvas');
// const scene = scenePresets.dnbWall({ canvas, bpm: 174 });
//
// const img = new Image();
// img.onload = () => {
//   const setA = createPoseSheetSet({ image: img, columns: 5, rows: 4, poseCount: 20 });
//   scene.addDancer({ id: 'd1', spriteSet: setA, archetype: 'punkIgnition', role: 'lead' });
//   scene.addDancer({ id: 'd2', spriteSet: setA, archetype: 'serpentGroover', role: 'follow', mirror: true });
//   scene.addDancer({ id: 'd3', spriteSet: setA, archetype: 'minimalGlitchEntity', role: 'ambient' });
//   scene.addDancer({ id: 'd4', spriteSet: setA, archetype: 'mechanicalBreaker', role: 'crowd' });
//   scene.start();
// };
// img.src = './poses/character-sheet.png';
//
// Upgrade path from here:
//   1. Add audio-reactive band analysis instead of BPM-only transport
//   2. Add pose tags (kick, snare, idle, transition, accent)
//   3. Add seated / smoking / talking behavior packs for bar scenes
//   4. Add scene automation timeline JSON
//   5. Add WebM recorder and project save/load
