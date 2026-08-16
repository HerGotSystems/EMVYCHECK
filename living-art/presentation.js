/* EMVY CHECK Living Art V2 — presentation / partner mode.
   A short looping auto-demo for showing the concept to display partners
   and integrators. Exits the moment the visitor touches a real control. */
(function (global) {
  'use strict';

  const STEPS = [
    // Explicit, fully self-contained reset (contentType included) - this is
    // the loop's re-entry point, so it can't rely on whatever the scene
    // tour below left behind.
    { patch: { contentType: 'abstract', layout: 1, composition: 'continuous', displayMode: 'live', palette: 0 }, duration: 7000, text: 'EMVY CHECK LIVING ART' },
    { patch: { layout: 9, composition: 'continuous' }, duration: 7000, text: 'GENERATIVE ART FOR CONNECTED DISPLAYS' },
    { patch: { composition: 'continuous' }, duration: 7000, text: null },
    { patch: { composition: 'family' }, duration: 7000, text: 'EVERY GENERATION ORIGINAL' },
    // Remote-control concept, honestly labelled as a simulation - one
    // browser cannot show a real phone controlling nine real screens, so
    // this narrates the interaction rather than claiming it is live.
    { patch: { composition: 'continuous' }, duration: 5000, text: 'REMOTE INSTALLATION CONTROL — SIMULATED DEMO' },
    { patch: { seed: 'EMVY-DEMO-' + Math.floor(Math.random() * 9000 + 1000) }, duration: 5500, text: 'PHONE PRESSES "NEW ART" → ALL 9 SCREENS UPDATE' },
    { patch: { palette: 6 }, duration: 5500, text: 'PHONE PRESSES "NEW COLOUR" → ALL 9 SCREENS UPDATE' },
    { patch: { palette: 3 }, duration: 5000, text: null },
    { patch: { displayMode: 'paper' }, duration: 5500, text: null },
    { patch: { displayMode: 'live' }, duration: 5500, text: null },
    { patch: { displayMode: 'music', musicSource: 'demo' }, duration: 9000, text: null },
    // Scene families tour (V4) - abstract families are one content layer;
    // this shows the second, representational one, and that each scene
    // genuinely behaves differently across PAINT/LIVE/MUSIC rather than
    // just being a reskinned visualizer.
    { patch: { layout: 1, composition: 'continuous', displayMode: 'live', musicSource: 'none' }, duration: 4000, text: 'SCENE FAMILIES' },
    { patch: { contentType: 'scene', sceneId: 'river-mill', displayMode: 'paper', musicSource: 'none' }, duration: 4500, text: 'RIVER MILL · PAINT' },
    { patch: { displayMode: 'live' }, duration: 6000, text: 'RIVER MILL · LIVE' },
    { patch: { displayMode: 'music', musicSource: 'demo' }, duration: 7000, text: 'RIVER MILL · MUSIC' },
    { patch: { sceneId: 'birds-flight', displayMode: 'paper', musicSource: 'none' }, duration: 4500, text: 'BIRDS FLIGHT · PAINT' },
    { patch: { displayMode: 'live' }, duration: 6000, text: 'BIRDS FLIGHT · LIVE' },
    { patch: { displayMode: 'music', musicSource: 'demo' }, duration: 7000, text: 'BIRDS FLIGHT · MUSIC' },
    { patch: { sceneId: 'open-arms', displayMode: 'paper', musicSource: 'none' }, duration: 4500, text: 'OPEN ARMS · PAINT' },
    { patch: { displayMode: 'live' }, duration: 6000, text: 'OPEN ARMS · LIVE' },
    { patch: { displayMode: 'music', musicSource: 'demo' }, duration: 7000, text: 'OPEN ARMS · MUSIC' },
    { patch: { sceneId: 'coaster-ride', displayMode: 'paper', musicSource: 'none' }, duration: 4500, text: 'COASTER RIDE · PAINT' },
    { patch: { displayMode: 'live' }, duration: 6000, text: 'COASTER RIDE · LIVE' },
    { patch: { displayMode: 'music', musicSource: 'demo' }, duration: 8000, text: 'COASTER RIDE · MUSIC' },
    { patch: { contentType: 'abstract', layout: 1, composition: 'continuous', displayMode: 'live', musicSource: 'none' }, duration: 7000, text: null }
  ];

  function Presentation() {
    this.active = false;
    this.timer = 0;
    this.stepIndex = 0;
  }

  Presentation.prototype.start = function (opts) {
    this.active = true;
    this.stepIndex = 0;
    this.opts = opts;
    this._runStep();
  };

  Presentation.prototype._runStep = function () {
    if (!this.active) return;
    const step = STEPS[this.stepIndex % STEPS.length];
    this.opts.applyPatch(step.patch);
    this.opts.onText(step.text || '');
    const self = this;
    this.timer = setTimeout(function () {
      self.stepIndex++;
      self._runStep();
    }, step.duration);
  };

  Presentation.prototype.stop = function () {
    this.active = false;
    clearTimeout(this.timer);
    if (this.opts && this.opts.onText) this.opts.onText('');
  };

  global.LivingArtPresentation = new Presentation();
})(window);
