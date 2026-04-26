// Pose Tagging System v1
// Purpose:
// Add semantic tags and selection logic to pose sheets so dancers can pick
// more appropriate poses for kicks, snares, hats, idles, accents, loops, and transitions.
//
// This is the layer that turns "frame swapping" into intentional movement logic.
//
// Works with:
//   - dancer-scene-engine.js
//   - audio-reactive-bridge.js
//   - scene-timeline-system.js
//
// Core idea:
//   each pose gets metadata
//   selectors choose poses based on event + role + archetype + recent history
//
// Example tags:
//   kick, snare, hat, idle, accent, transition, sustain, jump, leanLeft, leanRight,
//   handsUp, crouch, stretch, spin, loopStart, loopMid, loopEnd, talk, smoke, sit
//
// Main usage:
//   const taggedSet = createTaggedPoseSet({
//     baseSet,
//     poses: [ ... metadata ... ]
//   });
//
//   const selector = new PoseSelector({ taggedSet, archetype: 'punkIgnition' });
//   const nextPose = selector.selectForEvent({ eventType: 'kick', role: 'lead' });

export function createTaggedPoseSet({ baseSet, poses = [], defaultTags = [] }) {
  const poseCount = baseSet.poseCount || baseSet.poses?.length || poses.length || 0;

  const normalizedPoses = Array.from({ length: poseCount }, (_, i) => {
    const provided = poses[i] || {};
    return normalizePoseMeta({
      index: i,
      tags: provided.tags || defaultTags,
      weight: provided.weight ?? 1,
      energy: provided.energy ?? 0.5,
      direction: provided.direction || 'center',
      phase: provided.phase || inferPhaseFromTags(provided.tags || defaultTags),
      notes: provided.notes || '',
      linksTo: provided.linksTo || [],
      disallowAfter: provided.disallowAfter || [],
      allowRoles: provided.allowRoles || ['lead', 'follow', 'crowd', 'ambient', 'idle'],
      allowArchetypes: provided.allowArchetypes || null,
      cooldown: provided.cooldown ?? 0,
      holdBeats: provided.holdBeats ?? 0,
      mirrorFriendly: provided.mirrorFriendly ?? true,
      sceneTags: provided.sceneTags || [],
      sectionTags: provided.sectionTags || [],
      eventBoosts: provided.eventBoosts || {},
      group: provided.group || null,
      variantOf: provided.variantOf || null
    });
  });

  return {
    ...baseSet,
    meta: normalizedPoses,
    getMeta(index) {
      const count = normalizedPoses.length;
      const safe = ((Math.round(index) % count) + count) % count;
      return normalizedPoses[safe];
    },
    getByTag(tag) {
      return normalizedPoses.filter(p => p.tags.has(tag));
    },
    getByTags(tags = []) {
      const tagList = Array.isArray(tags) ? tags : [tags];
      return normalizedPoses.filter(p => tagList.every(tag => p.tags.has(tag)));
    }
  };
}

export class PoseSelector {
  constructor(options = {}) {
    this.taggedSet = options.taggedSet;
    this.archetype = options.archetype || 'generic';
    this.role = options.role || 'crowd';
    this.sceneTag = options.sceneTag || null;
    this.historySize = options.historySize || 8;
    this.cooldowns = new Map();
    this.history = [];
    this.lastPoseIndex = 0;
    this.lastEventType = 'idle';
    this.loopMemory = {
      group: null,
      phase: null
    };
  }

  tick(dt) {
    for (const [index, value] of this.cooldowns.entries()) {
      const next = Math.max(0, value - dt);
      if (next <= 0) this.cooldowns.delete(index);
      else this.cooldowns.set(index, next);
    }
  }

  setRole(role) {
    this.role = role;
  }

  setArchetype(archetype) {
    this.archetype = archetype;
  }

  setSceneTag(sceneTag) {
    this.sceneTag = sceneTag;
  }

  noteSelected(index, meta, eventType = 'idle') {
    this.lastPoseIndex = index;
    this.lastEventType = eventType;
    this.history.push(index);
    if (this.history.length > this.historySize) this.history.shift();

    if (meta.cooldown > 0) this.cooldowns.set(index, meta.cooldown);
    if (meta.group) this.loopMemory.group = meta.group;
    if (meta.phase) this.loopMemory.phase = meta.phase;
  }

  selectForEvent(context = {}) {
    const eventType = context.eventType || 'idle';
    const desiredTags = buildDesiredTags({
      eventType,
      role: context.role || this.role,
      archetype: context.archetype || this.archetype,
      sceneTag: context.sceneTag || this.sceneTag,
      sectionTag: context.sectionTag || null,
      motionLevel: context.motionLevel ?? 0.5,
      bassPressure: context.bassPressure ?? 0,
      transient: context.transient ?? 0,
      brightness: context.brightness ?? 0
    });

    const candidates = this.scoreCandidates({
      desiredTags,
      eventType,
      role: context.role || this.role,
      archetype: context.archetype || this.archetype,
      sceneTag: context.sceneTag || this.sceneTag,
      sectionTag: context.sectionTag || null,
      currentIndex: context.currentIndex ?? this.lastPoseIndex,
      allowMirror: context.allowMirror ?? true
    });

    const chosen = weightedPick(candidates);
    if (!chosen) {
      const fallbackMeta = this.taggedSet.getMeta(this.lastPoseIndex);
      return { index: this.lastPoseIndex, meta: fallbackMeta, score: 0 };
    }

    this.noteSelected(chosen.index, chosen.meta, eventType);
    return chosen;
  }

  scoreCandidates(context) {
    const { desiredTags, eventType, role, archetype, sceneTag, sectionTag, currentIndex, allowMirror } = context;
    const results = [];

    for (const meta of this.taggedSet.meta) {
      let score = meta.weight;

      // Role / archetype / scene filters
      if (!meta.allowRoles.includes(role)) continue;
      if (meta.allowArchetypes && !meta.allowArchetypes.includes(archetype)) continue;
      if (meta.sceneTags.length && sceneTag && !meta.sceneTags.includes(sceneTag)) continue;
      if (meta.sectionTags.length && sectionTag && !meta.sectionTags.includes(sectionTag)) continue;
      if (!allowMirror && !meta.mirrorFriendly) continue;

      // Cooldown / repetition avoidance
      const cooldown = this.cooldowns.get(meta.index) || 0;
      if (cooldown > 0) score *= 0.05;
      if (this.history.includes(meta.index)) score *= 0.55;
      if (meta.index === currentIndex) score *= eventType === 'sustain' ? 1.1 : 0.25;

      // Tag matching
      for (const tag of desiredTags.must) {
        if (!meta.tags.has(tag)) {
          score *= 0.08;
        } else {
          score *= 2.2;
        }
      }

      for (const tag of desiredTags.prefer) {
        if (meta.tags.has(tag)) score *= 1.45;
      }

      for (const tag of desiredTags.avoid) {
        if (meta.tags.has(tag)) score *= 0.32;
      }

      // Explicit event boosts from metadata
      if (meta.eventBoosts[eventType]) {
        score *= meta.eventBoosts[eventType];
      }

      // Transition friendliness
      if (meta.linksTo.includes(currentIndex)) score *= 1.35;
      const currentMeta = this.taggedSet.getMeta(currentIndex);
      if (currentMeta && currentMeta.linksTo.includes(meta.index)) score *= 1.55;
      if (meta.disallowAfter.includes(currentIndex)) score *= 0.05;

      // Loop continuity
      if (this.loopMemory.group && meta.group === this.loopMemory.group) score *= 1.16;
      if (this.loopMemory.phase && isGoodPhaseProgression(this.loopMemory.phase, meta.phase)) score *= 1.24;

      // Directional smoothing
      if (currentMeta?.direction === meta.direction) score *= 1.08;
      if (currentMeta?.direction === 'left' && meta.direction === 'right') score *= 1.12;
      if (currentMeta?.direction === 'right' && meta.direction === 'left') score *= 1.12;

      // Event semantics
      score *= scoreEventSemantics(meta, eventType, role, archetype);

      if (score > 0.01) {
        results.push({ index: meta.index, meta, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 18);
  }
}

export function attachPoseSelectorToDancer(dancer, options = {}) {
  if (!dancer.spriteSet?.meta) {
    throw new Error('attachPoseSelectorToDancer requires a tagged pose set (spriteSet.meta missing).');
  }

  dancer.poseSelector = new PoseSelector({
    taggedSet: dancer.spriteSet,
    archetype: dancer.archetype || options.archetype || 'generic',
    role: dancer.role || options.role || 'crowd',
    sceneTag: options.sceneTag || null,
    historySize: options.historySize || 8
  });

  const originalUpdate = dancer.update?.bind(dancer);
  const originalReactToBeat = dancer.reactToBeat?.bind(dancer);

  dancer.selectPoseForEvent = function selectPoseForEvent(eventContext = {}) {
    if (!this.poseSelector) return null;

    this.poseSelector.setRole(this.role);
    this.poseSelector.setArchetype(this.archetype);

    const chosen = this.poseSelector.selectForEvent({
      currentIndex: Math.round(this.poseIndex || 0),
      role: this.role,
      archetype: this.archetype,
      sceneTag: eventContext.sceneTag || null,
      sectionTag: eventContext.sectionTag || null,
      eventType: eventContext.eventType || 'idle',
      motionLevel: eventContext.motionLevel ?? this.motionAmount ?? 0.4,
      bassPressure: eventContext.bassPressure ?? 0,
      transient: eventContext.transient ?? 0,
      brightness: eventContext.brightness ?? 0,
      allowMirror: !this.mirror || true
    });

    if (chosen) {
      this.poseIndex = chosen.index;
      const meta = chosen.meta;
      this.poseHold = meta.holdBeats || 0;
      this.currentPoseMeta = meta;
    }

    return chosen;
  };

  dancer.reactToTaggedEvent = function reactToTaggedEvent(eventContext = {}) {
    const chosen = this.selectPoseForEvent(eventContext);
    if (!chosen) return;

    // Small motion modifiers based on tag semantics
    if (chosen.meta.tags.has('jump')) this.bounce += 0.08;
    if (chosen.meta.tags.has('accent')) this.accentScale += 0.06;
    if (chosen.meta.tags.has('leanLeft')) this.lean -= 0.03;
    if (chosen.meta.tags.has('leanRight')) this.lean += 0.03;
    if (chosen.meta.tags.has('crouch')) this.screenShakeY += 0.3;
  };

  dancer.update = function patchedUpdate(dt, context) {
    this.poseSelector?.tick(dt);
    if (originalUpdate) originalUpdate(dt, context);
  };

  dancer.reactToBeat = function patchedReactToBeat(beatIndex, beatInBar, scene) {
    if (originalReactToBeat) originalReactToBeat(beatIndex, beatInBar, scene);

    const eventType = beatInBar === 0 ? 'kick' : beatInBar === 1 || beatInBar === 3 ? 'snare' : 'hat';
    this.reactToTaggedEvent({
      eventType,
      sceneTag: scene.mode === 'windowGrid' ? 'windows' : 'stage',
      motionLevel: this.motionAmount,
      bassPressure: scene.dropAmount || 0,
      transient: scene.flash || 0,
      brightness: scene.globalEnergy || 0
    });
  };

  return dancer;
}

export function makeAudioPoseEventRouter(bridge, scene, options = {}) {
  const state = {
    lastKick: 0,
    lastSnare: 0,
    lastHat: 0,
    lastDrop: 0,
    kickThreshold: options.kickThreshold ?? 0.22,
    snareThreshold: options.snareThreshold ?? 0.22,
    hatThreshold: options.hatThreshold ?? 0.18,
    dropThreshold: options.dropThreshold ?? 0.58
  };

  return function routePoseEvents() {
    const snapshot = bridge.getSnapshot();
    const t = snapshot.time;
    const { signal, metrics } = snapshot;
    const sceneTag = scene.mode === 'windowGrid' ? 'windows' : scene.backgroundMode === 'bar' ? 'bar' : 'stage';

    if (signal.kickPulse > state.kickThreshold && t !== state.lastKick) {
      state.lastKick = t;
      broadcastPoseEvent(scene, {
        eventType: 'kick',
        sceneTag,
        motionLevel: metrics.motionDrive,
        bassPressure: metrics.bassPressure,
        transient: metrics.transient,
        brightness: metrics.brightness
      });
    }

    if (signal.snarePulse > state.snareThreshold && t !== state.lastSnare) {
      state.lastSnare = t;
      broadcastPoseEvent(scene, {
        eventType: 'snare',
        sceneTag,
        motionLevel: metrics.motionDrive,
        bassPressure: metrics.bassPressure,
        transient: metrics.transient,
        brightness: metrics.brightness
      });
    }

    if (signal.hatPulse > state.hatThreshold && t !== state.lastHat) {
      state.lastHat = t;
      broadcastPoseEvent(scene, {
        eventType: 'hat',
        sceneTag,
        motionLevel: metrics.motionDrive,
        bassPressure: metrics.bassPressure,
        transient: metrics.transient,
        brightness: metrics.brightness
      });
    }

    if (signal.dropPulse > state.dropThreshold && t !== state.lastDrop) {
      state.lastDrop = t;
      broadcastPoseEvent(scene, {
        eventType: 'accent',
        sceneTag,
        motionLevel: 1,
        bassPressure: metrics.bassPressure,
        transient: 1,
        brightness: metrics.brightness
      });
    }
  };
}

export function broadcastPoseEvent(scene, eventContext = {}) {
  for (const dancer of scene.dancers || []) {
    if (typeof dancer.reactToTaggedEvent === 'function') {
      dancer.reactToTaggedEvent(eventContext);
    }
  }
}

export function createDefault20PoseMap(archetype = 'generic') {
  // Default map for 5x4 = 20 poses.
  // This is a strong starting scaffold, not a prison.
  const map = [
    { tags: ['idle', 'loopStart', 'center', 'sustain'], phase: 'start', energy: 0.2, direction: 'center', group: 'main' },
    { tags: ['kick', 'accent', 'leanLeft'], phase: 'hit', energy: 0.8, direction: 'left', group: 'main' },
    { tags: ['transition', 'left'], phase: 'travel', energy: 0.55, direction: 'left', group: 'main' },
    { tags: ['snare', 'handsUp', 'accent'], phase: 'hit', energy: 0.7, direction: 'center', group: 'main' },
    { tags: ['hat', 'micro', 'right'], phase: 'micro', energy: 0.35, direction: 'right', group: 'main' },

    { tags: ['kick', 'jump', 'accent'], phase: 'hit', energy: 0.95, direction: 'center', group: 'main' },
    { tags: ['transition', 'leanRight'], phase: 'travel', energy: 0.55, direction: 'right', group: 'main' },
    { tags: ['snare', 'twist', 'accent'], phase: 'hit', energy: 0.78, direction: 'center', group: 'main' },
    { tags: ['hat', 'micro', 'leanLeft'], phase: 'micro', energy: 0.3, direction: 'left', group: 'main' },
    { tags: ['sustain', 'loopMid', 'groove'], phase: 'mid', energy: 0.42, direction: 'center', group: 'main' },

    { tags: ['kick', 'crouch', 'accent'], phase: 'hit', energy: 0.82, direction: 'center', group: 'main' },
    { tags: ['transition', 'stretch'], phase: 'travel', energy: 0.52, direction: 'center', group: 'main' },
    { tags: ['snare', 'leanRight', 'accent'], phase: 'hit', energy: 0.7, direction: 'right', group: 'main' },
    { tags: ['hat', 'micro', 'handsUp'], phase: 'micro', energy: 0.33, direction: 'center', group: 'main' },
    { tags: ['sustain', 'groove', 'loopEnd'], phase: 'end', energy: 0.44, direction: 'center', group: 'main' },

    { tags: ['accent', 'spin', 'jump'], phase: 'hit', energy: 1.0, direction: 'center', group: 'special' },
    { tags: ['idle', 'talk', 'ambient'], phase: 'start', energy: 0.15, direction: 'left', group: 'bar' },
    { tags: ['idle', 'smoke', 'ambient'], phase: 'mid', energy: 0.12, direction: 'right', group: 'bar' },
    { tags: ['idle', 'sit', 'ambient'], phase: 'end', energy: 0.08, direction: 'center', group: 'bar' },
    { tags: ['accent', 'signature', 'handsUp'], phase: 'hit', energy: 0.88, direction: 'center', group: 'special' }
  ];

  return applyArchetypeBias(map, archetype);
}

export function applyArchetypeBias(map, archetype) {
  const cloned = map.map(entry => ({ ...entry, tags: [...entry.tags], eventBoosts: { ...(entry.eventBoosts || {}) } }));

  if (archetype === 'punkIgnition') {
    for (const p of cloned) {
      if (p.tags.includes('jump')) p.weight = 1.5;
      if (p.tags.includes('kick')) p.eventBoosts.kick = 1.7;
      if (p.tags.includes('accent')) p.eventBoosts.accent = 1.5;
    }
  }

  if (archetype === 'serpentGroover') {
    for (const p of cloned) {
      if (p.tags.includes('micro')) p.weight = 1.5;
      if (p.tags.includes('transition')) p.weight = 1.35;
      if (p.tags.includes('jump')) p.weight = 0.45;
      if (p.tags.includes('stretch')) p.eventBoosts.sustain = 1.6;
    }
  }

  if (archetype === 'mechanicalBreaker') {
    for (const p of cloned) {
      if (p.tags.includes('kick')) p.eventBoosts.kick = 1.6;
      if (p.tags.includes('snare')) p.eventBoosts.snare = 1.35;
      if (p.tags.includes('transition')) p.weight = 0.75;
      if (p.tags.includes('micro')) p.weight = 0.5;
    }
  }

  if (archetype === 'minimalGlitchEntity') {
    for (const p of cloned) {
      if (p.tags.includes('idle')) p.weight = 1.8;
      if (p.tags.includes('micro')) p.weight = 1.5;
      if (p.tags.includes('jump')) p.weight = 0.15;
      if (p.tags.includes('accent')) p.weight = 0.6;
    }
  }

  if (archetype === 'expressiveStoryteller') {
    for (const p of cloned) {
      if (p.tags.includes('handsUp')) p.weight = 1.45;
      if (p.tags.includes('talk')) p.weight = 1.4;
      if (p.tags.includes('transition')) p.weight = 1.2;
    }
  }

  if (archetype === 'rubberHoseChaosGirl') {
    for (const p of cloned) {
      if (p.tags.includes('jump')) p.weight = 1.55;
      if (p.tags.includes('spin')) p.weight = 1.5;
      if (p.tags.includes('stretch')) p.weight = 1.4;
      if (p.tags.includes('micro')) p.weight = 0.85;
    }
  }

  return cloned;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalizePoseMeta(input) {
  return {
    index: input.index,
    tags: new Set(input.tags || []),
    weight: input.weight ?? 1,
    energy: input.energy ?? 0.5,
    direction: normalizeDirection(input.direction),
    phase: input.phase || 'mid',
    notes: input.notes || '',
    linksTo: input.linksTo || [],
    disallowAfter: input.disallowAfter || [],
    allowRoles: input.allowRoles || ['lead', 'follow', 'crowd', 'ambient', 'idle'],
    allowArchetypes: input.allowArchetypes || null,
    cooldown: input.cooldown ?? 0,
    holdBeats: input.holdBeats ?? 0,
    mirrorFriendly: input.mirrorFriendly !== false,
    sceneTags: input.sceneTags || [],
    sectionTags: input.sectionTags || [],
    eventBoosts: input.eventBoosts || {},
    group: input.group || null,
    variantOf: input.variantOf || null
  };
}

function inferPhaseFromTags(tags = []) {
  if (tags.includes('loopStart')) return 'start';
  if (tags.includes('loopEnd')) return 'end';
  if (tags.includes('transition')) return 'travel';
  if (tags.includes('kick') || tags.includes('snare') || tags.includes('accent')) return 'hit';
  if (tags.includes('hat') || tags.includes('micro')) return 'micro';
  return 'mid';
}

function normalizeDirection(direction) {
  if (['left', 'right', 'center'].includes(direction)) return direction;
  if (direction === 'leanLeft') return 'left';
  if (direction === 'leanRight') return 'right';
  return 'center';
}

function buildDesiredTags(context) {
  const must = [];
  const prefer = [];
  const avoid = [];

  switch (context.eventType) {
    case 'kick':
      must.push('kick');
      prefer.push('accent');
      if (context.motionLevel > 0.6) prefer.push('jump');
      break;
    case 'snare':
      must.push('snare');
      prefer.push('accent');
      prefer.push('handsUp');
      break;
    case 'hat':
      must.push('hat');
      prefer.push('micro');
      avoid.push('jump');
      break;
    case 'idle':
      must.push('idle');
      prefer.push('sustain');
      avoid.push('jump');
      avoid.push('accent');
      break;
    case 'accent':
      must.push('accent');
      prefer.push('signature');
      prefer.push('jump');
      break;
    case 'sustain':
      must.push('sustain');
      prefer.push('groove');
      break;
    case 'transition':
      must.push('transition');
      prefer.push('stretch');
      break;
  }

  if (context.role === 'ambient' || context.role === 'idle') {
    prefer.push('ambient');
    avoid.push('jump');
    avoid.push('spin');
  }

  if (context.sceneTag === 'bar') {
    prefer.push('talk');
    prefer.push('smoke');
    prefer.push('sit');
    avoid.push('jump');
  }

  if (context.bassPressure > 0.6) prefer.push('crouch');
  if (context.transient > 0.6) prefer.push('accent');
  if (context.brightness > 0.55) prefer.push('handsUp');

  return { must, prefer, avoid };
}

function scoreEventSemantics(meta, eventType, role, archetype) {
  let s = 1;

  if (eventType === 'kick' && meta.energy > 0.7) s *= 1.35;
  if (eventType === 'hat' && meta.energy < 0.45) s *= 1.18;
  if (eventType === 'idle' && meta.energy < 0.3) s *= 1.5;
  if (eventType === 'accent' && meta.tags.has('signature')) s *= 1.55;

  if (role === 'lead' && meta.tags.has('signature')) s *= 1.3;
  if (role === 'crowd' && meta.tags.has('signature')) s *= 0.55;
  if (role === 'ambient' && meta.tags.has('ambient')) s *= 1.4;

  if (archetype === 'serpentGroover' && meta.tags.has('transition')) s *= 1.25;
  if (archetype === 'mechanicalBreaker' && meta.tags.has('kick')) s *= 1.2;
  if (archetype === 'minimalGlitchEntity' && meta.tags.has('idle')) s *= 1.3;

  return s;
}

function isGoodPhaseProgression(prev, next) {
  const order = ['start', 'travel', 'hit', 'micro', 'mid', 'end'];
  const a = order.indexOf(prev);
  const b = order.indexOf(next);
  if (a === -1 || b === -1) return false;
  return b === a || b === a + 1 || (prev === 'end' && next === 'start');
}

function weightedPick(candidates) {
  if (!candidates.length) return null;
  const total = candidates.reduce((sum, c) => sum + c.score, 0);
  if (total <= 0) return candidates[0] || null;

  let r = Math.random() * total;
  for (const c of candidates) {
    r -= c.score;
    if (r <= 0) return c;
  }
  return candidates[candidates.length - 1];
}

// -----------------------------------------------------------------------------
// Example integration
// -----------------------------------------------------------------------------
// import { createPoseSheetSet } from './dancer-scene-engine.js';
// import {
//   createTaggedPoseSet,
//   createDefault20PoseMap,
//   attachPoseSelectorToDancer,
//   makeAudioPoseEventRouter
// } from './pose-tagging-system.js';
//
// const baseSet = createPoseSheetSet({ image, columns: 5, rows: 4, poseCount: 20 });
// const taggedSet = createTaggedPoseSet({
//   baseSet,
//   poses: createDefault20PoseMap('punkIgnition')
// });
//
// const dancer = scene.addDancer({
//   id: 'd1',
//   spriteSet: taggedSet,
//   archetype: 'punkIgnition',
//   role: 'lead'
// });
//
// attachPoseSelectorToDancer(dancer);
//
// const routePoseEvents = makeAudioPoseEventRouter(bridge, scene);
//
// // call on each frame after audio analysis:
// routePoseEvents();
//
// Result:
// kick no longer picks random pose.
// it picks a kick-friendly pose.
// snare picks snare-friendly pose.
// bar scenes prefer talk/smoke/sit.
// different archetypes bias different movement vocabularies.
