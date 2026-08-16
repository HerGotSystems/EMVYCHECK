/* EMVY CHECK Living Art V6 — scene families, composition + richness pass.
   A second, representational content layer alongside the existing abstract
   procedural FAMILIES in engine.js. Same deterministic-seed pipeline, same
   PAINT/LIVE/MUSIC contract: at phase=0 with NEUTRAL_AUDIO every scene must
   read as a proper still composition (PAINT); as `t` advances it drifts
   ambiently (LIVE); as `a.*` moves off zero it reacts with scene-specific,
   designed events rather than generic pulsing (MUSIC) - see each scene's
   `musicProfile` below for the mapping.

   V6 adds real COMPOSITION ARCHETYPES per scene (picked once, deterministically,
   from the seed) - a different seed doesn't just move details around inside
   the same template, it can change which side the subject sits on, how the
   ground is shaped, how big the subject is, and what kind of terrain/formation
   surrounds it. See each scene's *_ARCHETYPES table.

   Determinism rule every scene function must follow: the seeded RNG `r()`
   is consumed in a FIXED order/count that never depends on the runtime
   audio values - only the position/size/alpha *computed* from a draw may
   depend on audio, never how many times r() gets called before it. Seed-
   driven branching (archetype, time of day, weather, formation type...) is
   the opposite - that's expected and is exactly how a seed produces a
   visibly different world; it's fine for different SEEDS to consume
   different r() counts. An audio-gated flourish (a kick splash, a treble
   sparkle burst) is safe when it either (a) always rolls its r() value
   first and only branches on audio+roll together (never audio alone), or
   (b) is the LAST thing a scene draws, since nothing downstream then
   depends on the RNG sequence it consumes. */
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
  // stay visually related instead of five arbitrarily different hues, and a
  // palette swap visibly and coherently recolours the whole world.
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
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }

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

  // An irregular closed blob (canopy, cloud, bush, rock) - deterministic
  // jitter per vertex instead of a perfect ellipse, which is what makes
  // hand-drawn/painterly shapes read as organic rather than diagrammatic.
  function organicBlob(ctx, r, cx, cy, rx, ry, points, irregularity) {
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const ang = (i / points) * Math.PI * 2;
      const jitter = 1 + (r() - 0.5) * 2 * irregularity;
      const x = cx + Math.cos(ang) * rx * jitter, y = cy + Math.sin(ang) * ry * jitter;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  // An irregular ridge line from x=0..w ending back down at baseY on both
  // ends - used for hills/mountains/canopy edges. `jagged` biases toward
  // occasional sharp peaks instead of uniformly soft bumps.
  function ridgePath(ctx, r, w, baseY, segs, ampMin, ampMax, jagged) {
    ctx.moveTo(0, baseY);
    for (let i = 0; i <= segs; i++) {
      const x = (i / segs) * w;
      let amp = ampMin + r() * (ampMax - ampMin);
      if (jagged && r() > 0.72) amp *= 1.5 + r() * 0.6;
      const lean = (r() - 0.5) * (w / segs) * 0.6; // slight horizontal irregularity, not just vertical
      ctx.lineTo(x + lean, baseY - amp);
    }
    ctx.lineTo(w, baseY);
  }

  // A soft, low-alpha directional colour wash - a real landscape-painting
  // technique (glazing) for tying a whole scene together under one light
  // colour without flattening the detail underneath.
  function colourWash(ctx, w, h, hex, alpha, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, rgbaOf(hexToRgb(hex), alpha));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }

  /* ======================================================================
     V7 STORY / TIME LAYER (shared by River Mill, Open Arms, Birds Flight)

     A scene is not only "a seeded layout" - it also has a moment: a
     position in an ambient day/night cycle, and a couple of slow,
     always-running pulses that give small events (a wind gust through the
     reeds, a breath of radiance, a flock tightening before it lifts) even
     when nothing else is happening. This is intentionally lightweight -
     no state machine, no persisted history - every value here is a pure
     function of (seed roll, t, optional COLLECTION mood bias), which is
     what keeps PAINT reproducible and LIVE/MUSIC deterministic-safe.

     biasedRoll/biasedPick: COLLECTION mode wants its 9 panels to read as
     a curated spread across the day (and across archetypes) rather than
     9 independent dice rolls that might cluster by chance. `bias`, when
     given (0..1, set per-panel by buildIndependentEntries in app.js), is
     used INSTEAD of the seed's own roll - but the roll is always consumed
     first regardless, so r()'s call count/order never depends on whether
     a bias is present (the determinism rule at the top of this file). */
  function biasedRoll(r, bias) {
    const roll = r();
    return bias == null ? roll : ((bias % 1) + 1) % 1;
  }
  function biasedPick(r, arr, bias) {
    return arr[Math.floor(biasedRoll(r, bias) * arr.length) % arr.length];
  }

  // A full ambient day/night cycle takes ~10 minutes of continuous LIVE
  // viewing at the default Motion speed (t advances ~10 units/sec there -
  // see app.js currentPhase). PAINT always renders at t=0, so a scene's
  // day position there is purely its seed roll (or COLLECTION bias) -
  // exactly the per-artwork "what moment is this" identity V6 already had
  // for River Mill/Coaster, just continuous now instead of a hard 0-3 pick.
  const DAY_CYCLE_LENGTH = 6000;

  /* Returns a smoothly-interpolated time-of-day descriptor - no hard
     dawn/day/dusk/night buckets, so a scene left running visibly drifts
     from one into the next instead of jump-cutting. `warmth` is the sun's
     colour temperature (cool blue night -> warm gold dawn/dusk -> bright
     day), `dark` is how much night has taken over (drives stars/lit
     windows/moonlight), `sunAlt` is a -1..1 sun-height curve (peaks at
     midday, goes negative at night), and `eventPulse` briefly rises right
     as the scene crosses a band boundary - a "something just changed"
     beat a scene can use for a lights-switching-on / mist-breaking flourish. */
  function worldTime(r, t, bias) {
    const base = biasedRoll(r, bias);
    const u = ((base + t / DAY_CYCLE_LENGTH) % 1 + 1) % 1;
    // Five anchors around the ring: night, dawn, day, golden, dusk, back to night.
    const anchors = [
      { at: 0.00, name: 'night', warmth: 0.15, dark: 1, sunAlt: -0.6 },
      { at: 0.20, name: 'dawn', warmth: 0.85, dark: 0.35, sunAlt: -0.05 },
      { at: 0.38, name: 'day', warmth: 0.55, dark: 0, sunAlt: 1 },
      { at: 0.62, name: 'golden', warmth: 0.95, dark: 0.05, sunAlt: 0.35 },
      { at: 0.76, name: 'dusk', warmth: 0.8, dark: 0.55, sunAlt: -0.15 },
      { at: 1.00, name: 'night', warmth: 0.15, dark: 1, sunAlt: -0.6 }
    ];
    let lo = anchors[0], hi = anchors[anchors.length - 1];
    for (let i = 0; i < anchors.length - 1; i++) {
      if (u >= anchors[i].at && u <= anchors[i + 1].at) { lo = anchors[i]; hi = anchors[i + 1]; break; }
    }
    const span = (hi.at - lo.at) || 1;
    const localT = clamp((u - lo.at) / span, 0, 1);
    const smooth = localT * localT * (3 - 2 * localT); // smoothstep - eases in/out of each band
    const warmth = mix(lo.warmth, hi.warmth, smooth);
    const dark = mix(lo.dark, hi.dark, smooth);
    const sunAlt = mix(lo.sunAlt, hi.sunAlt, smooth);
    // Peaks near the middle of each transition, quiet mid-band - a gentle
    // "something is turning" beat rather than a constant hum.
    const eventPulse = Math.sin(localT * Math.PI);
    const band = smooth < 0.5 ? lo.name : hi.name;
    return {
      u: u, band: band, warmth: warmth, dark: dark, sunAlt: sunAlt,
      starsAlpha: clamp(dark * 1.3 - 0.25, 0, 1),
      lightsOn: clamp(dark * 1.4 - 0.3, 0, 1),
      eventPulse: eventPulse
    };
  }

  // Cheap always-on oscillator (0..1) for ambient "something is moving"
  // texture - wind gusts, a breath of radiance, a flock tightening before
  // it lifts. Pure function of t/seed offset, so it never touches r().
  function ambientPulse(t, speed, seedOffset) { return (Math.sin(t * speed + seedOffset * 6.283) + 1) * 0.5; }

  // Array-valued counterparts of mixRgb/shade, so a continuous time-of-day
  // sky/water tone can be built by chaining several blends/darkenings
  // together before the final rgbaOf() - without ever introducing a colour
  // that didn't come from the 5-slot palette.
  function mixArr(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
  function shadeArr(c, amt) {
    return amt >= 0 ? c.map(function (v) { return v + (255 - v) * amt; }) : c.map(function (v) { return v * (1 + amt); });
  }

  // ============================================================ A. RIVER MILL
  const RIVER_ARCHETYPES = [
    { id: 'mill-left-sweep', millSide: -1, riverBend: 0.16, riverWidth: 1, millScale: 1, terrain: 'hills' },
    { id: 'mill-right-diagonal', millSide: 1, riverBend: -0.3, riverWidth: 0.9, millScale: 1, terrain: 'hills' },
    { id: 'close-large-mill', millSide: -1, riverBend: 0.1, riverWidth: 1.05, millScale: 1.55, terrain: 'hills' },
    { id: 'distant-small-mill', millSide: 1, riverBend: 0.05, riverWidth: 1, millScale: 0.6, terrain: 'mountains' },
    { id: 'mountain-valley', millSide: -1, riverBend: 0.22, riverWidth: 0.8, millScale: 0.85, terrain: 'mountains' },
    { id: 'wooded-river', millSide: 1, riverBend: 0.14, riverWidth: 0.85, millScale: 1, terrain: 'forest' },
    { id: 'broad-lake', millSide: -1, riverBend: 0.04, riverWidth: 1.6, millScale: 0.85, terrain: 'hills' },
    { id: 'steep-bank', millSide: 1, riverBend: 0.26, riverWidth: 0.72, millScale: 1.1, terrain: 'cliff' }
  ];

  function drawRiverMill(ctx, w, h, r, pal, t, a, density, q, moodBias) {
    const archBias = moodBias == null ? null : (moodBias + 0.5) % 1;
    const arch = biasedPick(r, RIVER_ARCHETYPES, archBias);
    const wt = worldTime(r, t, moodBias);        // continuous dawn->day->golden->dusk->night
    const weather = Math.floor(r() * 4);         // 0 clear, 1 mist, 2 leaves, 3 fireflies
    const lightSide = r() < 0.5 ? -1 : 1;
    const wheelStyleTaller = r() < 0.4;          // occasional windmill-tall silhouette instead of squat cottage
    const roofStyle = Math.floor(r() * 3);       // 0 gabled, 1 hipped, 2 tall windmill cap
    const hasOutbuilding = r() < 0.4;
    const hasDock = r() < 0.35;
    const windowPattern = Math.floor(r() * 2);   // 0 two windows, 1 one wide window
    const gustOffset = r();
    const birdsCross = r() < 0.5;
    const horizon = h * (0.4 + r() * 0.08) * (arch.terrain === 'mountains' ? 0.92 : 1);
    const riverTop = h * (0.58 + r() * 0.05);

    // Continuous colour temperature instead of a hard 4-way bucket: warmth
    // blends the palette's paper/highlight slots, then everything darkens
    // toward the palette's own bg slot as night takes over - so a palette
    // swap still recolours the whole day/night range coherently.
    const skyTopRgb = shadeArr(hexToRgb(pal[0]), mix(0.15, -0.4, wt.dark));
    // Cross-fade (not multiply-darken) from the warm daytime horizon tone
    // toward the palette's own dark slot as night takes over - darkening a
    // warm colour multiplicatively just makes muddy brown, never a
    // believable cool night sky, because there is no independent "cool"
    // channel to darken into.
    const warmHorizonRgb = mixArr(hexToRgb(pal[1]), hexToRgb(pal[4]), wt.warmth);
    const nightHorizonRgb = shadeArr(hexToRgb(pal[0]), -0.15);
    const skyLowRgb = mixArr(warmHorizonRgb, nightHorizonRgb, wt.dark);
    const skyLowHex = pal[wt.dark > 0.5 ? 0 : 4]; // nearest hex for helpers that still need a hex (depthTint/blend)
    const nightDarken = -wt.dark * 0.55; // additional shade() amt so grass/foliage actually dims at night, not just the sky
    // A depthTint variant that also folds in night-darkening (via the
    // continuous skyLowRgb/nightDarken above) - plain depthTint's hex-
    // snapped haze colour only shifts once `dark` crosses 0.5, which left
    // terrain/grass/foliage full daylight-bright through dawn/dusk/early night.
    function nightDepthTint(hex, depth, baseAlpha) {
      return rgbaOf(shadeArr(mixArr(hexToRgb(hex), skyLowRgb, depth * 0.7), nightDarken), baseAlpha * (1 - depth * 0.35));
    }

    // ---- 1. BACKGROUND: sky, continuous time-of-day ----
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, rgbaOf(skyTopRgb, 1));
    sky.addColorStop(0.65, rgbaOf(mixArr(skyTopRgb, skyLowRgb, 0.55), 1));
    sky.addColorStop(1, rgbaOf(skyLowRgb, 1));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, horizon + 1);

    // Sun and moon are two distinct bodies, cross-faded by darkness rather
    // than one body sliding below the horizon - a real night sky's moon
    // isn't "the sun, very low", and this avoids a body visibly teleporting
    // as the day cycle turns. This is also the "sun emerging" / "quiet
    // night, moon path on water" pair from the brief.
    const sunX = w * (0.5 + lightSide * 0.3), sunY = horizon * mix(0.18, 0.62, clamp(1 - wt.sunAlt, 0, 1.6) / 1.6);
    const moonX = w * (0.5 - lightSide * 0.22), moonY = horizon * 0.26;
    const sunAlpha = clamp(1 - wt.dark * 1.3, 0, 1);
    const moonAlpha = clamp(wt.dark * 1.3 - 0.15, 0, 1);
    const lightX = mix(moonX, sunX, sunAlpha), lightY = mix(moonY, sunY, sunAlpha);
    if (sunAlpha > 0.02) {
      const sunR = Math.min(w, h) * 0.085 * (1 + wt.eventPulse * 0.12);
      const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 4.5);
      sunGlow.addColorStop(0, shade(pal[4], 0.5, 0.75 * sunAlpha));
      sunGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sunGlow; ctx.fillRect(0, 0, w, horizon);
      ctx.fillStyle = shade(pal[4], 0.65, 0.95 * sunAlpha);
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
    }
    if (moonAlpha > 0.02) {
      const moonR = Math.min(w, h) * 0.045;
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 4);
      moonGlow.addColorStop(0, shade(pal[1], 0.3, 0.4 * moonAlpha));
      moonGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = moonGlow; ctx.fillRect(0, 0, w, horizon);
      ctx.fillStyle = shade(pal[1], 0.35, 0.85 * moonAlpha);
      ctx.beginPath(); ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = moonAlpha;
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = shade(pal[1], 0.6, 0.2 + r() * 0.5);
        ctx.beginPath(); ctx.arc(r() * w, r() * horizon * 0.85, 0.5 + r() * 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ---- 2. DISTANT ENVIRONMENT: terrain type from the archetype ----
    if (arch.terrain === 'mountains') {
      const bands = 2;
      for (let b = 0; b < bands; b++) {
        const depth = 1 - b / (bands - 1 || 1);
        ctx.fillStyle = nightDepthTint(pal[1], depth, 0.85);
        ctx.beginPath();
        ridgePath(ctx, r, w, horizon - (bands - b) * h * 0.01, 8, h * 0.03, h * 0.16 - b * h * 0.05, true);
        ctx.lineTo(w, horizon + 2); ctx.lineTo(0, horizon + 2); ctx.closePath(); ctx.fill();
      }
    } else if (arch.terrain === 'cliff') {
      const cliffX = arch.millSide > 0 ? 0 : w * 0.62;
      const cliffW = w * 0.38;
      ctx.fillStyle = nightDepthTint(pal[1], 0.35, 0.92);
      ctx.beginPath();
      ctx.moveTo(cliffX, horizon + 2);
      const steps = 6;
      for (let i = 0; i <= steps; i++) {
        const x = cliffX + (i / steps) * cliffW;
        const y = horizon - h * (0.02 + r() * 0.05) - (i / steps) * h * 0.05;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(cliffX + cliffW, horizon + 2); ctx.closePath(); ctx.fill();
    } else if (arch.terrain === 'forest') {
      const bandY = horizon - h * 0.01;
      ctx.fillStyle = nightDepthTint(pal[2], 0.3, 0.85);
      ctx.beginPath();
      ridgePath(ctx, r, w, bandY, 22, h * 0.015, h * 0.05, true);
      ctx.lineTo(w, horizon + 2); ctx.lineTo(0, horizon + 2); ctx.closePath(); ctx.fill();
    } else { // hills - soft rolling bands
      const hillBands = 3;
      for (let b = 0; b < hillBands; b++) {
        const depth = 1 - b / (hillBands - 1);
        const bandTop = horizon - (hillBands - b) * h * 0.026;
        ctx.fillStyle = nightDepthTint(pal[1], depth, 0.85);
        ctx.beginPath();
        ridgePath(ctx, r, w, bandTop, 8, h * 0.014, h * 0.05, false);
        ctx.lineTo(w, horizon + 2); ctx.lineTo(0, horizon + 2); ctx.closePath(); ctx.fill();
      }
    }
    // A soft haze band right at the terrain/sky seam - the single biggest
    // cheap depth cue a flat illustration is usually missing (distant land
    // should visibly dissolve into the sky, not cut into it with a hard edge).
    const haze = ctx.createLinearGradient(0, horizon - h * 0.05, 0, horizon + h * 0.015);
    haze.addColorStop(0, 'rgba(0,0,0,0)'); haze.addColorStop(1, rgbaOf(skyLowRgb, 0.5));
    ctx.fillStyle = haze; ctx.fillRect(0, horizon - h * 0.05, w, h * 0.065);

    // distant tree-line as a hazy, uneven silhouette band, not a scatter of
    // identical dots - a couple of taller outliers break the uniformity.
    ctx.fillStyle = nightDepthTint(pal[2], 0.6, 0.65);
    const distClusters = Math.floor(5 + density * 0.04);
    for (let i = 0; i < distClusters; i++) {
      const tx = (i + r()) / distClusters * w, tall = r() > 0.85;
      const ty = horizon - 1 - r() * h * 0.01;
      organicBlob(ctx, r, tx, ty, (3 + r() * 4) * (tall ? 1.8 : 1), 2 + r() * 2.5, 6, 0.3);
      ctx.fill();
    }

    // ---- 3. MIDGROUND: bank grass strip + clustered, irregular bushes ----
    ctx.fillStyle = nightDepthTint(pal[2], 0.25, 0.9);
    ctx.fillRect(0, horizon - 2, w, riverTop - horizon + 6);
    const bushClusters = Math.floor(3 + density * 0.025);
    for (let c = 0; c < bushClusters; c++) {
      const cxp = r() * w, cyp = horizon + r() * (riverTop - horizon) * 0.6;
      const clumpSize = 1 + Math.floor(r() * 3); // one lone bush, or a clump of up to 3
      for (let i = 0; i < clumpSize; i++) {
        const bx = cxp + (r() - 0.5) * 22, by = cyp + (r() - 0.5) * 6;
        const scale = i === 0 ? 1 : 0.5 + r() * 0.4; // a clump has one larger anchor bush + smaller companions
        ctx.fillStyle = shade(pal[2], -0.1 + r() * 0.3 + nightDarken, 0.72);
        organicBlob(ctx, r, bx, by, (7 + r() * 9) * scale, (5 + r() * 5) * scale, 7, 0.32);
        ctx.fill();
      }
    }

    // ---- 4. MAIN SUBJECT: river with an irregular shore + mill + wheel ----
    // Water reflects the sky it sits under (a real-landscape convention)
    // rather than a fixed palette slot, so it stays coherent under any
    // palette/time-of-day.
    const riverBottom = h;
    const flow = t * (0.6 + a.bass * 0.8);
    const bendSign = arch.millSide;
    const bankY = []; // sampled once so the shore strip below can trace the same irregular line
    const bankPts = 16;
    for (let i = 0; i <= bankPts; i++) {
      const u = i / bankPts;
      const bendY = Math.sin(u * Math.PI) * h * arch.riverBend * bendSign;
      const jag = (r() - 0.5) * h * 0.012; // real shoreline is never a clean sine curve
      bankY.push(riverTop + bendY + jag + Math.sin(i * 0.9 + flow * 0.6) * 5 * (1 + a.bass * 0.5));
    }
    // The surface properly reflects the continuous sky tone (not a discrete
    // hex snap); depth still darkens toward the palette's own bg slot, but
    // less aggressively and further down, so the river reads as water with
    // atmosphere rather than a flat dark pond regardless of time of day.
    const waterSurfaceRgb = mixArr(skyLowRgb, hexToRgb(pal[0]), 0.12);
    const waterDeepRgb = mixArr(skyLowRgb, hexToRgb(pal[0]), 0.55); // deeper = more bg-toned, but still meaningfully sky-influenced
    const water = ctx.createLinearGradient(0, riverTop, 0, riverBottom);
    water.addColorStop(0, rgbaOf(waterSurfaceRgb, 0.92));
    water.addColorStop(0.7, rgbaOf(mixArr(waterSurfaceRgb, waterDeepRgb, 0.6), 0.93));
    water.addColorStop(1, rgbaOf(waterDeepRgb, 0.97));
    ctx.fillStyle = water;
    ctx.beginPath(); ctx.moveTo(0, riverTop);
    for (let i = 0; i <= bankPts; i++) ctx.lineTo((i / bankPts) * w, bankY[i]);
    ctx.lineTo(w, riverBottom); ctx.lineTo(0, riverBottom); ctx.closePath(); ctx.fill();

    // narrow shore strip (sand/pebble) right where grass meets water - a
    // specific, place-grounding detail a flat "grass then water" edge lacks.
    ctx.fillStyle = shade(pal[1], -0.05, 0.55);
    ctx.beginPath(); ctx.moveTo(0, riverTop - 3);
    for (let i = 0; i <= bankPts; i++) ctx.lineTo((i / bankPts) * w, bankY[i] - 3);
    for (let i = bankPts; i >= 0; i--) ctx.lineTo((i / bankPts) * w, bankY[i] + 3);
    ctx.closePath(); ctx.fill();
    const pebbleN = Math.floor(4 + density * 0.03);
    for (let i = 0; i < pebbleN; i++) {
      const u = r(); const bi = Math.floor(u * bankPts);
      ctx.fillStyle = shade(pal[1], -0.3 + r() * 0.3, 0.5);
      ctx.beginPath(); ctx.ellipse(u * w, bankY[bi] + (r() - 0.5) * 4, 1.5 + r() * 2, 1 + r(), 0, 0, Math.PI * 2); ctx.fill();
    }
    if (hasDock) {
      const dockU = 0.15 + r() * 0.7, dockBi = Math.floor(dockU * bankPts);
      const dockX = dockU * w, dockY = bankY[dockBi];
      ctx.strokeStyle = shade(pal[2], -0.2, 0.85); ctx.lineWidth = 3;
      for (let p = 0; p < 5; p++) {
        ctx.beginPath(); ctx.moveTo(dockX - 8 + p * 4, dockY - 2); ctx.lineTo(dockX - 8 + p * 4, dockY + h * 0.05); ctx.stroke();
      }
      ctx.strokeStyle = shade(pal[1], -0.1, 0.9); ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(dockX - 10, dockY); ctx.lineTo(dockX + 12, dockY); ctx.stroke();
    }

    // sun/moon reflection - short broken strokes (like real shimmer) rather
    // than a filled wedge; brighter and wider when the light source is
    // higher/stronger (an actual "brighter reflection band" event).
    ctx.globalCompositeOperation = 'screen';
    const reflStrength = mix(0.55, 1, clamp(sunAlpha + wt.eventPulse * 0.3, 0, 1)) * (0.7 + moonAlpha * 0.3);
    const reflRows = 14;
    for (let i = 0; i < reflRows; i++) {
      const v = i / reflRows;
      const ry = riverTop + 6 + v * (riverBottom - riverTop - 10);
      const spread = w * (0.008 + v * 0.05) * arch.riverWidth;
      const segX = lightX + (r() - 0.5) * spread * 2;
      const segLen = 4 + v * 16 + r() * 6;
      ctx.strokeStyle = shade(pal[4], 0.5, (0.5 - v * 0.25) * (0.5 + a.treble * 0.2) * reflStrength);
      ctx.lineWidth = 1.2 + v * 1.6;
      ctx.beginPath(); ctx.moveTo(segX - segLen / 2, ry); ctx.lineTo(segX + segLen / 2, ry); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // a couple of depth bands in the water itself (shallow near shore reads
    // warmer/lighter, deep mid-river reads darker) instead of one flat tone
    ctx.fillStyle = shade(pal[0], -0.4, 0.22);
    ctx.beginPath(); ctx.ellipse(w * 0.5, riverTop + (riverBottom - riverTop) * 0.6, w * 0.32 * arch.riverWidth, (riverBottom - riverTop) * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    // occasional ripple rings - a fish, a dropped leaf, a small sign of life
    const rippleU = ((t * 0.05 + gustOffset) % 1 + 1) % 1;
    if (rippleU < 0.4) {
      const rippleAge = rippleU / 0.4;
      const rx = mix(w * 0.15, w * 0.85, gustOffset), ry = riverTop + (riverBottom - riverTop) * (0.3 + gustOffset * 0.4);
      ctx.strokeStyle = shade(pal[4], 0.4, (1 - rippleAge) * 0.3);
      ctx.lineWidth = 1;
      for (let ring = 0; ring < 2; ring++) {
        ctx.beginPath(); ctx.ellipse(rx, ry, (rippleAge * 18 + ring * 6), (rippleAge * 6 + ring * 2), 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const stoneN = Math.floor(3 + density * 0.02);
    for (let i = 0; i < stoneN; i++) {
      const sx = r() * w, sy = riverTop + r() * (riverBottom - riverTop) * 0.35;
      ctx.fillStyle = shade(pal[1], -0.2 + r() * 0.3, 0.6);
      ctx.beginPath(); ctx.ellipse(sx, sy, 3 + r() * 4, 1.6 + r() * 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(pal[4], 0.4, 0.15); // tiny highlight catching the light
      ctx.beginPath(); ctx.ellipse(sx - 1, sy - 1, 1, 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }

    // mill building - archetype-driven scale/side, varied roof/windows/annex
    const millScale = arch.millScale;
    const houseW = w * (0.13 + r() * 0.03) * millScale, houseH = h * (0.09 + r() * 0.02) * millScale * (wheelStyleTaller ? 1.5 : 1);
    const houseX = w * 0.5 + arch.millSide * w * (0.16 + r() * 0.1) - houseW / 2;
    const houseY = riverTop - houseH - h * 0.03;
    if (hasOutbuilding) {
      const shedSide = -arch.millSide, shedW = houseW * 0.4, shedH = houseH * 0.45;
      const shedX = houseX + (shedSide > 0 ? houseW + 2 : -shedW - 2), shedY = houseY + houseH - shedH;
      ctx.fillStyle = shade(pal[1], -0.15, 0.85);
      ctx.fillRect(shedX, shedY, shedW, shedH);
      ctx.beginPath(); ctx.moveTo(shedX - 2, shedY); ctx.lineTo(shedX + shedW * 0.5, shedY - shedH * 0.35); ctx.lineTo(shedX + shedW + 2, shedY);
      ctx.closePath(); ctx.fillStyle = shade(pal[3], -0.15, 0.9); ctx.fill();
    }
    // wall in two tones for a simple sense of light direction
    ctx.fillStyle = shade(pal[1], -0.05, 0.92);
    ctx.fillRect(houseX, houseY, houseW, houseH);
    ctx.fillStyle = shade(pal[1], -0.28, 0.5);
    ctx.fillRect(houseX + houseW * (lightSide > 0 ? 0 : 0.7), houseY, houseW * 0.3, houseH);
    // roof: gabled (triangle), hipped (flattened trapezoid), or the tall
    // windmill cap - three genuinely different silhouettes, not one template
    ctx.fillStyle = shade(pal[3], -0.1, 0.95);
    if (roofStyle === 1 && !wheelStyleTaller) {
      ctx.beginPath();
      ctx.moveTo(houseX - houseW * 0.1, houseY);
      ctx.lineTo(houseX + houseW * 0.28, houseY - houseH * 0.42);
      ctx.lineTo(houseX + houseW * 0.72, houseY - houseH * 0.42);
      ctx.lineTo(houseX + houseW * 1.1, houseY);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(houseX - houseW * 0.12, houseY);
      ctx.lineTo(houseX + houseW * 0.5, houseY - houseH * (wheelStyleTaller ? 0.9 : 0.6));
      ctx.lineTo(houseX + houseW * 1.12, houseY);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = shade(pal[1], -0.3, 0.9);
    ctx.fillRect(houseX + houseW * 0.72, houseY - houseH * 0.5, houseW * 0.09, houseH * 0.38);
    if (wt.lightsOn > 0.15 && r() < 0.7) { // a lit chimney fire on cool evenings - occasional, not every render
      driftParticles(ctx, r, w, h, 3, shade(pal[1], 0.5, 1), t * 0.4, 0.002, -0.03, 0.6, 1.4, 0.35 * wt.lightsOn);
    }
    const winLit = shade(pal[4], 0.5, (0.15 + wt.lightsOn * 0.75) + a.kick * 0.1);
    const winDark = shade(pal[0], -0.35, 0.8);
    const winFill = wt.lightsOn > 0.3 ? winLit : winDark;
    if (windowPattern === 1) {
      ctx.fillStyle = winFill;
      ctx.fillRect(houseX + houseW * 0.32, houseY + houseH * 0.3, houseW * 0.36, houseH * 0.34);
    } else {
      ctx.fillStyle = winFill;
      ctx.fillRect(houseX + houseW * 0.18, houseY + houseH * 0.32, houseW * 0.18, houseH * 0.3);
      ctx.fillRect(houseX + houseW * 0.62, houseY + houseH * 0.32, houseW * 0.18, houseH * 0.3);
    }
    ctx.fillStyle = shade(pal[3], -0.25, 0.9);
    ctx.fillRect(houseX + houseW * 0.42, houseY + houseH * 0.55, houseW * 0.16, houseH * 0.45);

    // mill wheel - attached to a flume channel, real paddles with thickness
    const wheelR = Math.min(w, h) * 0.06 * millScale;
    const wheelX = houseX + (arch.millSide > 0 ? -wheelR * 1.1 : houseW + wheelR * 1.1);
    const wheelY = riverTop + wheelR * 0.35;
    ctx.fillStyle = shade(pal[1], -0.15, 0.6);
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

    // trees in clusters (one larger anchor tree + smaller companions, or a
    // lone leaning tree) rather than a uniform repeated formula - a real
    // treeline has large/medium/small hierarchy, not equal-weight repeats.
    const treeClusters = Math.floor((2 + density * 0.02) * q);
    for (let c = 0; c < treeClusters; c++) {
      const cxp = r() * w * 0.55, cyp = riverTop - r() * h * 0.05;
      const lone = r() < 0.3;
      const clumpSize = lone ? 1 : 2 + Math.floor(r() * 2);
      for (let i = 0; i < clumpSize; i++) {
        const scale = i === 0 ? 1 : 0.55 + r() * 0.35;
        const tx = cxp + (i === 0 ? 0 : (r() - 0.5) * 26), ty = cyp;
        const sway = (Math.sin(t * 0.4 + tx) * 3 + (ambientPulse(t, 0.35, gustOffset + i) - 0.5) * 4) * (1 + a.mid * 0.3);
        const trunkH = (10 + r() * 16) * scale;
        ctx.fillStyle = shade(pal[2], -0.15 + nightDarken, 0.7);
        ctx.fillRect(tx - 1.5 * scale, ty, 3 * scale, trunkH);
        const canopyLobes = 2 + Math.floor(r() * 2);
        for (let lobe = 0; lobe < canopyLobes; lobe++) {
          const lx = tx + (r() - 0.5) * 10 * scale + sway, ly = ty - trunkH * 0.3 - (r() - 0.5) * 6 * scale;
          ctx.fillStyle = shade(pal[2], -0.05 + r() * 0.25 + nightDarken, 0.85);
          organicBlob(ctx, r, lx, ly, (8 + r() * 7) * scale, (6 + r() * 6) * scale, 7, 0.35);
          ctx.fill();
        }
      }
    }

    // distant birds crossing - a small, occasional living detail, not a
    // fixture: a loose chevron group drifting once across the upper sky
    if (birdsCross) {
      const bu = ((t * 0.03 + gustOffset * 1.7) % 1 + 1) % 1;
      const bx = mix(-0.1, 1.1, bu) * w, by = horizon * (0.15 + gustOffset * 0.15);
      ctx.strokeStyle = depthTint(pal[2], skyLowHex, 0.4, 0.5);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 5; i++) {
        const ox = (i - 2) * 9, oy = Math.abs(i - 2) * 4;
        ctx.beginPath();
        ctx.moveTo(bx + ox - 3, by + oy); ctx.lineTo(bx + ox, by + oy - 2.5); ctx.lineTo(bx + ox + 3, by + oy);
        ctx.stroke();
      }
    }

    // ---- 5. FOREGROUND: reeds/grass tufts + a rock, framing the bottom ----
    // wind gusts through the reeds - a slow shared pulse layered on top of
    // each reed's own phase offset, so the whole bank sways together in
    // gusts instead of every blade moving independently
    const gust = ambientPulse(t, 0.22, gustOffset);
    const reedN = Math.floor(6 + density * 0.05);
    for (let i = 0; i < reedN; i++) {
      const rx = r() * w, ry = riverBottom - r() * h * 0.03;
      const sway = (Math.sin(t * 0.5 + i) * 5 + (gust - 0.5) * 6) * (1 + a.mid * 0.4);
      const rh = 9 + r() * 15;
      ctx.strokeStyle = shade(pal[2], -0.1 + r() * 0.2 + nightDarken, 0.62);
      ctx.lineWidth = 1.3 + r() * 1;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx + sway * 0.5, ry - rh * 0.6, rx + sway, ry - rh); ctx.stroke();
    }
    if (r() > 0.4) {
      const fgRockX = r() * w, fgRockY = riverBottom - r() * h * 0.025;
      ctx.fillStyle = shade(pal[1], -0.35, 0.85);
      organicBlob(ctx, r, fgRockX, fgRockY, 10 + r() * 10, 5 + r() * 4, 6, 0.25);
      ctx.fill();
      ctx.fillStyle = shade(pal[4], 0.3, 0.12); // rim light catching the rock edge
      ctx.beginPath(); ctx.ellipse(fgRockX - 4, fgRockY - 3, 4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
    }

    // ---- 6. ATMOSPHERE: seed-chosen weather + time-linked mist/fog ----
    // real fog favours the cool, low-sun hours (dawn/dusk/night) over full
    // daylight - mist strength now follows the sun's altitude, not just a
    // fixed seed roll, so a dawn render can show "sun breaking through mist"
    const mistFromTime = clamp(1 - Math.max(wt.sunAlt, 0), 0.15, 1);
    if (weather === 1 || (wt.dark > 0.1 && wt.dark < 0.5 && r() < 0.3)) {
      const drift = (t * 0.01) % (w * 0.2);
      ctx.fillStyle = blend(pal[1], skyLowHex, 0.5, 0.10 * mistFromTime);
      for (let i = 0; i < 4; i++) ctx.fillRect(-drift, riverTop - h * 0.05 + i * h * 0.025, w + drift * 2, h * 0.03);
      if (wt.eventPulse > 0.6 && sunAlpha > 0.3) { // sun breaking through - a brief brighter shaft
        colourWash(ctx, w, h, pal[4], 0.05 * wt.eventPulse, sunX, horizon * 0.3, sunX, riverTop);
      }
    } else if (weather === 2) {
      driftParticles(ctx, r, w, h, Math.floor(10 + density * 0.08), shade(pal[3], 0.1, 1), t, 0.03, 0.015, 1.5, 3.5, 0.5);
    } else if (weather === 3 && wt.dark > 0.3) {
      driftParticles(ctx, r, w, h, Math.floor(8 + density * 0.06), shade(pal[4], 0.5, 1), t * 0.6, 0.01, -0.02, 1, 2.2, 0.6 * wt.dark);
    }
    // a single directional colour wash ties the whole composition to the
    // chosen light source instead of every layer reading independently lit
    colourWash(ctx, w, h, pal[4], mix(0.09, 0.05, wt.dark), lightX, 0, w * 0.5, h);

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
    // a bright treble sparkle across the water at high energy - a music-
    // driven "reflection intensifies" event, distinct from the kick splash
    if (a.treble > 0.35) {
      ctx.globalCompositeOperation = 'screen';
      colourWash(ctx, w, h, pal[4], (a.treble - 0.35) * 0.18, lightX, riverTop, lightX, riverBottom);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ========================================================= B. OPEN ARMS ==
  const ARMS_ARCHETYPES = [
    { id: 'monumental-close', scale: 1.28, groundVisible: 0.1, armLift: 0.02 },
    { id: 'distant-landscape', scale: 0.72, groundVisible: 0.4, armLift: 0 },
    { id: 'wide-embrace', scale: 1, groundVisible: 0.2, armLift: -0.06 },
    { id: 'raised-arms', scale: 1.1, groundVisible: 0.15, armLift: 0.12 },
    { id: 'humble-close', scale: 0.95, groundVisible: 0.22, armLift: -0.1 },
    { id: 'towering-presence', scale: 1.42, groundVisible: 0.05, armLift: 0.06 }
  ];
  function drawOpenArms(ctx, w, h, r, pal, t, a, density, q, moodBias) {
    const archBias = moodBias == null ? null : (moodBias + 0.5) % 1;
    const arch = biasedPick(r, ARMS_ARCHETYPES, archBias);
    const envType = Math.floor(r() * 4); // 0 cloudscape, 1 mountains, 2 cathedral, 3 darkness+light
    const wt = worldTime(r, t, moodBias);
    const lightDir = r() < 0.5 ? -1 : 1;
    const robeVariant = r();
    const veilOffset = r();
    // radiance now comes from the day cycle, not a coin-flip: dawn/golden
    // are the most radiant moments, deep night is the moodiest, matching
    // "invitation/blessing" at first light and "presence in the dark" at night.
    const radiant = clamp(1 - Math.abs(wt.sunAlt - 0.4) * 0.7, 0.35, 1.25) * (1 - wt.dark * 0.25);

    const cx = w * 0.5, cy = h * (0.58 - arch.groundVisible * 0.06); // kept centred deliberately so the face sits inside a panel, not on a wall gap

    // ---- 1. BACKGROUND + 2. DISTANT ENVIRONMENT: continuous time-of-day ---
    const warmHorizonRgb = mixArr(hexToRgb(pal[1]), hexToRgb(pal[4]), mix(0.3, 0.9, radiant / 1.25));
    const nightHorizonRgb = shadeArr(hexToRgb(pal[3]), -0.25);
    const lowRgb = mixArr(warmHorizonRgb, nightHorizonRgb, wt.dark);
    const topRgb = shadeArr(hexToRgb(pal[0]), mix(0.05, -0.4, wt.dark));
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, rgbaOf(topRgb, 1));
    skyGrad.addColorStop(0.55, rgbaOf(mixArr(topRgb, lowRgb, 0.4), 1));
    skyGrad.addColorStop(1, rgbaOf(lowRgb, 1));
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, w, h);
    const nightDarken = -wt.dark * 0.4;
    function nightDepthTint(hex, depth, baseAlpha) {
      return rgbaOf(shadeArr(mixArr(hexToRgb(hex), lowRgb, depth * 0.7), nightDarken), baseAlpha * (1 - depth * 0.35));
    }

    if (wt.starsAlpha > 0.05) { // night presence - a quiet halo of stars, not just a bright figure on black
      ctx.globalAlpha = wt.starsAlpha;
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = shade(pal[1], 0.6, 0.2 + r() * 0.5);
        ctx.beginPath(); ctx.arc(r() * w, r() * h * 0.6, 0.5 + r() * 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // clouds parting: a slow shared pulse opens a gap in the cloud bank
    // right around the figure - "clouds parting" as an actual event, not
    // a fixed layout. Cloud positions still come from r() every call (kept
    // in the seed's own fixed r()-consumption order); only their alpha near
    // the parting gap breathes with ambientPulse.
    const partPulse = ambientPulse(t, 0.05, veilOffset);
    if (envType === 0) { // cloudscape - organic soft banks below the horizon
      for (let b = 0; b < 4; b++) {
        const by = h * (0.55 + b * 0.1);
        for (let i = 0; i < 3; i++) {
          const cxx = r() * w, cr = w * (0.12 + r() * 0.12);
          const distToCenter = Math.abs(cxx - cx) / w;
          const gapFade = mix(1, 0.35, clamp(1 - distToCenter * 3, 0, 1) * partPulse);
          ctx.fillStyle = depthTint(pal[1], pal[0], b / 4, 0.35 * gapFade);
          organicBlob(ctx, r, cxx, by + Math.sin(t * 0.1 + b) * 4, cr, cr * 0.35, 8, 0.25);
          ctx.fill();
        }
      }
    } else if (envType === 1) { // distant mountain silhouette
      ctx.fillStyle = nightDepthTint(pal[1], 0.5, 0.6);
      ctx.beginPath();
      ridgePath(ctx, r, w, h * 0.78, 8, h * 0.02, h * 0.09, true);
      ctx.lineTo(w, h * 0.78); ctx.closePath(); ctx.fill();
    } else if (envType === 2) { // cathedral-like space: tall light/shadow pillars over a receding floor
      for (let i = 0; i < 5; i++) {
        const px = (i + 0.5) / 5 * w;
        ctx.fillStyle = shade(pal[1], i % 2 ? -0.2 : 0.1, 0.18 * (0.6 + radiant * 0.4));
        ctx.fillRect(px - w * 0.04, 0, w * 0.08, h);
      }
      ctx.fillStyle = shade(pal[1], -0.1 + nightDarken, 0.12);
      for (let i = 0; i < 6; i++) {
        const fy = h * (0.62 + i * 0.06);
        ctx.fillRect(0, fy, w, 1.5);
      }
    }
    // envType 3 (darkness+light) uses no extra distant layer - the light itself carries the scene

    // ground, visible for the "distant figure in landscape" archetype
    if (arch.groundVisible > 0.15) {
      const groundY = h * (1 - arch.groundVisible * 0.5);
      ctx.fillStyle = rgbaOf(shadeArr(mixArr(hexToRgb(pal[2]), lowRgb, 0.4), nightDarken), 0.6);
      ctx.beginPath(); ridgePath(ctx, r, w, groundY, 6, h * 0.006, h * 0.02, false); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    }
    // depth haze at the horizon/ground seam, echoing River Mill's - grounds
    // the figure in an actual place rather than a flat gradient backdrop
    const groundSeamY = arch.groundVisible > 0.15 ? h * (1 - arch.groundVisible * 0.5) : h * 0.86;
    const seamHaze = ctx.createLinearGradient(0, groundSeamY - h * 0.05, 0, groundSeamY + h * 0.02);
    seamHaze.addColorStop(0, 'rgba(0,0,0,0)'); seamHaze.addColorStop(1, rgbaOf(lowRgb, 0.35));
    ctx.fillStyle = seamHaze; ctx.fillRect(0, groundSeamY - h * 0.05, w, h * 0.07);

    // ---- 7. LIGHT: rays, halo, rim light, luminous fog (signature element) --
    const radianceMul = radiant;
    ctx.save(); ctx.translate(cx, cy - h * 0.14);
    const rays = Math.floor((14 + density * 0.08) * q);
    const rayRot = t * (0.025 + a.mid * 0.05);
    const rayBreath = 1 + (ambientPulse(t, 0.09, veilOffset + 0.3) - 0.5) * 0.3; // beams slowly intensify/settle
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2 + rayRot;
      const len = Math.max(w, h) * (0.34 + r() * 0.24) * (1 + a.kick * 0.3) * radianceMul * rayBreath;
      const beamW = 2 + r() * 5;
      const g = ctx.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len);
      g.addColorStop(0, shade(pal[4], 0.5, (0.14 + 0.1 * r() + a.treble * 0.06) * radianceMul));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = beamW;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len); ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    const haloR = Math.min(w, h) * (0.1 + a.bass * 0.02) * arch.scale * radianceMul * (1 + Math.sin(t * 0.6) * 0.04) * rayBreath;
    const halo = ctx.createRadialGradient(cx, cy - h * 0.24, 0, cx, cy - h * 0.24, haloR * 2.6);
    halo.addColorStop(0, shade(pal[4], 0.55, (0.65 + a.kick * 0.35) * radianceMul));
    halo.addColorStop(0.4, shade(pal[3], 0.3, 0.18 * radianceMul));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);

    // luminous fog low in the frame, grounding the figure
    const fog = ctx.createLinearGradient(0, h * 0.7, 0, h);
    fog.addColorStop(0, 'rgba(0,0,0,0)');
    fog.addColorStop(1, shade(pal[4], 0.3, 0.12 + a.bass * 0.06));
    ctx.fillStyle = fog; ctx.fillRect(0, h * 0.7, w, h * 0.3);

    // ---- 4. MAIN SUBJECT: the figure - improved proportions, robe folds, hands
    const scale = Math.min(w, h) * arch.scale * (1 + a.kick * 0.025);
    const headR = scale * 0.055;
    const headY = cy - h * 0.26;
    const neckY = headY + headR * 1.3;
    const shoulderY = neckY + headR * 0.6;
    const hipY = mix(shoulderY, cy + h * 0.3, 0.55);
    const hemY = cy + h * 0.24;
    const armSpread = scale * (0.4 + a.kick * 0.035);
    const sway = Math.sin(t * 0.32) * scale * 0.01 * (1 + a.mid * 0.6);

    // rim light side (behind the silhouette, slightly offset toward lightDir)
    ctx.fillStyle = shade(pal[4], 0.4, 0.22 * radianceMul);
    ctx.beginPath(); ctx.arc(cx + lightDir * headR * 0.15, headY, headR * 1.08, 0, Math.PI * 2); ctx.fill();

    const bodyFill = shade(pal[2], mix(-0.25, -0.05, clamp(radianceMul, 0, 1)) + nightDarken * 0.3, 0.95);
    ctx.fillStyle = bodyFill;
    ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2); ctx.fill();
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
    // hem shadow shape for grounding
    ctx.fillStyle = shade(pal[0], -0.4, 0.2);
    ctx.beginPath(); ctx.ellipse(cx, hemY + 2, scale * 0.2, scale * 0.02, 0, 0, Math.PI * 2); ctx.fill();

    // arms, open gesture: shoulder -> rises outward -> settles roughly level
    // with the shoulder line, angle nudged by the archetype's armLift
    [-1, 1].forEach(function (side) {
      const sx = cx + side * scale * 0.1, sTop = shoulderY, sBot = shoulderY + headR * 0.9;
      const ex = cx + side * armSpread, ey = shoulderY - headR * 0.15 - scale * arch.armLift;
      const cxp = cx + side * armSpread * 0.6, cypTop = shoulderY - headR * 1.6 + sway - scale * arch.armLift * 0.6, cypBot = shoulderY - headR * 0.5 + sway;
      ctx.fillStyle = bodyFill;
      ctx.beginPath();
      ctx.moveTo(sx, sTop);
      ctx.quadraticCurveTo(cxp, cypTop, ex, ey - headR * 0.28);
      ctx.quadraticCurveTo(cxp, cypBot, sx, sBot);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = bodyFill;
      ctx.beginPath(); ctx.ellipse(ex, ey, headR * 0.34, headR * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    });

    // ---- 5/6. FOREGROUND + ATMOSPHERE: a mist veil that periodically thins,
    // revealing more of the figure, then thickens again - "silhouette
    // reveal through mist" as a real, watchable event rather than a fixed
    // haze layer.
    const veilPulse = ambientPulse(t, 0.035, veilOffset + 0.6);
    const veilStrength = mix(0.22, 0.02, veilPulse); // low = mostly revealed, high = veiled
    if (veilStrength > 0.03) {
      const veil = ctx.createLinearGradient(0, hemY - scale * 0.1, 0, headY - headR * 2);
      veil.addColorStop(0, rgbaOf(lowRgb, veilStrength));
      veil.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = veil; ctx.fillRect(0, headY - headR * 2, w, hemY - headY + headR * 2);
    }
    driftParticles(ctx, r, w, h * 0.85, Math.floor(8 + density * 0.05), shade(pal[4], 0.5, 1), t, 0.005, -0.03, 0.8, 2, (0.35 + a.bass * 0.1) * radianceMul);
    colourWash(ctx, w, h, pal[4], 0.05 * radianceMul, cx, 0, cx, h);

    // ---- 8. MUSIC EVENTS: radiance pulse + spark/halo detail - last, terminal
    if (a.kick > 0.1) { // a genuine radiance-pulse burst, not just extra sparkle
      ctx.globalCompositeOperation = 'screen';
      const burst = ctx.createRadialGradient(cx, cy - h * 0.24, 0, cx, cy - h * 0.24, haloR * (3 + a.kick * 2));
      burst.addColorStop(0, shade(pal[4], 0.55, 0.35 * a.kick));
      burst.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = burst; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
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
  const FORMATIONS = ['v', 'cloud', 'stream', 'spiral', 'arc', 'split'];
  function drawBirdsFlight(ctx, w, h, r, pal, t, a, density, q, moodBias) {
    // ---- seed rolls ----
    const archBias = moodBias == null ? null : (moodBias + 0.5) % 1;
    const wt = worldTime(r, t, moodBias);
    const formation = biasedPick(r, FORMATIONS, archBias);
    const formAngle = (r() - 0.5) * 0.7; // subtle overall formation tilt - NOT applied per-bird
    const hasLandscape = r() < 0.5;
    const foregroundEmphasis = r() < 0.4; // some seeds foreground-bird-heavy, others flock-only
    const hasHeroBird = r() < 0.35; // an occasional single large, cropped foreground bird for cinematic scale
    const cycleOffset = r();
    const flockCount = Math.floor((30 + density * 0.55) * q);

    // ---- 1. BACKGROUND: continuous time-of-day sky + sun/moon ----
    const warmHorizonRgb = mixArr(hexToRgb(pal[1]), hexToRgb(pal[4]), mix(0.35, 0.9, 1 - wt.dark));
    const nightHorizonRgb = shadeArr(hexToRgb(pal[0]), -0.15);
    const skyLowRgb = mixArr(warmHorizonRgb, nightHorizonRgb, wt.dark);
    const skyLow = pal[wt.dark > 0.5 ? 0 : 4];
    const nightDarken = -wt.dark * 0.45;
    const skyTopRgb = shadeArr(hexToRgb(pal[0]), mix(0.12, -0.4, wt.dark));
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, rgbaOf(skyTopRgb, 1));
    sky.addColorStop(0.6, rgbaOf(mixArr(skyTopRgb, skyLowRgb, 0.5), 1));
    sky.addColorStop(1, rgbaOf(skyLowRgb, 1));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);

    if (wt.starsAlpha > 0.05) {
      ctx.globalAlpha = wt.starsAlpha;
      for (let i = 0; i < 45; i++) {
        ctx.fillStyle = shade(pal[1], 0.6, 0.2 + r() * 0.5);
        ctx.beginPath(); ctx.arc(r() * w, r() * h * 0.55, 0.5 + r() * 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const lx = w * (0.2 + r() * 0.6), ly = h * (0.12 + r() * 0.18);
    const lightAlpha = clamp(1 - wt.dark * 1.1, 0.15, 1);
    const lglow = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.min(w, h) * 0.4);
    lglow.addColorStop(0, shade(pal[4], 0.5, (0.35 + wt.warmth * 0.25) * lightAlpha));
    lglow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = lglow; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = shade(pal[4], wt.dark > 0.5 ? 0.35 : 0.65, (wt.dark > 0.5 ? 0.55 : 0.9) * lightAlpha + wt.dark * 0.3);
    ctx.beginPath(); ctx.arc(lx, ly, Math.min(w, h) * (wt.dark > 0.5 ? 0.04 : 0.075), 0, Math.PI * 2); ctx.fill();

    // ---- 2. DISTANT ENVIRONMENT: layered clouds + optional treeline -------
    // clouds in two depth passes (distant hazy + closer, more defined) for
    // real depth hierarchy instead of five equal-weight blobs
    for (let pass = 0; pass < 2; pass++) {
      const n = pass === 0 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const cxp = r() * w, cyp = h * (0.06 + r() * (pass === 0 ? 0.22 : 0.14)), cr = w * (pass === 0 ? 0.04 + r() * 0.07 : 0.09 + r() * 0.1);
        ctx.fillStyle = depthTint(pal[1], skyLow, pass === 0 ? 0.6 + r() * 0.3 : 0.15 + r() * 0.15, pass === 0 ? 0.2 : 0.3);
        organicBlob(ctx, r, cxp, cyp, cr, cr * 0.4, 7, 0.25);
        ctx.fill();
      }
    }
    if (hasLandscape) {
      const nightDepth = function (hex, depth, baseAlpha) {
        return rgbaOf(shadeArr(mixArr(hexToRgb(hex), skyLowRgb, depth * 0.7), nightDarken), baseAlpha * (1 - depth * 0.35));
      };
      ctx.fillStyle = nightDepth(pal[1], 0.6, 0.7);
      ctx.beginPath();
      ridgePath(ctx, r, w, h * 0.88, 6, h * 0.008, h * 0.035, false);
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
      // a hazy treeline breaks up the flat ground edge
      ctx.fillStyle = nightDepth(pal[2], 0.4, 0.5);
      const clusters = Math.floor(4 + density * 0.03);
      for (let i = 0; i < clusters; i++) {
        organicBlob(ctx, r, (i + r()) / clusters * w, h * (0.86 + r() * 0.02), 4 + r() * 5, 3 + r() * 3, 6, 0.3);
        ctx.fill();
      }
    }

    // ---- 4. MAIN SUBJECT: the flock, three depth bands, formation-shaped ---
    const cosF = Math.cos(formAngle), sinF = Math.sin(formAngle);
    const anchorX = 0.5, anchorY = 0.32;
    const drift = t * (0.018 + a.bass * 0.045);
    const liftEvent = a.kick;

    // A living story beat, not just ambient drift: the flock cruises, then
    // periodically tightens (gathering) before bursting outward (a sudden
    // takeoff/scatter) and settling back - "circling before departure" as
    // an actual watchable event, present even with no music playing.
    const cyclePos = ((t * 0.012 + cycleOffset) % 1 + 1) % 1;
    let storySpread;
    if (cyclePos < 0.68) storySpread = 1;
    else if (cyclePos < 0.85) storySpread = mix(1, 0.55, (cyclePos - 0.68) / 0.17); // gathering
    else if (cyclePos < 0.92) storySpread = mix(0.55, 1.55, (cyclePos - 0.85) / 0.07); // burst outward
    else storySpread = mix(1.55, 1, (cyclePos - 0.92) / 0.08); // settle

    // Each formation returns a deliberately EXAGGERATED, structurally
    // distinct (x,y) offset (roughly -1..1 in both axes) - a wide flat V,
    // a thin horizontal line, a tight round spiral, a shallow wide bow, two
    // separated clusters with a real gap, or a loose scatter. They must
    // look different from across a room, not just differ in a formula.
    function formationOffset(u) {
      if (formation === 'v') {
        const side = u < 0.5 ? -1 : 1;
        const k = Math.abs(u - 0.5) * 2;
        return [side * k * 1.05, k * 0.85]; // wide, deep wedge
      }
      if (formation === 'stream') return [(u - 0.5) * 2.3, Math.sin(u * Math.PI * 3) * 0.12]; // long, flat, thin band
      if (formation === 'spiral') {
        const ang = u * Math.PI * 6.5, rr = 0.12 + u * 0.55;
        return [Math.cos(ang) * rr * 0.6, Math.sin(ang) * rr]; // tight, round, taller than wide
      }
      if (formation === 'arc') {
        const ang = (u - 0.5) * Math.PI * 1.4;
        return [Math.sin(ang) * 1.15, (1 - Math.cos(ang)) * -1.1]; // pronounced shallow bow
      }
      if (formation === 'split') {
        const side = u < 0.5 ? -1 : 1;
        const k = (u < 0.5 ? u * 2 : (u - 0.5) * 2);
        return [side * (0.55 + k * 0.5), (k - 0.5) * 0.45]; // two clusters with a real gap between them
      }
      return [(u - 0.5) * 2.1, (u * 7 % 1 - 0.5) * 1.3]; // cloud - big loose scatter filling most of the frame
    }

    // One shared spatial extent for every depth band - near/mid/far birds
    // all sample the SAME formation shape at the SAME scale (only their
    // size/alpha/tint differ), rather than three independently-rescaled
    // copies stacked on top of each other, which is what made every
    // formation collapse into a similar "pile" regardless of which one
    // was picked.
    const FLOCK_SPREAD = 0.36 * storySpread;
    const BANDS = [
      { depth: 0.88, frac: foregroundEmphasis ? 0.3 : 0.42, sizeMin: 2, sizeMax: 4 },
      { depth: 0.46, frac: 0.4, sizeMin: 6, sizeMax: 10 },
      { depth: 0.06, frac: foregroundEmphasis ? 0.3 : 0.18, sizeMin: 14, sizeMax: 24 }
    ];
    BANDS.forEach(function (band) {
      const n = Math.max(3, Math.round(flockCount * band.frac));
      for (let i = 0; i < n; i++) {
        // Stratified sampling along the formation curve (one slot per bird,
        // jittered within it) instead of pure r() - random sampling alone
        // tends to clump in some stretches of the curve and leave gaps in
        // others, which blurs exactly the silhouette the formation is
        // supposed to draw. Evenly-spaced-then-jittered birds trace the
        // shape cleanly while still looking organic, not gridded.
        const u = clamp((i + r()) / n, 0, 1);
        const jx = (r() - 0.5) * 0.06, jy = (r() - 0.5) * 0.06;
        const off = formationOffset(u);
        const ox = (off[0] + jx) * FLOCK_SPREAD, oy = (off[1] + jy) * FLOCK_SPREAD * 0.7;
        const rx = ox * cosF - oy * sinF, ry = ox * sinF + oy * cosF;
        const scatter = liftEvent * (1 - band.depth) * (i % 2 ? 1 : -1) * 0.5;
        // A small per-band parallax nudge (not a rescale) keeps far birds
        // slightly higher/tighter than near ones without hiding the shape.
        const parallax = (1 - band.depth) * 0.05;

        const rawX = anchorX + rx * (1 - band.depth * 0.1) + drift;
        const px = (((rawX % 1.3) + 1.3) % 1.3);
        const x = px * w - w * 0.15;
        const y = clamp(anchorY + parallax + ry, 0.03, 0.86) * h - scatter * 22;

        const glintRoll = r();
        const size = (band.sizeMin + glintRoll * (band.sizeMax - band.sizeMin)) * q;
        const flap = Math.sin(t * (3 + a.mid * 4) + i * 1.9 + band.depth * 5) * (0.4 + a.mid * 0.5 + Math.abs(liftEvent) * 0.3);
        const alpha = (0.35 + (1 - band.depth) * 0.55) + a.treble * 0.06;
        const color = rgbaOf(shadeArr(mixArr(hexToRgb(pal[2]), skyLowRgb, band.depth * 0.45), nightDarken), 1);
        const lw = (0.8 + size * 0.09) * (0.8 + band.depth * 0.2);

        ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x - size, y + flap * size * 0.45);
        ctx.lineTo(x, y - size * 0.62 - Math.abs(flap) * size * 0.35);
        ctx.lineTo(x + size, y + flap * size * 0.45);
        ctx.stroke();

        if (band.depth < 0.2 && a.treble > 0.3 && glintRoll > 0.55) {
          ctx.fillStyle = shade(pal[4], 0.5, 0.35 * a.treble);
          ctx.beginPath(); ctx.arc(x, y - size * 0.4, 1 + glintRoll * 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
    });
    ctx.globalAlpha = 1;

    // an occasional single large, partly-cropped foreground bird - a true
    // "large" tier above the three flock bands, for real foreground framing
    // and cinematic scale rather than everything living in the same range
    if (hasHeroBird) {
      const hx = mix(w * 0.12, w * 0.88, cycleOffset), hy = h * (0.62 + cycleOffset * 0.18);
      const hSize = Math.min(w, h) * 0.16;
      const hFlap = Math.sin(t * (2.2 + a.mid * 3) + 0.7) * (0.4 + a.mid * 0.4);
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = rgbaOf(shadeArr(hexToRgb(pal[2]), nightDarken - 0.1), 1);
      ctx.lineWidth = hSize * 0.1; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(hx - hSize, hy + hFlap * hSize * 0.45);
      ctx.lineTo(hx, hy - hSize * 0.62 - Math.abs(hFlap) * hSize * 0.35);
      ctx.lineTo(hx + hSize, hy + hFlap * hSize * 0.45);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    colourWash(ctx, w, h, skyLow, mix(0.06, 0.03, wt.dark), lx, 0, w * 0.5, h);

    // ---- MUSIC EVENT: a real scatter burst on kick, not just an offset ----
    if (a.kick > 0.2) {
      ctx.globalCompositeOperation = 'screen';
      colourWash(ctx, w, h, pal[4], (a.kick - 0.2) * 0.12, anchorX * w, anchorY * h, anchorX * w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ======================================================= D. COASTER RIDE ==
  const COASTER_ENVIRONMENTS = ['night-park', 'sunset', 'industrial', 'neon'];
  const COASTER_PROFILES = ['big-drop', 'rolling', 'loop-focus', 'launch'];
  function drawCoasterRide(ctx, w, h, r, pal, t, a, density, q) {
    // ---- seed rolls ----
    const env = pick(r, COASTER_ENVIRONMENTS);
    const profile = pick(r, COASTER_PROFILES);
    const closeUp = r() < 0.45; // close foreground track vs distant skyline ride
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

    // ---- 2. DISTANT ENVIRONMENT: skyline, closer/bigger for closeUp scenes -
    const skylineScale = closeUp ? 0.55 : 1;
    const skylineN = env === 'industrial' ? 6 : 4;
    for (let i = 0; i < skylineN; i++) {
      const bx = (i / skylineN) * w + r() * (w / skylineN) * 0.3;
      const bh = h * (0.1 + r() * (env === 'industrial' ? 0.28 : 0.16)) * skylineScale;
      ctx.fillStyle = depthTint(pal[1], skyLow, 0.6, 0.55);
      ctx.fillRect(bx, h * 0.86 - bh, w / skylineN * 0.5, bh);
      if (env === 'neon' || env === 'night-park') {
        ctx.fillStyle = shade(pal[4], 0.5, 0.25 + r() * 0.3);
        for (let wy = 0; wy < bh; wy += 8) ctx.fillRect(bx + 2, h * 0.86 - bh + wy, 2, 2);
      }
    }
    ctx.fillStyle = depthTint(pal[1], skyLow, 0.4, 0.4);
    ctx.fillRect(0, h * 0.86, w, h * 0.14);

    // ---- track geometry: profile drives the topology ----
    const baseY = h * (closeUp ? 0.6 : 0.55);
    const pts = [[w * 0.04, h * 0.5]];
    let px = w * 0.04;
    for (let i = 0; i < segs; i++) {
      px += (w * 0.92) / segs;
      let amp;
      if (profile === 'big-drop') amp = i === 0 ? 0.34 : 0.1 + r() * 0.12;
      else if (profile === 'rolling') amp = 0.16 + r() * 0.1;
      else if (profile === 'loop-focus') amp = i === 1 ? 0.3 : 0.12 + r() * 0.16;
      else amp = i < 2 ? 0.05 + r() * 0.04 : 0.14 + r() * 0.24; // launch - flat start then rises
      pts.push([px, baseY - amp * h * (closeUp ? 1.15 : 1)]);
    }
    const loopAt = (profile === 'loop-focus') ? 1 : (r() < 0.4 ? 2 + Math.floor(r() * (segs - 3)) : -1);
    const loopCenter = loopAt >= 0 ? pts[loopAt].slice() : null;
    const loopR = Math.min(w, h) * (profile === 'loop-focus' ? 0.095 : 0.075);
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
    ctx.lineWidth = closeUp ? 4 : 3;
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
    const half = closeUp ? 4.4 : 3.2;
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
    ctx.lineWidth = (closeUp ? 2.6 : 2) + a.bass * 1;
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
    const speed = (profile === 'launch' ? 0.06 : 0.045) + a.bass * 0.11 + a.kick * 0.22;
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
      if (q > 0.6) {
        ctx.fillStyle = shade(pal[2], 0.1, 0.9);
        ctx.beginPath(); ctx.arc(-3, -6, 1.6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, -6, 1.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    colourWash(ctx, w, h, pal[4], 0.05, w * 0.5, 0, w * 0.5, h);

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
      scene.draw(ctx, w, h, r, pal, recipe.phase || 0, a, clamp(recipe.density, 20, 100), q, recipe.moodBias);
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
