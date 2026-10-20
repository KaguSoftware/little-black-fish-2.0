// Eblis surfaces: crinkled silver-sage lame, crinkled beige linen, cobalt glass bead panels
// with gold beads and sequins, tan suede fringe, soft white fur.
import * as THREE from 'three';
import { surface, fbm, ridged, vnoise, rng } from './pbr.js';

// hex -> sRGB 0..255 (canvas space). THREE.Color would convert to linear and darken/saturate the canvas.
const C = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
// pre-encode a hex for helpers that run it through THREE.Color before painting a canvas (strandTex)
export const pre = (h) => { const [r, g, b] = C(h).map(v => v / 255); const e = x => x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; return '#' + [r, g, b].map(v => Math.round(e(v) * 255).toString(16).padStart(2, '0')).join(''); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// Lame: metallic film over crinkled cloth. Creases mostly run along the drape (vertical).
export function lame(repeat = [3, 3]) {
  const hi = C('#c4cdcd'), mid = C('#848f91'), lo = C('#434b4e'), warm = C('#a9a594');
  return surface({
    w: 1024, seed: 31, repeat, nStrength: 5,
    pixel: (u, v) => {
      // anisotropic warp: stretch along v so crinkles read as long vertical creases
      const wx = u + 0.02 * fbm(u, v, 4, 3, 7), wy = v * 0.22 + 0.03 * fbm(u, v, 3, 3, 9);
      const cr = ridged(wx, wy, 16, 4, 3);              // long crease lines along the drape
      const fine = ridged(u, v * 0.5, 48, 2, 11);         // fine crinkle
      const big = fbm(u, v * 0.4, 3, 3, 5);
      const h = 0.15 * big + 0.6 * cr + 0.25 * fine;
      const spark = vnoise(u, v, 300, 13) > 0.93 ? 1 : 0;
      let col = mix(lo, mid, clamp(0.1 + h * 1.2));
      col = mix(col, hi, clamp((cr - 0.55) * 2.2));
      col = mix(col, warm, 0.25 * fbm(u, v, 5, 2, 19));
      if (spark) col = mix(col, [255, 255, 250], 0.5);
      return { a: col, h, r: clamp(0.22 + 0.25 * (1 - cr) + 0.08 * (1 - big) - spark * 0.12), m: 0.9 };
    },
  });
}

// Crinkled, slubby beige linen
export function linen(base = '#c2b499', repeat = [4, 4], seed = 3) {
  const b = C(base), dk = mix(b, [70, 55, 35], 0.35), lt = mix(b, [255, 250, 235], 0.3);
  return surface({
    w: 512, seed, repeat, nStrength: 3,
    pixel: (u, v, x, y) => {
      const weave = 0.5 + 0.25 * Math.sin(x * 1.6 + 2 * fbm(u, v, 30, 1, 2)) * Math.sin(y * 1.6);
      const slub = fbm(u * 0.15, v, 64, 2, seed + 4);
      const cr = ridged(u + 0.05 * fbm(u, v, 3, 2, seed), v * 0.6, 6, 4, seed + 9);
      const h = 0.25 * weave + 0.25 * slub + 0.5 * cr;
      let col = mix(dk, b, clamp(0.65 + 0.5 * h));
      col = mix(col, lt, clamp((slub - 0.6) * 2));
      return { a: col, h, r: 0.9 + 0.08 * slub };
    },
  });
}

// Bead panel: columns of cobalt glass beads, gold bead edges, scattered gold sequins.
export function beads() {
  const W = 256, H = 1024;
  return surface({
    w: W, hgt: H, seed: 41, base: '#060a26', rough: 0.7, metal: 0, nStrength: 6,
    paint: ({ a, h, r, m }, w, hh, rnd) => {
      const cols = 7, bw = w / (cols + 1.4);
      const bead = (x, y, rad, col, metal, rough) => {
        const g = a.createRadialGradient(x - rad * 0.35, y - rad * 0.35, rad * 0.1, x, y, rad);
        g.addColorStop(0, col[0]); g.addColorStop(0.55, col[1]); g.addColorStop(1, col[2]);
        a.fillStyle = g; a.beginPath(); a.arc(x, y, rad, 0, 6.28); a.fill();
        const gh = h.createRadialGradient(x, y, 0, x, y, rad);
        gh.addColorStop(0, '#fff'); gh.addColorStop(0.7, '#bbb'); gh.addColorStop(1, '#555');
        h.fillStyle = gh; h.beginPath(); h.arc(x, y, rad, 0, 6.28); h.fill();
        r.fillStyle = `rgb(${rough * 255 | 0},${rough * 255 | 0},${rough * 255 | 0})`; r.beginPath(); r.arc(x, y, rad, 0, 6.28); r.fill();
        m.fillStyle = `rgb(${metal * 255 | 0},${metal * 255 | 0},${metal * 255 | 0})`; m.beginPath(); m.arc(x, y, rad, 0, 6.28); m.fill();
      };
      const blue = ['#6f8cff', '#1e36b0', '#070f48'], blue2 = ['#7b95f0', '#2843bd', '#0a1458'], gold = ['#fff0b0', '#c99a3a', '#5a3d10'];
      for (let c = 0; c < cols; c++) {
        const x0 = bw * 0.7 + c * bw + bw * 0.5;
        const rad = bw * 0.42;
        for (let y = rad; y < hh; y += rad * 1.9) bead(x0 + (rnd() - 0.5) * 2, y + (c % 2) * rad * 0.9, rad * (0.9 + rnd() * 0.15), rnd() < 0.5 ? blue : blue2, 0, 0.08);
      }
      // gold seed-bead edging columns
      for (const x0 of [bw * 0.35, w - bw * 0.35]) for (let y = 4; y < hh; y += 9) bead(x0 + (rnd() - 0.5) * 3, y, 4.5, gold, 1, 0.3);
      // sequins: small flat gold / silver discs sitting on the beads
      for (let i = 0; i < 70; i++) {
        const x = rnd() * w, y = rnd() * hh, rr = 5 + rnd() * 5, sil = rnd() < 0.3;
        a.fillStyle = sil ? '#e6e6dc' : '#d8b25a'; a.beginPath(); a.arc(x, y, rr, 0, 6.28); a.fill();
        a.fillStyle = '#3a2a10'; a.beginPath(); a.arc(x, y, 1.4, 0, 6.28); a.fill();
        h.fillStyle = '#e8e8e8'; h.beginPath(); h.arc(x, y, rr, 0, 6.28); h.fill();
        r.fillStyle = 'rgb(50,50,50)'; r.beginPath(); r.arc(x, y, rr, 0, 6.28); r.fill();
        m.fillStyle = '#fff'; m.beginPath(); m.arc(x, y, rr, 0, 6.28); m.fill();
      }
    },
  });
}

// Suede strips: tan, napped, a little darker at the edges
export function suede() {
  const b = C('#8a7352'), dk = C('#4a3b28'), lt = C('#b29b76');
  return surface({
    w: 256, seed: 7, nStrength: 2,
    pixel: (u, v) => {
      const n = fbm(u, v, 16, 4, 3), streak = fbm(u * 8, v * 0.3, 8, 2, 5);
      const edge = Math.min(u, 1 - u) < 0.12 ? 0.25 : 0;
      let col = mix(dk, b, clamp(0.5 + n * 0.7 - edge));
      col = mix(col, lt, clamp((streak - 0.6) * 1.5));
      return { a: col, h: 0.5 * n + 0.5 * streak, r: 0.88 };
    },
  });
}
