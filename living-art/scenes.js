/* EMVY CHECK Living Art V5 — scene families, art-direction pass.
   A second, representational content layer alongside the existing abstract
   procedural FAMILIES in engine.js. Same deterministic-seed pipeline, same
   PAINT/LIVE/MUSIC contract: at phase=0 with NEUTRAL_AUDIO every scene must
   read as a proper still composition (PAINT); as `t` advances it drifts
   ambiently (LIVE); as `a.*` moves off zero it reacts with scene-specific,
   designed events rather than generic pulsing (MUSIC) - see each scene's
   `musicProfile` below for the mapping.

   V5 art-direction model (per scene, not identically implemented but used
   as the layer order throughout): BACKGROUND, DISTANT ENVIRONMENT,
   MIDGROUND, MAIN SUBJECT, FOREGROUND, ATMOSPHERE, LIGHT, MUSIC EVENTS.
   Palette colours are never used raw - see shade()/blend() below - so a
   scene reads as colour-coherent rather than "five primitives, five palette
   slots".

   Determinism rule every scene function must follow: the seeded RNG `r()`
   is consumed in a FIXED order/count that never depends on the runtime
   audio values - only the position/size/alpha *computed* from a draw may
   depend on audio, never how many times r() gets called before it. Seed-
   driven branching (time of day, weather, formation type...) is the
   opposite - that's expected and is exactly how a seed produces a visibly
   different world; it's fine for different SEEDS to consume different
   r() counts. An audio-gated flourish (a kick splash, a treble sparkle
   burst) is safe when it either (a) always rolls its r() value first and
   only branches on audio+roll together (never audio alone), or (b) is the
   LAST thing a scene draws, since nothing downstream then depends on the
   RNG sequence it consumes. This is what keeps "same seed + same scene +
   same settings reproduce the same base composition" true for PAINT while
   still letting MUSIC react smoothly rather than glitching between frames
   when a threshold is crossed. */
(function (global) {
  'use strict';

  const engine = global.LivingArtEngine;
  const PALETTES = engine.PALETTES;
  const rngFromSeed = engine.rngFromSeed;
  const clamp = engine.clamp;
  const mix = engine.mix;
  const rgba = engine.rgba;
  const hexToRgb = engine.hexToRgb;

  // -------------------------------------------------------- colour helpers -
  // Every colour used in a scene is derived from the 5-slot palette through
  // these, rather than a raw pal[n] - so "lighter version of the accent",
  // "this object in shadow", "this distant hill hazed toward the sky" all
  // stay visually related instead of five arbitrarily different hues.
  function mixRgb(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  }
  function rgbaOf(c, alpha) {
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (alpha == null ? 1 : alpha) + ')';
  }
  // amt -1..1: negative darkens toward black, positive lightens toward white
  function shade(hex, amt, alpha) {
    const c = hexToRgb(hex);
    const out = amt >= 0 ? c.map(function (v) { return v + (255 - v) * amt; }) : c.map(function (v) { return v * (1 + amt); });
    return rgbaOf(out, alpha);
  }
  function blend(hexA, hexB, t, alpha) { return rgbaOf(mixRgb(hexA, hexB, t), alpha); }
  // Atmospheric perspective: an object at `depth` (0 near .. 1 far) hazes
  // toward the sky/horizon colour and loses a little opacity.
  function depthTint(hex, hazeHex, depth, baseAlpha) {
    return blend(hex, hazeHex, depth * 0.7, baseAlpha * (1 - depth * 0.35));
  }

  // Cheap deterministic drifting-particle layer shared by several scenes
  // (mist motes, fireflies, falling leaves, luminous fog, sparks). Bounded
  // count, no per-pixel work, one arc() per particle.
  function driftParticles(ctx, r, w, h, count, color, t, driftX, driftY, sizeMin, sizeMax, alpha) {
    for (let i = 0; i < count; i++) {
      const px = r() * 1.2 - 0.1, py = r();
      const x = (((px + driftX * t) % 1.2) + 1.2) % 1.2 * w - w * 0.1;
      const y = (((py + driftY * t) % 1) + 1) % 1 * h;
      const s = sizeMin + r() * (sizeMax - sizeMin);
      ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ============================================================ A. RIVER MILL
  function drawRiverMill(ctx, w, h, r, pal, t, a, density, q) {
    // ---- seed rolls (fixed count/order, unconditional - drives the world) --
    const timeOfDay = Math.floor(r() * 4);   // 0 dawn, 1 day, 2 dusk, 3 night
    const weather = Math.floor(r() * 4);     // 0 clear, 1 mist, 2 leaves, 3 fireflies
    const lightSide = r() < 0.5 ? -1 : 1;
    const houseSide = r() < 0.5 ? -1 : 1;    // keeps the mill off dead-centre, away from a wall gap
    const wheelScale = 0.85 + r() * 0.35;
    const horizon = h * (0.42 + r() * 0.06);
    const riverTop = h * (0.58 + r() * 0.05);
    const riverBend = (r() - 0.5) * 0.25;
    const skyLow = timeOfDay === 0 ? pal[4] : timeOfDay === 2 ? pal[3] : timeOfDay === 3 ? pal[0] : pal[1];

    // ---- 1. BACKGROUND: sky, time-of-day lit ----
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, shade(pal[0], timeOfDay === 3 ? -0.35 : 0.12, 1));
    sky.addColorStop(0.65, blend(pal[0], skyLow, 0.55, 1));
    sky.addColorStop(1, blend(skyLow, pal[1], 0.35, 1));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon + 1);

    const sunX = w * (0.5 + lightSide * 0.3), sunY = horizon * (timeOfDay === 1 ? 0.22 : 0.5);
    const sunR = Math.min(w, h) * (timeOfDay === 3 ? 0.045 : 0.085);
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 4.5);
    sunGlow.addColorStop(0, shade(pal[4], timeOfDay === 3 ? 0.35 : 0.55, timeOfDay === 3 ? 0.45 : 0.75));
    sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sunGlow; ctx.fillRect(0, 0, w, horizon);
    ctx.fillStyle = shade(pal[4], 0.65, timeOfDay === 3 ? 0.65 : 0.95);
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();

    if (timeOfDay === 3) {
      for (let i = 0; i < 44; i++) {
        ctx.globalAlpha = 0.25 + r() * 0.5;
        ctx.fillStyle = shade(pal[1], 0.6, 1);
        ctx.beginPath(); ctx.arc(r() * w, r() * horizon * 0.85, 0.5 + r() * 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ---- 2. DISTANT ENVIRONMENT: layered hazed hill bands + tiny trees ----
    const hillBands = 3;
    for (let b = 0; b < hillBands; b++) {
      const depth = 1 - b / (hillBands - 1);
      const bandTop = horizon - (hillBands - b) * h * 0.026;
      ctx.fillStyle = depthTint(pal[1], skyLow, depth, 0.85);
      ctx.beginPath(); ctx.moveTo(0, horizon + 2);
      const pts = 7;
      for (let i = 0; i <= pts; i++) {
        const x = (i / pts) * w;
        const y = bandTop - (8 + r() * 30) * (0.5 + 0.5 * Math.sin(i * 1.7 + b * 2.3));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, horizon + 2); ctx.closePath(); ctx.fill();
    }
    const distTrees = Math.floor(7 + density * 0.05);
    ctx.fillStyle = depthTint(pal[2], skyLow, 0.6, 0.7);
    for (let i = 0; i < distTrees; i++) {
      const tx = r() * w, ty = horizon - 1 - r() * h * 0.015;
      ctx.beginPath(); ctx.arc(tx, ty, 2 + r() * 3, 0, Math.PI * 2); ctx.fill();
    }

    // ---- 3. MIDGROUND: bank grass strip + reeds/bushes ----
    ctx.fillStyle = depthTint(pal[2], skyLow, 0.25, 0.9);
    ctx.fillRect(0, horizon - 2, w, riverTop - horizon + 6);
    const bushN = Math.floor(6 + density * 0.05);
    for (let i = 0; i < bushN; i++) {
      const bx = r() * w, by = horizon + r() * (riverTop - horizon) * 0.6;
      ctx.fillStyle = shade(pal[2], -0.1 + r() * 0.3, 0.75);
      ctx.beginPath(); ctx.ellipse(bx, by, 7 + r() * 9, 5 + r() * 5, 0, 0, Math.PI * 2); ctx.fill();
    }

    // ---- 4. MAIN SUBJECT: river with perspective + mill + wheel ----
    // Water reflects the sky it sits under (a real-landscape convention)
    // rather than a fixed palette slot - this is what actually reads as
    // "water" regardless of which slot happens to be warm vs cool for a
    // given palette, and keeps it visually tied to the chosen time of day.
    const riverBottom = h;
    const flow = t * (0.6 + a.bass * 0.8);
    const water = ctx.createLinearGradient(0, riverTop, 0, riverBottom);
    water.addColorStop(0, blend(skyLow, pal[0], 0.35, 0.92));
    water.addColorStop(0.45, shade(pal[0], -0.15, 0.94));
    water.addColorStop(1, shade(pal[0], -0.45, 0.97));
    ctx.fillStyle = water;
    ctx.beginPath(); ctx.moveTo(0, riverTop);
    const bankPts = 12;
    for (let i = 0; i <= bankPts; i++) {
      const u = i / bankPts;
      const x = u * w;
      const bendY = Math.sin(u * Math.PI) * h * riverBend;
      const y = riverTop + bendY + Math.sin(i * 0.9 + flow * 0.6) * 5 * (1 + a.bass * 0.5);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, riverBottom); ctx.lineTo(0, riverBottom); ctx.closePath(); ctx.fill();

    // sun/moon reflection - the single strongest "this is water" cue, built
    // from short broken strokes (like real shimmer) rather than one filled
    // wedge, which reads as a spotlight instead of a reflection
    ctx.globalCompositeOperation = 'screen';
    const reflRows = 14;
    for (let i = 0; i < reflRows; i++) {
      const v = i / reflRows;
      const ry = riverTop + 6 + v * (riverBottom - riverTop - 10);
      const spread = w * (0.008 + v * 0.05);
      const segX = sunX + (r() - 0.5) * spread * 2;
      const segLen = 4 + v * 16 + r() * 6;
      ctx.strokeStyle = shade(pal[4], 0.5, (0.5 - v * 0.25) * (0.5 + a.treble * 0.2));
      ctx.lineWidth = 1.2 + v * 1.6;
      ctx.beginPath(); ctx.moveTo(segX - segLen / 2, ry); ctx.lineTo(segX + segLen / 2, ry); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // darker deep-water pooling + a few stones near the near bank
    ctx.fillStyle = shade(pal[0], -0.4, 0.25);
    ctx.beginPath(); ctx.ellipse(w * 0.5, riverTop + (riverBottom - riverTop) * 0.6, w * 0.32, (riverBottom - riverTop) * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    const stoneN = Math.floor(3 + density * 0.02);
    for (let i = 0; i < stoneN; i++) {
      const sx = r() * w, sy = riverTop + r() * (riverBottom - riverTop) * 0.35;
      ctx.fillStyle = shade(pal[1], -0.2 + r() * 0.3, 0.6);
      ctx.beginPath(); ctx.ellipse(sx, sy, 3 + r() * 4, 1.6 + r() * 2, 0, 0, Math.PI * 2); ctx.fill();
    }

    // shimmer highlights scrolling downstream, aligned toward the light side
    ctx.globalCompositeOperation = 'screen';
    const shimmerN = Math.floor((10 + density * 0.14) * q * (1 + a.treble * 0.6));
    for (let i = 0; i < shimmerN; i++) {
      const ry = riverTop + 10 + (i / shimmerN) * (riverBottom - riverTop - 20);
      const xoff = ((flow * 42 + i * 53) % (w + 80)) - 40 + lightSide * w * 0.1;
      ctx.strokeStyle = shade(pal[4], 0.4, 0.12 + 0.22 * a.treble + 0.08 * Math.sin(i + flow));
      ctx.lineWidth = 1 + (i % 3) * 0.6;
      ctx.beginPath(); ctx.moveTo(xoff, ry); ctx.lineTo(xoff + 60 + a.bass * 30, ry + Math.sin(i) * 2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // mill building - varied proportions, roof, chimney, windows, eaves
    const houseW = w * (0.15 + r() * 0.03), houseH = h * (0.1 + r() * 0.02);
    const houseX = w * 0.5 + houseSide * w * (0.2 + r() * 0.1) - houseW / 2;
    const houseY = riverTop - houseH - h * 0.03;
    ctx.fillStyle = shade(pal[1], -0.05, 0.92);
    ctx.fillRect(houseX, houseY, houseW, houseH);
    ctx.fillStyle = shade(pal[1], -0.25, 0.5); // shadow side
    ctx.fillRect(houseX + houseW * (houseSide > 0 ? 0.7 : 0), houseY, houseW * 0.3, houseH);
    // roof with eave overhang
    ctx.beginPath();
    ctx.moveTo(houseX - houseW * 0.12, houseY);
    ctx.lineTo(houseX + houseW * 0.5, houseY - houseH * 0.65);
    ctx.lineTo(houseX + houseW * 1.12, houseY);
    ctx.closePath(); ctx.fillStyle = shade(pal[3], -0.1, 0.95); ctx.fill();
    // chimney
    ctx.fillStyle = shade(pal[1], -0.3, 0.9);
    ctx.fillRect(houseX + houseW * 0.72, houseY - houseH * 0.55, houseW * 0.09, houseH * 0.4);
    // windows, glowing warmly at dusk/night
    const winLit = timeOfDay >= 2;
    ctx.fillStyle = winLit ? shade(pal[4], 0.5, 0.85 + a.kick * 0.15) : shade(pal[0], -0.35, 0.8);
    ctx.fillRect(houseX + houseW * 0.18, houseY + houseH * 0.32, houseW * 0.18, houseH * 0.36);
    ctx.fillRect(houseX + houseW * 0.62, houseY + houseH * 0.32, houseW * 0.18, houseH * 0.36);
    // door
    ctx.fillStyle = shade(pal[3], -0.25, 0.9);
    ctx.fillRect(houseX + houseW * 0.42, houseY + houseH * 0.5, houseW * 0.16, houseH * 0.5);

    // mill wheel - attached to a flume channel, real paddles with thickness
    const wheelR = Math.min(w, h) * 0.06 * wheelScale * (1 + a.bass * 0.1);
    const wheelX = houseX + (houseSide > 0 ? -wheelR * 1.1 : houseW + wheelR * 1.1);
    const wheelY = riverTop + wheelR * 0.35;
    ctx.fillStyle = shade(pal[1], -0.15, 0.6); // channel/flume recess
    ctx.fillRect(wheelX - wheelR * 1.3, riverTop - 2, wheelR * 2.6, h * 0.06);
    const spin = t * (0.6 + a.mid * 1.4);
    ctx.save(); ctx.translate(wheelX, wheelY); ctx.rotate(spin);
    const paddles = 10;
    for (let i = 0; i < paddles; i++) {
      const ang = (i / paddles) * Math.PI * 2;
      ctx.save(); ctx.rotate(ang);
      const wet = Math.sin(ang - spin + Math.PI * 0.5) > 0.3;
      ctx.fillStyle = wet ? shade(pal[2], -0.2, 0.95) : shade(pal[2], 0.08, 0.9);
      ctx.fillRect(wheelR * 0.28, -wheelR * 0.09, wheelR * 0.74, wheelR * 0.18);
      ctx.restore();
    }
    ctx.fillStyle = shade(pal[1], -0.3, 0.95);
    ctx.beginPath(); ctx.arc(0, 0, wheelR * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(pal[2], -0.1, 0.9); ctx.lineWidth = wheelR * 0.09;
    ctx.beginPath(); ctx.arc(0, 0, wheelR * 0.98, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // reflection of house + wheel, rippled
    ctx.save();
    ctx.globalAlpha = 0.16 + a.treble * 0.05;
    ctx.translate(0, riverTop * 2); ctx.scale(1, -1);
    ctx.fillStyle = shade(pal[1], -0.05, 1);
    ctx.fillRect(houseX, houseY, houseW, houseH * 0.6);
    ctx.restore();

    // ---- 5. FOREGROUND: reeds/grass tufts framing the bottom of frame only -
    // kept low and sparse so they frame the water rather than covering it
    const reedN = Math.floor(6 + density * 0.05);
    for (let i = 0; i < reedN; i++) {
      const rx = r() * w, ry = riverBottom - r() * h * 0.03;
      const sway = Math.sin(t * 0.5 + i) * 5 * (1 + a.mid * 0.4);
      const rh = 9 + r() * 15;
      ctx.strokeStyle = shade(pal[2], -0.1 + r() * 0.2, 0.62);
      ctx.lineWidth = 1.3 + r() * 1;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx + sway * 0.5, ry - rh * 0.6, rx + sway, ry - rh); ctx.stroke();
    }

    // ---- 6. ATMOSPHERE: seed-chosen weather layer ----
    if (weather === 1) {
      ctx.fillStyle = blend(pal[1], skyLow, 0.5, 0.10);
      for (let i = 0; i < 4; i++) ctx.fillRect(0, riverTop - h * 0.05 + i * h * 0.025, w, h * 0.03);
    } else if (weather === 2) {
      driftParticles(ctx, r, w, h, Math.floor(10 + density * 0.08), shade(pal[3], 0.1, 1), t, 0.03, 0.015, 1.5, 3.5, 0.5);
    } else if (weather === 3 && timeOfDay >= 2) {
      driftParticles(ctx, r, w, h, Math.floor(8 + density * 0.06), shade(pal[4], 0.5, 1), t * 0.6, 0.01, -0.02, 1, 2.2, 0.6);
    }

    // ---- 8. MUSIC EVENTS: splash bursts at the wheel base on kick (last) --
    if (a.kick > 0.05) {
      ctx.globalCompositeOperation = 'screen';
      const n = Math.floor(4 + a.kick * 8);
      for (let i = 0; i < n; i++) {
        const ang = r() * Math.PI * 2;
        const rr = wheelR * (0.6 + r() * 1.4) * a.kick;
        ctx.fillStyle = shade(pal[4], 0.3, 0.5 * a.kick);
        ctx.beginPath(); ctx.arc(wheelX + Math.cos(ang) * rr, wheelY + wheelR * 0.7 + Math.sin(ang) * rr * 0.3, 1.5 + r() * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ========================================================= B. OPEN ARMS ==
  function drawOpenArms(ctx, w, h, r, pal, t, a, density, q) {
    // ---- seed rolls ----
    const envType = Math.floor(r() * 4); // 0 cloudscape, 1 mountains, 2 cathedral, 3 darkness+light
    const figureScale = 0.92 + r() * 0.18;
    const lightDir = r() < 0.5 ? -1 : 1;
    const robeVariant = r();

    const cx = w * 0.5, cy = h * 0.58; // kept centred deliberately so the face sits inside a panel, not on a wall gap

    // ---- 1. BACKGROUND + 2. DISTANT ENVIRONMENT ----
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, shade(pal[0], envType === 3 ? -0.4 : 0.05, 1));
    skyGrad.addColorStop(0.55, blend(pal[0], pal[3], 0.4, 1));
    skyGrad.addColorStop(1, blend(pal[3], pal[0], 0.35, 1));
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, h);

    if (envType === 0) { // cloudscape - soft layered banks below the horizon line
      for (let b = 0; b < 4; b++) {
        const by = h * (0.55 + b * 0.1);
        ctx.fillStyle = depthTint(pal[1], pal[0], b / 4, 0.35);
        for (let i = 0; i < 3; i++) {
          const cxx = r() * w, cr = w * (0.12 + r() * 0.12);
          ctx.beginPath(); ctx.ellipse(cxx, by + Math.sin(t * 0.1 + b) * 4, cr, cr * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    } else if (envType === 1) { // distant mountain silhouette
      ctx.fillStyle = depthTint(pal[1], pal[0], 0.5, 0.6);
      ctx.beginPath(); ctx.moveTo(0, h * 0.78);
      for (let i = 0; i <= 8; i++) ctx.lineTo((i / 8) * w, h * 0.78 - (10 + r() * 60));
      ctx.lineTo(w, h * 0.78); ctx.closePath(); ctx.fill();
    } else if (envType === 2) { // abstract cathedral-like space: tall pillars of light/shadow
      for (let i = 0; i < 5; i++) {
        const px = (i + 0.5) / 5 * w;
        ctx.fillStyle = shade(pal[1], i % 2 ? -0.2 : 0.1, 0.18);
        ctx.fillRect(px - w * 0.04, 0, w * 0.08, h);
      }
    }
    // envType 3 (darkness+light) uses no extra distant layer - the light itself carries the scene

    // ---- 7. LIGHT: rays, halo, rim light, luminous fog (signature element) --
    ctx.save(); ctx.translate(cx, cy - h * 0.14);
    const rays = Math.floor((14 + density * 0.08) * q);
    const rayRot = t * (0.025 + a.mid * 0.05);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2 + rayRot;
      const len = Math.max(w, h) * (0.34 + r() * 0.24) * (1 + a.kick * 0.3);
      const beamW = 2 + r() * 5;
      const g = ctx.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len);
      g.addColorStop(0, shade(pal[4], 0.5, 0.14 + 0.1 * r() + a.treble * 0.06));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = beamW;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len); ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    const haloR = Math.min(w, h) * (0.1 + a.bass * 0.02) * figureScale * (1 + Math.sin(t * 0.6) * 0.04);
    const halo = ctx.createRadialGradient(cx, cy - h * 0.24, 0, cx, cy - h * 0.24, haloR * 2.6);
    halo.addColorStop(0, shade(pal[4], 0.55, 0.65 + a.kick * 0.35));
    halo.addColorStop(0.4, shade(pal[3], 0.3, 0.18));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);

    // luminous fog low in the frame, grounding the figure
    const fog = ctx.createLinearGradient(0, h * 0.7, 0, h);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(1, shade(pal[4], 0.3, 0.12 + a.bass * 0.06));
    ctx.fillStyle = fog; ctx.fillRect(0, h * 0.7, w, h * 0.3);

    // ---- 4. MAIN SUBJECT: the figure - improved proportions, robe folds, hands
    const scale = Math.min(w, h) * figureScale * (1 + a.kick * 0.025);
    const headR = scale * 0.055;
    const headY = cy - h * 0.26;
    const neckY = headY + headR * 1.3;
    const shoulderY = neckY + headR * 0.6;
    const hipY = mix(shoulderY, cy + h * 0.3, 0.55);
    const hemY = cy + h * 0.24;
    // meaningfully wider than the robe hem so the gesture reads as open arms
    // rather than the robe's own wavy edge
    const armSpread = scale * (0.4 + a.kick * 0.035);
    const sway = Math.sin(t * 0.32) * scale * 0.01 * (1 + a.mid * 0.6);

    // rim light side (behind the silhouette, slightly offset toward lightDir)
    ctx.fillStyle = shade(pal[4], 0.4, 0.22);
    ctx.beginPath(); ctx.arc(cx + lightDir * headR * 0.15, headY, headR * 1.08, 0, Math.PI * 2); ctx.fill();

    const bodyFill = shade(pal[2], -0.05, 0.95);
    ctx.fillStyle = bodyFill;
    ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2); ctx.fill();
    // neck + shoulders taper into robe
    ctx.beginPath();
    ctx.moveTo(cx - scale * 0.055, neckY);
    ctx.quadraticCurveTo(cx - scale * 0.11, shoulderY, cx - scale * 0.16, shoulderY + headR * 0.5);
    ctx.lineTo(cx + scale * 0.16, shoulderY + headR * 0.5);
    ctx.quadraticCurveTo(cx + scale * 0.11, shoulderY, cx + scale * 0.055, neckY);
    ctx.closePath(); ctx.fill();

    // robe body with a few vertical fold lines for garment structure
    ctx.beginPath();
    ctx.moveTo(cx - scale * 0.16, shoulderY + headR * 0.5);
    ctx.quadraticCurveTo(cx - scale * 0.21 + sway, mix(hipY, hemY, 0.3), cx - scale * (0.22 + robeVariant * 0.05), hemY);
    ctx.lineTo(cx + scale * (0.22 + robeVariant * 0.05), hemY);
    ctx.quadraticCurveTo(cx + scale * 0.21 + sway, mix(hipY, hemY, 0.3), cx + scale * 0.16, shoulderY + headR * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(pal[2], -0.3, 0.4); ctx.lineWidth = scale * 0.006;
    for (let i = -2; i <= 2; i++) {
      const fx0 = cx + i * scale * 0.045, fx1 = fx0 + i * scale * 0.02 + sway * 0.6;
      ctx.beginPath(); ctx.moveTo(fx0, shoulderY + headR * 0.7); ctx.quadraticCurveTo(fx0, mix(shoulderY, hemY, 0.6), fx1, hemY); ctx.stroke();
    }

    // arms, open gesture: shoulder -> rises outward -> settles level with the
    // shoulder line at full spread, the classic welcoming/open silhouette -
    // drawn as a filled tapered wedge (not a thin stroke) so it reads at a
    // glance, with a simple rounded hand shape at each end.
    [-1, 1].forEach(function (side) {
      const sx = cx + side * scale * 0.1, sTop = shoulderY, sBot = shoulderY + headR * 0.9;
      const ex = cx + side * armSpread, ey = shoulderY - headR * 0.15;
      const cxp = cx + side * armSpread * 0.6, cypTop = shoulderY - headR * 1.6 + sway, cypBot = shoulderY - headR * 0.5 + sway;
      ctx.fillStyle = bodyFill;
      ctx.beginPath();
      ctx.moveTo(sx, sTop);
      ctx.quadraticCurveTo(cxp, cypTop, ex, ey - headR * 0.28);
      ctx.quadraticCurveTo(cxp, cypBot, sx, sBot);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = bodyFill;
      ctx.beginPath(); ctx.ellipse(ex, ey, headR * 0.34, headR * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    });

    // ---- 5/6. FOREGROUND + ATMOSPHERE: ground haze + rising motes ----
    driftParticles(ctx, r, w, h * 0.85, Math.floor(8 + density * 0.05), shade(pal[4], 0.5, 1), t, 0.005, -0.03, 0.8, 2, 0.35 + a.bass * 0.1);

    // ---- 8. MUSIC EVENTS: spark/halo detail from treble - last, terminal --
    ctx.globalCompositeOperation = 'screen';
    const motes = Math.floor(a.treble * 30);
    for (let i = 0; i < motes; i++) {
      const ang = r() * Math.PI * 2, rr = haloR * (1 + r() * 3);
      ctx.fillStyle = shade(pal[4], 0.5, 0.4 * r());
      ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rr, headY + Math.sin(ang) * rr * 0.7, 1 + r() * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ======================================================== C. BIRDS FLIGHT
  const FORMATIONS = ['v', 'cloud', 'stream', 'spiral'];
  // Crisp two-segment "gull" glyph (straight lines meeting at a peak) reads
  // as a distinct bird mark at small sizes far better than a smooth curve,
  // which blurs into neighbouring strokes and starts reading as texture.
  function birdMark(ctx, x, y, size, flap, color, alpha, lineWidth) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - size, y + flap * size * 0.45);
    ctx.lineTo(x, y - size * 0.62 - Math.abs(flap) * size * 0.35);
    ctx.lineTo(x + size, y + flap * size * 0.45);
    ctx.stroke();
  }

  function drawBirdsFlight(ctx, w, h, r, pal, t, a, density, q) {
    // ---- seed rolls ----
    const timeOfDay = Math.floor(r() * 3); // 0 dawn/dusk warm, 1 day, 2 overcast/blue
    const formation = FORMATIONS[Math.floor(r() * FORMATIONS.length)];
    const formAngle = (r() - 0.5) * 0.7; // subtle overall formation tilt - NOT applied per-bird
    const hasLandscape = r() < 0.5;
    const flockCount = Math.floor((30 + density * 0.55) * q);

    // ---- 1. BACKGROUND: sky + light source ----
    const skyLow = timeOfDay === 0 ? pal[4] : timeOfDay === 2 ? pal[1] : pal[3];
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, shade(pal[0], 0.12, 1));
    sky.addColorStop(0.6, blend(pal[0], skyLow, 0.5, 1));
    sky.addColorStop(1, blend(skyLow, pal[1], 0.3, 1));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const lx = w * (0.2 + r() * 0.6), ly = h * (0.12 + r() * 0.18);
    const lglow = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.min(w, h) * 0.4);
    lglow.addColorStop(0, shade(pal[4], 0.5, timeOfDay === 1 ? 0.35 : 0.55));
    lglow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lglow; ctx.fillRect(0, 0, w, h);

    // ---- 2. DISTANT ENVIRONMENT: clouds + optional landscape strip ----
    for (let i = 0; i < 5; i++) {
      const cxp = r() * w, cyp = h * (0.08 + r() * 0.3), cr = w * (0.05 + r() * 0.09);
      ctx.fillStyle = depthTint(pal[1], skyLow, 0.5 + r() * 0.3, 0.22);
      ctx.beginPath(); ctx.ellipse(cxp, cyp, cr, cr * 0.4, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (hasLandscape) {
      ctx.fillStyle = depthTint(pal[1], skyLow, 0.6, 0.7);
      ctx.beginPath(); ctx.moveTo(0, h * 0.88);
      for (let i = 0; i <= 6; i++) ctx.lineTo((i / 6) * w, h * 0.88 - (6 + r() * 26));
      ctx.lineTo(w, h * 0.88); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    }

    // ---- 4. MAIN SUBJECT: the flock, three depth bands, formation-shaped ---
    // Formation shape is resolved as an offset around a fixed anchor, then
    // rotated ONCE by the seed's formAngle - never per-bird - so the flock
    // reads as one coherent shape drifting across the sky instead of many
    // independently-rotated marks smearing into a texture.
    const cosF = Math.cos(formAngle), sinF = Math.sin(formAngle);
    const anchorX = 0.5, anchorY = 0.32;
    const drift = t * (0.018 + a.bass * 0.045);
    const liftEvent = a.kick; // formation lift/split/reform impulse

    function formationOffset(u) {
      if (formation === 'v') {
        const side = u < 0.5 ? -1 : 1;
        const k = Math.abs(u - 0.5) * 2;
        return [side * k, k * 0.55];
      }
      if (formation === 'stream') {
        return [(u - 0.5) * 2, Math.sin(u * Math.PI * 2.4) * 0.3];
      }
      if (formation === 'spiral') {
        const ang = u * Math.PI * 5;
        const rr = 0.1 + u * 0.85;
        return [Math.cos(ang) * rr, Math.sin(ang) * rr * 0.55];
      }
      return [(u - 0.5) * 1.9, Math.sin(u * 9) * 0.5]; // cloud - loose scatter
    }

    const BANDS = [
      { depth: 0.88, frac: 0.42, spread: 0.44, sizeMin: 2, sizeMax: 4 },   // distant, tiny
      { depth: 0.46, frac: 0.4, spread: 0.34, sizeMin: 6, sizeMax: 10 },  // mid flock, carries the formation shape
      { depth: 0.06, frac: 0.18, spread: 0.22, sizeMin: 13, sizeMax: 20 } // occasional foreground, large + detailed
    ];
    BANDS.forEach(function (band) {
      const n = Math.max(3, Math.round(flockCount * band.frac));
      for (let i = 0; i < n; i++) {
        const u = r();
        const jx = (r() - 0.5) * 0.05, jy = (r() - 0.5) * 0.05;
        const off = formationOffset(u);
        const ox = (off[0] + jx) * band.spread, oy = (off[1] + jy) * band.spread * 0.6;
        const rx = ox * cosF - oy * sinF, ry = ox * sinF + oy * cosF;
        const scatter = liftEvent * (1 - band.depth) * (i % 2 ? 1 : -1) * 0.5;

        const rawX = anchorX + rx * (1 - band.depth * 0.15) + drift;
        const px = (((rawX % 1.3) + 1.3) % 1.3);
        const x = px * w - w * 0.15;
        const y = clamp(anchorY + band.depth * 0.32 + ry, 0.04, 0.8) * h - scatter * 22;

        const glintRoll = r(); // always consumed - keeps every later bird audio-independent
        const size = (band.sizeMin + glintRoll * (band.sizeMax - band.sizeMin)) * q;
        const flap = Math.sin(t * (3 + a.mid * 4) + i * 1.9 + band.depth * 5) * (0.4 + a.mid * 0.5 + Math.abs(liftEvent) * 0.3);
        const alpha = (0.35 + (1 - band.depth) * 0.55) + a.treble * 0.06;
        const color = depthTint(pal[2], skyLow, band.depth * 0.45, 1);
        const lw = (0.8 + size * 0.09) * (0.8 + band.depth * 0.2);

        birdMark(ctx, x, y, size, flap, color, alpha, lw);

        if (band.depth < 0.2 && a.treble > 0.3 && glintRoll > 0.55) {
          ctx.fillStyle = shade(pal[4], 0.5, 0.35 * a.treble);
          ctx.beginPath(); ctx.arc(x, y - size * 0.4, 1 + glintRoll * 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
    });
    ctx.globalAlpha = 1;
  }

  // ======================================================= D. COASTER RIDE ==
  const COASTER_ENVIRONMENTS = ['night-park', 'sunset', 'industrial', 'neon'];
  function drawCoasterRide(ctx, w, h, r, pal, t, a, density, q) {
    // ---- seed rolls ----
    const env = COASTER_ENVIRONMENTS[Math.floor(r() * COASTER_ENVIRONMENTS.length)];
    const hasLoop = r() < 0.55;
    const hasTunnel = r() < 0.35;
    const segs = 6 + Math.floor(density / 22);

    // ---- 1. BACKGROUND: environment-specific sky + skyline ----
    const isNight = env === 'night-park' || env === 'neon';
    const skyLow = env === 'sunset' ? pal[4] : env === 'neon' ? pal[3] : pal[1];
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, shade(pal[0], isNight ? -0.35 : 0.08, 1));
    sky.addColorStop(0.7, blend(pal[0], skyLow, isNight ? 0.25 : 0.5, 1));
    sky.addColorStop(1, blend(skyLow, pal[0], 0.3, 1));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    if (isNight) {
      for (let i = 0; i < 50; i++) {
        ctx.globalAlpha = 0.2 + r() * 0.5;
        ctx.fillStyle = shade(pal[4], 0.5, 1);
        ctx.beginPath(); ctx.arc(r() * w, r() * h * 0.5, 0.5 + r() * 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ---- 2. DISTANT ENVIRONMENT: skyline of a distant structure/other rides -
    const skylineN = env === 'industrial' ? 6 : 4;
    for (let i = 0; i < skylineN; i++) {
      const bx = (i / skylineN) * w + r() * (w / skylineN) * 0.3;
      const bh = h * (0.1 + r() * (env === 'industrial' ? 0.28 : 0.16));
      ctx.fillStyle = depthTint(pal[1], skyLow, 0.6, 0.55);
      ctx.fillRect(bx, h * 0.86 - bh, w / skylineN * 0.5, bh);
      if (env === 'neon' || env === 'night-park') {
        ctx.fillStyle = shade(pal[4], 0.5, 0.25 + r() * 0.3);
        for (let wy = 0; wy < bh; wy += 8) ctx.fillRect(bx + 2, h * 0.86 - bh + wy, 2, 2);
      }
    }
    ctx.fillStyle = depthTint(pal[1], skyLow, 0.4, 0.4);
    ctx.fillRect(0, h * 0.86, w, h * 0.14);

    // ---- track geometry: hills/drops/curves, optional loop + tunnel -------
    const baseY = h * 0.55;
    const pts = [[w * 0.04, h * 0.5]];
    let px = w * 0.04;
    for (let i = 0; i < segs; i++) {
      px += (w * 0.92) / segs;
      const amp = i === 0 ? 0.12 : 0.14 + r() * 0.22; // first hill = the "lift hill", tallest
      pts.push([px, baseY - amp * h * (i === 0 ? 1.6 : 1)]);
    }
    const loopAt = hasLoop ? 2 + Math.floor(r() * (segs - 3)) : -1;
    const loopCenter = loopAt >= 0 ? pts[loopAt].slice() : null;
    const loopR = Math.min(w, h) * 0.075;
    if (loopCenter) loopCenter[1] = Math.min(loopCenter[1], baseY - loopR * 2.2);
    const tunnelAt = hasTunnel ? Math.floor(r() * pts.length) : -1;

    function trackPoint(u) {
      const n = pts.length - 1;
      const seg = clamp(Math.floor(u * n), 0, n - 1);
      const lt = u * n - seg;
      if (loopCenter && seg === loopAt && lt < 1) {
        const ang = -Math.PI / 2 + lt * Math.PI * 2;
        return [loopCenter[0] + Math.cos(ang) * loopR, loopCenter[1] + Math.sin(ang) * loopR];
      }
      const p0 = pts[seg], p1 = pts[seg + 1];
      const y = mix(p0[1], p1[1], lt) - Math.sin(lt * Math.PI) * h * 0.035;
      return [mix(p0[0], p1[0], lt), y];
    }

    // ---- support structure (drawn behind the rail so it reads as depth) ---
    ctx.strokeStyle = depthTint(pal[1], skyLow, 0.3, 0.65);
    ctx.lineWidth = 3;
    for (let i = 0; i < pts.length; i++) {
      const [sx, sy] = pts[i];
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, h * 0.86); ctx.stroke();
      if (i > 0) {
        ctx.beginPath(); ctx.moveTo(sx, mix(sy, h * 0.86, 0.4)); ctx.lineTo(sx - (w * 0.9 / segs) * 0.5, h * 0.86); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx, mix(sy, h * 0.86, 0.7)); ctx.lineTo(sx - (w * 0.9 / segs) * 0.25, h * 0.86); ctx.stroke();
      }
    }

    // ---- rail: two parallel rails with thickness + cross-ties -------------
    const rumble = a.bass * 2.4;
    const railSteps = Math.floor(110 * q);
    const half = 3.2;
    function railPass(offsetSign) {
      ctx.beginPath();
      for (let i = 0; i <= railSteps; i++) {
        const u = i / railSteps;
        const p = trackPoint(u);
        const p2 = trackPoint(Math.min(1, u + 0.004));
        const dx = p2[0] - p[0], dy = p2[1] - p[1], len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        const jitter = (r() - 0.5) * rumble;
        const x = p[0] + nx * half * offsetSign, y = p[1] + ny * half * offsetSign + jitter;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = shade(pal[2], 0.15, 0.95);
    ctx.lineWidth = 2 + a.bass * 1;
    railPass(1);
    ctx.strokeStyle = shade(pal[2], -0.2, 0.95);
    railPass(-1);
    ctx.strokeStyle = shade(pal[1], -0.1, 0.5); ctx.lineWidth = 1.2;
    const ties = Math.floor(46 * q);
    for (let i = 0; i < ties; i++) {
      const u = i / ties;
      const p = trackPoint(u), p2 = trackPoint(Math.min(1, u + 0.006));
      const dx = p2[0] - p[0], dy = p2[1] - p[1], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      ctx.beginPath(); ctx.moveTo(p[0] - nx * half, p[1] - ny * half); ctx.lineTo(p[0] + nx * half, p[1] + ny * half); ctx.stroke();
    }

    // tunnel mouth if rolled - a dark arch the track passes through
    if (tunnelAt >= 0 && tunnelAt < pts.length) {
      const [tx, ty] = pts[tunnelAt];
      ctx.fillStyle = shade(pal[0], -0.5, 0.9);
      ctx.beginPath(); ctx.arc(tx, ty + 6, Math.min(w, h) * 0.05, Math.PI, Math.PI * 2); ctx.fill();
    }

    // ---- lights - chase speed from mid, brightness from treble ------------
    const lightN = Math.floor((16 + density * 0.2) * q);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < lightN; i++) {
      const u = (i / lightN + t * (0.02 + a.mid * 0.05)) % 1;
      const p = trackPoint(u);
      const twinkle = 0.4 + 0.4 * Math.sin(t * 2 + i * 2.1);
      ctx.fillStyle = shade(pal[4], 0.5, 0.2 + twinkle * 0.3 + a.treble * 0.25);
      ctx.beginPath(); ctx.arc(p[0], p[1] - 4, 1.4 + a.treble * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // ---- cars: connected train with riders, oriented to track direction ---
    const speed = 0.045 + a.bass * 0.11 + a.kick * 0.22;
    const carCount = 4;
    const carGap = 0.018;
    for (let c = 0; c < carCount; c++) {
      const u = (t * speed - c * carGap + 1) % 1;
      const p = trackPoint(u), pa = trackPoint((u + 0.006) % 1);
      const ang = Math.atan2(pa[1] - p[1], pa[0] - p[0]);
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang);
      ctx.fillStyle = shade(pal[3], c % 2 ? -0.1 : 0.1, 0.95);
      ctx.fillRect(-7, -4, 14, 8);
      ctx.fillStyle = shade(pal[1], -0.3, 0.9);
      for (let s = -1; s <= 1; s += 2) { ctx.beginPath(); ctx.arc(s * 4, 5, 1.8, 0, Math.PI * 2); ctx.fill(); }
      if (q > 0.6) { // riders - cheap little dots, skipped at low quality
        ctx.fillStyle = shade(pal[2], 0.1, 0.9);
        ctx.beginPath(); ctx.arc(-3, -6, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -6, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // ---- MUSIC EVENT: launch flash at the lift-hill base on kick - last ---
    if (a.kick > 0.15) {
      const lp = trackPoint(0);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = shade(pal[4], 0.5, 0.5 * a.kick);
      ctx.beginPath(); ctx.arc(lp[0], lp[1], 10 + a.kick * 30, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  const SCENES = [
    {
      id: 'river-mill', name: 'River Mill', draw: drawRiverMill,
      musicProfile: { bass: 'current strength / water mass movement', mid: 'mill wheel rotation speed', treble: 'shimmer & splash highlight detail', kick: 'splash bursts at the wheel' }
    },
    {
      id: 'open-arms', name: 'Open Arms', draw: drawOpenArms,
      musicProfile: { bass: 'halo scale / grounded radiance', mid: 'aura & light-ray drift speed', treble: 'spark / halo mote detail', kick: 'radiance pulse burst' }
    },
    {
      id: 'birds-flight', name: 'Birds Flight', draw: drawBirdsFlight,
      musicProfile: { bass: 'flock global direction', mid: 'wing-flap speed / turbulence', treble: 'feather glint detail', kick: 'formation lift / split / reform' }
    },
    {
      id: 'coaster-ride', name: 'Coaster Ride', draw: drawCoasterRide,
      musicProfile: { bass: 'car momentum / track rumble', mid: 'light-chase travel speed', treble: 'sparks & track light detail', kick: 'drop / launch burst' }
    }
  ];
  const SAFE_SCENE_INDEX = 0;

  function sceneIndexById(id) {
    for (let i = 0; i < SCENES.length; i++) if (SCENES[i].id === id) return i;
    return -1;
  }
  function sceneById(id) {
    const i = sceneIndexById(id);
    return SCENES[i >= 0 ? i : SAFE_SCENE_INDEX];
  }

  /* Mirrors engine.renderRecipe's contract exactly (same PAINT/LIVE/MUSIC
     pipeline, same safe-fallback behaviour) so app.js can dispatch to
     either module interchangeably based on state.contentType. */
  function renderScene(ctx, w, h, recipe, audio, quality) {
    const pal = (PALETTES[((recipe.palette % PALETTES.length) + PALETTES.length) % PALETTES.length] || PALETTES[0]).colors;
    const scene = sceneById(recipe.sceneId);
    const r = rngFromSeed(recipe.seed + '|' + scene.id + '|' + recipe.palette);
    const q = quality ? quality.detail : 0.85;
    const a = audio || engine.NEUTRAL_AUDIO;
    ctx.save();
    try {
      // Guaranteed fully-opaque base coat, matching engine.js's bg(): the
      // canvas passed in is the SAME element reused frame after frame in
      // LIVE/MUSIC (ensureCanvasSize only resets it on an actual resize),
      // and every scene's own sky/backdrop gradients are intentionally
      // semi-transparent in places - without this, those gradients would
      // blend with whatever was left over from the previous frame instead
      // of cleanly repainting, and "same seed + same settings reproduce
      // the same base composition" would not hold for a reused canvas.
      ctx.fillStyle = pal[0];
      ctx.fillRect(0, 0, w, h);
      scene.draw(ctx, w, h, r, pal, recipe.phase || 0, a, clamp(recipe.density, 20, 100), q);
      const v = ctx.createLinearGradient(0, 0, w, h);
      v.addColorStop(0, 'rgba(255,255,255,.03)');
      v.addColorStop(0.5, 'rgba(255,255,255,0)');
      v.addColorStop(1, 'rgba(0,0,0,.11)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    } catch (err) {
      console.warn('[Living Art] scene render failed, falling back to safe gradient', err);
      ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, rgba(pal[2], 0.5)); g.addColorStop(1, rgba(pal[0], 1));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  global.LivingArtScenes = { SCENES, sceneById, sceneIndexById, renderScene };
})(window);
