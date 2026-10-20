// Zahhak surfaces: black crushed velvet, dragon embroidery, cracked iridescent bronze mask,
// tarnished crown gold, dark bronze beads, black snake scales, twisted dark wood.
import * as THREE from 'three';
import { surface, fbm, ridged, vnoise, rng } from './pbr.js';

// hex -> sRGB 0..255 (canvas space). THREE.Color would convert to linear and darken/saturate the canvas.
const C = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// pre-encode a hex for helpers that run it through THREE.Color before painting a canvas (strandTex)
export const pre = (h) => { const [r, g, b] = C(h).map(v => v / 255); const e = x => x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; return '#' + [r, g, b].map(v => Math.round(e(v) * 255).toString(16).padStart(2, '0')).join(''); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// tileable voronoi: returns {f1, f2, id}
function hash(ix, iy, s) { let h = (ix * 374761393 + iy * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function voronoi(u, v, P, seed = 1) {
  const x = u * P, y = v * P, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, f2 = 9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j, mx = ((cx % P) + P) % P, my = ((cy % P) + P) % P;
    const px = cx + hash(mx, my, seed), py = cy + hash(mx, my, seed + 7);
    const d = Math.hypot(px - x, py - y);
    if (d < f1) { f2 = f1; f1 = d; id = hash(mx, my, seed + 13); } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}

const velvetPixel = (u, v, tint = 0) => {
  const w1 = fbm(u, v, 3, 3, 4);
  const cr = ridged(u + 0.15 * w1, v + 0.15 * fbm(u, v, 3, 3, 8), 5, 4, 2);
  const pile = fbm(u, v, 120, 2, 6);
  const k = 0.5 * cr + 0.3 * w1 + 0.2 * pile;
  const base = mix(C('#040405'), C('#141318'), clamp(k * 0.9));
  return { a: tint ? mix(base, C('#151a15'), 0.3) : base, h: k, r: 0.62 + 0.25 * (1 - cr) };
};

export function velvet(repeat = [3, 3]) {
  return surface({ w: 512, seed: 5, repeat, nStrength: 4, pixel: (u, v) => velvetPixel(u, v) });
}

// Dragon embroidery: one long serpentine dragon per sleeve, couched green and gold thread.
export function dragonSleeve() {
  const W = 1024, H = 1024;
  return surface({
    w: W, hgt: H, seed: 14, nStrength: 7,
    pixel: (u, v) => velvetPixel(u, v),
    paint: ({ a, h, r, m }, w, hh, rnd) => {
      let cx0 = 0.5;
      const path = s => [w * (cx0 + 0.13 * Math.sin(s * Math.PI * 2.6 + 0.4)), hh * (0.08 + 0.86 * s)];
      const thick = s => 150 * (1 - 0.6 * s) + 18;
      const greens = ['#4b5f36', '#5f7444', '#38492c', '#6f7f4a', '#55623a', '#7a7a44'], golds = ['#a8873c', '#c4a356', '#866628'];
      const fill = (ctx, col) => { ctx.fillStyle = col; ctx.strokeStyle = col; };
      for (const cxx of [0.27, 0.73]) { cx0 = cxx;
      // body scales from tail to neck (so head scales overlap)
      for (let s = 0.98; s >= 0.06; s -= 0.0016) {
        const [x, y] = path(s), [x2, y2] = path(s + 0.01);
        const ang = Math.atan2(y2 - y, x2 - x), th = thick(s);
        for (let k = 0; k < 5; k++) {
          const off = (rnd() - 0.5) * 2;                     // across the body -1..1
          const ox = -Math.sin(ang) * th * 0.45 * off, oy = Math.cos(ang) * th * 0.45 * off;
          const shade = 1 - Math.abs(off) * 0.45;
          const gold = Math.abs(off) < 0.18 && rnd() < 0.6;
          const base = gold ? C(golds[(rnd() * 3) | 0]) : C(greens[(rnd() * greens.length) | 0]);
          const c = base.map(v => Math.round(v * shade));
          const sw = th * (0.11 + 0.05 * rnd()), sh = sw * 0.8;
          a.fillStyle = `rgb(${c.join(',')})`; a.beginPath(); a.ellipse(x + ox, y + oy, sw, sh, ang, 0, Math.PI * 2); a.fill();
          a.strokeStyle = 'rgba(12,14,8,0.85)'; a.lineWidth = 1.6; a.beginPath(); a.ellipse(x + ox, y + oy, sw, sh, ang, -Math.PI * 0.4, Math.PI * 0.4); a.stroke();
          const gh = h.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, sw);
          const hv = Math.round(150 + 100 * shade);
          gh.addColorStop(0, `rgb(${hv},${hv},${hv})`); gh.addColorStop(1, 'rgb(110,110,110)'); h.fillStyle = gh;
          h.beginPath(); h.ellipse(x + ox, y + oy, sw, sh, ang, 0, Math.PI * 2); h.fill();
          r.fillStyle = gold ? 'rgb(95,95,95)' : 'rgb(135,135,135)'; r.beginPath(); r.ellipse(x + ox, y + oy, sw, sh, ang, 0, Math.PI * 2); r.fill();
          m.fillStyle = gold ? 'rgb(200,200,200)' : 'rgb(60,60,60)'; m.beginPath(); m.ellipse(x + ox, y + oy, sw, sh, ang, 0, Math.PI * 2); m.fill();
        }
      }
      // gold spine ridge + belly line
      for (const [off, col] of [[0, '#d7b55c']]) {
        a.strokeStyle = col; a.lineWidth = 4; h.strokeStyle = '#fff'; h.lineWidth = 4; m.strokeStyle = '#ddd'; m.lineWidth = 4; r.strokeStyle = 'rgb(80,80,80)'; r.lineWidth = 4;
        for (const ctx of [a, h, m, r]) { ctx.beginPath(); for (let s = 0.06; s <= 0.98; s += 0.01) { const [x, y] = path(s); s === 0.06 ? ctx.moveTo(x + off, y) : ctx.lineTo(x + off, y); } ctx.stroke(); }
      }
      // legs with claws
      for (const s of [0.25, 0.5, 0.72]) {
        const [x, y] = path(s); const side = Math.sin(s * 20) > 0 ? 1 : -1;
        for (const ctx of [a, h, m, r]) {
          ctx.lineCap = 'round';
          ctx.strokeStyle = ctx === a ? '#4f6640' : ctx === h ? '#ddd' : ctx === m ? '#333' : '#8c8c8c'; ctx.lineWidth = 12;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 70, y + 30); ctx.lineTo(x + side * 95, y + 10); ctx.stroke();
          ctx.strokeStyle = ctx === a ? '#d2ae55' : ctx === h ? '#fff' : ctx === m ? '#ccc' : '#666'; ctx.lineWidth = 4;
          for (let c = -1; c <= 1; c++) { ctx.beginPath(); ctx.moveTo(x + side * 95, y + 10); ctx.lineTo(x + side * (110 + 4 * c), y + 2 + 10 * c); ctx.stroke(); }
        }
      }
      // head at the top: snout, open jaws, horns, eye, mane, whiskers
      const [hx, hy] = path(0.04);
      const dir = -1;
      const blob = (x, y, rx, ry, rot, col, hv, met, ro) => {
        a.fillStyle = col; a.beginPath(); a.ellipse(x, y, rx, ry, rot, 0, 6.28); a.fill();
        h.fillStyle = `rgb(${hv},${hv},${hv})`; h.beginPath(); h.ellipse(x, y, rx, ry, rot, 0, 6.28); h.fill();
        m.fillStyle = `rgb(${met},${met},${met})`; m.beginPath(); m.ellipse(x, y, rx, ry, rot, 0, 6.28); m.fill();
        r.fillStyle = `rgb(${ro},${ro},${ro})`; r.beginPath(); r.ellipse(x, y, rx, ry, rot, 0, 6.28); r.fill();
      };
      blob(hx, hy + 20, 80, 55, 0.3, '#4c6340', 225, 40, 140);
      blob(hx + dir * 60, hy + 10, 45, 18, -0.2, '#5c7448', 230, 40, 140);   // upper jaw
      blob(hx + dir * 55, hy + 42, 40, 12, 0.35, '#43573a', 210, 40, 140);   // lower jaw
      blob(hx + dir * 50, hy + 26, 30, 7, 0.1, '#7a1e1a', 160, 0, 170);       // mouth
      blob(hx + dir * 10, hy + 5, 10, 8, 0, '#e8d27a', 255, 200, 70);         // eye
      for (const [dx, dy, l] of [[10, -20, 70], [30, -25, 60]]) {
        for (const ctx of [a, h, m, r]) { ctx.strokeStyle = ctx === a ? '#d9b55a' : ctx === h ? '#fff' : ctx === m ? '#ccc' : '#666'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(hx + dx, hy + dy); ctx.quadraticCurveTo(hx + dx + 30, hy + dy - l * 0.6, hx + dx + 50, hy + dy - l); ctx.stroke(); }
      }
      for (let k = 0; k < 14; k++) { // mane flames
        const ang = -0.5 + k * 0.18;
        for (const ctx of [a, h, m, r]) { ctx.strokeStyle = ctx === a ? (k % 2 ? '#b08c42' : '#66784a') : ctx === h ? '#eee' : ctx === m ? (k % 2 ? '#bbb' : '#333') : '#777'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(hx + 30, hy + 20 + k * 6); ctx.quadraticCurveTo(hx + 60 + Math.cos(ang) * 30, hy + k * 8, hx + 90 + Math.cos(ang) * 40, hy + 10 + k * 9); ctx.stroke(); }
      }
      }
      // gold cloud scrolls scattered on the velvet
      for (let i = 0; i < 22; i++) {
        const x = rnd() * w, y = rnd() * hh;
        cx0 = 0.27; const d1 = Math.abs(x - path(y / hh)[0]); cx0 = 0.73; if (Math.min(d1, Math.abs(x - path(y / hh)[0])) < 130) continue;
        for (const ctx of [a, h, m, r]) { ctx.strokeStyle = ctx === a ? '#a8873f' : ctx === h ? '#ddd' : ctx === m ? '#aaa' : '#777'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 10, 0, 4.5); ctx.arc(x + 18, y - 4, 8, 3, 7.5); ctx.stroke(); }
      }
    },
  });
}

// Cracked oily bronze: raised plates with dark cracks, colour shifting copper / bronze / green / purple
export function crackedMask(repeat = [1, 1]) {
  const cols = ['#4a2f27', '#3a2924', '#463d2c', '#30302a', '#432832', '#2c3329', '#5a3a2c', '#2f221f'].map(C);
  return surface({
    w: 1024, seed: 63, repeat, nStrength: 4,
    pixel: (u, v) => {
      // crusty flakes: warped small voronoi plates + ridged crust, with a few long dark fissures
      const wu = u + 0.035 * fbm(u, v, 5, 3, 3), wv = v + 0.035 * fbm(u, v, 5, 3, 4);
      const flake = voronoi(wu, wv, 16, 5), big = voronoi(u + 0.05 * fbm(u, v, 3, 2, 8), v, 6, 9);
      const fiss = clamp(1 - (big.f2 - big.f1) / 0.025) * clamp((fbm(u, v, 4, 2, 12) - 0.35) * 3);
      const edge = clamp(1 - (flake.f2 - flake.f1) / 0.18) ** 3;
      const crust = ridged(u, v, 40, 3, 7), lump = fbm(u, v, 18, 4, 2), grit = fbm(u, v, 200, 2, 8);
      const plateH = 0.45 + 0.08 * flake.id + 0.3 * crust + 0.15 * lump - 0.25 * edge;
      let col = cols[(flake.id * cols.length) | 0];
      col = mix(col, cols[(big.id * cols.length) | 0], 0.45);
      col = mix(col, [128, 82, 64], clamp((crust - 0.55) * 1.6) * 0.8);     // copper on the raised crust
      col = mix(col, [70, 52, 78], clamp((lump - 0.6) * 2) * 0.5);          // purple oily sheen areas
      col = mix(col, [52, 66, 48], clamp((0.4 - lump) * 2) * 0.4);          // green patina
      col = mix(col, [12, 9, 8], Math.max(edge * 0.7, fiss));
      const h = clamp(plateH * (1 - 0.6 * fiss) + 0.1 * grit);
      return { a: col, h, r: clamp(0.4 + 0.3 * (1 - crust) + 0.4 * fiss + 0.3 * edge), m: clamp(0.6 - 0.55 * fiss - 0.4 * edge) };
    },
  });
}

export function crownGold() {
  const g = C('#857a62'), dk = C('#2e2618'), lt = C('#b0a17e'), verd = C('#4f5b40');
  return surface({
    w: 512, seed: 22, nStrength: 3, repeat: [2, 1],
    pixel: (u, v) => {
      const streak = fbm(u * 0.3, v * 3, 10, 3, 4), pit = fbm(u, v, 60, 2, 5), dirt = fbm(u, v, 6, 3, 9);
      let col = mix(g, lt, clamp((streak - 0.5) * 2));
      col = mix(col, dk, clamp((dirt - 0.55) * 2.5));
      col = mix(col, verd, clamp((pit - 0.7) * 3) * 0.6);
      return { a: col, h: 0.5 + 0.3 * streak - 0.3 * clamp((pit - 0.6) * 3), r: clamp(0.3 + 0.35 * dirt), m: clamp(1 - 0.7 * clamp((dirt - 0.6) * 3)) };
    },
  });
}

export function darkBronze() {
  return surface({
    w: 256, seed: 23, nStrength: 3, repeat: [3, 2],
    pixel: (u, v) => {
      const n = fbm(u, v, 12, 4, 2), p = fbm(u, v, 50, 2, 3);
      return { a: mix(C('#2c2520'), C('#5e5242'), clamp(n * 1.2 - 0.1)), h: n * 0.7 + p * 0.3, r: 0.35 + 0.3 * (1 - n), m: 0.75 };
    },
  });
}

// Snake scales: overlapping rows, dark glossy, faint olive edge highlights
export function scales(repeat = [3, 40]) {
  return surface({
    w: 256, hgt: 256, seed: 30, repeat, nStrength: 5,
    pixel: (u, v) => {
      const rows = 8, cols = 6;
      const ry = v * rows, row = Math.floor(ry), off = (row % 2) * 0.5;
      const cx = u * cols + off, ci = Math.floor(cx);
      const fx = cx - ci - 0.5, fy = ry - row - 0.35;
      const d = Math.hypot(fx * 1.1, fy * 1.5);
      const dome = clamp(1 - d * 1.6);
      const edge = clamp((d - 0.45) * 6) * clamp((0.65 - d) * 6);
      const n = fbm(u, v, 8, 2, 4);
      const col = mix(C('#0c0d0e'), C('#25282a'), clamp(edge * 0.9 + n * 0.25));
      return { a: col, h: 0.3 + 0.6 * dome, r: 0.42 + 0.3 * edge, m: 0 };
    },
  });
}

export function wood(repeat = [1, 6]) {
  return surface({
    w: 256, hgt: 512, seed: 40, repeat, nStrength: 4,
    pixel: (u, v) => {
      const grain = 0.5 + 0.5 * Math.sin((u * 18 + 3 * fbm(u, v, 4, 3, 2)) * Math.PI * 2);
      const n = fbm(u, v, 30, 3, 5);
      const col = mix(C('#1e100a'), C('#5e3420'), clamp(0.2 + 0.5 * grain * n + 0.3 * n));
      return { a: col, h: 0.4 * grain + 0.6 * n, r: clamp(0.38 + 0.3 * (1 - n)), m: 0 };
    },
  });
}
