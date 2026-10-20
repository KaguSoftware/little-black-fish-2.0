import * as THREE from 'three';
import { pbr, rng } from '../pbr.js';
import { tube, loft, ribbon, merge, mesh } from '../geo.js';
import { hairMat, hairBaseMat, growHair } from '../hair.js';
import { human2, J2, skinMat } from '../body.js';
import { skinMat2 } from './arnavaz.js';
import * as TS from '../tex_shahrnaz.js';
import { hammeredSilver } from '../tex_arnavaz.js';

export const frame = { ty: 0.9, dist: 5.3, fov: 24, size: [900, 1300] };
const V3 = THREE.Vector3;
const FS = THREE.FrontSide;

const prof = keys => t => {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) { const k = (t - t0) / (t1 - t0), s = k * k * (3 - 2 * k); return v0 + (v1 - v0) * s; }
  }
  return keys[keys.length - 1][1];
};
const folds = (seed, n, amp) => {
  const r = rng(seed), comps = [];
  for (let i = 0; i < 4; i++) comps.push({ k: Math.round(n * (0.6 + r() * 0.9)), ph: r() * 6.28, w: 0.4 + r() * 0.6, drift: (r() - 0.5) * 3 });
  return (a, t, env = 1) => { let s = 0; for (const c of comps) s += c.w * Math.sin(c.k * a + c.ph + c.drift * t); return amp * env * s / 2; };
};
const lerp3 = (a, b, t) => new V3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

export function build() {
  const g = new THREE.Group(); g.name = 'Shahrnaz';
  const SP = 0.02;

  // ---------------- materials ----------------
  const tweedM = pbr({ surf: TS.boucle({ repeat: [24, 12], flecks: 1.6, line: '#35302a' }), sheen: 0.5, sheenColor: '#6b6458', sheenRough: 0.6, name: 'BlackTweed' });
  const sleeveM = pbr({ surf: TS.boucle({ repeat: [8, 4], seed: 11, flecks: 0.25, line: '#1e1d1c' }), sheen: 0.55, sheenColor: '#4a4846', sheenRough: 0.55, name: 'SleeveTweed' });
  const darkWool = pbr({ surf: TS.boucle({ repeat: [24, 12], seed: 21, flecks: 0.2, line: '#191817' }), sheen: 0.4, sheenColor: '#3a3a3a', name: 'BlackWool' });
  const bodiceM = pbr({ surf: TS.boucle({ repeat: [10, 5], seed: 31, flecks: 0.2, line: '#191817' }), sheen: 0.4, sheenColor: '#3a3a3a', name: 'BlackBodice' });
  const bibM = pbr({ surf: TS.bib({}), sheen: 0.12, sheenColor: '#efe2c4', name: 'Bib' });
  const bibBackM = pbr({ surf: TS.bib({ seed: 9, meds: [[0.5, 0.3, 0.12], [0.5, 0.62, 0.12], [0.27, 0.46, 0.08], [0.73, 0.46, 0.08], [0.3, 0.78, 0.08], [0.7, 0.78, 0.08]] }), sheen: 0.12, sheenColor: '#efe2c4', name: 'BibBack' });
  const velvetRed = pbr({ color: '#3e0f12', rough: 0.85, sheen: 0.6, sheenColor: '#7a3036', sheenRough: 0.5, name: 'RedVelvet' });
  const bronzeM = pbr({ surf: TS.bronze({}), name: 'Bronze' });
  const medM = pbr({ surf: TS.medallionBronze(), name: 'BronzeMedallion' });
  const bronzePlain = pbr({ surf: hammeredSilver({ seed: 7 }), color: '#6e5c40', name: 'BronzeBead' });
  const leatherM = pbr({ surf: TS.leather(), clearcoat: 0.12, clearcoatRough: 0.45, env: 0.7, name: 'Leather' });
  const cordM = pbr({ surf: TS.cord(), sheen: 0.4, sheenColor: '#fff7e6', name: 'CottonTassel' });
  const maskM = pbr({ surf: TS.carvedMask({ a: 0.068, b: 0.132 }), side: FS, clearcoat: 0.1, clearcoatRough: 0.5, name: 'Mask' });

  const skinM = skinMat2('#7d5f48');
  g.add(upperBody(skinM, SP));
  for (const s of [-1, 1]) g.add(handR2(new V3((J2.wrist[0] + SP) * s, J2.wrist[1], J2.wrist[2]), new V3((J2.elbow[0] + SP * 0.5) * s, J2.elbow[1], J2.elbow[2]), s, skinM));

  // ---------------- mask: long narrow face, long nose ----------------
  const MC = [0, 1.668, 0.05], ma = 0.068, mb = 0.132, mc = 0.072;
  {
    const sg = new THREE.SphereGeometry(1, 96, 72);
    sg.rotateY(-Math.PI / 2);
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
      let x = ux * ma, y = uy * mb, z = uz * mc;
      if (y < 0) x *= 1 - 0.36 * (-y / mb) ** 1.5;
      if (y < -0.07) z *= 1 - 0.22 * ((-y - 0.07) / 0.07);
      if (uz > 0) {
        const fz = uz ** 1.5;
        const ny = y < 0.045 && y > -0.058 ? (0.045 - y) / 0.103 : 0;
        const nose = 0.036 * ny ** 0.8 * Math.exp(-((x / (0.009 + 0.007 * ny)) ** 2)) * (y > -0.052 ? 1 : Math.max(0, 1 - (-0.052 - y) / 0.008));
        let s = 0;
        for (const sx of [-1, 1]) s -= 0.01 * Math.exp(-(((x - 0.032 * sx) / 0.022) ** 2) - (((y - 0.02) / 0.013) ** 2));
        const brow = 0.005 * Math.exp(-(((y - 0.044) / 0.01) ** 2)) * Math.exp(-((x / 0.05) ** 4));
        const lips = 0.004 * Math.exp(-((x / 0.02) ** 2) - (((y + 0.083) / 0.007) ** 2));
        const cheek = 0.004 * Math.exp(-(((Math.abs(x) - 0.04) / 0.02) ** 2) - (((y + 0.01) / 0.02) ** 2));
        z += (nose + s + brow + lips + cheek) * fz;
      }
      p.setXYZ(i, x, y, z);
    }
    sg.computeVertexNormals();
    const m = mesh(sg, maskM, 'Mask'); m.position.set(...MC); g.add(m);
  }

  // ---------------- hair: centre part, sleek, down to the hips, behind the shoulders ----------------
  const ho = { base: '#0b0b0d', light: '#2c2c34', dark: '#000000', seed: 8, lightAmt: 0.5, sheen: 0.04 };
  const hm = hairMat({ ...ho, spec: 0.35, rough: 0.55 }), hb = hairBaseMat({ ...ho, spec: 0.35, rough: 0.55 });
  const head = { c: [0, 1.688, 0.0], r: [0.094, 0.136, 0.116] };
  const backCol = { type: 'zcol', y0: 0.7, y1: 1.5, rx: y => 0.26, rz: y => (y > 1.42 ? 0.1 : y > 1.1 ? 0.12 : 0.15), cz: -0.005, pad: 0.012 };
  const hair = growHair({
    head, part: 'center', count: 300, azRange: [-Math.PI, Math.PI], skip: a => Math.abs(a) < 1.1,
    departPolar: a => 1.45 + 0.4 * Math.abs(a) / Math.PI,
    tipY: (a, r) => (Math.abs(a) < 2.0 ? 1.15 : 0.92) + (r() - 0.5) * 0.03 - 0.1 * Math.max(0, Math.abs(a) - 2.0),
    side: a => -1,
    lean: (a, t) => [0, -0.03 * t * Math.min(1, Math.max(0, (2.2 - Math.abs(a)) / 0.8))],
    colliders: [{ c: head.c, r: head.r, pad: 0.04 }, { c: [0, 1.5, 0], r: [0.075, 0.08, 0.075], pad: 0.05 }, backCol, { c: MC, r: [ma, mb, mc], pad: 0.05 }],
    mat: hm, baseMat: hb, base: { count: 50, width: 0.07 }, width: 0.045, pad: 0.05, taper: 0.3,
  });
  g.add(hair.cards); g.add(hair.base);
  { const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), hb); cap.scale.set(0.094, 0.134, 0.1); cap.position.set(0, 1.688, -0.012); g.add(cap); }

  // ---------------- earrings: bronze ball, oval medallion, ball, long cotton tassel ----------------
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(0.108 * s, 1.64, 0.035); eg.rotation.x = -0.12; g.add(eg);
    eg.add(mesh(tube([[0, 0.012, 0], [0, -0.01, 0]], 0.0012, { n: 3, r: 6 }), bronzePlain));
    const ball = (y, r) => { const b = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), bronzePlain); b.scale.set(r, r, r); b.position.set(0, y, 0); eg.add(b); };
    ball(-0.018, 0.009);
    const plq = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 28), [bronzePlain, medM, medM]);
    plq.scale.set(0.012, 0.005, 0.018); plq.rotation.x = Math.PI / 2; plq.position.set(0, -0.045, 0); plq.rotation.order = 'XYZ'; eg.add(plq);
    ball(-0.074, 0.01);
    const tg = loft(t => ({ c: [0, -0.088 - t * 0.17, 0], rx: 0.005 + 0.013 * Math.min(1, t * 3) ** 0.7 + 0.004 * t, rz: 0.005 + 0.012 * Math.min(1, t * 3) ** 0.7 + 0.004 * t, f: (a) => 1 + 0.07 * Math.sin(a * 19 + t) + 0.04 * Math.sin(a * 37) }), { n: 20, r: 48 });
    { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.245) p.setY(i, p.getY(i) + 0.008 * Math.sin(i * 2.1)); tg.computeVertexNormals(); }
    eg.add(mesh(tg, cordM, 'Tassel'));
  }

  // ---------------- black sleeveless bodice ----------------
  // sleeveless bodice up to the neck: black over the torso, skin only on neck, shoulders and arms
  const brx = prof([[0, 0.142], [0.25, 0.148], [0.55, 0.158], [0.72, 0.156], [0.86, 0.13], [0.94, 0.095], [1, 0.064]]);
  const brz = prof([[0, 0.1], [0.25, 0.104], [0.55, 0.118], [0.72, 0.108], [0.86, 0.088], [0.94, 0.07], [1, 0.055]]);
  g.add(mesh(loft(t => ({ c: [0, 1.04 + t * 0.45, -0.01], rx: brx(t), rz: brz(t), p: 2.3 }), { n: 36, r: 72 }), bodiceM, 'Bodice'));
  g.add(mesh(tube(Array.from({ length: 41 }, (_, i) => { const a = i / 40 * Math.PI * 2; return [Math.sin(a) * 0.065, 1.488, Math.cos(a) * 0.056 - 0.01]; }), 0.004, { n: 80, r: 8, caps: false }), bodiceM, 'NeckBand'));

  // ---------------- quilted bib (front + back panels joined by shoulder straps) ----------------
  const panel = (sign, mat) => {
    const X0 = -0.172, X1 = 0.172, Y0 = 1.13, Y1 = 1.465, NX = 34, NY = 34;
    const pos = [], uv = [], idx = [];
    const zf = (x, y) => {
      const base = (sign > 0 ? 0.128 : 0.122) * Math.sqrt(Math.max(0.02, 1 - (x / 0.26) ** 2));
      const top = Math.max(0, (y - 1.36) / 0.105);
      return sign * (base * (1 - 0.75 * top ** 1.6) + 0.004) - 0.006;
    };
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NY, x = X0 + (X1 - X0) * u, y = Y0 + (Y1 - Y0) * v;
      pos.push(x * (1 - 0.05 * Math.max(0, (y - 1.4) / 0.065)), y, zf(x, y)); uv.push(sign > 0 ? u : 1 - u, v);
    }
    const neck = (u, v) => Math.abs(u - 0.5) < 0.22 && v > (sign > 0 ? 0.78 : 0.88);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const uc = (i + 0.5) / NX, vc = (j + 0.5) / NY; if (neck(uc, vc)) continue;
      const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1;
      sign > 0 ? idx.push(a, b, c, b, d, c) : idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    g.add(mesh(geo, mat, sign > 0 ? 'BibFront' : 'BibBack'));
    // velvet edge piping around the outline (gives the panel its thickness)
    const outl = [];
    const vN = sign > 0 ? 0.78 : 0.88;
    const P = (u, v) => { const x = X0 + (X1 - X0) * u, y = Y0 + (Y1 - Y0) * v; return [x * (1 - 0.05 * Math.max(0, (y - 1.4) / 0.065)), y, zf(x, y)]; };
    const path = [[0.28, 1], [0, 1], [0, 0], [1, 0], [1, 1], [0.72, 1], [0.72, vN], [0.28, vN], [0.28, 1]];
    for (let k = 0; k < path.length - 1; k++) for (let q = 0; q < 8; q++) { const t = q / 8; outl.push(P(path[k][0] + (path[k + 1][0] - path[k][0]) * t, path[k][1] + (path[k + 1][1] - path[k][1]) * t)); }
    outl.push(P(0.28, 1));
    g.add(mesh(tube(outl, 0.0045, { n: 300, r: 6, caps: false, tension: 0 }), velvetRed, 'BibPiping'));
  };
  panel(1, bibM); panel(-1, bibBackM);
  // shoulder straps over the top
  for (const s of [-1, 1]) {
    const pts = [[0.135 * s, 1.462, 0.035], [0.135 * s, 1.49, 0.0], [0.135 * s, 1.462, -0.035]];
    g.add(mesh(ribbon(pts, 0.072, p => new V3(0, 1, 0), { n: 8 }), bibM, 'Strap'));
  }

  // ---------------- antique bronze belt with medallion ----------------
  g.add(mesh(loft(t => ({ c: [0, 1.083 + t * 0.018, -0.008], rx: 0.1445, rz: 0.1025, p: 2.3 }), { n: 3, r: 96 }), pbr({ surf: TS.bronze({ bands: [[0, 0.3, 'rim'], [0.3, 0.7, 'diamond'], [0.7, 1, 'rim']], h: 64, w: 2048 }), name: 'BronzeBelt' }), 'Belt'));
  { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.035, 0.008, 40), [bronzePlain, medM, medM]); d.rotation.x = Math.PI / 2; d.position.set(0, 1.092, 0.098); g.add(d); }

  // ---------------- layered skirt with pointed handkerchief hems ----------------
  {
    const waist = 1.085;
    const R = prof([[0, 0.15], [0.1, 0.172], [0.35, 0.212], [0.7, 0.265], [1, 0.305]]);
    // under-skirt: plain black wool, nearly floor length, small points
    const fu = folds(301, 11, 0.14);
    const hemU = a => 0.075 + 0.025 * Math.abs(Math.sin(a * 3.5 + 0.4));
    g.add(mesh(loft(t => ({ c: [0, waist, -0.01], rx: R(t) * 1.0, rz: R(t) * 0.9, p: 2,
      f: (a) => 1 + fu(a, t * 2, Math.min(1, t * 3)),
      dy: (a) => -t * (waist - hemU(a)),
    }), { n: 40, r: 128 }), darkWool, 'UnderSkirt'));
    // outer tweed layer: open at the front, with uneven pointed points
    const fo = folds(302, 9, 0.2);
    const rr = rng(77);
    const pts = []; for (let i = 0; i < 7; i++) pts.push({ a: -Math.PI + (i + 0.3 + rr() * 0.4) / 7 * Math.PI * 2, d: 0.08 + rr() * 0.08 });
    const hemO = a => {
      // pointed tips at pts[], high scallops between
      let best = 0.32;
      for (const q of pts) { let da = Math.abs(((a - q.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI); best = Math.min(best, q.d + da * 0.36); }
      return best;
    };
    g.add(mesh(loft(t => ({ c: [0, waist + 0.005, -0.01], rx: R(t) * 1.06 + 0.006, rz: R(t) * 0.95 + 0.006, p: 2,
      f: (a) => { const d = fo(a, t * 2.2, Math.min(1, t * 2.5)); return 1 + (d > 0 ? d : d * 1.4); },
      dy: (a) => -t * (waist - hemO(a)),
    }), { n: 48, r: 160, a0: 0.32, aLen: Math.PI * 2 - 0.64 }), tweedM, 'OverSkirt'));
    // inner front panel layer: a second pointed tweed drape overlapping the front opening on one side
    const hemF = a => 0.12 + 0.3 * Math.abs(a - 0.1);
    g.add(mesh(loft(t => ({ c: [0, waist + 0.002, -0.008], rx: R(t) * 1.03 + 0.003, rz: R(t) * 0.93 + 0.003, p: 2,
      f: (a) => 1 + fo(a + 1.3, t * 2, Math.min(1, t * 2.5)) * 0.8,
      dy: (a) => -t * (waist - hemF(a)),
    }), { n: 40, r: 64, a0: -0.55, aLen: 0.75 }), tweedM, 'FrontDrape'));
  }

  // ---------------- detached puff sleeves + bronze cuffs ----------------
  for (const s of [-1, 1]) {
    const S = new V3(J2.shoulder[0] * s, J2.shoulder[1], J2.shoulder[2]);
    const E = new V3((J2.elbow[0] + SP * 0.5) * s, J2.elbow[1], J2.elbow[2]);
    const W = new V3((J2.wrist[0] + SP) * s, J2.wrist[1], J2.wrist[2]);
    const top = lerp3(S, E, 0.6), bot = lerp3(E, W, 0.42);
    const mid = lerp3(top, bot, 0.55).add(new V3(0.04 * s, -0.01, 0.0));
    const R = prof([[0, 0.042], [0.06, 0.06], [0.25, 0.09], [0.55, 0.112], [0.75, 0.112], [0.9, 0.075], [1, 0.042]]);
    const fl = folds(400 + s, 5, 0.08), gat = folds(410 + s, 20, 0.14);
    g.add(mesh(tube([top, lerp3(top, mid, 0.5).add(new V3(0.012 * s, 0, 0)), mid, lerp3(mid, bot, 0.6).add(new V3(0.01 * s, 0, 0)), bot], (t, a) => {
      const env = Math.sin(Math.PI * t);
      const ga = t < 0.12 ? 1 - t / 0.12 : t > 0.86 ? (t - 0.86) / 0.14 : 0;
      const sag = 1 + 0.06 * Math.max(0, t - 0.4) * (1 + Math.cos(a - (s > 0 ? Math.PI / 2 : -Math.PI / 2)));
      return R(t) * sag * (1 + fl(a, t * 3, env) + gat(a, t, ga));
    }, { n: 48, r: 48, ref: [0, 0, 1] }), sleeveM, 'PuffSleeve'));
    // tall engraved cuff over the forearm
    const c0 = lerp3(E, W, 0.4), c1 = lerp3(E, W, 0.88);
    const cd = c1.clone().sub(c0), L = cd.length();
    const cuff = new THREE.Group(); cuff.position.copy(c0); cuff.quaternion.setFromUnitVectors(new V3(0, 1, 0), cd.normalize());
    cuff.add(mesh(loft(t => ({ c: [0, t * L, 0], rx: 0.04 + 0.004 * (1 - t), rz: 0.036 + 0.004 * (1 - t) }), { n: 12, r: 48 }), bronzeM, 'Cuff'));
    for (const tt of [0.02, 0.36, 0.64, 0.98]) { const tor = new THREE.Mesh(new THREE.TorusGeometry(0.0435 - 0.004 * tt, 0.0028, 8, 40), bronzePlain); tor.rotation.x = Math.PI / 2; tor.scale.set(1, 0.9, 1); tor.position.y = tt * L; cuff.add(tor); }
    g.add(cuff);
  }

  // ---------------- black leather ankle boots with block heel ----------------
  for (const s of [-1, 1]) {
    const bx = 0.095 * s;
    g.add(mesh(loft(t => ({ c: [bx, 0.04 + t * 0.14, -0.006], rx: 0.048 + 0.006 * t, rz: 0.054 + 0.004 * t, p: 2.2, f: a => 1 + 0.02 * Math.sin(a * 5 + t * 8) * t }), { n: 10, r: 40 }), leatherM, 'BootShaft'));
    const fx = prof([[0, 0.045], [0.3, 0.05], [0.65, 0.052], [0.9, 0.042], [1, 0.024]]);
    const fh = prof([[0, 0.055], [0.3, 0.058], [0.6, 0.042], [0.9, 0.03], [1, 0.016]]);
    const fg = tube([[bx, 0.065, -0.06], [bx, 0.06, -0.02], [bx + 0.004 * s, 0.045, 0.06], [bx + 0.008 * s, 0.035, 0.14], [bx + 0.01 * s, 0.03, 0.175]],
      (t, a) => { const ca = Math.cos(a), sa = Math.sin(a); return 1 / Math.sqrt((ca / fh(t)) ** 2 + (sa / fx(t)) ** 2); }, { n: 24, r: 28, ref: [0, 1, 0] });
    { const p = fg.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); const floor = z < 0 ? 0.03 : 0.012; if (p.getY(i) < floor) p.setY(i, floor + (p.getY(i) - floor) * 0.1); } fg.computeVertexNormals(); }
    g.add(mesh(fg, leatherM, 'BootFoot'));
    // block heel + sole
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.06), leatherM); heel.position.set(bx, 0.015, -0.055); g.add(heel);
    g.add(mesh(loft(t => ({ c: [bx + 0.005 * s, 0.01 + t * 0.006, 0.075], rx: 0.05, rz: 0.1, p: 2.3 }), { n: 2, r: 40 }), leatherM, 'Sole'));
  }
  jpegTextures(g);
  return g;
}

// export opaque textures as JPEG inside the GLB (keeps files small); alpha-tested hair stays PNG
function jpegTextures(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      const keepPng = m.alphaTest > 0;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
        const t = m[k]; if (!t) continue;
        if (keepPng && k === 'map') continue;
        t.userData.mimeType = 'image/jpeg';
      }
    }
  });
}

// smooth slim shoulders: one tube from the neck base over the shoulder down to the wrist (no boxy joints)
function upperBody(skinM, SP) {
  const grp = new THREE.Group(); grp.name = 'Body';
  grp.add(mesh(tube([[0, 1.44, -0.014], [0, 1.53, -0.01], [0, 1.61, 0.004]], t => 0.048 - 0.006 * t, { n: 12, r: 24 }), skinM, 'Neck'));
  for (const s of [-1, 1]) {
    const pts = [[0.03 * s, 1.498, -0.014], [0.09 * s, 1.478, -0.014], [0.142 * s, 1.452, -0.012], [0.172 * s, 1.41, -0.01],
      [0.19 * s, 1.34, -0.014], [0.205 * s, 1.25, -0.018], [(J2.elbow[0] + SP * 0.5) * s, J2.elbow[1], J2.elbow[2]],
      [(0.255 + SP * 0.75) * s, 1.03, -0.005], [(J2.wrist[0] + SP) * s, J2.wrist[1], J2.wrist[2]]];
    const R = prof([[0, 0.028], [0.1, 0.034], [0.2, 0.04], [0.27, 0.04], [0.4, 0.035], [0.55, 0.03], [0.62, 0.029], [0.7, 0.032], [0.86, 0.026], [1, 0.021]]);
    grp.add(mesh(tube(pts, (t, a) => R(t) * (1 + (t > 0.6 ? -0.08 : 0.04) * Math.cos(a) ** 2), { n: 72, r: 24, ref: [0, 0, 1] }), skinM, 'Arm'));
  }
  return grp;
}

// relaxed hand: fingers together and softly curled toward the palm, thumb resting in front
function handR2(W, E, s, m) {
  const grp = new THREE.Group(); grp.name = 'Hand';
  const dir = W.clone().sub(E).normalize();
  const inward = new V3(-s, 0, 0); inward.sub(dir.clone().multiplyScalar(inward.dot(dir))).normalize();
  const fwd = new V3().crossVectors(inward, dir).normalize(); if (fwd.z < 0) fwd.negate();
  const base = W.clone().add(dir.clone().multiplyScalar(-0.006));
  const palmL = 0.09, pw = 0.037, pt = 0.0155;
  grp.add(mesh(tube([base, base.clone().add(dir.clone().multiplyScalar(palmL * 0.5)).add(inward.clone().multiplyScalar(0.002)), base.clone().add(dir.clone().multiplyScalar(palmL))],
    (t, a) => { const ca = Math.cos(a), sa = Math.sin(a); const rw = pw * (0.8 + 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.15))), rt = pt * (1.05 - 0.2 * t); return 1 / Math.sqrt((ca / rw) ** 2 + (sa / rt) ** 2); },
    { n: 12, r: 20, ref: fwd.toArray() }), m, 'Palm'));
  const lens = [0.072, 0.08, 0.075, 0.06], curls = [0.42, 0.5, 0.56, 0.62];
  for (let f = 0; f < 4; f++) {
    const off = (f - 1.5) / 1.5 * pw * 0.62;
    let p = base.clone().add(dir.clone().multiplyScalar(palmL * (0.97 - (f === 0 || f === 3 ? 0.03 : 0)))).add(fwd.clone().multiplyScalar(-off));
    const pts = [p.clone()], segL = [0.44, 0.32, 0.24];
    for (let k = 0; k < 3; k++) {
      const th = curls[f] * (k + 1) * 0.5;
      const d = dir.clone().multiplyScalar(Math.cos(th)).add(inward.clone().multiplyScalar(Math.sin(th))).add(fwd.clone().multiplyScalar(-off * 0.4)).normalize();
      p = p.clone().add(d.multiplyScalar(lens[f] * segL[k])); pts.push(p.clone());
    }
    grp.add(mesh(tube(pts, t => (f === 3 ? 0.0074 : 0.0084) * (1 - 0.2 * t), { n: 12, r: 12 }), m, 'Finger'));
  }
  const ts = base.clone().add(dir.clone().multiplyScalar(0.02)).add(fwd.clone().multiplyScalar(pw * 0.8)).add(inward.clone().multiplyScalar(0.007));
  const tp = [ts, ts.clone().add(dir.clone().multiplyScalar(0.03)).add(fwd.clone().multiplyScalar(0.008)).add(inward.clone().multiplyScalar(0.01)), ts.clone().add(dir.clone().multiplyScalar(0.055)).add(fwd.clone().multiplyScalar(0.004)).add(inward.clone().multiplyScalar(0.018))];
  grp.add(mesh(tube(tp, t => 0.0098 * (1 - 0.22 * t), { n: 10, r: 12 }), m, 'Thumb'));
  return grp;
}
