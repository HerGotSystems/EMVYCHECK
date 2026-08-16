/* EMVY CHECK Living Art V8 — River Mill art-quality prototype: asset/texture library.

   V6/V7 drew entire scenes directly from raw Canvas primitives (rect/arc/
   triangle, one flat fill per object). That reads as diagrammatic no matter
   how much composition/lighting logic sits on top of it. This module is a
   different layer entirely: a small internal library of hand-tuned,
   deterministic BUILDING/TREE/MOUNTAIN/etc. silhouette generators (real
   irregular multi-curve geometry, not a jittered circle) plus a lightweight
   brush-texture system (dry-brush stroke clusters, a cached paper-grain
   tile) that River Mill composites through instead of flat-filling shapes.

   Design rules:
   - Geometry only. Nothing here sets fillStyle/strokeStyle or calls
     fill()/stroke() except the texture helpers (which are inherently about
     paint/ink, not shape) - the caller (scenes.js) owns all colour, exactly
     like the existing organicBlob/ridgePath pattern it already follows.
     This keeps every colour in River Mill still deriving from the 5-slot
     palette, just through richer shapes.
   - Every generator takes the seeded r() and consumes it in whatever order
     it needs - callers must call these at a fixed point in their own r()
     sequence (same determinism rule as scenes.js).
   - No external assets, no network, no WebGL. Only two cached offscreen
     canvases exist (paper grain + soft wash mottling) and both are
     resolution-independent noise generated ONCE at module load, then tiled
     via canvas patterns - never regenerated per frame or per artwork. */
(function (global) {
  'use strict';

  const engine = global.LivingArtEngine;
  const mix = engine.mix;
  const clamp = engine.clamp;

  // ============================================================ GEOMETRY ==

  /* A smooth irregular closed silhouette through N control points, walked
     with quadraticCurveTo through their midpoints (the standard "smooth
     polygon" trick) instead of straight lineTo segments - this alone is
     most of the difference between "jittered circle" and "hand-drawn
     blob": every edge is a soft curve, never a polygon facet. */
  function smoothBlob(ctx, r, cx, cy, rx, ry, points, irregularity, rot) {
    rot = rot || 0;
    const pts = [];
    for (let i = 0; i < points; i++) {
      const ang = (i / points) * Math.PI * 2 + rot;
      const jitter = 1 + (r() - 0.5) * 2 * irregularity;
      pts.push([cx + Math.cos(ang) * rx * jitter, cy + Math.sin(ang) * ry * jitter]);
    }
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i], p1 = pts[(i + 1) % pts.length];
      const mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
      if (i === 0) ctx.moveTo((pts[pts.length - 1][0] + p0[0]) / 2, (pts[pts.length - 1][1] + p0[1]) / 2);
      ctx.quadraticCurveTo(p0[0], p0[1], mx, my);
    }
    ctx.closePath();
  }

  /* An irregular open silhouette line (mountain ridge, roofline, hedge
     edge) built the same smoothed way - segs control points, each with its
     own vertical amplitude and slight horizontal lean, joined by curves
     instead of straight facets. Two-octave: a coarse wander plus a finer
     ripple, which is what separates a real ridge silhouette from an evenly
     spaced zig-zag. */
  function smoothRidge(ctx, r, x0, w, baseY, segs, ampMin, ampMax, jaggedness) {
    const pts = [[x0, baseY]];
    for (let i = 0; i <= segs; i++) {
      const x = x0 + (i / segs) * w;
      let amp = ampMin + r() * (ampMax - ampMin);
      const fine = (r() - 0.5) * (ampMax - ampMin) * jaggedness;
      const lean = (r() - 0.5) * (w / segs) * 0.5;
      pts.push([x + lean, baseY - amp - fine]);
    }
    pts.push([x0 + w, baseY]);
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  }

  // =========================================================== TEXTURE ===

  /* A resolution-independent paper/gouache grain tile, generated ONCE at
     module load (not per artwork, not per frame - real paper grain doesn't
     change based on what's painted on it) and reused as a canvas pattern.
     Cheap: one small offscreen raster, then a single fillRect with a
     pattern fill per use - no per-pixel work at render time. */
  let _grainTile = null;
  function getGrainPattern(ctx) {
    if (!_grainTile) {
      const size = 180;
      const t = document.createElement('canvas'); t.width = size; t.height = size;
      const tctx = t.getContext('2d');
      // A fixed, non-seeded PRNG so the grain is identical across every
      // artwork/session - it is the "paper", not the "painting".
      let s = 987654321;
      function rnd() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0; return ((s >>> 0) / 4294967296); }
      for (let i = 0; i < size * size * 0.55; i++) {
        const x = rnd() * size, y = rnd() * size;
        const v = rnd();
        tctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,' + (0.03 + rnd() * 0.05) + ')' : 'rgba(0,0,0,' + (0.03 + rnd() * 0.05) + ')';
        tctx.fillRect(x, y, 1, 1);
      }
      _grainTile = t;
    }
    return ctx.createPattern(_grainTile, 'repeat');
  }

  /* A soft mottled wash tile - broad, low-frequency blobby variation (not
     stipple) for water/sky/wall colour-mottling, also cached and reused. */
  let _washTile = null;
  function getWashPattern(ctx) {
    if (!_washTile) {
      const size = 220;
      const t = document.createElement('canvas'); t.width = size; t.height = size;
      const tctx = t.getContext('2d');
      let s = 135792468;
      function rnd() { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0; return ((s >>> 0) / 4294967296); }
      for (let i = 0; i < 26; i++) {
        const x = rnd() * size, y = rnd() * size, rr = 18 + rnd() * 34;
        const g = tctx.createRadialGradient(x, y, 0, x, y, rr);
        const dark = rnd() > 0.5;
        g.addColorStop(0, dark ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.fillStyle = g;
        tctx.beginPath(); tctx.arc(x, y, rr, 0, Math.PI * 2); tctx.fill();
      }
      _washTile = t;
    }
    return ctx.createPattern(_washTile, 'repeat');
  }

  /* Lays grain (always) and wash (optional) over a rectangular region using
     a blend mode so it reads as texture-in-the-paint rather than a sticker
     on top - 'overlay' lightens light areas / darkens dark areas, which is
     exactly how canvas tooth interacts with paint. */
  function applyGrain(ctx, x, y, w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = getGrainPattern(ctx);
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  function applyWash(ctx, x, y, w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = getWashPattern(ctx);
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /* A single tapered dry-brush stroke: a short curved ribbon (not a 1px
     line) drawn as a filled shape whose width eases in/out along its
     length, with a couple of skipped gaps so the edge breaks up like a
     half-loaded brush instead of a clean line. */
  function dryBrushStroke(ctx, r, x0, y0, x1, y1, width, gapChance) {
    const segs = 5;
    const dx = (x1 - x0) / segs, dy = (y1 - y0) / segs;
    const nx = -dy, ny = dx, len = Math.hypot(nx, ny) || 1;
    const ux = nx / len, uy = ny / len;
    for (let i = 0; i < segs; i++) {
      if (gapChance && r() < gapChance) continue;
      const t0 = i / segs, t1 = (i + 1) / segs;
      const taper0 = Math.sin(t0 * Math.PI), taper1 = Math.sin(t1 * Math.PI);
      const sx0 = x0 + dx * i, sy0 = y0 + dy * i;
      const sx1 = x0 + dx * (i + 1), sy1 = y0 + dy * (i + 1);
      const w0 = width * (0.35 + taper0 * 0.65) * (0.7 + r() * 0.6);
      const w1 = width * (0.35 + taper1 * 0.65) * (0.7 + r() * 0.6);
      ctx.beginPath();
      ctx.moveTo(sx0 - ux * w0, sy0 - uy * w0);
      ctx.lineTo(sx1 - ux * w1, sy1 - uy * w1);
      ctx.lineTo(sx1 + ux * w1, sy1 + uy * w1);
      ctx.lineTo(sx0 + ux * w0, sy0 + uy * w0);
      ctx.closePath(); ctx.fill();
    }
  }

  /* Builds tonal depth for a mass (canopy, mountain flank, foliage clump)
     from many short overlapping strokes rather than one flat fill - the
     caller supplies a colour-of-this-stroke callback so it can vary hue/
     value per stroke (shadow strokes underneath, highlight strokes on top). */
  function brushMass(ctx, r, cx, cy, rx, ry, count, colorFn, angleBias) {
    for (let i = 0; i < count; i++) {
      const ang = angleBias + (r() - 0.5) * 2.4;
      const u = r(), v = r();
      const px = cx + (u - 0.5) * 2 * rx, py = cy + (v - 0.5) * 2 * ry;
      const inside = ((px - cx) / rx) * ((px - cx) / rx) + ((py - cy) / ry) * ((py - cy) / ry);
      if (inside > 1.05) continue;
      const len = (0.18 + r() * 0.3) * Math.min(rx, ry);
      const x0 = px - Math.cos(ang) * len * 0.5, y0 = py - Math.sin(ang) * len * 0.5;
      const x1 = px + Math.cos(ang) * len * 0.5, y1 = py + Math.sin(ang) * len * 0.5;
      ctx.fillStyle = colorFn(r, i, count);
      dryBrushStroke(ctx, r, x0, y0, x1, y1, len * (0.28 + r() * 0.22), 0.15);
    }
  }

  // =============================================================== MILL ==
  /* Five structurally distinct wall/proportions variants (not one formula
     with randomised numbers) - each returns key anchor points the caller
     needs (roofline, wheel-side wall edge, window band) after drawing the
     wall itself onto the current path-less ctx (caller fills). */
  function millWall(ctx, r, x, y, w, h, variant) {
    const top = y, bottom = y + h;
    ctx.beginPath();
    if (variant === 0) { // stone cottage: slightly bulging, uneven coursing along the top
      ctx.moveTo(x, bottom);
      const segs = 5;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        ctx.lineTo(x + u * w, top + (r() - 0.5) * h * 0.03);
      }
      ctx.lineTo(x + w, bottom);
      ctx.closePath();
    } else if (variant === 1) { // timber-frame: slight outward lean, jettied upper storey
      const jetty = w * 0.06;
      ctx.moveTo(x + jetty * 0.4, bottom);
      ctx.lineTo(x - jetty, top + h * 0.4);
      ctx.lineTo(x, top);
      ctx.lineTo(x + w, top);
      ctx.lineTo(x + w + jetty, top + h * 0.4);
      ctx.lineTo(x + w - jetty * 0.4, bottom);
      ctx.closePath();
    } else if (variant === 2) { // tall narrow tower mill: strong verticality, tapered
      const taper = w * 0.12;
      ctx.moveTo(x + taper * 0.5, bottom);
      ctx.lineTo(x, top);
      ctx.lineTo(x + w, top);
      ctx.lineTo(x + w - taper * 0.5, bottom);
      ctx.closePath();
    } else if (variant === 3) { // low broad barn-mill with a lean-to extension
      ctx.moveTo(x, bottom);
      ctx.lineTo(x, top + h * 0.15);
      ctx.lineTo(x + w * 0.15, top);
      ctx.lineTo(x + w, top);
      ctx.lineTo(x + w, bottom);
      ctx.closePath();
    } else { // weathered irregular fieldstone, uneven silhouette both sides
      const segs = 6;
      ctx.moveTo(x, bottom);
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const edge = (u < 0.08 || u > 0.92) ? h * 0.08 : 0;
        ctx.lineTo(x + u * w, top + edge * (r() * 0.6 + 0.4) + (r() - 0.5) * h * 0.025);
      }
      ctx.lineTo(x + w, bottom);
      ctx.closePath();
    }
    return { top: top, bottom: bottom, left: x, right: x + w, width: w, height: h };
  }

  /* Several genuinely different roof forms - gabled, hipped, catslide
     (one long low slope), tall witch's-cap (windmill), gambrel (barn). */
  function millRoof(ctx, r, x, y, w, h, roofVariant, extend) {
    const ex = w * (extend == null ? 0.1 : extend);
    ctx.beginPath();
    if (roofVariant === 0) { // gabled, slightly uneven ridge
      const ridgeX = x + w * (0.42 + r() * 0.16);
      ctx.moveTo(x - ex, y);
      ctx.lineTo(ridgeX, y - h * (0.85 + r() * 0.2));
      ctx.lineTo(x + w + ex, y);
      ctx.closePath();
    } else if (roofVariant === 1) { // hipped: flattened trapezoid, both ends sloped
      ctx.moveTo(x - ex, y);
      ctx.lineTo(x + w * 0.3, y - h * 0.75);
      ctx.lineTo(x + w * 0.7, y - h * 0.75);
      ctx.lineTo(x + w + ex, y);
      ctx.closePath();
    } else if (roofVariant === 2) { // catslide: one long low slope down past the eave line
      ctx.moveTo(x - ex, y + h * 0.3);
      ctx.lineTo(x + w * 0.3, y - h * 0.7);
      ctx.lineTo(x + w + ex * 1.6, y + h * 0.15);
      ctx.lineTo(x + w - ex * 0.3, y + h * 0.32);
      ctx.closePath();
    } else if (roofVariant === 3) { // witch's-cap: tall conical point (tower mill)
      ctx.moveTo(x - ex * 0.6, y);
      ctx.bezierCurveTo(x, y - h * 0.5, x + w * 0.35, y - h * 1.15, x + w * 0.5, y - h * 1.35);
      ctx.bezierCurveTo(x + w * 0.65, y - h * 1.15, x + w, y - h * 0.5, x + w + ex * 0.6, y);
      ctx.closePath();
    } else { // gambrel: two-slope barn roof
      ctx.moveTo(x - ex, y);
      ctx.lineTo(x + w * 0.15, y - h * 0.45);
      ctx.lineTo(x + w * 0.4, y - h * 0.95);
      ctx.lineTo(x + w * 0.6, y - h * 0.95);
      ctx.lineTo(x + w * 0.85, y - h * 0.45);
      ctx.lineTo(x + w + ex, y);
      ctx.closePath();
    }
  }

  // ============================================================== WHEEL ==
  /* Three visual variants: crisp modern-restored overshot wheel, a rustic
     weathered wheel with a few missing/broken paddles, and a small simple
     undershot wheel. Returns paddle geometry (angle/length/thickness/
     wetness) rather than drawing directly, since paddle colour depends on
     wetness and palette, which scenes.js owns - the caller iterates the
     list, building each paddle's quad itself and setting fillStyle per
     paddle before filling. */
  function wheelPaddles(r, R, variant, spin, wetFn) {
    const paddles = variant === 2 ? 8 : 12;
    const broken = variant === 1;
    const out = [];
    for (let i = 0; i < paddles; i++) {
      if (broken && r() < 0.12) continue;
      const ang = (i / paddles) * Math.PI * 2;
      const wet = wetFn(ang, spin);
      const len = R * (variant === 2 ? 0.62 : 0.78) * (broken ? (0.85 + r() * 0.15) : 1);
      const thick = R * (variant === 2 ? 0.14 : 0.17);
      out.push({ ang: ang, len: len, thick: thick, wet: wet });
    }
    return out;
  }

  // =============================================================== TREE ==
  /* Eight structurally distinct silhouettes - weeping, rounded deciduous,
     columnar, twin-trunk clump, windswept-leaning, bare winter branches,
     layered conifer, low shrub - each with its own canopy-mass logic so a
     treeline reads as mixed woodland, not one shape repeated at scale. */
  const TREE_VARIANT_COUNT = 8;
  function drawTree(ctx, r, x, groundY, scale, variant, sway, canopyColorFn, trunkColorFn) {
    const trunkH = 14 * scale, trunkW = 2.2 * scale;
    if (variant !== 5) { // variant 5 (bare winter) draws its own thinner trunk below
      ctx.fillStyle = trunkColorFn();
      ctx.beginPath();
      ctx.moveTo(x - trunkW * 0.5, groundY);
      ctx.quadraticCurveTo(x + sway * 0.3, groundY - trunkH * 0.6, x + sway * 0.6 - trunkW * 0.2, groundY - trunkH);
      ctx.lineTo(x + sway * 0.6 + trunkW * 0.2, groundY - trunkH);
      ctx.quadraticCurveTo(x + sway * 0.3 + trunkW * 0.4, groundY - trunkH * 0.6, x + trunkW * 0.5, groundY);
      ctx.closePath(); ctx.fill();
    }
    const topX = x + sway * 0.6, topY = groundY - trunkH;
    if (variant === 0) { // weeping: drooping trailing canopy strands
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1) - 0.5) * 2;
        const dx = a * 11 * scale, len = (9 + r() * 7) * scale;
        ctx.strokeStyle = canopyColorFn(r, i, n); ctx.lineWidth = 1.4 * scale;
        ctx.beginPath();
        ctx.moveTo(topX, topY - 4 * scale);
        ctx.quadraticCurveTo(topX + dx * 0.6 + sway * 0.4, topY - 2 * scale, topX + dx + sway * 0.7, topY + len);
        ctx.stroke();
      }
      brushMass(ctx, r, topX, topY - 6 * scale, 12 * scale, 8 * scale, 10, canopyColorFn, -1.57);
    } else if (variant === 1) { // rounded deciduous mass
      smoothBlob(ctx, r, topX, topY - 6 * scale, 10 * scale, 8 * scale, 8, 0.28);
      ctx.fillStyle = canopyColorFn(r, 0, 1); ctx.fill();
      brushMass(ctx, r, topX, topY - 6 * scale, 9 * scale, 7 * scale, 14, canopyColorFn, -0.6);
    } else if (variant === 2) { // columnar (poplar-like)
      smoothBlob(ctx, r, topX, topY - 12 * scale, 4 * scale, 13 * scale, 7, 0.2);
      ctx.fillStyle = canopyColorFn(r, 0, 1); ctx.fill();
      brushMass(ctx, r, topX, topY - 12 * scale, 3.6 * scale, 12 * scale, 12, canopyColorFn, -1.4);
    } else if (variant === 3) { // twin-trunk clump - two offset canopy masses
      [-1, 1].forEach(function (side, i) {
        const cx2 = topX + side * 5 * scale, cy2 = topY - (4 + i * 2) * scale;
        smoothBlob(ctx, r, cx2, cy2, 7 * scale, 6 * scale, 7, 0.3);
        ctx.fillStyle = canopyColorFn(r, i, 2); ctx.fill();
        brushMass(ctx, r, cx2, cy2, 6.5 * scale, 5.5 * scale, 9, canopyColorFn, -0.6 + side * 0.3);
      });
    } else if (variant === 4) { // windswept-leaning
      smoothBlob(ctx, r, topX + 6 * scale, topY - 4 * scale, 10 * scale, 6 * scale, 8, 0.32, 0.3);
      ctx.fillStyle = canopyColorFn(r, 0, 1); ctx.fill();
      brushMass(ctx, r, topX + 6 * scale, topY - 4 * scale, 9 * scale, 5 * scale, 11, canopyColorFn, -0.3);
    } else if (variant === 5) { // bare winter branches - thin trunk + fork lines, no mass
      ctx.strokeStyle = trunkColorFn(); ctx.lineWidth = trunkW * 0.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, groundY); ctx.lineTo(topX, topY); ctx.stroke();
      const branches = 5;
      for (let i = 0; i < branches; i++) {
        const bt = 0.35 + (i / branches) * 0.6;
        const bx = mix(x, topX, bt), by = mix(groundY, topY, bt);
        const a = (r() - 0.5) * 1.6 - 0.9;
        const blen = (5 + r() * 6) * scale;
        ctx.lineWidth = trunkW * 0.6 * (1 - bt * 0.6);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(a) * blen, by + Math.sin(a) * blen); ctx.stroke();
      }
    } else if (variant === 6) { // layered conifer - stacked tiers, narrowing upward
      const tiers = 4;
      for (let i = 0; i < tiers; i++) {
        const ty = topY + i * 3.4 * scale, tw = (9 - i * 1.7) * scale;
        ctx.beginPath();
        ctx.moveTo(topX - tw, ty + 4 * scale);
        ctx.quadraticCurveTo(topX, ty - 4 * scale, topX + tw, ty + 4 * scale);
        ctx.quadraticCurveTo(topX, ty + 2 * scale, topX - tw, ty + 4 * scale);
        ctx.closePath();
        ctx.fillStyle = canopyColorFn(r, i, tiers); ctx.fill();
      }
    } else { // low shrub-tree - wide, short, dense
      smoothBlob(ctx, r, x, groundY - 5 * scale, 9 * scale, 5 * scale, 7, 0.3);
      ctx.fillStyle = canopyColorFn(r, 0, 1); ctx.fill();
      brushMass(ctx, r, x, groundY - 5 * scale, 8 * scale, 4.5 * scale, 10, canopyColorFn, 0);
    }
  }

  // ========================================================== MOUNTAIN ===
  /* Multiple ridge "families" - jagged alpine, soft rolling, mesa/plateau,
     single dominant peak with foothills - drawn with smoothRidge's two-
     octave irregularity so no silhouette reads as a repeated triangle. */
  function mountainRidge(ctx, r, x0, w, baseY, family, ampScale) {
    if (family === 0) { // jagged alpine
      smoothRidge(ctx, r, x0, w, baseY, 9, ampScale * 0.5, ampScale * 1.15, 0.55);
    } else if (family === 1) { // soft rolling
      smoothRidge(ctx, r, x0, w, baseY, 6, ampScale * 0.25, ampScale * 0.55, 0.15);
    } else if (family === 2) { // mesa/plateau - flat-topped with cliff edges
      const segs = 5, pts = [[x0, baseY]];
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, x = x0 + u * w;
        const plateau = u > 0.25 && u < 0.75;
        const amp = plateau ? ampScale * (0.85 + r() * 0.08) : ampScale * (0.2 + r() * 0.15);
        pts.push([x, baseY - amp]);
      }
      pts.push([x0 + w, baseY]);
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    } else { // single dominant peak + foothills
      const peakU = 0.3 + r() * 0.4;
      const pts = [[x0, baseY]];
      const segs = 8;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const distFromPeak = Math.abs(u - peakU);
        const amp = ampScale * Math.max(0.12, 1.1 - distFromPeak * 2.6) + (r() - 0.5) * ampScale * 0.12;
        pts.push([x0 + u * w, baseY - amp]);
      }
      pts.push([x0 + w, baseY]);
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
      }
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    }
  }

  // ============================================================= CLOUD ===
  // Several formations: scattered cumulus, streaky bands, low fog bank,
  // one dramatic dominant mass.
  function cloudFormation(ctx, r, cx, cy, scale, formation) {
    if (formation === 0) { // scattered cumulus - 3-4 puffy lobes
      const lobes = 3 + Math.floor(r() * 2);
      for (let i = 0; i < lobes; i++) {
        smoothBlob(ctx, r, cx + (i - lobes / 2) * scale * 0.55, cy + (r() - 0.5) * scale * 0.2, scale * (0.5 + r() * 0.25), scale * 0.32, 7, 0.22);
        ctx.fill();
      }
    } else if (formation === 1) { // streaky cirrus bands
      const bands = 3;
      for (let i = 0; i < bands; i++) {
        ctx.beginPath();
        smoothRidge(ctx, r, cx - scale * 1.3, scale * 2.6, cy + i * scale * 0.22, 5, scale * 0.02, scale * 0.09, 0.3);
        ctx.lineTo(cx + scale * 1.3, cy + i * scale * 0.22 + scale * 0.14);
        smoothRidge(ctx, r, cx - scale * 1.3, scale * 2.6, cy + i * scale * 0.22 + scale * 0.14, 5, scale * 0.02, scale * 0.07, 0.3);
        ctx.fill();
      }
    } else if (formation === 2) { // low fog bank - wide flat soft shape
      smoothBlob(ctx, r, cx, cy, scale * 1.3, scale * 0.22, 9, 0.15);
      ctx.fill();
    } else { // one dramatic dominant mass
      smoothBlob(ctx, r, cx, cy, scale * 0.85, scale * 0.5, 9, 0.3);
      ctx.fill();
    }
  }

  // ============================================================== ROCK ===
  function rockShape(ctx, r, x, y, scale, variant) {
    if (variant === 0) { // flat slab
      smoothBlob(ctx, r, x, y, scale * 1.3, scale * 0.35, 6, 0.25);
    } else if (variant === 1) { // rounded boulder cluster
      smoothBlob(ctx, r, x, y, scale * 0.8, scale * 0.62, 7, 0.28);
    } else { // jagged outcrop
      const pts = 6;
      ctx.beginPath();
      for (let i = 0; i < pts; i++) {
        const ang = (i / pts) * Math.PI * 2;
        const rr = scale * (0.4 + (i % 2 === 0 ? r() * 0.9 : r() * 0.4));
        const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr * 0.6;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
    }
  }

  // ======================================================= REEDS/GRASS ===
  function reedCluster(ctx, r, x, groundY, scale, variant, sway) {
    if (variant === 0) { // tall sparse reeds
      const n = 3 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const rx = x + (r() - 0.5) * 10 * scale, rh = (14 + r() * 10) * scale;
        ctx.beginPath(); ctx.moveTo(rx, groundY);
        ctx.quadraticCurveTo(rx + sway * 0.5, groundY - rh * 0.6, rx + sway, groundY - rh);
        ctx.stroke();
      }
    } else if (variant === 1) { // dense low grass tuft
      const n = 8 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) {
        const rx = x + (r() - 0.5) * 8 * scale, rh = (4 + r() * 5) * scale;
        ctx.beginPath(); ctx.moveTo(rx, groundY);
        ctx.quadraticCurveTo(rx + sway * 0.3, groundY - rh * 0.7, rx + sway * 0.6, groundY - rh);
        ctx.stroke();
      }
    } else { // mixed clump with seed-heads
      const n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const rx = x + (r() - 0.5) * 9 * scale, rh = (10 + r() * 8) * scale;
        ctx.beginPath(); ctx.moveTo(rx, groundY);
        ctx.quadraticCurveTo(rx + sway * 0.5, groundY - rh * 0.6, rx + sway, groundY - rh);
        ctx.stroke();
        if (r() > 0.4) {
          ctx.beginPath(); ctx.ellipse(rx + sway, groundY - rh, 1.3 * scale, 2.6 * scale, 0.3, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  global.LivingArtSceneAssets = {
    smoothBlob: smoothBlob,
    smoothRidge: smoothRidge,
    applyGrain: applyGrain,
    applyWash: applyWash,
    dryBrushStroke: dryBrushStroke,
    brushMass: brushMass,
    millWall: millWall,
    millRoof: millRoof,
    wheelPaddles: wheelPaddles,
    drawTree: drawTree,
    TREE_VARIANT_COUNT: TREE_VARIANT_COUNT,
    mountainRidge: mountainRidge,
    cloudFormation: cloudFormation,
    rockShape: rockShape,
    reedCluster: reedCluster
  };
})(window);
