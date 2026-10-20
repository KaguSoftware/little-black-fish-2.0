// Siyamak textures: hand-drawn marker writing on skin (letters, symbols, small drawings),
// torn paper and gold glitter patches; layered paper-collage mask; worn teal cotton jacket.
import * as THREE from 'three';
import { surface, fbm, ridged, rng } from './pbr.js';

// ---------- hand-drawn glyphs (unit box, y down) ----------
const C = (cx, cy, r, a0 = 0, a1 = 6.283, n = 14) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
export const GLYPHS = {
  N: [[[0, 1], [0, 0], [1, 1], [1, 0]]],
  M: [[[0, 1], [0.05, 0], [0.5, 0.65], [0.95, 0], [1, 1]]],
  V: [[[0, 0], [0.5, 1], [1, 0]]],
  W: [[[0, 0], [0.22, 1], [0.5, 0.35], [0.78, 1], [1, 0]]],
  H: [[[0, 0], [0, 1]], [[1, 0], [1, 1]], [[0, 0.5], [1, 0.5]]],
  I: [[[0.5, 0], [0.5, 1]]],
  E: [[[1, 0], [0, 0], [0, 1], [1, 1]], [[0, 0.5], [0.75, 0.5]]],
  L: [[[0, 0], [0, 1], [0.9, 1]]],
  T: [[[0, 0], [1, 0]], [[0.5, 0], [0.5, 1]]],
  A: [[[0, 1], [0.5, 0], [1, 1]], [[0.22, 0.6], [0.78, 0.6]]],
  K: [[[0, 0], [0, 1]], [[1, 0], [0, 0.55], [1, 1]]],
  X: [[[0, 0], [1, 1]], [[1, 0], [0, 1]]],
  Y: [[[0, 0], [0.5, 0.5], [1, 0]], [[0.5, 0.5], [0.5, 1]]],
  Z: [[[0, 0], [1, 0], [0, 1], [1, 1]]],
  U: [[[0, 0], [0, 0.7], [0.2, 1], [0.8, 1], [1, 0.7], [1, 0]]],
  S: [[[1, 0.1], [0.6, 0], [0.1, 0.12], [0.1, 0.4], [0.9, 0.6], [0.9, 0.88], [0.4, 1], [0, 0.9]]],
  O: [C(0.5, 0.5, 0.5)],
  P: [[[0, 1], [0, 0], [0.7, 0], [0.9, 0.2], [0.7, 0.45], [0, 0.45]]],
  R: [[[0, 1], [0, 0], [0.7, 0], [0.9, 0.2], [0.7, 0.45], [0, 0.45], [0.9, 1]]],
  plus: [[[0.5, 0], [0.5, 1]], [[0, 0.45], [1, 0.45]]],
  cross: [[[0.5, 0], [0.5, 1]], [[0.2, 0.3], [0.8, 0.3]]],
  arrow: [[[0, 1], [1, 0]], [[0.45, 0], [1, 0], [1, 0.55]]],
  spiral: [Array.from({ length: 30 }, (_, i) => { const a = i * 0.45, r = 0.04 + i * 0.016; return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r]; })],
  eye: [[[0, 0.5], [0.25, 0.25], [0.75, 0.25], [1, 0.5], [0.75, 0.75], [0.25, 0.75], [0, 0.5]], C(0.5, 0.5, 0.12, 0, 6.283, 8)],
  closedEye: [[[0, 0.4], [0.3, 0.65], [0.7, 0.65], [1, 0.4]], [[0.2, 0.58], [0.15, 0.85]], [[0.4, 0.66], [0.38, 0.95]], [[0.6, 0.66], [0.62, 0.95]], [[0.8, 0.58], [0.85, 0.85]]],
  figure: [C(0.5, 0.15, 0.13, 0, 6.283, 10), [[0.5, 0.28], [0.5, 0.68]], [[0.15, 0.42], [0.85, 0.42]], [[0.5, 0.68], [0.2, 1]], [[0.5, 0.68], [0.8, 1]]],
  ankh: [[[0.5, 0.3], [0.5, 1]], [[0.15, 0.45], [0.85, 0.45]], C(0.5, 0.17, 0.15, 0, 6.283, 10)],
  phi: [[[0.5, 0], [0.5, 1]], C(0.5, 0.62, 0.3, 0, 6.283, 14), [[0.2, 0.25], [0.8, 0.25]]],
  wave: [Array.from({ length: 16 }, (_, i) => [i / 15, 0.5 + Math.sin(i / 15 * 9.4) * 0.35])],
  hash: [[[0.3, 0], [0.2, 1]], [[0.75, 0], [0.65, 1]], [[0, 0.33], [1, 0.3]], [[0, 0.7], [1, 0.67]]],
  tri: [[[0.5, 0], [1, 1], [0, 1], [0.5, 0]]],
  dots: [[[0.1, 0.5], [0.12, 0.52]], [[0.5, 0.5], [0.52, 0.52]], [[0.9, 0.5], [0.92, 0.52]]],
  bars: [[[0.1, 0], [0.1, 1]], [[0.4, 0.1], [0.4, 1]], [[0.7, 0], [0.7, 0.9]]],
  bird: [[[0, 0.4], [0.25, 0.2], [0.5, 0.5], [0.75, 0.2], [1, 0.4]]],
  sun: [C(0.5, 0.5, 0.22, 0, 6.283, 12), ...Array.from({ length: 8 }, (_, i) => { const a = i / 8 * 6.283; return [[0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.3], [0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5]]; })],
};
const LETTERS = 'NMVWHIELTAKXYZUSOPR'.split('');
const SYMS = ['plus', 'cross', 'arrow', 'spiral', 'eye', 'figure', 'ankh', 'phi', 'wave', 'hash', 'tri', 'bars', 'bird', 'sun', 'O'];

export const INK = { teal: '#0d5662', teal2: '#17707a', navy: '#14273a', black: '#151515', red: '#a3301f', orange: '#c4611c', ochre: '#a8843c' };
const INK_W = [['teal', 6], ['teal2', 2.5], ['navy', 2.5], ['black', 1.5], ['red', 0.7], ['orange', 0.5], ['ochre', 0.6]];
function pickInk(r) { let tot = 0; for (const [, w] of INK_W) tot += w; let x = r() * tot; for (const [k, w] of INK_W) { x -= w; if (x <= 0) return INK[k]; } return INK.teal; }

// draw a stroke on albedo (+ roughness), wobbling like a marker
function stroke(L, pts, col, lw, r, alpha = 0.92) {
  const P = pts.map(([x, y]) => [x + (r() - 0.5) * lw * 0.5, y + (r() - 0.5) * lw * 0.5]);
  for (const [ctx, style, a] of [[L.a, col, alpha], [L.r, 'rgb(105,105,105)', 1], [L.h, 'rgb(136,136,136)', 1]]) {
    ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (ctx === L.a) { ctx.shadowColor = col; ctx.shadowBlur = lw * 0.35; }
    ctx.beginPath(); ctx.moveTo(...P[0]); for (const p of P.slice(1)) ctx.lineTo(...p); ctx.stroke(); ctx.restore();
  }
  // second, thinner pass: marker density variation
  L.a.save(); L.a.globalAlpha = 0.35; L.a.strokeStyle = col; L.a.lineWidth = lw * 0.5; L.a.lineCap = 'round';
  L.a.beginPath(); L.a.moveTo(P[0][0] + lw * 0.15, P[0][1]); for (const p of P.slice(1)) L.a.lineTo(p[0] + lw * 0.15, p[1]); L.a.stroke(); L.a.restore();
}

export function glyph(L, name, x, y, size, col, r, o = {}) {
  const def = GLYPHS[name]; if (!def) return;
  const rot = o.rot ?? (r() - 0.5) * 0.5, sx = size * (o.ar ?? (0.7 + r() * 0.3)), sy = size;
  const cs = Math.cos(rot), sn = Math.sin(rot);
  const lw = o.lw ?? Math.max(2.2, size * (0.07 + r() * 0.05));
  for (const poly of def) {
    const pts = poly.map(([u, v]) => { const px = (u - 0.5) * sx, py = (v - 0.5) * sy; return [x + px * cs - py * sn, y + px * sn + py * cs]; });
    stroke(L, pts, col, lw, r);
  }
}
export function word(L, x, y, size, col, r, n) {
  let cx = x;
  const rot = (r() - 0.5) * 0.35;
  for (let i = 0; i < n; i++) {
    const ch = LETTERS[Math.floor(r() * LETTERS.length)];
    glyph(L, ch, cx + Math.cos(rot) * 0, y + Math.sin(rot) * (cx - x), size * (0.85 + r() * 0.3), col, r, { rot: rot + (r() - 0.5) * 0.15 });
    cx += size * (0.75 + r() * 0.25);
  }
}
// cursive scribble "script": loops along a line
export function script(L, x, y, len, size, col, r) {
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, ph = t * len / size * 6.28 * 0.8;
    pts.push([x + t * len + Math.sin(ph) * size * 0.25, y + Math.cos(ph) * size * 0.35 * (0.6 + r() * 0.5)]);
  }
  stroke(L, pts, col, Math.max(2, size * 0.09), r);
}
// torn paper patch (lace / printed pattern), raised, matte
export function paper(L, x, y, w, h, r, o = {}) {
  const pts = [];
  const N = 22;
  for (let i = 0; i < N; i++) {
    const t = i / N, side = Math.floor(t * 4), f = (t * 4) % 1;
    let px, py;
    if (side === 0) { px = x + w * f; py = y; } else if (side === 1) { px = x + w; py = y + h * f; } else if (side === 2) { px = x + w * (1 - f); py = y + h; } else { px = x; py = y + h * (1 - f); }
    pts.push([px + (r() - 0.5) * w * 0.12, py + (r() - 0.5) * h * 0.12]);
  }
  const rot = (r() - 0.5) * 0.9, cx = x + w / 2, cy = y + h / 2;
  const P = pts.map(([px, py]) => { const dx = px - cx, dy = py - cy; return [cx + dx * Math.cos(rot) - dy * Math.sin(rot), cy + dx * Math.sin(rot) + dy * Math.cos(rot)]; });
  const path = ctx => { ctx.beginPath(); ctx.moveTo(...P[0]); for (const p of P.slice(1)) ctx.lineTo(...p); ctx.closePath(); };
  const col = o.col ?? ['#ddd1ba', '#d6c8ad', '#e2d8c4', '#cbbfa6'][Math.floor(r() * 4)];
  L.a.save(); path(L.a); L.a.fillStyle = col; L.a.globalAlpha = 0.95; L.a.fill(); L.a.clip();
  // lace / doily print
  L.a.globalAlpha = 0.45; L.a.strokeStyle = o.print ?? '#b9a88a'; L.a.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) { L.a.beginPath(); L.a.arc(x + r() * w, y + r() * h, 2 + r() * 7, 0, 6.28); L.a.stroke(); }
  if (o.paint) { L.a.globalAlpha = 0.6; L.a.fillStyle = o.paint; L.a.fillRect(x + r() * w * 0.5, y + r() * h * 0.5, w * 0.4, h * 0.3); }
  L.a.restore();
  L.h.save(); path(L.h); L.h.fillStyle = 'rgb(175,175,175)'; L.h.fill(); L.h.restore();
  L.r.save(); path(L.r); L.r.fillStyle = 'rgb(225,225,225)'; L.r.fill(); L.r.restore();
  L.a.save(); path(L.a); L.a.strokeStyle = 'rgba(90,70,50,0.35)'; L.a.lineWidth = 1.5; L.a.stroke(); L.a.restore();
}
// gold glitter patch: metallic speckle
export function glitter(L, x, y, w, h, r, o = {}) {
  const n = Math.floor(w * h * (o.density ?? 0.5));
  for (let i = 0; i < n; i++) {
    const a = r() * 6.283, d = Math.sqrt(r());
    const px = x + Math.cos(a) * d * w / 2, py = y + Math.sin(a) * d * h / 2;
    const s = 1 + r() * 2.2, b = r();
    const c = b < 0.6 ? '#b8963e' : b < 0.85 ? '#e6cf7a' : '#6d5524';
    L.a.fillStyle = c; L.a.globalAlpha = 0.85; L.a.fillRect(px, py, s, s);
    const mv = 150 + b * 105; L.m.fillStyle = `rgb(${mv | 0},${mv | 0},${mv | 0})`; L.m.fillRect(px, py, s, s);
    const rv = 70 + r() * 60 | 0; L.r.fillStyle = `rgb(${rv},${rv},${rv})`; L.r.fillRect(px, py, s, s);
    const hv = 130 + r() * 90; L.h.fillStyle = `rgb(${hv | 0},${hv | 0},${hv | 0})`; L.h.fillRect(px, py, s, s);
  }
  L.a.globalAlpha = 1;
}

// ---------- skin ----------
const skinCol = new THREE.Color('#dcc0b2');
function skinPixel(seed, flush) {
  return (u, v) => {
    const n = fbm(u, v, 6, 4, seed), pore = fbm(u, v, 160, 2, seed + 9), bl = fbm(u, v, 3, 3, seed + 4);
    const red = flush ? flush(u, v) : 0;
    const k = 0.93 + 0.1 * n;
    return {
      a: [skinCol.r * 255 * k + red * 18, skinCol.g * 255 * (k - 0.02 * bl) - red * 10, skinCol.b * 255 * (k - 0.03 * bl) - red * 6],
      h: 0.5 + (pore - 0.5) * 0.35, r: 0.52 + 0.1 * pore,
    };
  };
}

// region = 'torso' | 'arm' | 'leg'; density map(u,v) -> 0..1 decides how crowded each area is
export function skinSurface(region, seed, o = {}) {
  const dims = { torso: [1024, 864], arm: [384, 896], leg: [512, 1280] }[region];
  const [W, H] = dims;
  return surface({
    w: W, hgt: H, seed, rough: 0.52, nStrength: 1.2,
    pixel: skinPixel(seed, o.flush),
    paint: (L, w, h, r) => {
      const wrap = (fn) => { fn(0); fn(-w); fn(w); };
      if (o.paint) o.paint(L, w, h, r, wrap);
      const n = o.count ?? 60;
      for (let i = 0; i < n; i++) {
        const x = r() * w, y = h * (o.yMin ?? 0) + r() * h * ((o.yMax ?? 1) - (o.yMin ?? 0));
        if (o.density && r() > o.density(x / w, y / h)) continue;
        const col = pickInk(r), k = r();
        const size = (o.size ?? 34) * (0.6 + r() * 0.8);
        wrap(dx => {
          const rr = rng(i * 7919 + seed);
          if (k < 0.4) word(L, x + dx, y, size * 0.5, col, rr, 1 + Math.floor(rr() * 5));
          else if (k < 0.62) glyph(L, SYMS[Math.floor(rr() * SYMS.length)], x + dx, y, size * 1.1, col, rr);
          else if (k < 0.78) glyph(L, LETTERS[Math.floor(rr() * LETTERS.length)], x + dx, y, size * 1.4, col, rr);
          else if (k < 0.9) script(L, x + dx, y, size * (2 + rr() * 2), size * 0.8, col, rr);
          else { // a bold stroke or blot
            const len = size * (1 + rr() * 2.5), ang = (rr() < 0.6 ? Math.PI / 2 : 0) + (rr() - 0.5) * 0.6;
            stroke(L, [[x + dx, y], [x + dx + Math.cos(ang) * len, y + Math.sin(ang) * len]], col, size * 0.22, rr);
          }
        });
      }
    },
  });
}

// ---------- mask: layered paper collage ----------
export function maskSurface() {
  const W = 512, H = 704;
  return surface({
    w: W, hgt: H, seed: 77, rough: 0.82, nStrength: 2.4,
    pixel: (u, v) => {
      const cr = ridged(u, v, 5, 4, 3), n = fbm(u, v, 12, 3, 5), fib = fbm(u * 8, v, 64, 2, 8);
      const k = 0.9 + 0.08 * n - 0.05 * cr;
      return { a: [206 * k, 190 * k, 166 * k], h: 0.45 + 0.25 * cr + 0.05 * fib, r: 0.8 + 0.1 * n };
    },
    paint: (L, w, h, r) => {
      // layered torn papers
      for (let i = 0; i < 14; i++) paper(L, r() * w * 0.85, r() * h * 0.9, 60 + r() * 140, 40 + r() * 120, r, { print: r() < 0.5 ? '#c9b892' : '#b7c2bd', paint: r() < 0.3 ? ['#c8b07a', '#a9c1bd', '#d9a79a'][Math.floor(r() * 3)] : null });
      // red diagonal hatching top-left
      for (let i = 0; i < 12; i++) stroke(L, [[24 + i * 12, 30 + i * 3], [34 + i * 12, 200 + i * 5]], i % 3 ? INK.red : '#7c2216', 9, r);
      for (let i = 0; i < 4; i++) stroke(L, [[20, 60 + i * 40], [170, 70 + i * 40]], INK.red, 4, r);
      // teal lines down the right side + crossbars
      for (let i = 0; i < 3; i++) stroke(L, [[w * 0.8 + i * 16, h * 0.08], [w * 0.78 + i * 18, h * (0.6 + r() * 0.3)]], i === 1 ? INK.navy : INK.teal, 6 + r() * 3, r);
      for (let i = 0; i < 6; i++) stroke(L, [[w * 0.72, h * (0.2 + i * 0.1)], [w * 0.95, h * (0.21 + i * 0.1)]], INK.teal, 4, r);
      // closed eye drawn on the left, teal blotches on the right eye
      glyph(L, 'closedEye', w * 0.3, h * 0.36, 60, INK.black, r, { rot: -0.05, ar: 1.2, lw: 5 });
      L.a.save(); L.a.globalAlpha = 0.85; L.a.fillStyle = INK.teal;
      for (const [x, y, rx, ry] of [[0.22, 0.6, 30, 45], [0.3, 0.88, 50, 22], [0.68, 0.4, 22, 30], [0.62, 0.86, 26, 18]]) { L.a.beginPath(); L.a.ellipse(w * x, h * y, rx, ry, r(), 0, 6.28); L.a.fill(); }
      L.a.restore();
      glyph(L, 'eye', w * 0.25, h * 0.6, 34, '#efe6d2', r, { lw: 4 });
      // small scattered marks
      for (let i = 0; i < 30; i++) glyph(L, SYMS[Math.floor(r() * SYMS.length)], r() * w, r() * h, 14 + r() * 20, pickInk(r), r, { lw: 3.5 });
      for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h; stroke(L, [[x, y], [x + (r() - 0.5) * 50, y + (r() - 0.3) * 60]], pickInk(r), 3 + r() * 5, r); }
      // teal swirl line on the right cheek, black squiggles at the jaw
      script(L, w * 0.6, h * 0.55, 150, 40, INK.teal, r); script(L, w * 0.15, h * 0.93, 300, 30, INK.black, r);
      for (let i = 0; i < 26; i++) { L.a.fillStyle = [INK.red, INK.teal, '#d9b36a', INK.black][Math.floor(r() * 4)]; L.a.globalAlpha = 0.8; L.a.beginPath(); L.a.arc(r() * w, r() * h, 2 + r() * 4, 0, 6.28); L.a.fill(); }
      L.a.globalAlpha = 1;
      // red lips
      L.a.save(); L.a.fillStyle = '#b4322a'; L.a.globalAlpha = 0.95;
      L.a.beginPath(); L.a.moveTo(w * 0.36, h * 0.735); L.a.quadraticCurveTo(w * 0.5, h * 0.705, w * 0.64, h * 0.735); L.a.quadraticCurveTo(w * 0.5, h * 0.775, w * 0.36, h * 0.735); L.a.fill(); L.a.restore();
      L.r.save(); L.r.fillStyle = 'rgb(80,80,80)'; L.r.beginPath(); L.r.ellipse(w * 0.5, h * 0.74, w * 0.14, h * 0.03, 0, 0, 6.28); L.r.fill(); L.r.restore();
      // glitter on the nose bridge and a cheek
      glitter(L, w * 0.5, h * 0.42, 60, 150, r, { density: 0.6 });
      glitter(L, w * 0.72, h * 0.18, 70, 40, r, { density: 0.5 });
    },
  });
}

// ---------- worn teal cotton jacket ----------
export function jacketSurface(rep = [3, 3]) {
  const base = new THREE.Color('#2a6470');
  return surface({
    w: 1024, seed: 91, rough: 0.93, nStrength: 2.2, repeat: rep,
    pixel: (u, v, x, y) => {
      const tw = ((x + y) % 6 < 3 ? 1 : 0) * 0.5 + ((x - y + 1024) % 9 < 2 ? 0.3 : 0); // twill
      const n = fbm(u, v, 4, 4, 11), cr = ridged(u, v, 3, 4, 17), fine = fbm(u, v, 48, 2, 3), stain = fbm(u, v, 7, 3, 29);
      const fade = 0.85 + 0.25 * n + 0.35 * cr * cr - 0.06 * tw;
      const sp = stain > 0.72 ? (stain - 0.72) * 2.5 : 0;
      return {
        a: [base.r * 255 * fade + sp * 60, base.g * 255 * fade + sp * 50, base.b * 255 * fade + sp * 40],
        h: 0.5 + 0.18 * tw + 0.22 * (cr - 0.5) + 0.06 * fine, r: 0.9 + 0.08 * fine,
      };
    },
    paint: (L, w, h, r) => {
      // pale paint flecks and frayed specks like the reference
      for (let i = 0; i < 60; i++) { L.a.fillStyle = r() < 0.6 ? 'rgba(160,190,175,0.5)' : 'rgba(200,180,130,0.45)'; L.a.beginPath(); L.a.ellipse(r() * w, r() * h, 1 + r() * 4, 1 + r() * 9, r() * 3, 0, 6.28); L.a.fill(); }
    },
  });
}
