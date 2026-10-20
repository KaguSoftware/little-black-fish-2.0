// Body v2: one continuous torso loft, anatomical limb tubes, shaped hands and feet.
import * as THREE from 'three';
import { tube, loft, mesh } from './geo.js';
import { pbr, surface, fbm } from './pbr.js';
const V3 = THREE.Vector3;

export const J2 = {
  hip: [0.088, 0.94, 0], knee: [0.092, 0.5, 0.012], ankle: [0.094, 0.08, -0.005],
  shoulder: [0.17, 1.43, -0.005], elbow: [0.235, 1.15, -0.02], wrist: [0.27, 0.9, 0.01],
  neck: [0, 1.5, -0.01], head: [0, 1.68, 0],
};

export function skinSurface(base = '#c39673', o = {}) {
  const b = new THREE.Color(base), sh = new THREE.Color(o.shade ?? base).multiplyScalar(0.8);
  return surface({
    w: 512, seed: o.seed ?? 4, rough: 0.55, nStrength: 0.6, repeat: o.repeat ?? [5, 5],
    pixel: (u, v) => {
      const n = fbm(u, v, 8, 4, 3), pore = fbm(u, v, 96, 2, 9);
      const k = 0.92 + 0.12 * n;
      const c = [b.r * 255 * k, b.g * 255 * (k - 0.01 * (1 - n)), b.b * 255 * (k - 0.02 * n)];
      return { a: c, h: 0.5 + (pore - 0.5) * 0.5, r: 0.5 + 0.12 * pore };
    },
    ...o.surf,
  });
}

export function skinMat(base, o = {}) {
  if (o.map) {
    const s = skinSurface(base, o);
    return pbr({ surf: { ...s, map: o.map }, sheen: 0.12, sheenColor: '#ffd9c4', nScale: 0.5, name: o.name ?? 'Skin' });
  }
  return pbr({ surf: skinSurface(base, o), sheen: 0.12, sheenColor: '#ffd9c4', nScale: 0.5, name: o.name ?? 'Skin' });
}

const lerp = (a, b, t) => a + (b - a) * t;
function profile(keys) { // keys [[t, v]...] -> smooth fn
  return t => {
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      if (t <= t1) { const k = (t - t0) / (t1 - t0); const s = k * k * (3 - 2 * k); return lerp(v0, v1, s); }
    }
    return keys[keys.length - 1][1];
  };
}

export function human2(o = {}) {
  const g = new THREE.Group(); g.name = 'Body';
  const skin = o.mat ?? skinMat(o.skin ?? '#c39673', o);
  const trunk = o.trunkMat ?? skin, legM = o.legMat ?? skin, armM = o.armMat ?? skin;
  const fem = o.female ? 1 : 0, thin = o.thin ?? 0;
  const sp = o.spread ?? 0;
  const A = {};
  // ---- torso
  const rx = profile([[0, 0.05], [0.08, 0.128], [0.17, 0.158 + 0.012 * fem], [0.25, 0.145 + 0.006 * fem], [0.36, 0.128 - 0.006 * fem], [0.55, 0.14], [0.7, 0.152 - 0.008 * fem], [0.82, 0.166 - 0.014 * fem], [0.9, 0.15 - 0.012 * fem], [0.95, 0.1], [1, 0.062]]);
  const rz = profile([[0, 0.045], [0.08, 0.088], [0.17, 0.1 + 0.006 * fem], [0.3, 0.092], [0.5, 0.098], [0.7, 0.105 + 0.006 * fem], [0.85, 0.095], [0.95, 0.07], [1, 0.055]]);
  const y0 = 0.80, y1 = 1.52;
  const torso = loft(t => ({
    c: [0, lerp(y0, y1, t), lerp(0.005, -0.012, t)], rx: rx(t) * (1 - thin * 0.08), rz: rz(t) * (1 - thin * 0.06), p: 2.25,
    f: (a) => {
      const front = Math.max(0, Math.cos(a));
      let k = 1 - 0.06 * Math.max(0, -Math.cos(a)) ** 2; // flatter back
      // chest / bust
      const chest = Math.exp(-(((t - 0.72) / 0.07) ** 2));
      k += chest * front ** 2 * (0.05 + 0.1 * fem) * (Math.exp(-(((Math.abs(a) - 0.5) / 0.3) ** 2)));
      // shoulder blades
      k += Math.exp(-(((t - 0.8) / 0.08) ** 2)) * Math.max(0, -Math.cos(a)) * 0.03;
      return k;
    },
  }), { n: 44, r: 48 });
  g.add(mesh(torso, trunk, 'Torso'));
  // ---- neck
  g.add(mesh(tube([[0, 1.45, -0.012], [0, 1.53, -0.008], [0, 1.62, 0.008]], (t) => lerp(0.056, 0.046, t) * (1 - thin * 0.05), { n: 10, r: 20 }), skin, 'Neck'));
  // ---- head
  if (!o.noHead) {
    const hg = new THREE.SphereGeometry(1, 40, 28);
    const p = hg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const jaw = y < -0.2 ? 1 - 0.18 * (-(y + 0.2)) : 1;
      p.setXYZ(i, x * 0.088 * jaw, y * 0.122, z * 0.1 * (y < 0 && z > 0 ? 1 - 0.05 * -y : 1));
    }
    hg.computeVertexNormals();
    const h = mesh(hg, o.headMat ?? skin, 'Head'); h.position.set(0, 1.685, 0.002); g.add(h);
  }
  // ---- arms
  for (const s of [-1, 1]) {
    const S = new V3(J2.shoulder[0] * s, J2.shoulder[1], J2.shoulder[2]);
    const E = new V3((J2.elbow[0] + sp * 0.5) * s, J2.elbow[1], J2.elbow[2]);
    const W = new V3((J2.wrist[0] + sp) * s, J2.wrist[1], J2.wrist[2]);
    const r = profile([[0, 0.05], [0.12, 0.05], [0.3, 0.041], [0.47, 0.034], [0.58, 0.037], [0.75, 0.031], [1, 0.024]]);
    const arm = tube([S.clone().add(new V3(-0.012 * s, 0.012, 0)), S, S.clone().lerp(E, 0.5), E, E.clone().lerp(W, 0.5), W], (t, a) => r(t) * (1 - thin * 0.12) * (1 + 0.1 * Math.cos(a) ** 2 * (t > 0.5 ? -1 : 0.3)), { n: 40, r: 18, ref: [0, 0, 1] });
    g.add(mesh(arm, armM, 'Arm'));
    // deltoid cap
    const dl = new THREE.SphereGeometry(1, 20, 14); dl.scale(0.062 * (1 - thin * 0.1), 0.058, 0.06);
    const dm = mesh(dl, armM, 'Deltoid'); dm.position.set((J2.shoulder[0] + 0.004) * s, J2.shoulder[1] - 0.018, J2.shoulder[2]); g.add(dm);
    A['wrist' + (s > 0 ? 'L' : 'R')] = W.clone();
    if (!o.noHands) g.add(hand(W, E, s, o.handMat ?? skin, o));
  }
  // ---- legs
  for (const s of [-1, 1]) {
    const H = new V3(J2.hip[0] * s, J2.hip[1], J2.hip[2]), K = new V3(J2.knee[0] * s, J2.knee[1], J2.knee[2]), An = new V3(J2.ankle[0] * s, J2.ankle[1], J2.ankle[2]);
    const r = profile([[0, 0.05], [0.1, 0.082], [0.18, 0.084], [0.4, 0.068], [0.5, 0.05], [0.58, 0.054], [0.68, 0.056], [0.85, 0.04], [1, 0.033]]);
    const leg = tube([H.clone().add(new V3(-0.01 * s, 0.07, 0)), H, H.clone().lerp(K, 0.5), K, K.clone().lerp(An, 0.45), An], (t, a) => {
      let k = r(t) * (1 - thin * 0.12);
      // calf bulge at the back, knee cap at the front
      if (t > 0.5 && t < 0.85) k *= 1 + 0.12 * Math.max(0, -Math.cos(a)) * Math.sin(Math.PI * (t - 0.5) / 0.35);
      return k;
    }, { n: 44, r: 18, ref: [0, 0, 1] });
    g.add(mesh(leg, legM, 'Leg'));
    if (!o.noFeet) g.add(foot(An, s, o.footMat ?? legM));
  }
  g.userData.anchors = A;
  return g;
}

export function hand(W, E, s, m, o = {}) {
  const grp = new THREE.Group(); grp.name = 'Hand';
  const dir = W.clone().sub(E).normalize();               // forearm direction (down)
  const inward = new V3(-s, 0, 0);                         // palm faces the thigh
  const fwd = new V3().crossVectors(dir, inward).multiplyScalar(-s).normalize(); // thumb side (front)
  if (fwd.z < 0) fwd.negate();
  const base = W.clone().add(dir.clone().multiplyScalar(-0.008));
  // palm
  const palmLen = 0.088, pw = 0.04, pt = 0.016;
  const palm = tube([base, base.clone().add(dir.clone().multiplyScalar(palmLen * 0.55)), base.clone().add(dir.clone().multiplyScalar(palmLen))],
    (t, a) => { const ca = Math.cos(a), sa = Math.sin(a); const rw = pw * (0.85 + 0.15 * Math.sin(Math.PI * t * 0.9 + 0.3)), rt = pt * (1 - 0.2 * t); return 1 / Math.sqrt((ca / rw) ** 2 + (sa / rt) ** 2); },
    { n: 10, r: 16, ref: fwd.toArray() });
  grp.add(mesh(palm, m, 'Palm'));
  const curl = o.curl ?? 0.35;
  const lens = [0.072, 0.08, 0.076, 0.062];
  for (let f = 0; f < 4; f++) {
    const off = (f - 1.5) / 1.5 * pw * 0.78;
    const start = base.clone().add(dir.clone().multiplyScalar(palmLen * 0.96)).add(fwd.clone().multiplyScalar(off));
    const L = lens[f];
    const pts = [start]; let p = start.clone(), d = dir.clone();
    for (let k = 1; k <= 3; k++) {
      d.applyAxisAngle(fwd.clone(), curl * 0.5 * s); // curl toward the palm side
      d.add(inward.clone().multiplyScalar(curl * 0.15)).normalize();
      p = p.clone().add(d.clone().multiplyScalar(L / 3)); pts.push(p);
    }
    grp.add(mesh(tube(pts, t => 0.0092 * (1 - 0.25 * t) * (f === 3 ? 0.88 : 1), { n: 10, r: 10 }), m, 'Finger'));
  }
  // thumb
  const ts = base.clone().add(dir.clone().multiplyScalar(0.02)).add(fwd.clone().multiplyScalar(pw * 0.9)).add(inward.clone().multiplyScalar(0.006));
  const tp = [ts, ts.clone().add(dir.clone().multiplyScalar(0.03)).add(fwd.clone().multiplyScalar(0.012)).add(inward.clone().multiplyScalar(0.01)), ts.clone().add(dir.clone().multiplyScalar(0.06)).add(fwd.clone().multiplyScalar(0.012)).add(inward.clone().multiplyScalar(0.02))];
  grp.add(mesh(tube(tp, t => 0.011 * (1 - 0.25 * t), { n: 10, r: 10 }), m, 'Thumb'));
  return grp;
}

export function foot(An, s, m) {
  const x = An.x;
  const pts = [[x, 0.05, -0.05], [x, 0.055, 0.0], [x + 0.004 * s, 0.045, 0.07], [x + 0.008 * s, 0.03, 0.14], [x + 0.01 * s, 0.022, 0.175]];
  const rw = profile([[0, 0.032], [0.3, 0.036], [0.7, 0.045], [1, 0.03]]), rh = profile([[0, 0.045], [0.3, 0.05], [0.7, 0.028], [1, 0.016]]);
  const g = tube(pts, (t, a) => { const ca = Math.cos(a), sa = Math.sin(a); return 1 / Math.sqrt((ca / rh(t)) ** 2 + (sa / rw(t)) ** 2); }, { n: 20, r: 18, ref: [0, 1, 0] });
  // flatten the sole
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.006) p.setY(i, 0.006 + (p.getY(i) - 0.006) * 0.15);
  g.computeVertexNormals();
  const me = mesh(g, m, 'Foot');
  const grp = new THREE.Group(); grp.add(me);
  grp.add(mesh(tube([[x, 0.05, -0.02], [x, 0.09, -0.01], [x, 0.14, -0.005]], 0.034, { n: 6, r: 14 }), m, 'Ankle'));
  return grp;
}
