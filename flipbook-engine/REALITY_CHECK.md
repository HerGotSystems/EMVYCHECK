# KINEOSTROKE Reality Check v0.1

This branch exists to answer one question before XXV depends on KINEOSTROKE:

> Does the current EMVY Flipbook Engine actually render real sprite-sheet frames, or are we only looking at placeholders/protocols?

## What exists today

The `flipbook-engine/` directory contains two overlapping generations:

1. `index.html`
   - self-contained browser engine;
   - local/hosted audio loading;
   - 5x4 pose-sheet upload;
   - sprite cutter controls;
   - dancer roster;
   - canvas rendering;
   - PNG/WebM export.

2. modular files
   - `dancer_scene_engine.js`
   - `scene_timeline_system.js`
   - `audio_reactive_bridge.js`
   - `pose_tagging_system.js`
   - `flipbook_engine_orchestrator.js`

The scene engine has a real `createPoseSheetSet()` implementation. It slices a supplied image as a grid and its `drawPose()` calls `CanvasRenderingContext2D.drawImage()` with the selected cell.

The scene engine also contains a fallback stick-figure renderer. Therefore **seeing movement alone is not proof that a real sprite sheet is working**.

## Known issue found by this audit

`flipbook_engine_orchestrator.js` imports hyphenated module names:

- `dancer-scene-engine.js`
- `scene-timeline-system.js`
- `audio-reactive-bridge.js`
- `pose-tagging-system.js`

The repository files actually use underscores:

- `dancer_scene_engine.js`
- `scene_timeline_system.js`
- `audio_reactive_bridge.js`
- `pose_tagging_system.js`

The orchestrator should not be treated as proven working until those imports are repaired and the full modular stack is exercised.

`module-test.html` already uses the correct underscore names for the scene and timeline modules.

## Missing asset reality

The repository currently contains the engine but no dedicated KINEOSTROKE 5x4 pose-sheet PNG library in `flipbook-engine/`.

That means we cannot honestly claim a real KINEOSTROKE character library is already integrated.

## Reality-check page

`reality-check.html` deliberately tests the real sprite path.

It:

1. imports the actual `dancer_scene_engine.js` module;
2. creates a generated 5x4 / 20-frame technical sprite sheet in-browser;
3. feeds that image into the real `createPoseSheetSet()` cutter;
4. wraps the returned `drawPose()` so the page can count real sprite draw calls;
5. starts the real scene engine with that sprite set;
6. reports `REAL SPRITE DRAW = PASS` only after `drawPose()` has actually executed;
7. allows replacing the generated sheet with an uploaded real KINEOSTROKE 5x4 sheet.

The generated sheet proves plumbing, not art quality or character consistency.

## Definition of genuinely working KINEOSTROKE

We should not call KINEOSTROKE integrated into XXV until all of these are true:

1. one real KINEOSTROKE character sheet is loaded;
2. real sprite frames render without falling back to the silhouette;
3. several named actions can be selected deliberately, not merely random pose cycling;
4. two characters can perform one deterministic CUBUS receipt;
5. renderer actions remain traceable back to the authoritative XXV event/receipt.

## Safety boundary

This branch is an isolated diagnostic branch. It should not be merged into the public EMVY site merely because the generated technical sheet animates.
