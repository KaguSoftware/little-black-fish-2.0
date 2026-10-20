// Jamshid's horse textures: matted lavender-white fur, wrinkled warty pale skin, worn red velvet
// saddle blanket with gold thread embroidery, ridged horn.
import * as THREE from 'three';
import { surface, fbm, ridged, rng } from './pbr.js';
import { strandTex } from './hair.js';

// tileable cellular (Worley) noise: returns [f1, f2] distances in cell units
export function cellular(u, v, period, seed = 1) {
  const x = u * period, y = v * period, ix = Math.floor(x), iy = Math.floor(y);
  let f1 = 9, f2 = 9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = ix + dx, cy = iy + dy;
    const mx = ((cx % period) + period) % period, my = ((cy % period) + period) % period;
    let h = (mx * 374761393 + my * 668265263 + seed * 1442695041) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0;
    const rx = ((h >>> 0) % 1000) / 1000, ry = (((h >>> 10) >>> 0) % 1000) / 1000;
    const d = Math.hypot(cx + rx - x, cy + ry - y);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2];
}

const FUR = { base: '#b9bac6', light: '#e3e4ea', dark: '#787a8e' };

export function furBodySurface(rep = [4, 4]) {
  const b = new THREE.Color(FUR.base);
  return surface({
    w: 512, seed: 3, rough: 0.95, nStrength: 3, repeat: rep,
    pixel: (u, v, x, y) => {
      // stringy matted fur running "down" the texture, clumps darker in the gaps
      const strand = fbm(u * 1, v, 64, 3, 5), clump = ridged(u, v, 8, 3, 9), n = fbm(u, v, 4, 3, 2);
      const k = 0.6 + 0.4 * clump + 0.12 * (strand - 0.5) + 0.06 * n;
      return { a: [b.r * 255 * k * 0.96, b.g * 255 * k * 0.98, b.b * 255 * Math.min(1.04, k * 1.04)], h: 0.3 + 0.5 * clump + 0.2 * strand, r: 0.92 };
    },
  });
}

// alpha strand texture for matted locks (clumped strands, wavy, soft tips)
export function lockTex(seed = 4) {
  return strandTex({ base: FUR.base, light: FUR.light, dark: FUR.dark, seed, count: 1400, wMin: 2.2, wVar: 4, tipMin: 0.45, wave: 0.03, waveF: 1.5, frizz: 0.015, spread: 0.86, lightAmt: 0.7, nStrength: 2.2, alphaMin: 0.85 });
}

export function skinSurface(rep = [2, 2], o = {}) {
  // pale pinkish-ivory skin: fine wrinkle network (two scales of creases), soft mottling, sparse warts
  const base = new THREE.Color(o.base ?? '#ddd4cc'), pink = new THREE.Color('#d4aba5'), crease = new THREE.Color('#a8988f');
  return surface({
    w: 1024, seed: o.seed ?? 12, rough: 0.66, nStrength: 3.2, repeat: rep,
    pixel: (u, v) => {
      const w1 = ridged(u, v, 20, 2, 3), w2 = ridged(u, v, 52, 2, 11), big = ridged(u, v, 5, 2, 21);
      const cr = Math.max(0, w1 - 0.72) * 3.5 * 0.7 + Math.max(0, w2 - 0.78) * 4.5 * 0.45 + Math.max(0, big - 0.8) * 5 * 0.6;
      const n = fbm(u, v, 5, 3, 4), pk = Math.max(0, fbm(u, v, 3, 2, 8) - 0.45) * 1.8;
      const c = base.clone().lerp(pink, Math.min(1, pk * 0.28 + (o.pinkAll ?? 0))).lerp(crease, Math.min(0.7, cr));
      const k = 0.94 + 0.06 * n;
      return { a: [c.r * 255 * k, c.g * 255 * k, c.b * 255 * k], h: 0.62 - 0.45 * Math.min(1, cr) + 0.05 * n, r: 0.6 + 0.15 * Math.min(1, cr) };
    },
    paint: (L, w, h, r) => {
      for (let i = 0; i < (o.warts ?? 34); i++) {
        const x = r() * w, y = r() * h, rad = 4 + r() * 10;
        const gr = L.h.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(160,160,160,0)');
        L.h.fillStyle = gr; L.h.beginPath(); L.h.arc(x, y, rad, 0, 6.28); L.h.fill();
        L.a.fillStyle = r() < 0.5 ? 'rgba(200,150,140,0.5)' : 'rgba(236,226,214,0.5)'; L.a.beginPath(); L.a.arc(x, y, rad * 0.7, 0, 6.28); L.a.fill();
      }
    },
  });
}

export function hornSurface() {
  return surface({
    w: 256, hgt: 512, seed: 41, rough: 0.6, nStrength: 4,
    pixel: (u, v) => {
      const ring = 0.5 + 0.5 * Math.sin(v * 90 + fbm(u, v, 8, 2, 3) * 4), n = fbm(u, v, 16, 3, 5);
      const k = 0.78 + 0.12 * ring + 0.1 * n - 0.2 * v;
      return { a: [185 * k, 174 * k, 160 * k], h: 0.4 + 0.4 * ring + 0.1 * n, r: 0.55 + 0.15 * n };
    },
  });
}

// worn dark-red velvet saddle blanket with couched gold thread scrolls, threadbare patches, gold border
export function rugSurface() {
  const red = new THREE.Color('#5e111b'), red2 = new THREE.Color('#3e0a12');
  return surface({
    w: 1024, seed: 90, rough: 0.85, nStrength: 2.5,
    pixel: (u, v, x, y) => {
      const pile = fbm(u, v, 160, 2, 3), crush = fbm(u, v, 6, 3, 8), wear = fbm(u, v, 5, 4, 19);
      const worn = Math.max(0, wear - 0.56) * 3.2; // threadbare: lighter, flatter, shows weave
      const weave = ((x >> 1) + (y >> 1)) % 2 ? 1 : 0;
      const c = red.clone().lerp(red2, crush * 0.8);
      const wcol = new THREE.Color('#9c5a4e');
      c.lerp(wcol, Math.min(0.8, worn * (0.6 + 0.4 * weave)));
      const k = 0.85 + 0.25 * pile;
      return { a: [c.r * 255 * k, c.g * 255 * k, c.b * 255 * k], h: 0.55 + 0.25 * pile - 0.3 * Math.min(1, worn) + 0.1 * weave * Math.min(1, worn), r: 0.82 + 0.12 * pile };
    },
    paint: (L, w, h, r) => {
      const gold = (ctx, lw, col) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; };
      const thread = (path, lw) => {
        // couched gold thread: albedo gold, metallic, raised, mid rough; broken where worn
        for (const [ctx, col, k] of [[L.a, '#a88845', 1], [L.m, '#d8d8d8', 1], [L.h, '#e8e8e8', 1], [L.r, '#7a7a7a', 1]]) {
          ctx.save(); gold(ctx, lw * k, col); ctx.setLineDash([lw * 3 + r() * lw * 6, lw * (0.5 + r())]); ctx.beginPath(); path(ctx); ctx.stroke(); ctx.restore();
        }
        L.a.save(); gold(L.a, lw * 0.35, '#f0d890'); L.a.globalAlpha = 0.5; L.a.beginPath(); path(L.a); L.a.stroke(); L.a.restore();
      };
      // double border bands
      for (const m of [22, 40, 58]) thread(ctx => ctx.rect(m, m, w - 2 * m, h - 2 * m), m === 40 ? 6 : 3);
      // border running scroll
      for (let i = 0; i < 4; i++) {
        const horiz = i < 2, pos = i % 2 ? (horiz ? h - 40 : w - 40) : 40;
        thread(ctx => { for (let k = 0; k < 40; k++) { const t = k / 40, a = 70 + t * (w - 140); const s = Math.sin(t * 60) * 9; horiz ? (k ? ctx.lineTo(a, pos + s) : ctx.moveTo(a, pos + s)) : (k ? ctx.lineTo(pos + s, a) : ctx.moveTo(pos + s, a)); } }, 2.2);
      }
      // field: big scrolling vines with leaves and palmettes
      for (let i = 0; i < 95; i++) {
        const x = 80 + r() * (w - 160), y = 80 + r() * (h - 160), sc = 18 + r() * 34, rot = r() * 6.28;
        thread(ctx => { ctx.moveTo(x, y); ctx.bezierCurveTo(x + Math.cos(rot) * sc, y + Math.sin(rot) * sc, x + Math.cos(rot + 1.5) * sc * 1.4, y + Math.sin(rot + 1.5) * sc * 1.4, x + Math.cos(rot + 2.4) * sc * 1.8, y + Math.sin(rot + 2.4) * sc * 1.8); }, 3.5);
        for (let k = 0; k < 4; k++) {
          const a = rot + k * 1.3, lx = x + Math.cos(a) * sc * 0.8, ly = y + Math.sin(a) * sc * 0.8;
          thread(ctx => { ctx.ellipse(lx, ly, 6 + r() * 6, 14 + r() * 8, a, 0, 6.28); }, 2.2);
        }
        thread(ctx => { const s = 10 + r() * 10; for (let k = 0; k <= 8; k++) { const a = k / 8 * 6.283, rr = s * (k % 2 ? 0.5 : 1); k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + rr, y); } ctx.closePath(); }, 2.5);
      }
      // threadbare holes / scuffs: knock the pile and gold down
      for (let i = 0; i < 34; i++) {
        const x = r() * w, y = r() * h, rad = 10 + r() * 46;
        L.a.save(); L.a.globalAlpha = 0.35; L.a.fillStyle = '#8f5a4a'; L.a.beginPath(); L.a.ellipse(x, y, rad, rad * (0.4 + r() * 0.6), r() * 3, 0, 6.28); L.a.fill(); L.a.restore();
        L.m.save(); L.m.globalAlpha = 0.6; L.m.fillStyle = '#000'; L.m.beginPath(); L.m.ellipse(x, y, rad * 0.7, rad * 0.4, r() * 3, 0, 6.28); L.m.fill(); L.m.restore();
      }
      // frayed fringe at the bottom edge rows
      for (let i = 0; i < 400; i++) { const x = r() * w; L.a.strokeStyle = r() < 0.5 ? '#5a0f18' : '#a8814a'; L.a.lineWidth = 1.5; L.a.beginPath(); L.a.moveTo(x, h - 14); L.a.lineTo(x + (r() - 0.5) * 6, h); L.a.stroke(); }
    },
  });
}
