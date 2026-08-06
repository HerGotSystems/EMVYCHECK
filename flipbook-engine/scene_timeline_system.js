// Scene Timeline System v1
// Purpose:
// Drive the dancer scene engine with song sections, beat events, role swaps,
// scene changes, density control, and visual impact moments.
//
// Works with dancer-scene-engine.js
//
// Main concept:
//   song -> sections -> timed actions -> engine reacts
//
// This gives you:
//   - intro / build / drop / breakdown / outro automation
//   - scene mode switches (windowGrid/sharedStage)
//   - background switches (club/windows/bar)
//   - dancer role swaps (lead/follow/ambient/crowd/idle)
//   - blackout slams, flash hits, density changes
//   - future-ready hook for audio onset detection
//
// Example:
//   const timeline = new SceneTimelineController(scene, timelineData);
//   timeline.start(audioElement);

export class SceneTimelineController {
  constructor(scene, timelineData = {}) {
    this.scene = scene;
    this.timeline = normalizeTimeline(timelineData, scene.bpm || 120);
    this.audio = null;
    this.startedAt = 0;
    this.time = 0;
    this.lastTime = 0;
    this.activeSectionIndex = -1;
    this.nextActionIndex = 0;
    this.isRunning = false;
    this.useAudioTime = true;
    this._boundTick = this.tick.bind(this);
  }

  start(audioElement = null) {
    this.audio = audioElement || null;
    this.startedAt = performance.now();
    this.lastTime = 0;
    this.time = 0;
    this.activeSectionIndex = -1;
    this.nextActionIndex = 0;
    this.isRunning = true;
    requestAnimationFrame(this._boundTick);
  }

  stop() {
    this.isRunning = false;
  }

  reset() {
    this.stop();
    this.startedAt = 0;
    this.lastTime = 0;
    this.time = 0;
    this.activeSectionIndex = -1;
    this.nextActionIndex = 0;
  }

  tick() {
    if (!this.isRunning) return;

    this.time = this.getCurrentTime();
    this.handleSections();
    this.handleActions();
    this.lastTime = this.time;

    requestAnimationFrame(this._boundTick);
  }

  getCurrentTime() {
    if (this.audio && this.useAudioTime && Number.isFinite(this.audio.currentTime)) {
      return this.audio.currentTime;
    }
    return (performance.now() - this.startedAt) / 1000;
  }

  handleSections() {
    const sectionIndex = findActiveSectionIndex(this.timeline.sections, this.time);
    if (sectionIndex === this.activeSectionIndex) return;

    this.activeSectionIndex = sectionIndex;
    const section = this.timeline.sections[sectionIndex];
    if (!section) return;

    applySectionState(this.scene, section);
  }

  handleActions() {
    const actions = this.timeline.actions;

    while (this.nextActionIndex < actions.length) {
      const action = actions[this.nextActionIndex];
      if (action.time > this.time) break;

      this.fireAction(action);
      this.nextActionIndex++;
    }
  }

  fireAction(action) {
    const scene = this.scene;
    const payload = action.payload || {};

    switch (action.type) {
      case 'setMode':
        scene.setMode(payload.mode);
        scene.relayout();
        break;

      case 'setBackground':
        scene.backgroundMode = payload.backgroundMode;
        break;

      case 'setLeader':
        if (payload.dancerId) scene.setLeader(payload.dancerId);
        break;

      case 'setRoles':
        applyRoleMap(scene, payload.roles || {});
        break;

      case 'setArchetypes':
        applyArchetypeMap(scene, payload.archetypes || {});
        break;

      case 'flash':
        scene.flash += payload.amount ?? 1;
        break;

      case 'blackout':
        scene.addEvent({ time: scene.time, type: 'blackout', amount: payload.amount ?? 1 });
        break;

      case 'drop':
        scene.addEvent({ time: scene.time, type: 'drop', amount: payload.amount ?? 1 });
        break;

      case 'setBpm':
        if (payload.bpm) scene.setBpm(payload.bpm);
        break;

      case 'mirrorToggle':
        toggleMirror(scene, payload.targets || 'all');
        break;

      case 'setDensity':
        applyDensity(scene, payload.level || 'full');
        break;

      case 'randomLeader':
        chooseRandomLeader(scene, payload.filterRole || null);
        break;

      case 'spreadFormation':
        scene.setMode('sharedStage');
        applySpreadFormation(scene, payload);
        scene.relayout();
        break;

      case 'windowFormation':
        scene.setMode('windowGrid');
        if (payload.cols) scene.windowGrid.cols = payload.cols;
        scene.relayout();
        break;

      case 'scenePalette':
        Object.assign(scene.scenePalette, payload || {});
        break;

      case 'setFloorY':
        if (typeof payload.floorY === 'number') {
          scene.floorY = payload.floorY;
          scene.relayout();
        }
        break;

      case 'custom':
        if (typeof payload.run === 'function') payload.run(scene, action, this);
        break;
    }
  }
}

export function normalizeTimeline(timelineData, fallbackBpm = 120) {
  const bpm = timelineData.bpm || fallbackBpm;
  const spb = 60 / bpm;

  const sections = (timelineData.sections || []).map((section, index) => ({
    id: section.id || `section_${index}`,
    label: section.label || `Section ${index + 1}`,
    start: resolveTime(section.start, spb),
    end: resolveTime(section.end, spb),
    mode: section.mode || null,
    backgroundMode: section.backgroundMode || null,
    leaderId: section.leaderId || null,
    density: section.density || null,
    gridCols: section.gridCols || null,
    floorY: section.floorY ?? null,
    scenePalette: section.scenePalette || null,
    roleMap: section.roleMap || null,
    archetypeMap: section.archetypeMap || null,
    notes: section.notes || null
  })).sort((a, b) => a.start - b.start);

  const actions = (timelineData.actions || []).map((action, index) => ({
    id: action.id || `action_${index}`,
    time: resolveTime(action.time, spb),
    type: action.type,
    payload: action.payload || {}
  })).sort((a, b) => a.time - b.time);

  return {
    bpm,
    secondsPerBeat: spb,
    sections,
    actions
  };
}

function resolveTime(value, secondsPerBeat) {
  if (typeof value === 'number') return value;

  if (typeof value === 'string') {
    if (value.endsWith('b')) {
      const beats = parseFloat(value.slice(0, -1));
      return beats * secondsPerBeat;
    }
    if (value.endsWith('bar')) {
      const bars = parseFloat(value.slice(0, -3));
      return bars * 4 * secondsPerBeat;
    }
    if (value.includes(':')) {
      const [m, s] = value.split(':').map(Number);
      return m * 60 + s;
    }
    const asNumber = parseFloat(value);
    if (Number.isFinite(asNumber)) return asNumber;
  }

  return 0;
}

function findActiveSectionIndex(sections, time) {
  for (let i = sections.length - 1; i >= 0; i--) {
    const s = sections[i];
    if (time >= s.start && (s.end == null || time < s.end)) return i;
  }
  return -1;
}

function applySectionState(scene, section) {
  if (section.mode) scene.setMode(section.mode);
  if (section.backgroundMode) scene.backgroundMode = section.backgroundMode;
  if (section.leaderId) scene.setLeader(section.leaderId);
  if (section.gridCols) scene.windowGrid.cols = section.gridCols;
  if (typeof section.floorY === 'number') scene.floorY = section.floorY;
  if (section.scenePalette) Object.assign(scene.scenePalette, section.scenePalette);
  if (section.roleMap) applyRoleMap(scene, section.roleMap);
  if (section.archetypeMap) applyArchetypeMap(scene, section.archetypeMap);
  if (section.density) applyDensity(scene, section.density);
  scene.relayout();
}

function applyRoleMap(scene, roleMap) {
  for (const dancer of scene.dancers) {
    if (roleMap[dancer.id]) dancer.role = roleMap[dancer.id];
  }
}

function applyArchetypeMap(scene, archetypeMap) {
  for (const dancer of scene.dancers) {
    const archetypeName = archetypeMap[dancer.id];
    if (!archetypeName) continue;
    dancer.archetype = archetypeName;
  }
}

function toggleMirror(scene, targets) {
  const list = targets === 'all'
    ? scene.dancers
    : scene.dancers.filter(d => Array.isArray(targets) && targets.includes(d.id));

  for (const dancer of list) {
    dancer.mirror = !dancer.mirror;
  }
}

function applyDensity(scene, level) {
  const dancers = scene.dancers;

  switch (level) {
    case 'solo':
      dancers.forEach((d, i) => {
        d.role = i === 0 ? 'lead' : 'idle';
      });
      if (dancers[0]) scene.setLeader(dancers[0].id);
      break;

    case 'duo':
      dancers.forEach((d, i) => {
        d.role = i === 0 ? 'lead' : i === 1 ? 'follow' : 'idle';
      });
      if (dancers[0]) scene.setLeader(dancers[0].id);
      break;

    case 'sparse':
      dancers.forEach((d, i) => {
        d.role = i % 3 === 0 ? 'crowd' : 'ambient';
      });
      break;

    case 'build':
      dancers.forEach((d, i) => {
        d.role = i === 0 ? 'lead' : i % 2 === 0 ? 'follow' : 'ambient';
      });
      if (dancers[0]) scene.setLeader(dancers[0].id);
      break;

    case 'full':
    default:
      dancers.forEach((d, i) => {
        d.role = i === 0 ? 'lead' : i % 4 === 0 ? 'follow' : 'crowd';
      });
      if (dancers[0]) scene.setLeader(dancers[0].id);
      break;
  }
}

function chooseRandomLeader(scene, filterRole = null) {
  const pool = filterRole
    ? scene.dancers.filter(d => d.role === filterRole)
    : scene.dancers;

  if (!pool.length) return;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  scene.setLeader(chosen.id);
}

function applySpreadFormation(scene, payload = {}) {
  if (payload.floorY != null) scene.floorY = payload.floorY;
  if (payload.scaleMin != null) scene.sharedStage.crowdScaleMin = payload.scaleMin;
  if (payload.scaleMax != null) scene.sharedStage.crowdScaleMax = payload.scaleMax;
}

// -----------------------------------------------------------------------------
// Example song timeline presets
// -----------------------------------------------------------------------------

export const timelinePresets = {
  dnbEnergyWall: {
    bpm: 174,
    sections: [
      {
        id: 'intro',
        label: 'Intro',
        start: 0,
        end: '16b',
        mode: 'windowGrid',
        backgroundMode: 'windows',
        density: 'sparse',
        gridCols: 4,
        notes: 'Establish the wall. Minimal movement. Let cells breathe.'
      },
      {
        id: 'build',
        label: 'Build',
        start: '16b',
        end: '32b',
        mode: 'windowGrid',
        backgroundMode: 'windows',
        density: 'build',
        gridCols: 4,
        notes: 'More dancers wake up. Follow logic grows.'
      },
      {
        id: 'drop',
        label: 'Drop',
        start: '32b',
        end: '48b',
        mode: 'sharedStage',
        backgroundMode: 'club',
        density: 'full',
        notes: 'Rip them out of the boxes and onto one stage.'
      },
      {
        id: 'breakdown',
        label: 'Breakdown',
        start: '48b',
        end: '64b',
        mode: 'sharedStage',
        backgroundMode: 'bar',
        density: 'duo',
        notes: 'Human moment. Let contrast hit.'
      },
      {
        id: 'finale',
        label: 'Finale',
        start: '64b',
        end: '96b',
        mode: 'windowGrid',
        backgroundMode: 'windows',
        density: 'full',
        gridCols: 5,
        notes: 'Bigger wall. More pressure.'
      }
    ],
    actions: [
      {
        time: '15.5b',
        type: 'flash',
        payload: { amount: 1.4 }
      },
      {
        time: '16b',
        type: 'randomLeader',
        payload: {}
      },
      {
        time: '31.75b',
        type: 'blackout',
        payload: { amount: 1 }
      },
      {
        time: '32b',
        type: 'drop',
        payload: { amount: 1 }
      },
      {
        time: '32b',
        type: 'flash',
        payload: { amount: 2 }
      },
      {
        time: '47.5b',
        type: 'setDensity',
        payload: { level: 'duo' }
      },
      {
        time: '48b',
        type: 'setBackground',
        payload: { backgroundMode: 'bar' }
      },
      {
        time: '63.5b',
        type: 'blackout',
        payload: { amount: 1 }
      },
      {
        time: '64b',
        type: 'windowFormation',
        payload: { cols: 5 }
      },
      {
        time: '80b',
        type: 'mirrorToggle',
        payload: { targets: 'all' }
      }
    ]
  },

  clubToBarNarrative: {
    bpm: 128,
    sections: [
      {
        id: 'dancefloor',
        label: 'Dancefloor',
        start: 0,
        end: 30,
        mode: 'sharedStage',
        backgroundMode: 'club',
        density: 'full'
      },
      {
        id: 'pullback',
        label: 'Pullback',
        start: 30,
        end: 45,
        mode: 'sharedStage',
        backgroundMode: 'bar',
        density: 'sparse'
      },
      {
        id: 'windowMemory',
        label: 'Window Memory',
        start: 45,
        end: 60,
        mode: 'windowGrid',
        backgroundMode: 'windows',
        density: 'build',
        gridCols: 3
      }
    ],
    actions: [
      { time: 29.8, type: 'blackout', payload: { amount: 0.9 } },
      { time: 30, type: 'setDensity', payload: { level: 'sparse' } },
      { time: 44.8, type: 'flash', payload: { amount: 1.1 } },
      { time: 45, type: 'windowFormation', payload: { cols: 3 } }
    ]
  }
};

// -----------------------------------------------------------------------------
// Example helper for quickly binding a song to a scene
// -----------------------------------------------------------------------------

export function bindTimelineToScene({ scene, audio, timelineData }) {
  const controller = new SceneTimelineController(scene, timelineData);

  if (audio) {
    const tryStart = () => {
      controller.start(audio);
      audio.removeEventListener('play', tryStart);
    };

    if (!audio.paused) {
      controller.start(audio);
    } else {
      audio.addEventListener('play', tryStart);
    }

    audio.addEventListener('seeked', () => {
      const t = audio.currentTime;
      const actions = controller.timeline.actions;

      let i = 0;
      while (i < actions.length && actions[i].time < t) i++;

      controller.nextActionIndex = i;
      controller.activeSectionIndex = -1;
      controller.lastTime = t;
    });
  } else {
    controller.start(null);
  }

  return controller;
}

// -----------------------------------------------------------------------------
// Example usage
// -----------------------------------------------------------------------------
// import { scenePresets } from './dancer-scene-engine.js';
// import { bindTimelineToScene, timelinePresets } from './scene-timeline-system.js';
//
// const canvas = document.querySelector('canvas');
// const audio = document.querySelector('audio');
// const scene = scenePresets.dnbWall({ canvas, bpm: 174 });
//
// // add dancers before binding timeline
// // scene.addDancer(...)
//
// scene.start();
// const timeline = bindTimelineToScene({
//   scene,
//   audio,
//   timelineData: timelinePresets.dnbEnergyWall
// });
//
// Now the song drives the visual world.
