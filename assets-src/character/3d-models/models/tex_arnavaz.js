// Arnavaz surfaces: crinkled linen, felted wool with couched gold embroidery,
// engraved/embossed silver, gilded gesso mask, silk tassels.
import * as THREE from 'three';
import { surface, vnoise, fbm, ridged, rng } from './pbr.js';

// anisotropic tileable value noise (separate periods in x and y)
export function vn2(x, y, px, py, seed = 1) {
  const h = (ix, iy) => { let v = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0; v = (v ^ (v >>> 13)) * 1274126177 | 0; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };
  const fx = x * px, fy = y * py, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const mx = v => ((v % px) + px) % px, my = v => ((v % py) + py) % py;
  const a = h(mx(ix), my(iy)), b = h(mx(ix + 1), my(iy)), c = h(mx(ix), my(iy + 1)), d = h(mx(ix + 1), my(iy + 1));
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
// hex -> sRGB 0..255 (canvas space; THREE.Color would convert to linear)
const C = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// ---------- crinkled slubby linen ----------
export function linen(o = {}) {
  const base = C(o.base ?? '#cec5b1'), dark = C(o.dark ?? '#a99d85'), lite = C('#ddd6c6');
  const W = o.weave ?? 150;
  return surface({
    w: 1024, seed: o.seed ?? 3, rough: 0.9, nStrength: o.nStrength ?? 4, repeat: o.repeat ?? [2, 2],
    pixel: (u, v) => {
      // warp so creases wander
      const wu = u + 0.04 * (fbm(u, v, 3, 3, 5) - 0.5), wv = v + 0.04 * (fbm(u, v, 3, 3, 7) - 0.5);
      const crinkle = ridged(wu, wv, o.crinkle ?? 9, 4, 11);        // sharp crease network
      const soft = fbm(u, v, 4, 3, 2);
      const slubH = vn2(u, v, 3, 260, 17), slubV = vn2(u, v, 260, 3, 19);
      const wx = 0.5 + 0.5 * Math.sin(u * W * 6.283), wy = 0.5 + 0.5 * Math.sin(v * W * 6.283);
      const weave = (wx * 0.5 + wy * 0.5) * 0.6 + (slubH > 0.78 ? 0.25 : 0) + (slubV > 0.8 ? 0.2 : 0);
      const h = 0.5 + 0.28 * (crinkle - 0.45) + 0.12 * (soft - 0.5) + 0.07 * (weave - 0.4);
      let c = lerpC(base, dark, clamp((0.5 - crinkle) * 0.35 + (0.5 - soft) * 0.2));
      c = lerpC(c, lite, clamp((slubH - 0.75) * 1.2 + (slubV - 0.8) * 1.0));
      c = lerpC(c, dark, (1 - wx * wy) * 0.18);
      return { a: c, h, r: 0.88 + 0.08 * (1 - crinkle) };
    },
  });
}

// ---------- felted heather wool + couched gold embroidery ----------
function couchedPetal(L, x, y, len, wid, ang, cols, rnd) {
  // a petal / leaf filled with parallel thread strokes along its axis, raised and metallic
  const n = Math.max(3, Math.floor(wid * 1.4));
  for (let i = 0; i < n; i++) {
    const k = (i / (n - 1) - 0.5) * 2, half = Math.sqrt(Math.max(0, 1 - k * k));
    const off = k * wid / 2;
    const col = cols[Math.floor(rnd() * cols.length)];
    for (const [ctx, style, lw] of [[L.a, col, 1.7], [L.h, '#e8e8e8', 1.7], [L.m, '#5a5a5a', 1.9], [L.r, '#8a8a8a', 1.9]]) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(off, -len * 0.5 * half); ctx.quadraticCurveTo(off * 1.15, 0, off, len * 0.5 * half); ctx.stroke();
      ctx.restore();
    }
  }
  // outline groove (darker gap between thread groups)
  for (const [ctx, style] of [[L.a, 'rgba(70,45,15,0.55)'], [L.h, 'rgba(60,60,60,0.8)']]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.strokeStyle = style; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.ellipse(0, 0, wid / 2 + 0.6, len / 2 + 0.6, 0, 0, 6.283); ctx.stroke(); ctx.restore();
  }
}
function knot(L, x, y, r, col) {
  for (const [ctx, st] of [[L.a, col], [L.h, '#f0f0f0'], [L.r, '#9a9a9a']]) { ctx.fillStyle = st; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); }
  L.a.fillStyle = 'rgba(40,10,5,0.5)'; L.a.beginPath(); L.a.arc(x + r * 0.3, y + r * 0.3, r * 0.4, 0, 6.283); L.a.fill();
}
export function flowerE(L, x, y, R, rnd, golds, reds) {
  // compact rosette: many short pointed gold petals around a large rust-orange heart
  const petals = 12 + Math.floor(rnd() * 5), rot = rnd() * 6.28;
  for (let i = 0; i < petals; i++) {
    const a = rot + i / petals * 6.283 + (rnd() - 0.5) * 0.3;
    const len = R * (0.45 + rnd() * 0.35);
    couchedPetal(L, x + Math.sin(a) * (R * 0.42 + len * 0.45), y - Math.cos(a) * (R * 0.42 + len * 0.45), len, R * (0.22 + rnd() * 0.12), a + (rnd() - 0.5) * 0.25, golds, rnd);
  }
  const rust = ['#9a4a28', '#b0603a', '#83371f', '#a85a30', '#c0743f'];
  for (let i = 0; i < petals; i++) {
    const a = rot + (i + 0.5) / petals * 6.283;
    couchedPetal(L, x + Math.sin(a) * R * 0.26, y - Math.cos(a) * R * 0.26, R * 0.36, R * 0.2, a, rust, rnd);
  }
  for (let i = 0; i < 22; i++) { const a = rnd() * 6.28, d = rnd() * R * 0.2; knot(L, x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.045 + rnd() * 2, reds[Math.floor(rnd() * reds.length)]); }
}
export function vine(L, pts, rnd, golds, leafScale = 1) {
  // stem as couched line + leaves along it
  for (const [ctx, st, lw] of [[L.a, golds[1], 2.4], [L.h, '#dddddd', 2.6], [L.m, '#808080', 2.6], [L.r, '#707070', 2.6]]) {
    ctx.strokeStyle = st; ctx.lineWidth = lw; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(...pts[0]);
    for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    ctx.lineTo(...pts[pts.length - 1]); ctx.stroke();
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const ang = Math.atan2(y1 - y0, x1 - x0);
    for (const sd of [-1, 1]) {
      if (rnd() < 0.25) continue;
      const t = rnd(), x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const la = ang + sd * (0.8 + rnd() * 0.5) + Math.PI / 2;
      const len = (9 + rnd() * 9) * leafScale;
      couchedPetal(L, x + Math.sin(la) * len * 0.5, y - Math.cos(la) * len * 0.5, len, len * 0.42, la, golds, rnd);
    }
  }
}

export function felt(o = {}) {
  const W = o.w ?? 2048, H = o.h ?? 1024;
  const fib = [C('#141a21'), C('#1d252e'), C('#28333e'), C('#3a4857'), C('#0e1216'), C('#222c36')];
  const golds = o.golds ?? ['#8a6a30', '#6f5226', '#a07f42', '#5a4220', '#7d5e2c', '#a8894e'];
  const reds = ['#7c3220', '#93422a', '#5e2618', '#a0553a'];
  return surface({
    w: W, hgt: H, seed: o.seed ?? 8, rough: 0.97, nStrength: 3.2, base: '#3f5060',
    pixel: (u, v, x, y) => {
      const n = fbm(u, v, 24, 3, 3), sp = vnoise(u, v, 700, 5), sp2 = vnoise(u, v, 380, 9);
      const idx = Math.floor(clamp(sp * 0.7 + sp2 * 0.5 + n * 0.3 - 0.25) * (fib.length - 0.01));
      const c = lerpC(fib[idx], fib[2], 0.25 + 0.2 * (n - 0.5));
      return { a: c, h: 0.45 + 0.25 * sp + 0.15 * n, r: 0.95 };
    },
    paint: (L, w, h, rnd) => {
      if (o.plain) return;
      const front = o.front ?? [0.22, 0.78]; // u-range that is the vest front
      const fx0 = front[0] * w, fx1 = front[1] * w;
      const bands = o.bands ?? [[0.05, 0.62], [0.72, 0.98]]; // v-ranges (canvas top = vest top)
      for (const [b0, b1] of bands) {
        const y0 = b0 * h, y1 = b1 * h;
        // large flowers in a loose staggered grid, vines between, leaves fill gaps
        const R = (o.flowerR ?? 0.07) * h;
        const cols = Math.round((fx1 - fx0) / (R * 3.0));
        const rows = Math.max(1, Math.round((y1 - y0) / (R * 2.9)));
        const centers = [];
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const x = fx0 + (i + 0.5 + (j % 2 ? 0.35 : -0.1) + (rnd() - 0.5) * 0.3) * (fx1 - fx0) / cols;
          const y = y0 + (j + 0.5 + (rnd() - 0.5) * 0.3) * (y1 - y0) / rows;
          if (x < fx0 + R * 0.6 || x > fx1 - R * 0.6) continue;
          centers.push([x, y]);
        }
        for (let k = 0; k < centers.length; k++) for (let m = k + 1; m < centers.length; m++) {
          const a = centers[k], b = centers[m]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
          if (d > R * 4.2) continue;
          const mid = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * R * 1.5, (a[1] + b[1]) / 2 + (rnd() - 0.5) * R * 1.5];
          vine(L, [a, mid, b], rnd, golds);
        }
        for (let s = 0; s < (o.sprigs ?? 22); s++) {
          const x = fx0 + rnd() * (fx1 - fx0), y = y0 + rnd() * (y1 - y0);
          const a = rnd() * 6.28, l = R * (0.8 + rnd());
          vine(L, [[x, y], [x + Math.cos(a) * l * 0.6, y + Math.sin(a) * l * 0.6], [x + Math.cos(a + 0.5) * l, y + Math.sin(a + 0.5) * l]], rnd, golds, 0.8);
        }
        for (const [x, y] of centers) flowerE(L, x, y, R * (0.85 + rnd() * 0.35), rnd, golds, reds);
        // small buds
        for (let s = 0; s < (o.buds ?? 18); s++) flowerE(L, fx0 + rnd() * (fx1 - fx0), y0 + rnd() * (y1 - y0), R * 0.35, rnd, golds, reds);
      }
    },
  });
}

// ---------- engraved silver band (belt) ----------
export function engravedSilver(o = {}) {
  const W = o.w ?? 2048, H = o.h ?? 128;
  return surface({
    w: W, hgt: H, seed: o.seed ?? 4, rough: 0.36, metal: 1, base: o.base ?? '#c3c5c3', nStrength: 3.5,
    pixel: (u, v) => {
      const n = fbm(u, v, 40, 3, 4), sc = fbm(u, v, 200, 2, 6);
      const k = 0.88 + 0.12 * n;
      return { a: [200 * k, 201 * k, 196 * k], h: 0.62 + 0.06 * (sc - 0.5), r: 0.3 + 0.14 * n };
    },
    paint: (L, w, h, rnd) => {
      const grooveA = 'rgba(55,52,45,0.9)', grooveH = '#2a2a2a', grooveR = '#c8c8c8';
      const line = (fn) => { for (const [ctx, st] of [[L.a, grooveA], [L.h, grooveH], [L.r, grooveR]]) { ctx.strokeStyle = st; ctx.lineWidth = 1.6; fn(ctx); } };
      // border lines
      for (const y of [h * 0.12, h * 0.88]) line(ctx => { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); });
      // flowing script-like scrolls with rosettes
      for (let x = 0; x < w; x += h * 0.9) {
        line(ctx => { ctx.beginPath(); ctx.moveTo(x, h * 0.5); ctx.bezierCurveTo(x + h * 0.2, h * 0.15, x + h * 0.45, h * 0.85, x + h * 0.9, h * 0.5); ctx.stroke(); });
        line(ctx => { ctx.beginPath(); ctx.arc(x + h * 0.45, h * 0.5, h * 0.16, 0, 6.283); ctx.stroke(); });
        for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; line(ctx => { ctx.beginPath(); ctx.ellipse(x + h * 0.45 + Math.cos(a) * h * 0.08, h * 0.5 + Math.sin(a) * h * 0.08, h * 0.05, h * 0.025, a, 0, 6.283); ctx.stroke(); }); }
        for (let k = 0; k < 4; k++) { const xx = x + rnd() * h * 0.9, yy = h * (0.25 + rnd() * 0.5); line(ctx => { ctx.beginPath(); ctx.arc(xx, yy, h * 0.06, rnd() * 3, rnd() * 3 + 2.5); ctx.stroke(); }); }
      }
      // tarnish in recesses: darker soft blobs near border
      L.a.globalAlpha = 0.18; L.a.fillStyle = '#4a463c';
      for (let i = 0; i < 300; i++) { L.a.beginPath(); L.a.arc(rnd() * w, rnd() < 0.5 ? h * 0.1 : h * 0.9, 2 + rnd() * 5, 0, 6.283); L.a.fill(); }
      L.a.globalAlpha = 1;
    },
  });
}

// ---------- embossed floral silver (boots) ----------
export function embossedSilver(o = {}) {
  const W = o.w ?? 1024, H = o.h ?? 1024;
  return surface({
    w: W, hgt: H, seed: o.seed ?? 6, rough: 0.5, metal: 1, base: '#808080', nStrength: 5,
    paint: (L, w, h, rnd) => {
      // recess colour everywhere, then raised leaves in bright silver
      L.a.fillStyle = '#6f716c'; L.a.fillRect(0, 0, w, h);
      L.h.fillStyle = '#303030'; L.h.fillRect(0, 0, w, h);
      L.r.fillStyle = '#b4b4b4'; L.r.fillRect(0, 0, w, h);
      const leaf = (x, y, len, wid, a) => {
        for (const [ctx, st] of [[L.a, '#a9aba6'], [L.h, '#e0e0e0'], [L.r, '#6a6a6a']]) {
          ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = st; ctx.shadowColor = ctx === L.a ? 'rgba(50,50,46,0.7)' : ctx === L.h ? 'rgba(0,0,0,0.7)' : 'transparent'; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.moveTo(0, -len / 2); ctx.quadraticCurveTo(wid, 0, 0, len / 2); ctx.quadraticCurveTo(-wid, 0, 0, -len / 2); ctx.fill();
          ctx.restore();
        }
        // midrib + veins engraved
        for (const [ctx, st] of [[L.a, '#7a7c78'], [L.h, '#8a8a8a']]) {
          ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.strokeStyle = st; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(0, -len * 0.45); ctx.lineTo(0, len * 0.45); ctx.stroke();
          for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(0, k * len * 0.15); ctx.lineTo(wid * 0.45, k * len * 0.15 - len * 0.08); ctx.moveTo(0, k * len * 0.15); ctx.lineTo(-wid * 0.45, k * len * 0.15 - len * 0.08); ctx.stroke(); }
          ctx.restore();
        }
      };
      for (let i = 0; i < (o.leaves ?? 150); i++) {
        const x = rnd() * w, y = rnd() * h, len = 60 + rnd() * 70, a = rnd() * 6.28;
        for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) leaf(x + ox, y + oy, len, len * 0.42, a);
      }
      // dotted punch texture in recesses
      L.h.fillStyle = '#505050';
      for (let i = 0; i < 6000; i++) { L.h.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
    },
  });
}

// ---------- vertical ribbed "crown" band at the boot top ----------
export function ribbedSilver(o = {}) {
  return surface({
    w: 1024, hgt: 128, seed: 12, rough: 0.42, metal: 1, base: '#bdbfbb', nStrength: 5,
    pixel: (u, v) => {
      const k = u * (o.ribs ?? 64), f = k - Math.floor(k);
      const arch = Math.abs(f - 0.5) * 2;           // 0 centre of rib
      const top = v < 0.55 ? 1 : 0;
      const h = top ? 0.75 - 0.5 * arch ** 2 : 0.5 + 0.2 * Math.sin(u * 6.283 * 32) * (v > 0.75 ? 1 : 0.3);
      const c = 0.55 + 0.4 * h;
      return { a: [200 * c, 202 * c, 198 * c], h, r: 0.32 + 0.3 * (1 - h) };
    },
  });
}

// ---------- gilded gesso mask ----------
// Painted in mask-local metres: P(x, y) maps a point on the mask ellipsoid (a, b) to canvas pixels
// for a faceFront SphereGeometry (u = 0.5 at the face centre, canvas top = top of the sphere).
export function maskSurf(o = {}) {
  const W = 2048, H = 2048, A = o.a ?? 0.079, B = o.b ?? 0.134;
  const P = (x, y) => {
    const yy = Math.max(-0.999, Math.min(0.999, y / B)), rr = Math.sqrt(1 - yy * yy) * A;
    const u = 0.5 + Math.asin(Math.max(-1, Math.min(1, x / rr))) / (2 * Math.PI);
    return [u * W, Math.acos(yy) / Math.PI * H];
  };
  return surface({
    w: W, hgt: H, seed: o.seed ?? 5, rough: 0.62, base: '#e6dcc5', nStrength: 3,
    pixel: (u, v) => {
      const n = fbm(u, v, 30, 4, 2), cr = ridged(u, v, 40, 3, 8);
      const c = lerpC(C('#bea686'), C('#95806a'), clamp((cr - 0.68) * 1.6 + (0.5 - n) * 0.45));
      return { a: c, h: 0.5 + 0.05 * (n - 0.5) - 0.06 * Math.max(0, cr - 0.75) * 4, r: 0.62 };
    },
    paint: (L, w, h, rnd) => {
      const golds = ['#b08a45', '#9a7637', '#c2a05c', '#86662d', '#b8964f'];
      const layers = (fn) => { for (const [ctx, st, kind] of [[L.a, golds[Math.floor(rnd() * golds.length)], 'a'], [L.h, '#d6d6d6', 'h'], [L.m, '#cfcfcf', 'm'], [L.r, '#5a5a5a', 'r']]) fn(ctx, st, kind); };
      const stroke = (pts, lw) => layers((ctx, st) => { ctx.strokeStyle = st; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(...P(...pts[0])); for (const q of pts.slice(1)) ctx.lineTo(...P(...q)); ctx.stroke(); });
      const leaf = (x, y, len, ang, wid = 0.34) => { // len in metres, ang 0 = up
        const c = P(x, y), tip = P(x + Math.sin(ang) * len / 2, y + Math.cos(ang) * len / 2), tail = P(x - Math.sin(ang) * len / 2, y - Math.cos(ang) * len / 2);
        const L2 = Math.hypot(tip[0] - tail[0], tip[1] - tail[1]), a2 = Math.atan2(tip[0] - tail[0], -(tip[1] - tail[1]));
        layers((ctx, st) => { ctx.save(); ctx.translate(...c); ctx.rotate(a2); ctx.fillStyle = st; ctx.beginPath(); ctx.moveTo(0, -L2 / 2); ctx.quadraticCurveTo(L2 * wid, 0, 0, L2 / 2); ctx.quadraticCurveTo(-L2 * wid, 0, 0, -L2 / 2); ctx.fill(); ctx.restore(); });
        // vein groove
        for (const [ctx, st] of [[L.a, 'rgba(110,80,30,0.7)'], [L.h, '#9a9a9a']]) { ctx.save(); ctx.translate(...c); ctx.rotate(a2); ctx.strokeStyle = st; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -L2 * 0.4); ctx.lineTo(0, L2 * 0.4); ctx.stroke(); ctx.restore(); }
      };
      const feather = (x0, y0, ang, len, n, spread) => { // stem with leaflets both sides
        const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push([x0 + Math.sin(ang + spread * 0.3 * t) * len * t, y0 + Math.cos(ang + spread * 0.3 * t) * len * t]); }
        stroke(pts, 2.2);
        for (let k = 1; k <= n; k++) {
          const t = k / (n + 1), q = pts[Math.round(t * 8)];
          for (const sd of [-1, 1]) leaf(q[0] + Math.sin(ang + sd * 0.9) * len * 0.07, q[1] + Math.cos(ang + sd * 0.9) * len * 0.07, len * (0.22 - 0.1 * t), ang + sd * (0.7 + rnd() * 0.3), 0.3);
        }
      };
      // forehead: symmetric feathered motif under the fringe
      for (const s of [-1, 1]) {
        for (let k = 0; k < 5; k++) feather(0.004 * s, 0.05 + k * 0.016, s * (0.9 + k * 0.12), 0.05 - k * 0.004, 6, s);
        feather(0.025 * s, 0.05, s * 0.35, 0.06, 6, s);
      }
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) feather(0.03 * s, 0.05 + k * 0.018, s * (1.2 + k * 0.1), 0.045, 5, s);
      stroke([[0, 0.045], [0, 0.13]], 3);
      for (let i = 0; i < 260; i++) { const x = (rnd() - 0.5) * 0.14, y = 0.05 + rnd() * 0.08; leaf(x, y, 0.006 + rnd() * 0.008, (rnd() - 0.5) * 3); }
      // eyebrow arcs (double line)
      for (const s of [-1, 1]) {
        const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push([s * (0.008 + 0.046 * t), 0.041 + 0.007 * Math.sin(Math.PI * t * 0.9)]); }
        stroke(pts, 5); stroke(pts.map(q => [q[0], q[1] + 0.006]), 2);
      }
      // nose ridge + tip
      stroke([[0, 0.04], [0, 0.0], [0, -0.043]], 4);
      for (let i = 0; i < 12; i++) leaf((rnd() - 0.5) * 0.008, -0.04 + rnd() * 0.08, 0.006, (rnd() - 0.5) * 0.6);
      // cheek fans sweeping out and down from the nose
      for (const s of [-1, 1]) {
        for (let k = 0; k < 6; k++) feather(0.016 * s, 0.002 - k * 0.006, s * (1.5 + k * 0.18), 0.05 - k * 0.003, 6, s);
        for (let i = 0; i < 110; i++) { const t = rnd(); leaf(s * (0.02 + t * 0.04), -0.002 - t * 0.04 + (rnd() - 0.5) * 0.02, 0.006 + rnd() * 0.008, s * (1.6 + rnd() * 0.8)); }
      }
      // gilded lips + chin mark
      layers((ctx, st) => { ctx.fillStyle = st; const c = P(0, -0.078), e = P(0.022, -0.078); ctx.beginPath(); ctx.ellipse(c[0], c[1], e[0] - c[0], 9, 0, 0, 6.283); ctx.fill(); });
      for (const [ctx, st] of [[L.a, '#5b4020'], [L.h, '#404040']]) { ctx.strokeStyle = st; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...P(-0.02, -0.078)); ctx.quadraticCurveTo(...P(0, -0.08), ...P(0.02, -0.078)); ctx.stroke(); }
      feather(0, -0.098, Math.PI, 0.02, 3, 0); feather(0, -0.098, 0, 0.012, 2, 0);
      // almond eye openings with dark eyes (painted, glossy)
      for (const s of [-1, 1]) {
        const c = P(0.033 * s, 0.024), e = P(0.033 * s + 0.018, 0.024);
        const rx = Math.abs(e[0] - c[0]), ry = 0.006 / Math.PI / B * H * 1.2;
        const almond = (ctx) => { ctx.beginPath(); ctx.moveTo(c[0] - rx, c[1] + ry * 0.2 * s); ctx.quadraticCurveTo(c[0], c[1] - ry * 1.6, c[0] + rx, c[1] - ry * 0.4 * s); ctx.quadraticCurveTo(c[0], c[1] + ry * 1.4, c[0] - rx, c[1] + ry * 0.2 * s); };
        L.a.fillStyle = '#120c08'; almond(L.a); L.a.fill();
        L.a.fillStyle = '#3a2416'; L.a.beginPath(); L.a.arc(c[0] - s * rx * 0.05, c[1], ry * 0.75, 0, 6.283); L.a.fill();
        L.a.fillStyle = '#050302'; L.a.beginPath(); L.a.arc(c[0] - s * rx * 0.05, c[1], ry * 0.35, 0, 6.283); L.a.fill();
        L.h.fillStyle = '#202020'; almond(L.h); L.h.fill();
        L.r.fillStyle = '#6a6a6a'; almond(L.r); L.r.fill();
        L.m.fillStyle = '#000'; almond(L.m); L.m.fill();
        // gilded lid rim
        for (const [ctx, st, lw] of [[L.a, '#b88d3d', 3], [L.h, '#e0e0e0', 3], [L.m, '#c0c0c0', 3]]) { ctx.strokeStyle = st; ctx.lineWidth = lw; almond(ctx); ctx.stroke(); }
      }
      // blue lizard figure on her left cheek (+x)
      const lx = 0.047, ly = -0.012;
      const blue = (draw) => { for (const [ctx, st] of [[L.a, '#1b3260'], [L.h, '#b8b8b8'], [L.r, '#7a7a7a'], [L.m, '#000']]) { ctx.fillStyle = st; ctx.strokeStyle = st; draw(ctx); } };
      const E = (x, y, rx, ry, rot = 0) => (ctx) => { const c = P(x, y), e = P(x + rx, y), f = P(x, y + ry); ctx.beginPath(); ctx.ellipse(c[0], c[1], Math.abs(e[0] - c[0]), Math.abs(f[1] - c[1]), rot, 0, 6.283); ctx.fill(); };
      blue(E(lx, ly, 0.0045, 0.019, 0.15));
      blue(E(lx - 0.002, ly + 0.025, 0.004, 0.006));
      blue((ctx) => { ctx.lineWidth = 6; ctx.lineCap = 'round'; for (const [dx, dy, ex, ey] of [[-0.002, 0.012, -0.012, 0.022], [0.003, 0.012, 0.012, 0.018], [-0.002, -0.012, -0.011, -0.022], [0.003, -0.012, 0.012, -0.02]]) { ctx.beginPath(); ctx.moveTo(...P(lx + dx, ly + dy)); ctx.lineTo(...P(lx + ex, ly + ey)); ctx.stroke(); } ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(...P(lx, ly - 0.018)); ctx.quadraticCurveTo(...P(lx + 0.006, ly - 0.03), ...P(lx - 0.003, ly - 0.042)); ctx.stroke(); });
      for (let i = 0; i < 500; i++) { L.a.fillStyle = rnd() < 0.5 ? '#2a4c80' : '#101f40'; const q = P(lx + (rnd() - 0.5) * 0.012, ly + (rnd() - 0.5) * 0.045); L.a.fillRect(q[0], q[1], 3, 3); }
    },
  });
}

// ---------- silk tassel threads ----------
export function tasselSurf(base = '#dccfae') {
  const b = C(base);
  return surface({
    w: 256, seed: 2, rough: 0.55, nStrength: 3, repeat: [3, 1],
    pixel: (u, v) => {
      const s = vn2(u, v, 220, 2, 3), f = 0.5 + 0.5 * Math.sin(u * 6.283 * 90 + s * 4);
      const k = 0.82 + 0.25 * f;
      return { a: [b[0] * k, b[1] * k, b[2] * k], h: f, r: 0.5 + 0.2 * (1 - f) };
    },
  });
}

// ---------- hammered/beaded silver for cuffs and bells ----------
export function hammeredSilver(o = {}) {
  return surface({
    w: 512, seed: o.seed ?? 14, rough: 0.4, metal: 1, base: '#c0c2bf', nStrength: 3, repeat: o.repeat ?? [1, 1],
    pixel: (u, v) => {
      const n = fbm(u, v, 20, 3, 3), d = fbm(u, v, 60, 2, 8);
      const k = 0.78 + 0.25 * n;
      return { a: [196 * k, 198 * k, 192 * k], h: 0.5 + 0.3 * (d - 0.5), r: 0.32 + 0.2 * (1 - n) };
    },
  });
}

// cuff band: rope borders + round medallions
export function cuffSilver() {
  return surface({
    w: 1024, hgt: 256, seed: 21, rough: 0.38, metal: 1, base: '#bfc1bd', nStrength: 4,
    pixel: (u, v) => {
      const n = fbm(u, v, 30, 3, 2);
      const rope = (v < 0.12 || v > 0.88) ? 0.5 + 0.5 * Math.sin((u * 220 + v * 30) * 6.283) : 0.5;
      const k = 0.8 + 0.2 * n;
      return { a: [192 * k, 194 * k, 188 * k], h: (v < 0.12 || v > 0.88) ? 0.4 + 0.4 * rope : 0.55, r: 0.33 + 0.15 * (1 - n) };
    },
    paint: (L, w, h, rnd) => {
      for (let i = 0; i < 6; i++) {
        const x = (i + 0.5) / 6 * w, y = h * 0.5, R = h * 0.3;
        for (const [ctx, st] of [[L.a, '#d4d6d2'], [L.h, '#e0e0e0'], [L.r, '#555']]) { ctx.fillStyle = st; ctx.beginPath(); ctx.arc(x, y, R, 0, 6.283); ctx.fill(); }
        for (const [ctx, st] of [[L.a, '#5a5a54'], [L.h, '#606060']]) {
          ctx.strokeStyle = st; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, R * 0.92, 0, 6.283); ctx.stroke();
          for (let k = 0; k < 3; k++) { const a = k / 3 * 6.283; ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * 0.32, y + Math.sin(a) * R * 0.32, R * 0.3, a + 1, a + 4); ctx.stroke(); }
        }
        // small dot motifs between medallions
        for (const [ctx, st] of [[L.a, '#6a6a64'], [L.h, '#404040']]) { ctx.fillStyle = st; for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + w / 12, h * (0.3 + k * 0.1), 3, 0, 6.283); ctx.fill(); } }
      }
      L.a.globalAlpha = 0.25; L.a.fillStyle = '#3e3c34';
      for (let i = 0; i < 400; i++) { L.a.beginPath(); L.a.arc(rnd() * w, rnd() * h, 2 + rnd() * 4, 0, 6.283); L.a.fill(); }
      L.a.globalAlpha = 1;
    },
  });
}
