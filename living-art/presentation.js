/* EMVY CHECK Living Art V2 — presentation / partner mode.
   A short looping auto-demo for showing the concept to display partners
   and integrators. Exits the moment the visitor touches a real control. */
(function (global) {
  'use strict';

  const STEPS = [
    { patch: { layout: 1, composition: 'continuous', displayMode: 'live', palette: 0 }, duration: 7000, text: 'EMVY CHECK LIVING ART' },
    { patch: { layout: 9, composition: 'continuous' }, duration: 7000, text: 'GENERATIVE ART FOR CONNECTED DISPLAYS' },
    { patch: { composition: 'continuous' }, duration: 7000, text: null },
    { patch: { composition: 'family' }, duration: 7000, text: 'EVERY GENERATION ORIGINAL' },
    { patch: { palette: 3 }, duration: 5500, text: null },
    { patch: { displayMode: 'paper' }, duration: 5500, text: null },
    { patch: { displayMode: 'live' }, duration: 5500, text: null },
    { patch: { displayMode: 'music', musicSource: 'demo' }, duration: 9000, text: null },
    { patch: { layout: 1, composition: 'continuous', displayMode: 'live', musicSource: 'none' }, duration: 7000, text: null }
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
