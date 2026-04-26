// Flipbook Engine Orchestrator v1
// Purpose:
// One boot layer that wires together:
//   - dancer-scene-engine.js
//   - scene-timeline-system.js
//   - audio-reactive-bridge.js
//   - pose-tagging-system.js
//
// This is the practical shell that turns the stack into one working system.
//
// Main responsibilities:
//   - load pose sheets
//   - convert them to tagged pose sets
//   - create dancers from config
//   - attach pose selectors
//   - boot scene preset
//   - bind timeline preset or custom timeline
//   - connect audio reactive bridge
//   - start animation loop
//   - optionally expose runtime controls
//
// Assumes these modules exist alongside this file.

import { scenePresets, createPoseSheetSet } from './dancer-scene-engine.js';
import { bindTimelineToScene, timelinePresets } from './scene-timeline-system.js';
import { connectAudioReactiveScene, makeReactiveHooks } from './audio-reactive-bridge.js';
import {
  createTaggedPoseSet,
  createDefault20PoseMap,
  attachPoseSelectorToDancer,
  makeAudioPoseEventRouter,
  broadcastPoseEvent
} from './pose-tagging-system.js';

export class FlipbookEngineOrchestrator {
  constructor(options = {}) {
    this.canvas = options.canvas;
    this.audioElement = options.audioElement || null;
    this.scene = null;
    this.timeline = null;
    this.bridge = null;
    this.reactiveHooks = null;
    this.routePoseEvents = null;

    this.config = options.config || defaultEngineConfig();
    this.assets = new Map();
    this.taggedSets = new Map();
    this.dancers = [];

    this.isReady = false;
    this.isStarted = false;

    this.runtime = {
      currentPreset: this.config.scenePreset || 'dnbWall',
      currentTimeline: this.config.timelinePreset || 'dnbEnergyWall',
      currentSceneTag: null
    };

    this.frameHandlers = [];
    this.externalAPI = null;
  }

  async init() {
    if (!this.canvas) throw new Error('FlipbookEngineOrchestrator requires a canvas.');

    await this.loadAssets();
    this.buildScene();
    this.buildDancers();
    await this.buildAudioAndTimeline();
    this.buildRuntimeLoopHooks();
    this.buildExternalAPI();

    this.isReady = true;
    return this;
  }

  async start() {
    if (!this.isReady) await this.init();
    if (this.isStarted) return this;

    this.scene.start();

    if (this.audioElement) {
      if (!this.audioElement.paused) {
        if (!this.bridge?.isRunning) await this.bridge.start();
      }
    } else {
      if (!this.bridge?.isRunning && this.bridge) await this.bridge.start();
    }

    this.installSceneFrameLoop();
    this.isStarted = true;
    return this;
  }

  stop() {
    this.scene?.stop();
    this.bridge?.stop();
    this.isStarted = false;
  }

  async reload(nextConfig = null) {
    this.stop();
    if (nextConfig) this.config = nextConfig;
    this.assets.clear();
    this.taggedSets.clear();
    this.dancers = [];
    this.scene = null;
    this.timeline = null;
    this.bridge = null;
    this.routePoseEvents = null;
    this.reactiveHooks = null;
    this.isReady = false;
    return this.init();
  }

  async loadAssets() {
    const uniqueSheets = dedupeBy(this.config.poseSheets || [], item => item.id);
    const loaded = await Promise.all(uniqueSheets.map(sheet => loadImageAsset(sheet)));

    for (const asset of loaded) {
      this.assets.set(asset.id, asset);
    }

    for (const sheet of uniqueSheets) {
      const asset = this.assets.get(sheet.id);
      const baseSet = createPoseSheetSet({
        image: asset.image,
        columns: sheet.columns || 5,
        rows: sheet.rows || 4,
        poseCount: sheet.poseCount || 20,
        padding: sheet.padding || 0
      });

      const poseMap = sheet.poseMap || createDefault20PoseMap(sheet.archetype || 'generic');
      const taggedSet = createTaggedPoseSet({
        baseSet,
        poses: poseMap,
        defaultTags: sheet.defaultTags || []
      });

      this.taggedSets.set(sheet.id, taggedSet);
    }
  }

  buildScene() {
    const presetName = this.config.scenePreset || 'dnbWall';
    const presetFactory = scenePresets[presetName] || scenePresets.dnbWall;
    this.scene = presetFactory({
      canvas: this.canvas,
      bpm: this.config.bpm || 174
    });

    if (this.config.sceneOverrides) {
      applySceneOverrides(this.scene, this.config.sceneOverrides);
    }

    this.runtime.currentPreset = presetName;
  }

  buildDancers() {
    for (const def of this.config.dancers || []) {
      const spriteSet = this.taggedSets.get(def.poseSheetId);
      if (!spriteSet) {
        console.warn(`Missing tagged pose set for poseSheetId: ${def.poseSheetId}`);
        continue;
      }

      const dancer = this.scene.addDancer({
        id: def.id,
        spriteSet,
        archetype: def.archetype || 'generic',
        role: def.role || 'crowd',
        mirror: !!def.mirror,
        syncBias: def.syncBias,
        energyGain: def.energyGain,
        motionSmoothness: def.motionSmoothness,
        influenceWeight: def.influenceWeight,
        independence: def.independence,
        signatureInterval: def.signatureInterval,
        beatStride: def.beatStride,
        paletteTag: def.paletteTag || null
      });

      attachPoseSelectorToDancer(dancer, {
        sceneTag: this.scene.mode === 'windowGrid' ? 'windows' : 'stage'
      });

      dancer.metaProfile = {
        label: def.label || def.id,
        tags: def.tags || [],
        variant: def.variant || null
      };

      this.dancers.push(dancer);
    }

    const leader = this.config.dancers?.find(d => d.role === 'lead');
    if (leader) this.scene.setLeader(leader.id);
  }

  async buildAudioAndTimeline() {
    const timelineData = resolveTimelineData(this.config.timelinePreset, this.config.timelineData);
    this.timeline = bindTimelineToScene({
      scene: this.scene,
      audio: this.audioElement,
      timelineData
    });
    this.runtime.currentTimeline = this.config.timelinePreset || 'custom';

    if (this.audioElement) {
      this.bridge = await connectAudioReactiveScene({
        audioElement: this.audioElement,
        scene: this.scene,
        timeline: this.timeline,
        options: this.config.audioReactive || {}
      });

      this.reactiveHooks = makeReactiveHooks(this.bridge);
      this.routePoseEvents = makeAudioPoseEventRouter(this.bridge, this.scene, this.config.poseEventRouting || {});
    }
  }

  buildRuntimeLoopHooks() {
    this.frameHandlers = [];

    if (this.routePoseEvents) {
      this.frameHandlers.push(() => {
        this.routePoseEvents();
      });
    }

    if (Array.isArray(this.config.customFrameHandlers)) {
      for (const fn of this.config.customFrameHandlers) {
        if (typeof fn === 'function') this.frameHandlers.push(fn);
      }
    }
  }

  installSceneFrameLoop() {
    if (!this.scene || this.scene.__orchestratorFrameHooksInstalled) return;
    if (!Array.isArray(this.scene.frameHooks)) this.scene.frameHooks = [];

    const engine = this;

    for (const fn of this.frameHandlers) {
      this.scene.frameHooks.push((ctx) => {
        try {
          fn({
            ...ctx,
            timeline: engine.timeline,
            bridge: engine.bridge,
            hooks: engine.reactiveHooks,
            orchestrator: engine
          });
        } catch (err) {
          console.error('Frame handler failed:', err);
        }
      });
    }

    this.scene.__orchestratorFrameHooksInstalled = true;
  }

  buildExternalAPI() {
    const engine = this;

    this.externalAPI = {
      get scene() {
        return engine.scene;
      },
      get timeline() {
        return engine.timeline;
      },
      get bridge() {
        return engine.bridge;
      },
      get hooks() {
        return engine.reactiveHooks;
      },
      get dancers() {
        return engine.dancers;
      },
      triggerPoseEvent(eventContext) {
        broadcastPoseEvent(engine.scene, eventContext);
      },
      setMode(mode) {
        engine.scene.setMode(mode);
        engine.scene.relayout();
      },
      setBackground(backgroundMode) {
        engine.scene.backgroundMode = backgroundMode;
      },
      setLeader(dancerId) {
        engine.scene.setLeader(dancerId);
      },
      setTimeline(timelineData) {
        engine.timeline = bindTimelineToScene({
          scene: engine.scene,
          audio: engine.audioElement,
          timelineData
        });
      },
      getSnapshot() {
        return {
          mode: engine.scene?.mode,
          backgroundMode: engine.scene?.backgroundMode,
          leaderId: engine.scene?.leaderId,
          time: engine.scene?.time,
          bridge: engine.bridge?.getSnapshot?.() || null,
          dancerCount: engine.dancers.length
        };
      }
    };
  }

  getAPI() {
    return this.externalAPI;
  }
}

// -----------------------------------------------------------------------------
// Public factory
// -----------------------------------------------------------------------------

export async function bootFlipbookEngine(options = {}) {
  const engine = new FlipbookEngineOrchestrator(options);
  await engine.init();
  await engine.start();
  return engine;
}

// -----------------------------------------------------------------------------
// Default config scaffold
// -----------------------------------------------------------------------------

export function defaultEngineConfig() {
  return {
    bpm: 174,
    scenePreset: 'dnbWall',
    timelinePreset: 'dnbEnergyWall',
    timelineData: null,
    sceneOverrides: null,
    poseSheets: [
      // Example:
      // {
      //   id: 'punk-sheet',
      //   src: './poses/punk-sheet.png',
      //   columns: 5,
      //   rows: 4,
      //   poseCount: 20,
      //   archetype: 'punkIgnition'
      // }
    ],
    dancers: [
      // Example:
      // {
      //   id: 'punk-lead',
      //   poseSheetId: 'punk-sheet',
      //   archetype: 'punkIgnition',
      //   role: 'lead',
      //   mirror: false
      // }
    ],
    audioReactive: {
      allowAutoBlackoutOnDrop: true,
      enableTimelineAssist: true,
      enableDancerModulation: true,
      globalFlashGain: 1.15,
      motionGain: 1.1
    },
    poseEventRouting: {
      kickThreshold: 0.22,
      snareThreshold: 0.22,
      hatThreshold: 0.18,
      dropThreshold: 0.58
    },
    customFrameHandlers: []
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function resolveTimelineData(timelinePreset, timelineData) {
  if (timelineData) return timelineData;
  if (timelinePreset && timelinePresets[timelinePreset]) return timelinePresets[timelinePreset];
  return timelinePresets.dnbEnergyWall;
}

function applySceneOverrides(scene, overrides = {}) {
  if (typeof overrides.mode === 'string') scene.mode = overrides.mode;
  if (typeof overrides.backgroundMode === 'string') scene.backgroundMode = overrides.backgroundMode;
  if (typeof overrides.floorY === 'number') scene.floorY = overrides.floorY;
  if (typeof overrides.gridCols === 'number') scene.windowGrid.cols = overrides.gridCols;
  if (typeof overrides.gridGap === 'number') scene.windowGrid.gap = overrides.gridGap;
  if (overrides.scenePalette) Object.assign(scene.scenePalette, overrides.scenePalette);
}

async function loadImageAsset(sheet) {
  const image = await loadImage(sheet.src);
  return {
    id: sheet.id,
    image,
    width: image.width,
    height: image.height,
    meta: sheet
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = err => reject(new Error(`Failed to load image: ${src}`));
    image.src = src;
  });
}

function dedupeBy(arr, fn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const key = fn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Example boot sequence
// -----------------------------------------------------------------------------
// import { bootFlipbookEngine } from './flipbook-engine-orchestrator.js';
//
// const canvas = document.querySelector('#scene');
// const audio = document.querySelector('#track');
//
// const engine = await bootFlipbookEngine({
//   canvas,
//   audioElement: audio,
//   config: {
//     bpm: 174,
//     scenePreset: 'dnbWall',
//     timelinePreset: 'dnbEnergyWall',
//     poseSheets: [
//       {
//         id: 'punk-sheet',
//         src: './poses/punk-sheet.png',
//         columns: 5,
//         rows: 4,
//         poseCount: 20,
//         archetype: 'punkIgnition'
//       },
//       {
//         id: 'serpent-sheet',
//         src: './poses/serpent-sheet.png',
//         columns: 5,
//         rows: 4,
//         poseCount: 20,
//         archetype: 'serpentGroover'
//       },
//       {
//         id: 'glitch-sheet',
//         src: './poses/glitch-sheet.png',
//         columns: 5,
//         rows: 4,
//         poseCount: 20,
//         archetype: 'minimalGlitchEntity'
//       }
//     ],
//     dancers: [
//       {
//         id: 'lead-punk',
//         poseSheetId: 'punk-sheet',
//         archetype: 'punkIgnition',
//         role: 'lead'
//       },
//       {
//         id: 'wave-serpent',
//         poseSheetId: 'serpent-sheet',
//         archetype: 'serpentGroover',
//         role: 'follow',
//         mirror: true
//       },
//       {
//         id: 'glitch-ambient',
//         poseSheetId: 'glitch-sheet',
//         archetype: 'minimalGlitchEntity',
//         role: 'ambient'
//       }
//     ]
//   }
// });
//
// const api = engine.getAPI();
// window.flipbookEngine = api;
//
// From there you can live-control:
// api.setMode('sharedStage')
// api.setBackground('bar')
// api.setLeader('wave-serpent')
// api.triggerPoseEvent({ eventType: 'accent', sceneTag: 'stage', motionLevel: 1 })
