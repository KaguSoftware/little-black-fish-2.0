import * as THREE from 'three';
import { human2 } from '../body.js';
import { pbr, rng } from '../pbr.js';
import { tube, loft, ribbon, merge, mesh, curve } from '../geo.js';
import { hairMat, hairBaseMat, growHair, strandTex } from '../hair.js';
import * as TX from '../tex_eblis.js';
const pre = TX.pre;

export const frame = { ty: 0.92, dist: 5.4, fov: 24, size: [900, 1300] };
const V3 = THREE.Vector3;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const prof = keys => t => { for (let i = 0; i < keys.length - 1; i++) { const [t0, v0] = keys[i], [t1, v1] = keys[i + 1]; if (t <= t1) { const k = (t - t0) / (t1 - t0), s = k * k * (3 - 2 * k); return v0 + (v1 - v0) * s; } } return keys[keys.length - 1][1]; };

// loft whose angular range changes with t: a ring from open(t) to 2PI - open(t) (front opening at a = 0)
function loftOpen(ring, open, o = {}) {
  const N = o.n ?? 60, R = o.r ?? 120;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, q = ring(t), op = open(t);
    for (let j = 0; j <= R; j++) {
      const a = op + (Math.PI * 2 - 2 * op) * j / R;
      const f = q.f ? q.f(a, t) : 1;
      let x = q.c[0] + Math.sin(a) * q.rx * f, z = q.c[2] + Math.cos(a) * q.rz * f, y = q.c[1] + (q.dy ? q.dy(a, t) : 0);
      if (o.deform) [x, y, z] = o.deform(x, y, z, a, t);
      pos.push(x, y, z); uv.push(j / R * (o.uRep ?? 1), t * (o.vRep ?? 1));
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}


// glTF size: store opaque textures as JPEG (alpha-tested hair/fur keep PNG for their alpha)
function jpegTextures(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material;
    for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
      const t = m[k]; if (!t) continue;
      if (k === 'map' && m.alphaTest > 0) continue;
      t.userData.mimeType = 'image/jpeg';
    }
  });
  return root;
}

export function build() {
  const g = new THREE.Group(); g.name = 'Eblis';
  const r = rng(77);
  const headDark = pbr({ color: '#140808', rough: 0.6, name: 'UnderMask' });
  g.add(human2({ skin: '#b99882', spread: 0.02, noHands: true, headMat: headDark }));

  // ---------- chrome ovoid mask: egg with a pointed chin and a crease up the lower centre
  {
    const mg = new THREE.SphereGeometry(1, 96, 72);
    mg.rotateY(-Math.PI / 2);
    const p = mg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const low = Math.max(0, -y);
      const taper = 1 - 0.38 * low ** 1.6;              // narrows to a rounded point at the chin
      x *= 0.079 * taper; z *= 0.072 * (1 - 0.12 * low); y *= 0.138;
      if (y < 0) y *= 1 + 0.08 * low;
      // vertical crease: lower centre only, deepest just above the chin
      const front = Math.max(0, p.getZ(i));
      const crease = Math.exp(-((x / 0.0035) ** 2)) * sstep(0.02, -0.06, y) * sstep(-0.14, -0.1, y) * front;
      z -= crease * 0.0045;
      // faint central ridge on the upper half (two-halves look)
      z += Math.exp(-((x / 0.012) ** 2)) * sstep(-0.02, 0.06, y) * front * 0.0018;
      p.setXYZ(i, x, y, z);
    }
    mg.computeVertexNormals();
    const chrome = pbr({ color: '#a9b0b5', metal: 1, rough: 0.03, env: 1.0, side: THREE.FrontSide, name: 'ChromeMask', specular: 1 });
    const m = mesh(mg, chrome, 'Mask'); m.position.set(0, 1.7, 0.035); g.add(m);
  }

  // ---------- cloak (silver-sage lame), hood-like collar, narrow front opening, train
  const cRx = prof([[0, 0.46], [0.2, 0.42], [0.5, 0.36], [0.75, 0.32], [0.86, 0.295], [0.92, 0.26], [0.97, 0.18], [1, 0.11]]);
  const cRz = prof([[0, 0.38], [0.2, 0.33], [0.5, 0.27], [0.75, 0.22], [0.88, 0.19], [0.95, 0.15], [1, 0.1]]);
  const H = 1.58;
  const ph = Array.from({ length: 6 }, () => r() * 6.28);
  const folds = (a, t) => {
    const env = 0.022 + 0.1 * (1 - t) ** 1.1;
    return 1 + env * (Math.sin(13 * a + ph[0] + t * 1.5) * 0.55 + Math.sin(21 * a + ph[1] + t) * 0.3 + Math.sin(7 * a + ph[2] - t * 2) * 0.45 + Math.sin(33 * a + ph[3]) * 0.15 * (1 - t));
  };
  const cloakGeo = loftOpen(t => ({
    c: [0, t * H, -0.02 - 0.03 * (1 - t)], rx: cRx(t), rz: cRz(t),
    f: folds,
    dy: (a, tt) => { const back = Math.max(0, -Math.cos(a)); return tt > 0.88 ? 0.11 * back ** 1.4 * sstep(0.88, 1, tt) : 0; },
  }), t => prof([[0, 0.42], [0.25, 0.66], [0.5, 0.56], [0.75, 0.38], [0.88, 0.22], [0.95, 0.15], [1, 0.22]])(t) + 0.045 * Math.sin(t * 17 + 1) * (1 - t) + 0.025 * Math.sin(t * 37), {
    n: 70, r: 160, uRep: 5, vRep: 2.5,
    deform: (x, y, z, a, t) => {
      const back = Math.max(0, -Math.cos(a));
      // train: back hem pools behind on the floor
      z -= 0.55 * back ** 2 * sstep(0.32, 0, t) ** 1.3;
      x *= 1 + 0.12 * back * sstep(0.25, 0, t);
      if (y < 0.012) y = 0.006 + y * 0.1;
      // front edges roll inward over the robe (draped overlap) instead of a straight cut
      const fr = Math.max(0, Math.cos(a)) ** 6;
      x *= 1 - 0.1 * fr * (1 - t * 0.5);
      z += 0.02 * fr;
      return [x, y, z];
    },
  });
  const lameM = pbr({ surf: TX.lame([2, 2]), env: 1.2, name: 'Lame' });
  g.add(mesh(cloakGeo, lameM, 'Cloak'));

  // ---------- beige linen under-robe
  const linenM = pbr({ surf: TX.linen('#ab9e83', [6, 5]), sheen: 0.3, sheenColor: '#fff3dc', name: 'Linen' });
  g.add(mesh(loft(t => ({ c: [0, t * 1.57, 0.0], rx: prof([[0, 0.27], [0.5, 0.21], [0.8, 0.18], [0.95, 0.1], [1, 0.07]])(t), rz: prof([[0, 0.21], [0.5, 0.16], [0.8, 0.13], [0.95, 0.09], [1, 0.065]])(t),
    f: (a, tt) => 1 + (0.05 + 0.08 * (1 - tt) ** 1.5) * (Math.sin(14 * a + 1.2 + tt * 0.8) * 0.6 + Math.sin(23 * a + 2 - tt) * 0.3 + Math.sin(7 * a + 0.4) * 0.4) }), { n: 40, r: 160, uRep: 4, vRep: 4 }), linenM, 'Robe'));

  // ---------- wide hanging sleeves with bead panels, suede fringe and fur cuffs
  // suede fringe: alpha cards of many cut leather strips (reads as dense fringe, not planks)
  const fringeTex = strandTex({ base: pre('#7a6344'), light: pre('#a88f68'), dark: pre('#3f3120'), seed: 71, count: 62, wMin: 2, wVar: 7, tipMin: 0.3, spread: 0.94, alphaMin: 0.95, lightAmt: 0.8, frizz: 0.01, wave: 0.006, waveF: 2, nStrength: 3 });
  const suedeM = hairMat({ tex: fringeTex, rough: 0.85, aniso: 0.0, sheen: 0.35, sheenColor: '#e9d8b4', spec: 0.3, alphaTest: 0.5, nScale: 0.8, name: 'SuedeFringe' });
  const beadM = pbr({ surf: TX.beads(), clearcoat: 0.8, clearcoatRough: 0.05, env: 1.3, name: 'GlassBeads' });
  const furTex = strandTex({ base: pre('#d2cad8'), light: pre('#f4f1f6'), dark: pre('#7a7088'), seed: 61, tipMin: 0.2, wave: 0.03, waveF: 1.5, frizz: 0.025, count: 380, spread: 0.85, wMin: 0.7, wVar: 1.3, lightAmt: 1 });
  const furM = hairMat({ tex: furTex, rough: 0.85, aniso: 0.1, sheen: 0.12, sheenColor: '#ffffff', alphaTest: 0.33, nScale: 0.4, name: 'Fur', spec: 0.3 });
  const furCore = pbr({ color: '#8b8296', rough: 0.95, sheen: 0.6, sheenColor: '#e8e2ee', name: 'FurCore' });
  const fringeGeos = [], beadGeos = [], furGeos = [];
  for (const s of [-1, 1]) {
    const sx = t => s * (0.2 - 0.03 * t), sz = t => 0.05 + 0.06 * t; // t: 0 shoulder -> 1 bottom
    const yT = 1.47, yB = 0.34;
    const srx = prof([[0, 0.055], [0.12, 0.08], [0.3, 0.1], [0.7, 0.13], [1, 0.145]]), srz = prof([[0, 0.05], [0.12, 0.065], [0.3, 0.075], [0.7, 0.095], [1, 0.11]]);
    const sl = loft(tt => { const t = 1 - tt; return { c: [sx(t), yB + (yT - yB) * tt, sz(t)], rx: srx(t), rz: srz(t), f: (a) => 1 + 0.04 * t * Math.sin(7 * a + s) }; }, { n: 30, r: 48, uRep: 2, vRep: 3 });
    g.add(mesh(sl, linenM, 'Sleeve'));
    const onSleeve = (a, t, off = 0.004) => new V3(sx(t) + Math.sin(a) * (srx(t) + off), yT + (yB - yT) * t, sz(t) + Math.cos(a) * (srz(t) + off));
    // two bead panels on the front of each sleeve
    for (const a0 of [-0.45 * s, 0.32 * s]) {
      const pts = []; for (let k = 0; k <= 12; k++) { const t = 0.06 + 0.66 * k / 12; pts.push(onSleeve(a0, t, 0.006)); }
      beadGeos.push(ribbon(pts, 0.085, p => new V3(p.x - sx(0.5), 0, p.z - sz(0.5) + 0.02), { n: 24, bow: 0.3 }));
    }
    // fringe strips: down the outer side, along the panel edges, and a row below the beads
    const addStrip = (root, len, sway) => {
      const pts = []; const ph2 = r() * 6.28;
      for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new V3(root.x + Math.sin(t * 3 + ph2) * sway + root.x * 0.05 * t, root.y - len * t, root.z + 0.012 * t + Math.cos(t * 2 + ph2) * sway * 0.5)); }
      const w = 0.022 + r() * 0.04;
      fringeGeos.push(ribbon(pts, tt => w * (1 - 0.35 * tt), p => new V3(p.x - sx(0.5) * 0.6, 0, p.z - 0.02), { n: 10, twist: tt => (r() - 0.5) * 0.6 * tt, u0: r() * 0.4, u1: 0.6 + r() * 0.4, bow: 0.4 }));
    };
    for (let i = 0; i < 70; i++) { const t = 0.03 + r() * 0.6, a = s * (1.1 + r() * 1.3); addStrip(onSleeve(a, t, 0.008), 0.2 + r() * 0.45, 0.016); }
    for (let i = 0; i < 16; i++) { const t = 0.12 + r() * 0.5, a = (r() < 0.5 ? -0.75 : 0.0) * s + (r() - 0.5) * 0.15; addStrip(onSleeve(a, t, 0.01), 0.15 + r() * 0.3, 0.01); }
    for (let i = 0; i < 14; i++) { const a = (r() - 0.5) * 2.4; addStrip(onSleeve(a, 0.66, 0.012), 0.2 + r() * 0.35, 0.012); }
  }
  // fringe hanging from the cloak's front edges (inside the opening)
  {
    const open = t => prof([[0, 0.42], [0.25, 0.66], [0.5, 0.56], [0.75, 0.38], [0.88, 0.22], [0.95, 0.15], [1, 0.22]])(t) + 0.045 * Math.sin(t * 17 + 1) * (1 - t) + 0.025 * Math.sin(t * 37);
    for (let i = 0; i < 40; i++) {
      const s = r() < 0.5 ? -1 : 1, t = 0.45 + r() * 0.42, a = s * (open(t) + 0.05);
      const root = new V3(Math.sin(a) * cRx(t) * 0.88, t * H, -0.02 - 0.03 * (1 - t) + Math.cos(a) * cRz(t) * 0.94);
      const len = 0.2 + r() * 0.4, pts = [], ph2 = r() * 6.28;
      for (let k = 0; k <= 8; k++) { const q = k / 8; pts.push(new V3(root.x + Math.sin(q * 3 + ph2) * 0.012 - s * 0.01 * q, root.y - len * q, root.z + 0.01 * q)); }
      const w = 0.02 + r() * 0.035;
      fringeGeos.push(ribbon(pts, tt => w * (1 - 0.35 * tt), p => new V3(p.x * 0.3, 0, 1), { n: 10, u0: r() * 0.4, u1: 0.6 + r() * 0.4, bow: 0.4 }));
    }
  }
  // fur: three large irregular clumps at the lower front, biggest on the viewer's left
  for (const [cx, cy, cz, sc, seed] of [[-0.19, 0.44, 0.2, 1.15, 1], [0.04, 0.4, 0.22, 0.85, 2], [0.23, 0.5, 0.17, 0.65, 3]]) {
    const rr = rng(400 + seed);
    const lobes = []; for (let k = 0; k < 5; k++) lobes.push([cx + (rr() - 0.5) * 0.07 * sc, cy + (rr() - 0.5) * 0.36 * sc, cz + (rr() - 0.5) * 0.04, (0.05 + rr() * 0.04) * sc]);
    for (const [lx, ly, lz, lr] of lobes) { const c = new THREE.SphereGeometry(1, 16, 12); c.scale(lr * 0.8, lr * 1.5, lr * 0.6); c.translate(lx, ly, lz); g.add(mesh(c, furCore, 'FurCore')); }
    const n = Math.round(800 * sc);
    for (let i = 0; i < n; i++) {
      const L = lobes[(rr() * lobes.length) | 0];
      const th = Math.acos(1 - 2 * rr()), phi = rr() * 6.28;
      const d = new V3(Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi));
      if (d.z < -0.5) continue;
      const root = new V3(L[0] + d.x * L[3] * 0.6, L[1] + d.y * L[3] * 1.6, L[2] + d.z * L[3] * 0.4);
      const len = (0.08 + rr() * 0.14) * (0.8 + 0.3 * sc) * (d.y < -0.3 ? 1.25 : 1);
      const dir = new V3(d.x * 0.75 + (rr() - 0.5) * 0.45, d.y * 0.45 - 0.6, Math.max(0, d.z) * 0.8 + (rr() - 0.3) * 0.4).normalize();
      const pts = []; for (let k = 0; k <= 7; k++) { const t = k / 7; const p = root.clone().add(dir.clone().multiplyScalar(len * t)); p.y -= 0.25 * len * t * t; pts.push(p); }
      const w = 0.016 + rr() * 0.022;
      furGeos.push(ribbon(pts, tt => w * (1 - 0.5 * tt), p => new V3(p.x - cx, 0.15, p.z - cz + 0.05), { n: 7, u0: rr() * 0.5, u1: 0.5 + rr() * 0.5, bow: 0.4, twist: tt => (rr() - 0.5) * tt }));
    }
  }
  g.add(mesh(merge(beadGeos), beadM, 'BeadPanels'));
  g.add(mesh(merge(fringeGeos), suedeM, 'SuedeFringe'));
  g.add(mesh(merge(furGeos), furM, 'FurCuffs'));

  // ---------- very long dark mahogany hair: centre part, front lengths to the waist, back over the cloak
  const ho = { base: pre('#1a0b0b'), light: pre('#3e1d18'), dark: pre('#0a0404'), seed: 17, lightAmt: 0.5, tipMin: 0.85 };
  const hm = hairMat({ ...ho, rough: 0.38, aniso: 0.7, spec: 0.65, sheen: 0.1, nScale: 0.35 }), hb = hairBaseMat({ ...ho, rough: 0.45 });
  const hmBack = hairMat({ ...ho, light: pre('#5c2b22'), lightAmt: 0.9, seed: 19, tipMin: 0.45, count: 1300, rough: 0.4, aniso: 0.7, spec: 0.65, sheen: 0.1, nScale: 0.6 });
  const head = { c: [0, 1.695, -0.01], r: [0.09, 0.128, 0.104] };
  const cloakCol = { type: 'zcol', y0: 0.0, y1: 1.62, rx: y => cRx(Math.min(1, y / H)) * 1.15, rz: y => cRz(Math.min(1, y / H)) * 1.1 + 0.015, cz: y => -0.02 - 0.03 * (1 - Math.min(1, y / H)), pad: 0.0 };
  const maskCol = { c: [0, 1.7, 0.035], r: [0.079, 0.14, 0.072], pad: 0.08 };
  const hairO = {
    head, part: 'center', partSpan: 0.85, hairline: 0.42,
    departPolar: a => 1.45 + 0.3 * Math.abs(a) / Math.PI,
    colliders: [{ c: head.c, r: head.r, pad: 0.03 }, maskCol, cloakCol],
    side: a => Math.abs(a) < 1.65 ? 1 : -1,
    mat: hm, baseMat: hb, pad: 0.022,
  };
  // front curtains: hang beside the mask and straight down in front of the chest
  const frontCol = { type: 'zcol', y0: 0.0, y1: 1.62, rx: y => 0.3, rz: y => y > 1.45 ? 0.1 : 0.135, cz: 0, pad: 0 };
  const front = growHair({ ...hairO, colliders: [{ c: head.c, r: head.r, pad: 0.03 }, maskCol, frontCol], seed: 12, count: 300, azRange: [-1.25, 1.25], skip: a => Math.abs(a) < 0.6, side: () => 1, departPolar: a => 1.5,
    tipY: (a, rr) => 0.98 + rr() * 0.06 - 0.04 * (1 - Math.abs(a) / 1.65), width: 0.036, taper: 0.45, base: { count: 24, width: 0.04, shorter: 0.12 },
    lean: (a, t) => [-Math.sign(a) * 0.02 * t, 0] });
  g.add(front.cards); g.add(front.base);
  // back fall: strands converge toward the spine as they fall, centre strands longest -> tapered, ragged end at hip level
  const backCol = { type: 'zcol', y0: 0.0, y1: 1.72, rx: y => cRx(Math.min(1, y / H)) * 1.15, rz: y => y > 1.56 ? 0.135 : cRz(Math.min(1, y / H)) * 1.05 + 0.012, cz: y => -0.02 - 0.03 * (1 - Math.min(1, y / H)), pad: 0.0 };
  for (const [az0, az1, sd] of [[1.6, Math.PI, 13], [-Math.PI, -1.6, 14]]) {
    const back = growHair({ ...hairO, mat: hmBack, colliders: [{ c: head.c, r: head.r, pad: 0.03 }, backCol], seed: sd, count: 280, azRange: [az0, az1],
      tipY: (a, rr) => { const lat = Math.abs(Math.sin(a)); return 0.84 + 0.12 * lat + (rr() - 0.5) * 0.36; },
      lean: (a, t) => [Math.sin(a) * 0.075 * Math.sin(Math.PI * t * 0.8), 0],
      width: 0.026, flare: 0.0, taper: 0.4, padJit: 0.05, side: () => -1, base: { count: 8, width: 0.025, shorter: 0.3 } });
    g.add(back.cards); g.add(back.base);
  }
  {
    const sg = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.62); sg.scale(head.r[0] * 1.02, head.r[1] * 1.02, head.r[2] * 1.02);
    g.add(mesh(sg.translate(...head.c), hb, 'Scalp'));
  }
  return jpegTextures(g);
}
