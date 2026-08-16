/* EMVY CHECK Living Art V4 — scene families.
   A second, representational content layer alongside the existing abstract
   procedural FAMILIES in engine.js. Same deterministic-seed pipeline, same
   PAINT/LIVE/MUSIC contract: at phase=0 with NEUTRAL_AUDIO every scene must
   read as a proper still composition (PAINT); as `t` advances it drifts
   ambiently (LIVE); as `a.*` moves off zero it reacts with scene-specific,
   designed events rather than generic pulsing (MUSIC) - see each scene's
   `musicProfile` below for the mapping.

   Determinism rule every scene function must follow: the seeded RNG `r()`
   is consumed in a FIXED order/count that never depends on the runtime
   audio values - only the position/size/alpha *computed* from a draw may
   depend on audio, never how many times r() gets called before it. An
   audio-gated flourish (a kick splash, a treble sparkle burst) is safe
   only when it is the LAST thing a scene draws, since nothing downstream
   then depends on the RNG sequence it consumes. This is what keeps "same
   seed + same scene + same settings reproduce the same base composition"
   true for PAINT while still letting MUSIC react freely. */
(function (global) {
  'use strict';

  const engine = global.LivingArtEngine;
  const PALETTES = engine.PALETTES;
  const rngFromSeed = engine.rngFromSeed;
  const clamp = engine.clamp;
  const mix = engine.mix;
  const rgba = engine.rgba;

  // ---------------------------------------------------------- A. RIVER MILL -
  function drawRiverMill(ctx, w, h, r, pal, t, a, density, q) {
    const skyH = h * 0.52;
    const sky = ctx.createLinearGradient(0, 0, 0, skyH);
    sky.addColorStop(0, rgba(pal[0], 1));
    sky.addColorStop(1, rgba(pal[1], 0.22));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, skyH);

    // distant hills silhouette
    ctx.fillStyle = rgba(pal[1], 0.14);
    ctx.beginPath(); ctx.moveTo(0, skyH);
    const hillPts = 6;
    for (let i = 0; i <= hillPts; i++) {
      const x = (i / hillPts) * w;
      const y = skyH - (10 + r() * 40) * (0.6 + Math.sin(i * 1.3) * 0.4);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, skyH); ctx.closePath(); ctx.fill();

    // river band - gentle wave shape, current speed/height driven by bass
    const riverTop = h * 0.6, riverBottom = h;
    const water = ctx.createLinearGradient(0, riverTop, 0, riverBottom);
    water.addColorStop(0, rgba(pal[3], 0.55));
    water.addColorStop(1, rgba(pal[0], 0.9));
    ctx.fillStyle = water;
    ctx.beginPath(); ctx.moveTo(0, riverTop);
    const bankPts = 10;
    const flow = t * (0.6 + a.bass * 0.8);
    for (let i = 0; i <= bankPts; i++) {
      const x = (i / bankPts) * w;
      const y = riverTop + Math.sin(i * 0.9 + flow * 0.6) * 6 * (1 + a.bass * 0.5);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, riverBottom); ctx.lineTo(0, riverBottom); ctx.closePath(); ctx.fill();

    // shimmer highlights scrolling downstream - density/brightness from treble
    ctx.globalCompositeOperation = 'screen';
    const shimmerN = Math.floor((8 + density * 0.12) * q * (1 + a.treble * 0.6));
    for (let i = 0; i < shimmerN; i++) {
      const ry = riverTop + 10 + (i / shimmerN) * (riverBottom - riverTop - 20);
      const xoff = ((flow * 40 + i * 53) % (w + 80)) - 40;
      ctx.strokeStyle = rgba(pal[2], 0.10 + 0.22 * a.treble + 0.08 * Math.sin(i + flow));
      ctx.lineWidth = 1 + (i % 3) * 0.6;
      ctx.beginPath(); ctx.moveTo(xoff, ry); ctx.lineTo(xoff + 60 + a.bass * 30, ry + Math.sin(i) * 2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    // trees along the near bank, gentle wind sway
    const treeCount = Math.floor((5 + density * 0.06) * q);
    for (let i = 0; i < treeCount; i++) {
      const tx = r() * w * 0.5, ty = riverTop - r() * h * 0.05;
      const sway = Math.sin(t * 0.4 + i) * 3 * (1 + a.mid * 0.3);
      const trunkH = 10 + r() * 14;
      ctx.fillStyle = rgba(pal[2], 0.5 + r() * 0.3);
      ctx.fillRect(tx - 1.5, ty, 3, trunkH);
      ctx.beginPath(); ctx.ellipse(tx + sway, ty - trunkH * 0.3, 10 + r() * 10, 8 + r() * 8, 0, 0, Math.PI * 2); ctx.fill();
    }

    // cottage
    const houseX = w * (0.58 + r() * 0.08), houseY = riverTop - h * 0.14;
    const houseW = w * 0.14, houseH = h * 0.1;
    ctx.fillStyle = rgba(pal[1], 0.85);
    ctx.fillRect(houseX, houseY, houseW, houseH);
    ctx.beginPath();
    ctx.moveTo(houseX - 6, houseY);
    ctx.lineTo(houseX + houseW / 2, houseY - houseH * 0.7);
    ctx.lineTo(houseX + houseW + 6, houseY);
    ctx.closePath(); ctx.fillStyle = rgba(pal[3], 0.9); ctx.fill();
    ctx.fillStyle = rgba(pal[4], 0.7 + a.kick * 0.3);
    ctx.fillRect(houseX + houseW * 0.2, houseY + houseH * 0.3, houseW * 0.18, houseH * 0.35);
    ctx.fillRect(houseX + houseW * 0.62, houseY + houseH * 0.3, houseW * 0.18, houseH * 0.35);

    // mill wheel - rotation speed from mid, radius nudged by bass
    const wheelX = houseX + houseW + w * 0.03, wheelY = riverTop + h * 0.02;
    const wheelR = Math.min(w, h) * (0.055 + a.bass * 0.008);
    const spin = t * (0.6 + a.mid * 1.4);
    ctx.save(); ctx.translate(wheelX, wheelY); ctx.rotate(spin);
    ctx.strokeStyle = rgba(pal[2], 0.85); ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, wheelR, 0, Math.PI * 2); ctx.stroke();
    const spokes = 8;
    for (let i = 0; i < spokes; i++) {
      const ang = (i / spokes) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * wheelR, Math.sin(ang) * wheelR); ctx.stroke();
    }
    ctx.restore();

    // reflection of house+wheel in the water
    ctx.save();
    ctx.globalAlpha = 0.18 + a.treble * 0.05;
    ctx.translate(0, riverTop * 2); ctx.scale(1, -1);
    ctx.fillStyle = rgba(pal[1], 0.6);
    ctx.fillRect(houseX, houseY, houseW, houseH * 0.6);
    ctx.restore();

    // splash bursts at the wheel base on kick - last, so it can freely vary
    // how many r() calls it makes without shifting anything drawn above
    if (a.kick > 0.05) {
      ctx.globalCompositeOperation = 'screen';
      const n = Math.floor(4 + a.kick * 8);
      for (let i = 0; i < n; i++) {
        const ang = r() * Math.PI * 2;
        const rr = wheelR * (0.6 + r() * 1.4) * a.kick;
        ctx.fillStyle = rgba(pal[4], 0.5 * a.kick);
        ctx.beginPath(); ctx.arc(wheelX + Math.cos(ang) * rr, wheelY + wheelR * 0.7 + Math.sin(ang) * rr * 0.3, 1.5 + r() * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // ------------------------------------------------------ B. OPEN ARMS FIGURE
  function drawOpenArms(ctx, w, h, r, pal, t, a, density, q) {
    const cx = w * 0.5, cy = h * 0.56;

    // atmospheric backdrop glow behind the figure
    const glowR = Math.max(w, h) * (0.55 + a.bass * 0.15);
    const glow = ctx.createRadialGradient(cx, cy - h * 0.1, 0, cx, cy - h * 0.1, glowR);
    glow.addColorStop(0, rgba(pal[3], 0.28 + a.kick * 0.35));
    glow.addColorStop(0.5, rgba(pal[2], 0.10 + a.bass * 0.1));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);

    // light rays fanning from behind - rotation speed from mid
    ctx.save(); ctx.translate(cx, cy - h * 0.12);
    const rays = Math.floor((10 + density * 0.06) * q);
    const rayRot = t * (0.03 + a.mid * 0.06);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2 + rayRot;
      const len = Math.max(w, h) * (0.32 + r() * 0.22) * (1 + a.kick * 0.3);
      ctx.strokeStyle = rgba(pal[4], 0.05 + 0.08 * r() + a.treble * 0.05);
      ctx.lineWidth = 2 + r() * 4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len); ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    // halo - scale/radiance from bass, brief burst on kick
    const haloR = Math.min(w, h) * (0.09 + a.bass * 0.02) * (1 + Math.sin(t * 0.6) * 0.04);
    const halo = ctx.createRadialGradient(cx, cy - h * 0.24, 0, cx, cy - h * 0.24, haloR * 2.4);
    halo.addColorStop(0, rgba(pal[4], 0.6 + a.kick * 0.4));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);

    // figure silhouette: head, robe, two open arms - stylised, not realistic
    const scale = Math.min(w, h) * (1 + a.kick * 0.03);
    const headR = scale * 0.05;
    const headY = cy - h * 0.24;
    const shoulderY = headY + headR * 1.6;
    const hemY = cy + h * 0.22;
    const armSpread = scale * (0.22 + a.kick * 0.03);
    const sway = Math.sin(t * 0.35) * scale * 0.012 * (1 + a.mid * 0.6);

    ctx.fillStyle = rgba(pal[2], 0.92);
    ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - scale * 0.09, shoulderY);
    ctx.quadraticCurveTo(cx - scale * 0.15 + sway, mix(shoulderY, hemY, 0.6), cx - scale * 0.19, hemY);
    ctx.lineTo(cx + scale * 0.19, hemY);
    ctx.quadraticCurveTo(cx + scale * 0.15 + sway, mix(shoulderY, hemY, 0.6), cx + scale * 0.09, shoulderY);
    ctx.closePath(); ctx.fill();
    ctx.lineWidth = scale * 0.035; ctx.strokeStyle = rgba(pal[2], 0.92); ctx.lineCap = 'round';
    [-1, 1].forEach(function (side) {
      ctx.beginPath();
      ctx.moveTo(cx + side * scale * 0.08, shoulderY + headR * 0.3);
      ctx.quadraticCurveTo(cx + side * armSpread * 0.7, shoulderY - headR * 0.6 + sway, cx + side * armSpread, shoulderY + headR * 1.2);
      ctx.stroke();
    });

    // spark/halo detail motes from treble - last, count varies freely with audio
    ctx.globalCompositeOperation = 'screen';
    const motes = Math.floor(a.treble * 30);
    for (let i = 0; i < motes; i++) {
      const ang = r() * Math.PI * 2, rr = haloR * (1 + r() * 3);
      ctx.fillStyle = rgba(pal[4], 0.4 * r());
      ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * rr, headY + Math.sin(ang) * rr * 0.7, 1 + r() * 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ----------------------------------------------------------- C. BIRDS FLIGHT
  function drawBirdsFlight(ctx, w, h, r, pal, t, a, density, q) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, rgba(pal[0], 1));
    sky.addColorStop(1, rgba(pal[1], 0.16));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = rgba(pal[1], 0.10);
    ctx.fillRect(0, h * 0.86, w, h * 0.14);

    const count = Math.floor((22 + density * 0.5) * q);
    const drift = t * (0.02 + a.bass * 0.05);
    const lift = a.kick * 30;
    ctx.strokeStyle = rgba(pal[2], 0.7);
    for (let i = 0; i < count; i++) {
      const bx = r() * 1.4 - 0.2, by = 0.12 + r() * 0.55;
      const glintRoll = r(); // always consumed - keeps every later bird's RNG draw audio-independent
      const x = (((bx + drift) % 1.4) + 1.4) % 1.4 * w - w * 0.2;
      const flock = Math.sin(bx * 6 + by * 4) * 0.06;
      const y = (by + flock) * h - lift * (0.4 + Math.sin(i) * 0.6);
      const size = (5 + (glintRoll * 9)) * (0.6 + (1 - by) * 0.8) * q;
      const flap = Math.sin(t * (3 + a.mid * 4) + i * 1.7) * (0.4 + a.mid * 0.5);
      ctx.globalAlpha = 0.35 + (1 - by) * 0.5 + a.treble * 0.1;
      ctx.lineWidth = 1 + size * 0.06;
      ctx.beginPath();
      ctx.moveTo(x - size, y + flap * size * 0.6);
      ctx.quadraticCurveTo(x, y - size * 0.5 - Math.abs(flap) * size, x + size, y + flap * size * 0.6);
      ctx.stroke();
      if (a.treble > 0.3 && glintRoll > 0.6) {
        ctx.fillStyle = rgba(pal[4], 0.3 * a.treble);
        ctx.beginPath(); ctx.arc(x, y - size * 0.3, 1 + glintRoll * 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------- D. COASTER RIDE
  function drawCoasterRide(ctx, w, h, r, pal, t, a, density, q) {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, rgba(pal[0], 1));
    sky.addColorStop(1, rgba(pal[1], 0.14));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = rgba(pal[1], 0.08);
    ctx.fillRect(0, h * 0.88, w, h * 0.12);

    // deterministic track control points
    const segs = 5 + Math.floor(density / 25);
    const pts = [[w * 0.05, h * 0.55]];
    let px = w * 0.05;
    for (let i = 0; i < segs; i++) {
      px += (w * 0.9) / segs;
      pts.push([px, h * (0.3 + r() * 0.45)]);
    }
    function trackPoint(u) {
      const n = pts.length - 1;
      const seg = clamp(Math.floor(u * n), 0, n - 1);
      const lt = u * n - seg;
      const p0 = pts[seg], p1 = pts[seg + 1];
      const y = mix(p0[1], p1[1], lt) - Math.sin(lt * Math.PI) * h * 0.05;
      return [mix(p0[0], p1[0], lt), y];
    }

    // rail - rumble jitter always consumes r(), scaled by bass (never gated)
    const rumble = a.bass * 3;
    ctx.strokeStyle = rgba(pal[2], 0.85);
    ctx.lineWidth = 2.2 + a.bass * 1.2;
    ctx.beginPath();
    const railSteps = Math.floor(80 * q);
    for (let i = 0; i <= railSteps; i++) {
      const u = i / railSteps;
      const pt = trackPoint(u);
      const jitter = (r() - 0.5) * rumble;
      i ? ctx.lineTo(pt[0], pt[1] + jitter) : ctx.moveTo(pt[0], pt[1] + jitter);
    }
    ctx.stroke();

    // ties
    ctx.strokeStyle = rgba(pal[1], 0.4); ctx.lineWidth = 1;
    const ties = Math.floor(40 * q);
    for (let i = 0; i < ties; i++) {
      const u = i / ties;
      const p = trackPoint(u), p2 = trackPoint(Math.min(1, u + 0.008));
      const dx = p2[0] - p[0], dy = p2[1] - p[1], len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      ctx.beginPath(); ctx.moveTo(p[0] - nx * 5, p[1] - ny * 5); ctx.lineTo(p[0] + nx * 5, p[1] + ny * 5); ctx.stroke();
    }

    // support struts under each peak
    ctx.strokeStyle = rgba(pal[1], 0.5);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i][0], h * 0.88); ctx.stroke();
    }

    // lights - chase speed from mid, brightness from treble
    const lightN = Math.floor((14 + density * 0.2) * q);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < lightN; i++) {
      const u = (i / lightN + t * (0.02 + a.mid * 0.05)) % 1;
      const p = trackPoint(u);
      const twinkle = 0.4 + 0.4 * Math.sin(t * 2 + i * 2.1);
      ctx.fillStyle = rgba(pal[4], (0.2 + twinkle * 0.3 + a.treble * 0.25));
      ctx.beginPath(); ctx.arc(p[0], p[1] - 3, 1.4 + a.treble * 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // cars travelling the loop, speed from bass + a kick launch impulse
    const speed = 0.05 + a.bass * 0.12 + a.kick * 0.25;
    const carCount = 3;
    for (let c = 0; c < carCount; c++) {
      const u = (t * speed + c / carCount) % 1;
      const p = trackPoint(u), pa = trackPoint((u + 0.01) % 1);
      const ang = Math.atan2(pa[1] - p[1], pa[0] - p[0]);
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(ang);
      ctx.fillStyle = rgba(pal[3], 0.9);
      ctx.fillRect(-6, -3, 12, 6);
      ctx.restore();
    }

    // launch flash at the start of the track on kick - last, no r() used
    if (a.kick > 0.15) {
      const lp = trackPoint(0);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = rgba(pal[4], 0.5 * a.kick);
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
      musicProfile: { bass: 'flock directional drift', mid: 'wing-flap speed / turbulence', treble: 'feather glint detail', kick: 'sudden lift / formation scatter' }
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
