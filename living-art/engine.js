/* EMVY CHECK Living Art V2 — generative render engine.
   Deterministic seeded procedural families behind one reusable render
   pipeline. No canvas is created inside the animation loop: every working
   buffer is allocated once and only resized when its target pixel size
   actually changes, so this can run for hours without leaking memory. */
(function (global) {
  'use strict';

  function hashString(str) {
    let h = 2166136261 >>> 0;
    str = String(str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rngFromSeed(seed) {
    let a = hashString(seed) || 1;
    return function () {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function mix(a, b, t) { return a + (b - a) * t; }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }
  function hexToRgb(hex) {
    hex = String(hex).replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    const n = parseInt(hex, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) { const c = hexToRgb(hex); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + (a == null ? 1 : a) + ')'; }

  const PALETTES = [
    { name: 'Ember', colors: ['#0b0b0c', '#f1eee8', '#ff4c21', '#8e102a', '#ffc857'] },
    { name: 'Glacier', colors: ['#0b1020', '#d8f1ff', '#4fd1c5', '#7c3aed', '#ff6b9d'] },
    { name: 'Moss', colors: ['#0d1712', '#e9f0d5', '#658c4c', '#d99b3d', '#8f3d2f'] },
    { name: 'Acid', colors: ['#090909', '#f4f0e8', '#d7ff00', '#00d9ff', '#ff1f8f'] },
    { name: 'Clay', colors: ['#18110e', '#f5d7a1', '#a53d2a', '#4c6a92', '#201f45'] },
    { name: 'Reef', colors: ['#07121a', '#d7f7e8', '#2cc295', '#087ea4', '#f59e0b'] },
    { name: 'Orchid', colors: ['#130b17', '#f3dbff', '#d946ef', '#7c3aed', '#fb7185'] },
    { name: 'Slate', colors: ['#111315', '#e8e4dd', '#a7a29a', '#5d6874', '#df4b32'] },
    { name: 'Paper', colors: ['#f4f0e6', '#141210', '#9b3d24', '#3c5a52', '#c69a4a'] },
    { name: 'Midnight', colors: ['#05070d', '#e7ecff', '#3457d5', '#8f9bff', '#e6c15c'] }
  ];

  function bg(ctx, w, h, pal, r) {
    ctx.fillStyle = pal[0];
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * (0.25 + r() * 0.5), h * (0.2 + r() * 0.5), 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    g.addColorStop(0, rgba(pal[1], 0.07));
    g.addColorStop(0.45, rgba(pal[2], 0.03));
    g.addColorStop(1, 'rgba(0,0,0,.12)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  function lineStyle(ctx, pal, r, alpha) { ctx.strokeStyle = rgba(pick(r, pal.slice(1)), alpha == null ? 0.8 : alpha); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; }

  /* Each family receives:
     ctx, w, h            - target surface
     r                     - seeded RNG (deterministic base composition)
     pal                   - array of 5 hex colours
     t                     - motion phase, only used for LIVE/MUSIC evolution
     a                     - audio state {bass,mid,treble,energy,kick,transient,smoothedEnergy} 0..~1.4
     density               - 20..100
     q                     - quality detail multiplier, 0.45..1.3

     Audio mapping convention used across families (per spec section 2):
       bass    -> scale / deformation / major geometry
       kick    -> momentary impact burst (short-lived, decays fast)
       mid     -> internal pattern movement / rotation speed
       treble  -> line/detail micro-activity, edge jitter
       energy  -> overall phase speed (already baked into t upstream)     */

  function drawContours(ctx, w, h, r, pal, t, a, density, q) {
    const count = Math.floor((12 + density * 0.28) * q);
    ctx.globalCompositeOperation = 'screen';
    for (let k = 0; k < count; k++) {
      const cx = w * (0.15 + r() * 0.7), cy = h * (0.15 + r() * 0.7);
      const base = Math.min(w, h) * (0.04 + r() * 0.28) * (1 + a.bass * 0.35);
      lineStyle(ctx, pal, r, 0.16 + r() * 0.5);
      ctx.lineWidth = 1 + r() * 4;
      ctx.beginPath();
      const pts = 96;
      for (let i = 0; i <= pts; i++) {
        const ang = i / pts * Math.PI * 2;
        const wobble = Math.sin(ang * (2 + Math.floor(r() * 5)) + k * 0.47 + t * (0.5 + a.mid * 0.6)) * (7 + a.treble * 14);
        const rr = base + k * 3.4 + wobble + a.kick * 22 * Math.sin(ang * 6);
        const x = cx + Math.cos(ang) * rr * mix(0.75, 1.35, r()), y = cy + Math.sin(ang) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawRoots(ctx, w, h, r, pal, t, a, density, q) {
    const branches = Math.floor((22 + density * 0.5) * q);
    ctx.globalCompositeOperation = 'screen';
    for (let b = 0; b < branches; b++) {
      let x = w * (0.1 + r() * 0.8), y = h * (0.05 + r() * 0.2);
      let ang = Math.PI / 2 + (r() - 0.5) * (1.4 + a.bass * 0.6);
      lineStyle(ctx, pal, r, 0.3 + r() * 0.5);
      ctx.lineWidth = 0.7 + r() * (3.6 + a.bass * 3);
      ctx.beginPath(); ctx.moveTo(x, y);
      const steps = 16 + Math.floor(r() * 28 * q);
      for (let i = 0; i < steps; i++) {
        ang += (r() - 0.5) * (0.55 + a.mid * 0.35) + Math.sin(i * 0.2 + t + b) * 0.03 * (1 + a.treble * 2);
        const len = 5 + r() * (14 + a.kick * 10);
        x += Math.cos(ang) * len; y += Math.sin(ang) * len;
        ctx.lineTo(x, y);
        if (x < -20 || x > w + 20 || y < -20 || y > h + 20) break;
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawOpArt(ctx, w, h, r, pal, t, a, density, q) {
    const n = Math.floor((16 + density * 0.34) * q);
    const cx = w * 0.5 + Math.sin(t * 0.3) * w * 0.04 * a.mid, cy = h * 0.5 + Math.cos(t * 0.27) * h * 0.04 * a.mid;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate((r() - 0.5) * 0.6 + t * 0.03 * (1 + a.mid));
    for (let i = n; i > 0; i--) {
      const s = (i / n) * Math.max(w, h) * (0.7 + a.bass * 0.22);
      ctx.strokeStyle = rgba(pal[1 + (i % 4)], 0.16 + 0.7 * (1 - i / n));
      ctx.lineWidth = 1 + (i % 5) + a.treble * 2;
      ctx.beginPath();
      const sides = 4 + Math.floor(r() * 4);
      for (let j = 0; j <= sides; j++) {
        const ang = (j / sides) * Math.PI * 2 + Math.sin(i * 0.2 + t) * 0.08 * (1 + a.kick * 2);
        const rr = s * (0.55 + 0.22 * Math.sin(j * 2.1 + i * 0.31));
        const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr;
        j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawCells(ctx, w, h, r, pal, t, a, density, q) {
    const n = Math.floor((20 + density * 0.55) * q);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h;
      const rad = (8 + r() * (34 + a.bass * 18)) * (1 + a.kick * 0.35 * Math.sin(t * 2 + i));
      ctx.fillStyle = rgba(pick(r, pal.slice(1)), 0.05 + r() * 0.17);
      ctx.strokeStyle = rgba(pick(r, pal.slice(1)), 0.24 + r() * 0.5 + a.treble * 0.2);
      ctx.lineWidth = 1 + r() * 3;
      ctx.beginPath();
      const p = 14;
      for (let j = 0; j <= p; j++) {
        const ang = (j / p) * Math.PI * 2;
        const rr = rad * (0.72 + r() * 0.5 + Math.sin(t * (0.6 + a.mid) + j) * 0.04 * a.mid);
        const xx = x + Math.cos(ang) * rr, yy = y + Math.sin(ang) * rr;
        j ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawVeins(ctx, w, h, r, pal, t, a, density, q) {
    ctx.save(); ctx.translate(w * 0.5, h * 0.55); ctx.rotate((r() - 0.5) * 0.9);
    ctx.globalCompositeOperation = 'screen';
    const len = h * (0.72 + a.bass * 0.08);
    ctx.strokeStyle = rgba(pal[1], 0.78); ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(0, -len * 0.5);
    ctx.quadraticCurveTo(Math.sin(t * 0.3) * 15 * (1 + a.mid), 0, 0, len * 0.5);
    ctx.stroke();
    const n = Math.floor((11 + density * 0.18) * q);
    [-1, 1].forEach(function (side) {
      for (let i = 0; i < n; i++) {
        const yy = -len * 0.44 + i * (len * 0.88 / (n - 1));
        ctx.strokeStyle = rgba(pal[2 + (i % 3)], 0.24 + 0.35 * r() + a.treble * 0.1);
        ctx.lineWidth = 0.6 + r() * 2;
        ctx.beginPath(); ctx.moveTo(0, yy);
        const endX = side * w * (0.18 + 0.2 * r()) * (1 - Math.abs(yy) / (len * 0.7));
        const endY = yy + (r() - 0.5) * 80 + Math.sin(t + i) * a.kick * 14;
        ctx.quadraticCurveTo(endX * 0.35, yy - (20 + r() * 60), endX, endY);
        ctx.stroke();
        for (let j = 1; j < 4; j++) {
          const qv = j / 4, bx = endX * qv, by = mix(yy, endY, qv);
          ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + side * (12 + r() * 36), by + (r() - 0.5) * 40); ctx.stroke();
        }
      }
    });
    ctx.restore(); ctx.globalCompositeOperation = 'source-over';
  }

  function drawSpirals(ctx, w, h, r, pal, t, a, density, q) {
    ctx.globalCompositeOperation = 'screen';
    const n = Math.floor(3 + density / 20);
    for (let s = 0; s < n; s++) {
      const cx = r() * w, cy = r() * h;
      lineStyle(ctx, pal, r, 0.32 + r() * 0.5);
      ctx.lineWidth = 1 + r() * (4 + a.bass * 2);
      ctx.beginPath();
      const loops = 4 + r() * 8, pts = Math.floor(160 * q);
      for (let i = 0; i < pts; i++) {
        const ang = (i / pts) * Math.PI * 2 * loops + t * 0.15 * (1 + a.mid) * (s % 2 ? 1 : -1);
        const rr = (i / pts) * Math.min(w, h) * (0.12 + r() * 0.34) * (1 + a.kick * 0.12);
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawOrbit(ctx, w, h, r, pal, t, a, density, q) {
    const cx = w * 0.5, cy = h * 0.5;
    ctx.globalCompositeOperation = 'screen';
    const n = Math.floor((18 + density * 0.35) * q);
    for (let i = 0; i < n; i++) {
      const ang = r() * Math.PI * 2 + t * (0.03 + r() * 0.09) * (1 + a.mid) * (i % 2 ? 1 : -1);
      const rx = w * (0.08 + r() * (0.48 + a.bass * 0.1)), ry = h * (0.06 + r() * (0.38 + a.bass * 0.1));
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(r() * Math.PI);
      ctx.strokeStyle = rgba(pick(r, pal.slice(1)), 0.14 + r() * 0.5 + a.treble * 0.15);
      ctx.lineWidth = 0.6 + r() * 2.6;
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = rgba(pick(r, pal.slice(1)), 0.6);
      ctx.beginPath(); ctx.arc(Math.cos(ang) * rx, Math.sin(ang) * ry, 1.5 + r() * 4 + a.kick * 5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawTessellation(ctx, w, h, r, pal, t, a, density, q) {
    const size = clamp(90 - density * 0.55, 24, 70) * (1 - a.bass * 0.12);
    ctx.globalCompositeOperation = 'screen';
    for (let y = -size; y < h + size; y += size) {
      for (let x = -size; x < w + size; x += size) {
        const xx = x + ((y / size) % 2) * size * 0.5;
        ctx.save(); ctx.translate(xx, y);
        ctx.rotate((r() - 0.5) * 0.25 + Math.sin(t * 0.25 * (1 + a.mid) + (x + y) * 0.01) * 0.05 * (1 + a.kick));
        ctx.strokeStyle = rgba(pick(r, pal.slice(1)), 0.16 + r() * 0.48 + a.treble * 0.1);
        ctx.lineWidth = 0.7 + r() * 2.2;
        ctx.beginPath();
        const sides = 3 + Math.floor(r() * 4), rad = size * (0.28 + r() * 0.35);
        for (let j = 0; j <= sides; j++) {
          const ang = (j / sides) * Math.PI * 2;
          const px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
          j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFlowField(ctx, w, h, r, pal, t, a, density, q) {
    const n = Math.floor((60 + density * 1.3) * q);
    ctx.globalCompositeOperation = 'screen';
    const fx = 0.0022 + a.mid * 0.001, fy = 0.0019 + a.mid * 0.0009;
    for (let i = 0; i < n; i++) {
      let x = r() * w, y = r() * h;
      lineStyle(ctx, pal, r, 0.14 + r() * 0.4 + a.treble * 0.15);
      ctx.lineWidth = 0.7 + r() * 2 + a.bass * 1.4;
      ctx.beginPath(); ctx.moveTo(x, y);
      const steps = 26 + Math.floor(r() * 30 * q);
      for (let s = 0; s < steps; s++) {
        const ang = Math.sin(x * fx + t * 0.4) * Math.PI + Math.cos(y * fy - t * 0.3) * Math.PI + a.kick * 1.4;
        x += Math.cos(ang) * 6; y += Math.sin(ang) * 6;
        ctx.lineTo(x, y);
        if (x < 0 || x > w || y < 0 || y > h) break;
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawTopography(ctx, w, h, r, pal, t, a, density, q) {
    const cx = w * (0.3 + r() * 0.4), cy = h * (0.3 + r() * 0.4);
    const rings = Math.floor((14 + density * 0.3) * q);
    const bumps = [];
    for (let i = 0; i < 4 + Math.floor(r() * 4); i++) bumps.push([r() * w, r() * h, 0.15 + r() * 0.4]);
    ctx.globalCompositeOperation = 'screen';
    for (let ring = 1; ring <= rings; ring++) {
      const base = (ring / rings) * Math.max(w, h) * (0.62 + a.bass * 0.15);
      ctx.strokeStyle = rgba(pal[1 + (ring % 4)], 0.14 + (ring / rings) * 0.4 + a.treble * 0.1);
      ctx.lineWidth = 1 + (ring % 3) * 0.6;
      ctx.beginPath();
      const pts = Math.floor(90 * q);
      for (let i = 0; i <= pts; i++) {
        const ang = (i / pts) * Math.PI * 2;
        let rr = base;
        bumps.forEach(function (b) { rr += Math.sin(ang * 3 + b[2] * 10 + t * 0.2 * (1 + a.mid)) * base * b[2] * 0.18; });
        rr += a.kick * 10 * Math.sin(ang * 5);
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr * 0.72;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawFracture(ctx, w, h, r, pal, t, a, density, q) {
    const n = Math.floor((7 + density * 0.16) * q);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < n; i++) {
      let x1 = r() * w, y1 = r() * h;
      const segs = 4 + Math.floor(r() * 5);
      let ang = r() * Math.PI * 2;
      ctx.strokeStyle = rgba(pick(r, pal.slice(1)), 0.3 + r() * 0.5);
      ctx.lineWidth = 0.8 + r() * (2.4 + a.bass * 2);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      for (let s = 0; s < segs; s++) {
        ang += (r() - 0.5) * (2 + a.treble * 1.2);
        const len = (Math.min(w, h) * (0.06 + r() * 0.14)) * (1 + a.kick * 0.6);
        x1 += Math.cos(ang) * len; y1 += Math.sin(ang) * len;
        ctx.lineTo(x1, y1);
      }
      ctx.stroke();
      if (r() > 0.55) {
        ctx.fillStyle = rgba(pick(r, pal.slice(1)), 0.05 + a.mid * 0.05);
        ctx.beginPath(); ctx.arc(x1, y1, 3 + r() * 20, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawThreads(ctx, w, h, r, pal, t, a, density, q) {
    const n = Math.floor((10 + density * 0.22) * q);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < n; i++) {
      const anchors = [];
      const cnt = 3 + Math.floor(r() * 3);
      for (let k = 0; k < cnt; k++) anchors.push([r() * w, r() * h]);
      lineStyle(ctx, pal, r, 0.18 + r() * 0.4);
      ctx.lineWidth = 0.6 + r() * 1.6 + a.treble * 1.2;
      ctx.beginPath();
      const pts = Math.floor(80 * q);
      for (let p = 0; p <= pts; p++) {
        const u = p / pts * (cnt - 1);
        const seg = Math.min(cnt - 2, Math.floor(u));
        const lt = u - seg;
        const p0 = anchors[seg], p1 = anchors[seg + 1] || anchors[seg];
        const wob = Math.sin(p * 0.3 + t * (0.6 + a.mid) + i) * (6 + a.bass * 18) * (1 + a.kick * 0.4);
        const x = mix(p0[0], p1[0], lt) + wob, y = mix(p0[1], p1[1], lt) + wob * 0.6;
        p ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawOrganicNetwork(ctx, w, h, r, pal, t, a, density, q) {
    const n = Math.floor((22 + density * 0.4) * q);
    const nodes = [];
    for (let i = 0; i < n; i++) nodes.push([r() * w, r() * h, r()]);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i][0] - nodes[j][0], dy = nodes[i][1] - nodes[j][1];
        const d = Math.sqrt(dx * dx + dy * dy);
        const link = Math.min(w, h) * (0.14 + a.bass * 0.05);
        if (d < link) {
          ctx.strokeStyle = rgba(pick(r, pal.slice(1)), (1 - d / link) * (0.3 + a.treble * 0.2));
          ctx.lineWidth = 0.6 + (1 - d / link) * 1.8;
          ctx.beginPath(); ctx.moveTo(nodes[i][0], nodes[i][1]); ctx.lineTo(nodes[j][0], nodes[j][1]); ctx.stroke();
        }
      }
    }
    nodes.forEach(function (node, i) {
      const rad = (2 + node[2] * 6) * (1 + a.kick * 0.6 * Math.sin(t + i));
      ctx.fillStyle = rgba(pick(r, pal.slice(1)), 0.5 + a.mid * 0.2);
      ctx.beginPath(); ctx.arc(node[0], node[1], rad, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawGeometricNoise(ctx, w, h, r, pal, t, a, density, q) {
    const cell = clamp(70 - density * 0.5, 18, 60);
    ctx.globalCompositeOperation = 'screen';
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const nv = (Math.sin(x * 0.013 + t * 0.2 * (1 + a.mid)) + Math.cos(y * 0.011 - t * 0.17)) * 0.5;
        if (r() > 0.55 + nv * 0.15) continue;
        ctx.save(); ctx.translate(x + cell / 2, y + cell / 2);
        ctx.rotate(nv * Math.PI + a.kick * 1.2);
        ctx.fillStyle = rgba(pick(r, pal.slice(1)), 0.12 + Math.abs(nv) * 0.35 + a.treble * 0.15);
        const s = cell * (0.2 + Math.abs(nv) * (0.5 + a.bass * 0.3));
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawWaveInterference(ctx, w, h, r, pal, t, a, density, q) {
    const sources = [];
    const n = 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) sources.push([r() * w, r() * h, 0.02 + r() * 0.02]);
    const step = clamp(9 - Math.floor(density / 20), 3, 8);
    ctx.globalCompositeOperation = 'screen';
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      let started = false;
      for (let x = 0; x < w; x += step) {
        let v = 0;
        sources.forEach(function (s) {
          const d = Math.hypot(x - s[0], y - s[1]);
          v += Math.sin(d * s[2] * (1 + a.bass * 0.4) - t * (1.2 + a.mid));
        });
        v /= sources.length;
        if (v > 0.55 - a.treble * 0.2) {
          const px = x, py = y + v * 3 * a.kick;
          started ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
          started = true;
        } else started = false;
      }
      ctx.strokeStyle = rgba(pick(r, pal.slice(1)), 0.2 + r() * 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawRadialStructure(ctx, w, h, r, pal, t, a, density, q) {
    const cx = w * 0.5, cy = h * 0.5;
    const spokes = Math.floor((10 + density * 0.22) * q);
    ctx.globalCompositeOperation = 'screen';
    ctx.save(); ctx.translate(cx, cy);
    for (let i = 0; i < spokes; i++) {
      const ang = (i / spokes) * Math.PI * 2 + t * 0.05 * (1 + a.mid);
      const rings = 5 + Math.floor(r() * 6);
      ctx.save(); ctx.rotate(ang);
      for (let k = 1; k <= rings; k++) {
        const rr = (k / rings) * Math.min(w, h) * (0.46 + a.bass * 0.12);
        ctx.strokeStyle = rgba(pal[1 + (k % 4)], 0.12 + (k / rings) * 0.4 + a.treble * 0.15);
        ctx.lineWidth = 0.6 + r() * 2;
        ctx.beginPath(); ctx.moveTo(rr * 0.7, -8 - a.kick * 14); ctx.lineTo(rr, 0); ctx.lineTo(rr * 0.7, 8 + a.kick * 14); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }

  const FAMILIES = [
    { id: 'contours', name: 'Contours', draw: drawContours },
    { id: 'roots', name: 'Roots', draw: drawRoots },
    { id: 'opart', name: 'Op Art', draw: drawOpArt },
    { id: 'cells', name: 'Cells', draw: drawCells },
    { id: 'veins', name: 'Leaf Veins', draw: drawVeins },
    { id: 'spirals', name: 'Spirals', draw: drawSpirals },
    { id: 'orbit', name: 'Orbit', draw: drawOrbit },
    { id: 'tessellation', name: 'Tessellation', draw: drawTessellation },
    { id: 'flowfield', name: 'Flow Field', draw: drawFlowField },
    { id: 'topography', name: 'Topography', draw: drawTopography },
    { id: 'fracture', name: 'Fracture', draw: drawFracture },
    { id: 'threads', name: 'Threads', draw: drawThreads },
    { id: 'network', name: 'Organic Network', draw: drawOrganicNetwork },
    { id: 'geonoise', name: 'Geometric Noise', draw: drawGeometricNoise },
    { id: 'waves', name: 'Wave Interference', draw: drawWaveInterference },
    { id: 'radial', name: 'Radial Structure', draw: drawRadialStructure }
  ];
  const SAFE_FAMILY_INDEX = 0;

  function familyIndexById(id) {
    for (let i = 0; i < FAMILIES.length; i++) if (FAMILIES[i].id === id) return i;
    return -1;
  }

  const QUALITY_PROFILES = {
    low: { dprCap: 1, frameMs: 55, detail: 0.5 },
    normal: { dprCap: 1.6, frameMs: 33, detail: 0.85 },
    high: { dprCap: 2, frameMs: 20, detail: 1.2 }
  };
  function resolveQuality(level) {
    if (level === 'low' || level === 'normal' || level === 'high') return QUALITY_PROFILES[level];
    // AUTO: estimate from device pixel ratio + logical CPU hint.
    const dpr = global.devicePixelRatio || 1;
    const cores = (navigator && navigator.hardwareConcurrency) || 4;
    if (dpr >= 2.5 || cores <= 2) return QUALITY_PROFILES.low;
    if (dpr >= 1.8 && cores >= 6) return QUALITY_PROFILES.high;
    return QUALITY_PROFILES.normal;
  }

  const NEUTRAL_AUDIO = { bass: 0, mid: 0, treble: 0, energy: 0, kick: 0, transient: 0, smoothedEnergy: 0 };

  /* One artwork = one deterministic "recipe" render at any target size.
     safe: wraps the family draw call so one broken family can't blank
     the whole wall - falls back to a calm gradient instead. */
  function renderRecipe(ctx, w, h, recipe, audio, quality) {
    const pal = (PALETTES[((recipe.palette % PALETTES.length) + PALETTES.length) % PALETTES.length] || PALETTES[0]).colors;
    const r = rngFromSeed(recipe.seed + '|' + recipe.family + '|' + recipe.palette);
    const famIndex = clamp(recipe.family % FAMILIES.length, 0, FAMILIES.length - 1);
    const fam = FAMILIES[famIndex] || FAMILIES[SAFE_FAMILY_INDEX];
    const q = quality ? quality.detail : 0.85;
    const a = audio || NEUTRAL_AUDIO;
    ctx.save();
    try {
      bg(ctx, w, h, pal, r);
      fam.draw(ctx, w, h, r, pal, recipe.phase || 0, a, clamp(recipe.density, 20, 100), q);
      const altIndex = (famIndex + 3 + Math.floor(r() * 5)) % FAMILIES.length;
      ctx.globalAlpha = 0.34;
      FAMILIES[altIndex].draw(ctx, w, h, r, pal, (recipe.phase || 0) * 0.78, a, clamp(recipe.density, 20, 100) * 0.7, q);
      ctx.globalAlpha = 1;
      const v = ctx.createLinearGradient(0, 0, w, h);
      v.addColorStop(0, 'rgba(255,255,255,.03)');
      v.addColorStop(0.5, 'rgba(255,255,255,0)');
      v.addColorStop(1, 'rgba(0,0,0,.11)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
    } catch (err) {
      console.warn('[Living Art] family render failed, falling back to safe gradient', err);
      ctx.fillStyle = pal[0]; ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, rgba(pal[2], 0.5)); g.addColorStop(1, rgba(pal[0], 1));
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  }

  function ensureCanvasSize(canvas, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return canvas;
  }

  global.LivingArtEngine = {
    FAMILIES, PALETTES, QUALITY_PROFILES,
    hashString, rngFromSeed, clamp, mix, rgba, hexToRgb,
    familyIndexById, resolveQuality, renderRecipe, ensureCanvasSize,
    NEUTRAL_AUDIO
  };
})(window);
