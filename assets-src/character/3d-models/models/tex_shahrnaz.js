// Shahrnaz surfaces: dark boucle tweed, quilted cream bib with red velvet medallions,
// antique engraved bronze, carved cream mask, black leather, twisted cotton tassels.
import * as THREE from 'three';
import { surface, vnoise, fbm, ridged, rng } from './pbr.js';
import { vn2 } from './tex_arnavaz.js';

// hex -> sRGB 0..255 (canvas space; THREE.Color would convert to linear)
const C = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lerpC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hsh = (i, s) => { let v = (i * 374761393 + s * 668265263) | 0; v = (v ^ (v >>> 13)) * 1274126177 | 0; return ((v ^ (v >>> 16)) >>> 0) / 4294967296; };

// ---------- dark boucle tweed ----------
export function tweed(o = {}) {
  const N = o.threads ?? 96;
  const pal = o.pal ? o.pal.map(([h, w]) => [C(h), w]) : [
    [C('#080808'), 0.4], [C('#0e0d0d'), 0.2], [C('#151413'), 0.1], [C('#3a3226'), 0.12], [C('#524633'), 0.06],
    [C('#2c1a12'), 0.05], [C('#10161f'), 0.05], [C('#1d2024'), 0.02],
  ];
  const pick = (r) => { let a = 0; for (const [c, w] of pal) { a += w; if (r < a) return c; } return pal[0][0]; };
  const warp = [], weft = [];
  for (let i = 0; i < N; i++) { warp.push(pick(hsh(i, o.seed ?? 3))); weft.push(pick(hsh(i, (o.seed ?? 3) + 77))); }
  return surface({
    w: 1024, seed: o.seed ?? 3, rough: 0.95, nStrength: o.nStrength ?? 4, repeat: o.repeat ?? [6, 6],
    pixel: (u, v) => {
      const fu = u * N, fv = v * N, i = Math.floor(fu), j = Math.floor(fv);
      const cu = fu - i, cv = fv - j;
      const warpTop = ((i + j) % 4) < 2;             // 2/2 twill
      const across = warpTop ? cu : cv;
      const prof = Math.sin(Math.PI * across);        // round thread
      const along = warpTop ? cv : cu;
      let c = warpTop ? warp[i % N] : weft[j % N];
      const boucle = vnoise(u, v, 320, 5), fuzz = vnoise(u, v, 700, 9), clump = fbm(u, v, 12, 3, 4);
      const k = 0.55 + 0.6 * prof * (0.8 + 0.2 * Math.sin(along * 6.283 * 2)) + 0.25 * (boucle - 0.5);
      c = [c[0] * k, c[1] * k, c[2] * k];
      // loose fibre flecks
      if (fuzz > 0.88) c = lerpC(c, C('#5e5040'), (fuzz - 0.88) * 4);
      c = lerpC(c, [10, 10, 10], (1 - clump) * 0.2);
      return { a: c, h: 0.35 + 0.35 * prof + 0.25 * boucle + 0.1 * clump, r: 0.88 + 0.1 * (1 - prof) };
    },
  });
}

// ---------- fine dense boucle crosshatch (ref: near-black with faint tan/rust flecks) ----------
export function boucle(o = {}) {
  const N = o.threads ?? 128, fl = o.flecks ?? 1, seed = o.seed ?? 3;
  const base = C(o.base ?? '#121110'), base2 = C(o.base2 ?? '#1a1918'), line = C(o.line ?? '#2b2621');
  const tan = C('#5a4c3a'), rust = C('#4a2a1c'), grey = C('#2a2a2b'), navy = C('#161b24');
  return surface({
    w: 1024, seed, rough: 0.95, nStrength: o.nStrength ?? 3, repeat: o.repeat ?? [24, 12],
    pixel: (u, v) => {
      const fu = u * N, fv = v * N, i = Math.floor(fu), j = Math.floor(fv);
      const cu = fu - i, cv = fv - j;
      const warpTop = ((i + j) % 4) < 2;
      const across = warpTop ? cu : cv, prof = Math.sin(Math.PI * across);
      const th = warpTop ? i : j;
      // faint crosshatch: every 4th thread a touch lighter, in both directions
      let c = (th % 4 === 0) ? line : (hsh(th, seed + (warpTop ? 0 : 9)) < 0.5 ? base : base2);
      // short flecks per thread segment (not whole-thread stripes, so no tartan)
      const seg = warpTop ? Math.floor(fv / 3) : Math.floor(fu / 3);
      const r = hsh(th * 977 + seg * 131 + (warpTop ? 7 : 3), seed);
      if (r < 0.05 * fl) c = tan; else if (r < 0.07 * fl) c = rust; else if (r < 0.13 * fl) c = grey; else if (r < 0.15 * fl) c = navy;
      const boucle = vnoise(u, v, 512, 5), clump = fbm(u, v, 16, 3, 4);
      const k = 0.62 + 0.5 * prof + 0.2 * (boucle - 0.5);
      c = [c[0] * k, c[1] * k, c[2] * k];
      c = lerpC(c, [8, 8, 8], (1 - clump) * 0.25);
      return { a: c, h: 0.35 + 0.3 * prof + 0.3 * boucle + 0.1 * clump, r: 0.9 + 0.08 * (1 - prof) };
    },
  });
}

// ---------- quilted cream bib with velvet medallions and border ----------
function medallion(L, x, y, R, rnd) {
  const red = '#3e0d12', red2 = '#521519', tan = '#b39663';
  const fill = (fn, col, hv, rv) => { for (const [ctx, st] of [[L.a, col], [L.h, hv], [L.r, rv]]) { ctx.fillStyle = st; fn(ctx); } };
  // 8 outer pointed petals
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * 6.283;
    fill(ctx => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -R); ctx.quadraticCurveTo(R * 0.36, -R * 0.55, R * 0.12, -R * 0.2); ctx.lineTo(-R * 0.12, -R * 0.2); ctx.quadraticCurveTo(-R * 0.36, -R * 0.55, 0, -R); ctx.fill(); ctx.restore(); }, red, '#c8c8c8', '#ffffff');
    const a2 = a + 6.283 / 16;
    fill(ctx => { ctx.save(); ctx.translate(x, y); ctx.rotate(a2); ctx.beginPath(); ctx.ellipse(0, -R * 0.55, R * 0.16, R * 0.3, 0, 0, 6.283); ctx.fill(); ctx.restore(); }, red2, '#c0c0c0', '#ffffff');
  }
  fill(ctx => { ctx.beginPath(); ctx.arc(x, y, R * 0.36, 0, 6.283); ctx.fill(); }, red, '#c4c4c4', '#ffffff');
  // tan couched outlines and inner rosette
  for (const [ctx, st, lw] of [[L.a, tan, 2.2], [L.h, '#e4e4e4', 2.2], [L.r, '#9a9a9a', 2.2]]) {
    ctx.strokeStyle = st; ctx.lineWidth = lw;
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(0, -R * 0.92); ctx.lineTo(0, -R * 0.42); ctx.stroke(); ctx.beginPath(); ctx.ellipse(0, -R * 0.62, R * 0.08, R * 0.16, 0, 0, 6.283); ctx.stroke(); ctx.restore(); }
    ctx.beginPath(); ctx.arc(x, y, R * 0.36, 0, 6.283); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.39; ctx.beginPath(); ctx.ellipse(x + Math.sin(a) * R * 0.2, y - Math.cos(a) * R * 0.2, R * 0.05, R * 0.11, a, 0, 6.283); ctx.stroke(); }
  }
  for (const [ctx, st] of [[L.a, tan], [L.h, '#eeeeee']]) { ctx.fillStyle = st; ctx.beginPath(); ctx.arc(x, y, R * 0.08, 0, 6.283); ctx.fill(); }
  // velvet pile speckle
  for (let i = 0; i < R * R * 0.8; i++) { const a = rnd() * 6.283, d = Math.sqrt(rnd()) * R * 0.95; L.a.fillStyle = rnd() < 0.5 ? 'rgba(40,6,10,0.35)' : 'rgba(150,60,60,0.25)'; L.a.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 2, 2); }
}
function borderBand(L, x0, y0, x1, y1, vertical, rnd) {
  const red = '#350b0e', cream = '#c9b48a', gold = '#a8853f';
  for (const [ctx, st, hv] of [[L.a, red, 0], [L.h, '#b0b0b0', 1], [L.r, '#ffffff', 2]]) { ctx.fillStyle = st; ctx.fillRect(x0, y0, x1 - x0, y1 - y0); }
  // velvet nap
  for (let i = 0; i < (x1 - x0) * (y1 - y0) * 0.05; i++) { L.a.fillStyle = rnd() < 0.5 ? 'rgba(30,4,8,0.35)' : 'rgba(140,50,50,0.25)'; L.a.fillRect(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 2, 2); }
  const len = vertical ? y1 - y0 : x1 - x0, wid = vertical ? x1 - x0 : y1 - y0;
  const P = (s, t) => vertical ? [x0 + t * wid, y0 + s] : [x0 + s, y0 + t * wid];
  for (const [ctx, st, lw] of [[L.a, gold, 2], [L.h, '#e8e8e8', 2], [L.r, '#999999', 2]]) {
    ctx.strokeStyle = st; ctx.lineWidth = lw;
    // edge rails
    for (const t of [0.1, 0.9]) { ctx.beginPath(); ctx.moveTo(...P(0, t)); ctx.lineTo(...P(len, t)); ctx.stroke(); }
    // repeating vine chain with diamonds
    const step = wid * 0.9;
    for (let s = step / 2; s < len; s += step) {
      ctx.beginPath(); ctx.moveTo(...P(s - step / 2, 0.5)); ctx.quadraticCurveTo(...P(s - step / 4, 0.2), ...P(s, 0.5)); ctx.quadraticCurveTo(...P(s + step / 4, 0.8), ...P(s + step / 2, 0.5)); ctx.stroke();
      ctx.beginPath(); const c = P(s, 0.5); ctx.moveTo(c[0], c[1] - wid * 0.18); ctx.lineTo(c[0] + wid * 0.14, c[1]); ctx.lineTo(c[0], c[1] + wid * 0.18); ctx.lineTo(c[0] - wid * 0.14, c[1]); ctx.closePath(); ctx.stroke();
    }
  }
  for (const [ctx, st] of [[L.a, cream], [L.h, '#f0f0f0']]) { ctx.fillStyle = st; const step = wid * 0.9; for (let s = step / 2; s < len; s += step) { const c = P(s, 0.5); ctx.beginPath(); ctx.arc(c[0], c[1], wid * 0.06, 0, 6.283); ctx.fill(); for (const t of [0.25, 0.75]) { const q = P(s + step / 2, t); ctx.beginPath(); ctx.arc(q[0], q[1], wid * 0.04, 0, 6.283); ctx.fill(); } } }
}
export function bib(o = {}) {
  const W = 1024, H = o.h ?? 1024;
  return surface({
    w: W, hgt: H, seed: o.seed ?? 7, rough: 0.9, nStrength: 3.5, base: '#e2d4b5',
    pixel: (u, v) => {
      // quilting: diagonal grooves + puffed cells, mottled ivory
      const d1 = (u * 26 + v * 26 * H / W) % 1, d2 = (u * 26 - v * 26 * H / W + 100) % 1;
      const groove = Math.min(Math.abs(d1 - 0.5), Math.abs(d2 - 0.5)) * 2; // 0 at groove
      const puff = Math.min(1, groove * 3.0);
      const n = fbm(u, v, 14, 4, 3), crk = ridged(u, v, 30, 3, 6);
      let c = lerpC(C('#b49a7c'), C('#94795a'), clamp((1 - puff) * 0.25 + (0.5 - n) * 0.5 + (crk - 0.7) * 0.6));
      return { a: c, h: 0.4 + 0.3 * puff ** 0.5 + 0.15 * n + 0.1 * (crk - 0.5), r: 0.9 };
    },
    paint: (L, w, h, rnd) => {
      const b = o.border ?? 0.1 * w;
      // borders: left, right, bottom (front panel); top edge has a thin band
      borderBand(L, 0, 0, b, h, true, rnd); borderBand(L, w - b, 0, w, h, true, rnd);
      borderBand(L, b, h - b, w - b, h, false, rnd);
      for (const [ctx, st] of [[L.a, '#350b0e'], [L.h, '#b0b0b0']]) { ctx.fillStyle = st; ctx.fillRect(0, 0, w, b * 0.25); }
      const meds = o.meds ?? [[0.5, 0.52, 0.12], [0.27, 0.27, 0.1], [0.73, 0.27, 0.1], [0.28, 0.77, 0.1], [0.72, 0.77, 0.1]];
      for (const [x, y, r] of meds) medallion(L, x * w, y * h, r * w, rnd);
      // small tan sprigs between
      for (let i = 0; i < 40; i++) {
        const x = b + rnd() * (w - 2 * b), y = b * 0.3 + rnd() * (h - 1.3 * b);
        for (const [ctx, st] of [[L.a, 'rgba(150,110,60,0.7)'], [L.h, '#c8c8c8']]) { ctx.strokeStyle = st; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 10, x + 14, y - 4); ctx.stroke(); }
      }
    },
  });
}

// ---------- antique bronze, engraved geometric bands ----------
export function bronze(o = {}) {
  const W = o.w ?? 1024, H = o.h ?? 512;
  return surface({
    w: W, hgt: H, seed: o.seed ?? 4, rough: 0.45, metal: 1, base: '#8f7c59', nStrength: 7,
    pixel: (u, v) => {
      const n = fbm(u, v, 20, 4, 2), sc = fbm(u, v, 120, 2, 5);
      const k = 0.85 + 0.25 * n;
      return { a: [104 * k, 92 * k, 70 * k], h: 0.6 + 0.08 * (sc - 0.5), r: 0.4 + 0.18 * (1 - n) };
    },
    paint: (L, w, h, rnd) => {
      const bands = o.bands ?? [[0.0, 0.12, 'rim'], [0.12, 0.42, 'diamond'], [0.42, 0.5, 'rim'], [0.5, 0.8, 'zig'], [0.8, 0.88, 'rim'], [0.88, 1.0, 'dots']];
      const groove = (fn) => { for (const [ctx, st] of [[L.a, 'rgba(26,23,16,0.95)'], [L.h, '#101010'], [L.r, '#d8d8d8']]) { ctx.strokeStyle = st; fn(ctx); } };
      for (const [a, b, kind] of bands) {
        const y0 = a * h, y1 = b * h, ym = (y0 + y1) / 2, bh = y1 - y0;
        groove(ctx => { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, y0); ctx.lineTo(w, y0); ctx.stroke(); });
        if (kind === 'rim') {
          for (const [ctx, st] of [[L.h, '#e0e0e0'], [L.a, 'rgba(210,190,140,0.35)'], [L.r, '#555']]) { ctx.fillStyle = st; ctx.fillRect(0, y0 + bh * 0.25, w, bh * 0.5); }
        } else if (kind === 'diamond') {
          const step = bh * 0.9;
          groove(ctx => { ctx.lineWidth = 2.2; for (let x = 0; x < w + step; x += step) { ctx.beginPath(); ctx.moveTo(x, y0 + 3); ctx.lineTo(x + step / 2, ym); ctx.lineTo(x, y1 - 3); ctx.lineTo(x - step / 2, ym); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, ym - bh * 0.18); ctx.lineTo(x + step * 0.18, ym); ctx.lineTo(x, ym + bh * 0.18); ctx.lineTo(x - step * 0.18, ym); ctx.closePath(); ctx.stroke(); } });
        } else if (kind === 'zig') {
          const step = bh * 0.6;
          groove(ctx => { ctx.lineWidth = 2.2; for (const off of [0.25, 0.5, 0.75]) { ctx.beginPath(); for (let x = 0, k = 0; x <= w + step; x += step / 2, k++) ctx.lineTo(x, y0 + bh * (off + (k % 2 ? 0.1 : -0.1))); ctx.stroke(); } });
        } else if (kind === 'dots') {
          for (const [ctx, st] of [[L.a, 'rgba(40,34,24,0.9)'], [L.h, '#202020']]) { ctx.fillStyle = st; for (let x = 6; x < w; x += 14) { ctx.beginPath(); ctx.arc(x, ym, 3, 0, 6.283); ctx.fill(); } }
        }
      }
      // patina in recesses + wear
      L.a.globalAlpha = 0.22;
      for (let i = 0; i < 900; i++) { L.a.fillStyle = rnd() < 0.6 ? '#3b3a28' : '#4f5a42'; L.a.beginPath(); L.a.arc(rnd() * w, rnd() * h, 2 + rnd() * 6, 0, 6.283); L.a.fill(); }
      L.a.globalAlpha = 1;
    },
  });
}
// round engraved medallion (belt buckle, earring plaques): mapped on a disc/cylinder cap via planar uv
export function medallionBronze() {
  return surface({
    w: 512, seed: 9, rough: 0.4, metal: 1, base: '#9a8660', nStrength: 5,
    pixel: (u, v) => { const n = fbm(u, v, 12, 3, 2); const k = 0.85 + 0.25 * n; return { a: [110 * k, 97 * k, 73 * k], h: 0.55, r: 0.38 + 0.15 * (1 - n) }; },
    paint: (L, w, h, rnd) => {
      const cx = w / 2, cy = h / 2;
      const groove = (fn, lw = 3) => { for (const [ctx, st] of [[L.a, 'rgba(40,34,24,0.95)'], [L.h, '#1a1a1a'], [L.r, '#d0d0d0']]) { ctx.strokeStyle = st; ctx.lineWidth = lw; fn(ctx); } };
      for (const r of [0.47, 0.42, 0.2]) groove(ctx => { ctx.beginPath(); ctx.arc(cx, cy, r * w, 0, 6.283); ctx.stroke(); });
      for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; groove(ctx => { ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -0.31 * w, 0.06 * w, 0.1 * w, 0, 0, 6.283); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, -0.2 * w); ctx.lineTo(0, -0.41 * w); ctx.stroke(); ctx.restore(); }, 2.5); }
      for (let i = 0; i < 36; i++) { const a = i / 36 * 6.283; for (const [ctx, st] of [[L.h, '#2a2a2a']]) { ctx.fillStyle = st; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 0.445 * w, cy + Math.sin(a) * 0.445 * w, 3, 0, 6.283); ctx.fill(); } }
      for (const [ctx, st] of [[L.h, '#e8e8e8'], [L.r, '#444']]) { ctx.fillStyle = st; ctx.beginPath(); ctx.arc(cx, cy, 0.08 * w, 0, 6.283); ctx.fill(); }
      L.a.globalAlpha = 0.2; for (let i = 0; i < 300; i++) { L.a.fillStyle = '#3b3a28'; L.a.beginPath(); L.a.arc(rnd() * w, rnd() * h, 2 + rnd() * 5, 0, 6.283); L.a.fill(); } L.a.globalAlpha = 1;
    },
  });
}

// ---------- carved cream mask (floral relief, tan recesses) ----------
export function carvedMask(o = {}) {
  const W = 2048, H = 2048, A = o.a ?? 0.08, B = o.b ?? 0.14;
  const P = (x, y) => {
    const yy = Math.max(-0.999, Math.min(0.999, y / B)), rr = Math.sqrt(1 - yy * yy) * A;
    const u = 0.5 + Math.asin(Math.max(-1, Math.min(1, x / rr))) / (2 * Math.PI);
    return [u * W, Math.acos(yy) / Math.PI * H];
  };
  return surface({
    w: W, hgt: H, seed: 13, rough: 0.6, base: '#e6dac2', nStrength: 4,
    pixel: (u, v) => { const n = fbm(u, v, 40, 4, 2); return { a: lerpC(C('#c9b398'), C('#b39c80'), clamp(0.5 - n)), h: 0.62 + 0.04 * n, r: 0.6 }; },
    paint: (L, w, h, rnd) => {
      // carved motifs = recessed (low height, tan) shapes over a raised cream ground
      const tan = ['#a88a66', '#9d7f5b', '#b39674'];
      const cut = (fn) => { for (const [ctx, st] of [[L.a, tan[Math.floor(rnd() * 3)]], [L.h, '#5a5a5a'], [L.r, '#c4c4c4']]) { ctx.fillStyle = st; ctx.strokeStyle = st; fn(ctx); } };
      const rosette = (x, y, R, n) => { const c = P(x, y); const e = P(x + R, y)[0] - c[0];
        cut(ctx => { for (let i = 0; i < n; i++) { const a = i / n * 6.283; ctx.save(); ctx.translate(...c); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(0, -e * 0.55, e * 0.16, e * 0.4, 0, 0, 6.283); ctx.fill(); ctx.restore(); } ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c[0], c[1], e * 0.98, 0, 6.283); ctx.stroke(); });
        for (const [ctx, st] of [[L.a, '#ece1cb'], [L.h, '#9a9a9a']]) { ctx.fillStyle = st; ctx.beginPath(); ctx.arc(c[0], c[1], e * 0.12, 0, 6.283); ctx.fill(); } };
      // big forehead rosette + ring of small florets
      rosette(0, 0.085, 0.022, 16); rosette(0, 0.085, 0.011, 10);
      // dense tiny floral lace over the whole face except eye holes
      for (let i = 0; i < 2200; i++) {
        const x = (rnd() - 0.5) * 2 * A * 0.95, y = (rnd() - 0.5) * 2 * B * 0.95;
        if ((x / A) ** 2 + (y / B) ** 2 > 0.85) continue;
        if (Math.abs(Math.abs(x) - 0.032) < 0.023 && Math.abs(y - 0.02) < 0.011) continue;
        if (Math.hypot(x, y - 0.085) < 0.025) continue;
        const r = 0.0014 + rnd() * 0.0022, c = P(x, y), e = Math.max(2, P(x + r, y)[0] - c[0]);
        if (rnd() < 0.55) cut(ctx => { for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + rnd(); ctx.beginPath(); ctx.ellipse(c[0] + Math.cos(a) * e * 0.5, c[1] + Math.sin(a) * e * 0.5, e * 0.28, e * 0.5, a + 1.57, 0, 6.283); ctx.fill(); } });
        else cut(ctx => { ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(c[0], c[1], e, rnd() * 3, rnd() * 3 + 3); ctx.stroke(); });
      }
      // almond eye openings (painted dark, with lid groove)
      for (const s of [-1, 1]) {
        const c = P(0.032 * s, 0.02), e = P(0.032 * s + 0.02, 0.02);
        const rx = Math.abs(e[0] - c[0]), ry = 0.008 / Math.PI / B * H;
        const almond = (ctx) => { ctx.beginPath(); ctx.moveTo(c[0] - rx, c[1] + ry * 0.3 * s); ctx.quadraticCurveTo(c[0] - s * rx * 0.1, c[1] - ry * 1.5, c[0] + rx, c[1] - ry * 0.5 * s); ctx.quadraticCurveTo(c[0], c[1] + ry * 1.2, c[0] - rx, c[1] + ry * 0.3 * s); };
        L.a.fillStyle = '#100a07'; almond(L.a); L.a.fill();
        L.a.fillStyle = '#2b1b11'; L.a.beginPath(); L.a.arc(c[0], c[1] + ry * 0.1, ry * 0.7, 0, 6.283); L.a.fill();
        L.h.fillStyle = '#1a1a1a'; almond(L.h); L.h.fill(); L.r.fillStyle = '#7a7a7a'; almond(L.r); L.r.fill();
        for (const [ctx, st] of [[L.a, '#a78659'], [L.h, '#404040']]) { ctx.strokeStyle = st; ctx.lineWidth = 3; almond(ctx); ctx.stroke(); }
      }
      // closed lips line
      for (const [ctx, st] of [[L.a, '#9c7b52'], [L.h, '#3a3a3a']]) { ctx.strokeStyle = st; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(...P(-0.02, -0.082)); ctx.quadraticCurveTo(...P(0, -0.085), ...P(0.02, -0.082)); ctx.stroke(); }
    },
  });
}

// ---------- black leather ----------
export function leather() {
  return surface({
    w: 512, seed: 6, rough: 0.38, nStrength: 2.5, base: '#0d0c0c', repeat: [2, 2],
    pixel: (u, v) => {
      const g = vnoise(u, v, 90, 3), cr = ridged(u, v, 10, 3, 8), w2 = fbm(u, v, 6, 3, 2);
      const k = 13 + 10 * w2 + 8 * (cr > 0.8 ? cr - 0.8 : 0) * 5;
      return { a: [k, k * 0.95, k * 0.92], h: 0.5 + 0.12 * g - 0.2 * Math.max(0, cr - 0.75) * 4, r: 0.3 + 0.2 * g + 0.15 * (cr > 0.8 ? 1 : 0) };
    },
  });
}

// ---------- twisted cotton cord tassel ----------
export function cord(base = '#c9bc9e') {
  const b = C(base);
  return surface({
    w: 512, seed: 2, rough: 0.85, nStrength: 4, repeat: [2, 2],
    pixel: (u, v) => {
      const cords = 46, x = u * cords, i = Math.floor(x), f = x - i;
      const twist = (v * 60 + f * 1.2 + i * 0.37) % 1;
      const ply = 0.5 + 0.5 * Math.sin(twist * 6.283);
      const prof = Math.sin(Math.PI * f);
      const k = 0.65 + 0.35 * prof * (0.75 + 0.25 * ply);
      return { a: [b[0] * k, b[1] * k, b[2] * k], h: prof * (0.7 + 0.3 * ply), r: 0.85 };
    },
  });
}
