// Keyumars textures: dark plum boucle knit with dense teal leopard rosettes; pale driftwood staff.
import * as THREE from 'three';
import { surface, fbm, ridged, vnoise, rng } from './pbr.js';

export function knitSurface(rep = [5, 6]) {
  const base = new THREE.Color('#4c1a30'), base2 = new THREE.Color('#3a1225');
  const W = 1024;
  // rosette centres (tileable jittered grid)
  const r = rng(71), spots = [];
  const cell = 64;
  for (let gy = 0; gy < W / cell; gy++) for (let gx = 0; gx < W / cell; gx++) {
    if (r() < 0.04) continue;
    spots.push({ x: (gx + 0.2 + r() * 0.6) * cell, y: (gy + 0.2 + r() * 0.6) * cell, rx: 23 + r() * 12, ry: 18 + r() * 10, rot: r() * 3.14, k: r() });
  }
  return surface({
    w: W, seed: 13, rough: 1, nStrength: 3.2, repeat: rep,
    pixel: (u, v, x, y) => {
      // boucle: nubby loops at two scales + faint knit rows
      const loops = ridged(u, v, 64, 2, 5), nub = fbm(u, v, 160, 2, 9), row = 0.5 + 0.5 * Math.sin(y * 0.55 + vnoise(u, v, 40, 3) * 6);
      const n = fbm(u, v, 6, 3, 21);
      const k = 0.8 + 0.35 * loops + 0.1 * nub;
      const c = base.clone().lerp(base2, n);
      return { a: [c.r * 255 * k, c.g * 255 * k, c.b * 255 * k], h: 0.3 + 0.45 * loops + 0.15 * nub + 0.08 * row, r: 0.92 + 0.08 * nub };
    },
    paint: (L, w, h) => {
      const rr = rng(5);
      // pink / magenta-red flecks filling the ground between rosettes
      for (let i = 0; i < 2600; i++) {
        const x = rr() * w, y = rr() * h, c = rr();
        L.a.fillStyle = c < 0.45 ? '#86244a' : c < 0.75 ? '#681a37' : c < 0.92 ? '#a2345e' : '#4e122a';
        L.a.globalAlpha = 0.85; L.a.beginPath(); L.a.ellipse(x, y, 3 + rr() * 6, 2 + rr() * 5, rr() * 3, 0, 6.28); L.a.fill();
      }
      L.a.globalAlpha = 1;
      for (const s of spots) for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
        const x = s.x + ox, y = s.y + oy;
        if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue;
        // dark broken rim
        L.a.save(); L.a.translate(x, y); L.a.rotate(s.rot);
        L.a.globalAlpha = 0.9; L.a.fillStyle = '#180a12';
        L.a.beginPath(); L.a.ellipse(0, 0, s.rx * 1.3, s.ry * 1.3, 0, 0, 6.28); L.a.fill();
        // teal / green centre, some lighter mint
        const cols = ['#25705f', '#1f6054', '#2f7f6c', '#1b544b'];
        L.a.fillStyle = cols[Math.floor(s.k * 4)]; L.a.globalAlpha = 0.95;
        L.a.beginPath();
        for (let i = 0; i <= 12; i++) { const a = i / 12 * 6.283, rad = 0.88 + 0.12 * Math.sin(a * 2 + s.k * 9) + 0.07 * Math.sin(a * 5 + s.k * 4); const px = Math.cos(a) * s.rx * rad, py = Math.sin(a) * s.ry * rad; i ? L.a.lineTo(px, py) : L.a.moveTo(px, py); }
        L.a.closePath(); L.a.fill();
        // break the rim with plum gaps so it reads as a rosette, not a dot
        L.a.fillStyle = rr() < 0.5 ? '#9c2a52' : '#7a1d3e'; L.a.globalAlpha = 0.95;
        for (let i = 0; i < 2; i++) { const a = rr() * 6.28; L.a.beginPath(); L.a.arc(Math.cos(a) * s.rx * 1.15, Math.sin(a) * s.ry * 1.15, 4 + rr() * 5, 0, 6.28); L.a.fill(); }
        // darker core speck in some rosettes
        if (s.k > 0.6) { L.a.fillStyle = '#1d4a44'; L.a.beginPath(); L.a.ellipse(0, 0, s.rx * 0.3, s.ry * 0.3, 0, 0, 6.28); L.a.fill(); }
        L.a.restore();
        // spots are slightly raised yarn
        L.h.save(); L.h.globalAlpha = 0.25; L.h.fillStyle = '#ffffff'; L.h.beginPath(); L.h.ellipse(x, y, s.rx, s.ry, s.rot, 0, 6.28); L.h.fill(); L.h.restore();
      }
      // re-apply boucle nubs over the spots so the yarn texture runs through them
      const id = L.a.getImageData(0, 0, w, h), d = id.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = x / w, v = y / h, k = 0.78 + 0.34 * ridged(u, v, 64, 2, 5);
        const i = (y * w + x) * 4; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k;
      }
      L.a.putImageData(id, 0, 0);
    },
  });
}

export function driftwoodSurface(rep = [1, 1]) {
  return surface({
    w: 256, hgt: 1024, seed: 33, rough: 0.82, nStrength: 4, repeat: rep,
    pixel: (u, v) => {
      // grain runs along v; cracks are ridged lines stretched along the staff
      const grain = fbm(u * 1, v * 0.08, 24, 4, 7), crack = ridged(u, v * 0.15, 10, 3, 9), knot = fbm(u, v, 3, 2, 4);
      const c = 0.62 + 0.25 * grain - 0.35 * Math.max(0, crack - 0.7) * 3 - 0.12 * Math.max(0, knot - 0.6) * 3;
      return { a: [160 * c, 142 * c, 118 * c], h: 0.5 + 0.3 * grain - 0.4 * Math.max(0, crack - 0.7) * 3, r: 0.78 + 0.15 * grain };
    },
  });
}
