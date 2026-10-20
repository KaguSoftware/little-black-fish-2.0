import * as THREE from 'three';
import { pbr, fbm, rng, surface } from '../pbr.js';
import { tube, loft, ribbon, merge, mesh, displace } from '../geo.js';
import { hairMat, hairBaseMat, growHair, fringe } from '../hair.js';
import { human2, J2, skinMat } from '../body.js';
import * as TX from '../tex_arnavaz.js';

export const frame = { ty: 0.9, dist: 5.3, fov: 24, size: [900, 1300] };
const V3 = THREE.Vector3;
const FS = THREE.FrontSide;

// smooth key profile
const prof = keys => t => {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) { const k = (t - t0) / (t1 - t0), s = k * k * (3 - 2 * k); return v0 + (v1 - v0) * s; }
  }
  return keys[keys.length - 1][1];
};
// irregular soft folds around a ring: a = angle, t = along; returns relative radial offset
const folds = (seed, n, amp) => {
  const r = rng(seed), comps = [];
  for (let i = 0; i < 4; i++) comps.push({ k: Math.round(n * (0.6 + r() * 0.9)), ph: r() * 6.28, w: 0.4 + r() * 0.6, drift: (r() - 0.5) * 3 });
  return (a, t, env = 1) => {
    let s = 0;
    for (const c of comps) s += c.w * Math.sin(c.k * a + c.ph + c.drift * t);
    return amp * env * s / 2;
  };
};

export function build() {
  const g = new THREE.Group(); g.name = 'Arnavaz';
  const SP = 0.03;
  

  // ---------------- materials ----------------
  const linenS = TX.linen({ repeat: [3, 3] });
  const linen = pbr({ surf: linenS, sheen: 0.2, sheenColor: '#f0e6cf', sheenRough: 0.7, nScale: 1.0, name: 'Linen' });
  const linenFine = pbr({ surf: linenS, sheen: 0.2, sheenColor: '#f0e6cf', sheenRough: 0.7, name: 'LinenCollar' });
  const vestM = pbr({ surf: TX.felt({ flowerR: 0.08, sprigs: 70, buds: 30, golds: ['#8a6a30', '#6f5226', '#a07f42', '#5a4220', '#7d5e2c', '#a8894e'] }), sheen: 0.25, sheenColor: '#7d8fa0', sheenRough: 0.8, nScale: 1.0, name: 'FeltVest' });
  const beltM = pbr({ surf: TX.engravedSilver({}), name: 'SilverBelt' });
  const bootS = TX.embossedSilver({});
  bootS.map.repeat.set(2, 1); bootS.normalMap.repeat.set(2, 1); bootS.ormMap.repeat.set(2, 1);
  const bootM = pbr({ surf: bootS, nScale: 1.2, name: 'SilverBoot' });
  const bootFootS = { map: bootS.map.clone(), normalMap: bootS.normalMap.clone(), ormMap: bootS.ormMap.clone() };
  bootFootS.ormMap = bootFootS.ormMap; for (const t of [bootFootS.map, bootFootS.normalMap, bootFootS.ormMap]) t.repeat.set(2, 2);
  const bootFootM = pbr({ surf: bootFootS, nScale: 1.2, name: 'SilverBootFoot' });
  const ribM = pbr({ surf: TX.ribbedSilver({}), name: 'SilverBand' });
  const cuffM = pbr({ surf: TX.cuffSilver(), name: 'SilverCuff' });
  const hamM = pbr({ surf: TX.hammeredSilver({}), name: 'Silver' });
  const goldBead = pbr({ surf: TX.hammeredSilver({ seed: 3 }), color: '#ece2c8', name: 'ChampagneBead' });
  const tassM = pbr({ surf: TX.tasselSurf('#d9cba7'), sheen: 0.8, sheenColor: '#fff6e0', sheenRough: 0.35, name: 'SilkTassel' });
  const maskM = pbr({ surf: TX.maskSurf({ a: 0.079, b: 0.134 }), side: FS, clearcoat: 0.15, clearcoatRough: 0.5, name: 'Mask' });

  const skinM = skinMat2('#946a4e');
  g.add(human2({ mat: skinM, female: false, thin: 0.6, spread: SP, armMat: linen, trunkMat: linen, legMat: linen, noFeet: true, noHands: true }));
  for (const s of [-1, 1]) g.add(handR(new V3((J2.wrist[0] + SP) * s, J2.wrist[1], J2.wrist[2]), new V3((J2.elbow[0] + SP * 0.5) * s, J2.elbow[1], J2.elbow[2]), s, skinM));

  // ---------------- mask (sculpted gesso face) ----------------
  const MC = [0, 1.672, 0.05], ma = 0.079, mb = 0.134, mc = 0.074;
  {
    const sg = new THREE.SphereGeometry(1, 96, 72);
    sg.rotateY(-Math.PI / 2);
    const p = sg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const ux = p.getX(i), uy = p.getY(i), uz = p.getZ(i);
      let x = ux * ma, y = uy * mb, z = uz * mc;
      // narrower, pointed chin; flatter cheek planes
      if (y < 0) x *= 1 - 0.32 * (-y / mb) ** 1.6;
      if (y < -0.07) z *= 1 - 0.25 * ((-y - 0.07) / 0.064);
      if (uz > 0) {
        const fz = uz ** 1.5;
        // nose: ridge from brow to tip, rounded tip
        const ny = y < 0.04 && y > -0.052 ? (0.04 - y) / 0.092 : 0;
        const nose = 0.034 * ny ** 0.85 * Math.exp(-((x / (0.0105 + 0.007 * ny)) ** 2)) * (y > -0.046 ? 1 : Math.max(0, 1 - (-0.046 - y) / 0.008));
        // eye sockets and brow
        let s = 0;
        for (const sx of [-1, 1]) s -= 0.009 * Math.exp(-(((x - 0.033 * sx) / 0.021) ** 2) - (((y - 0.024) / 0.013) ** 2));
        const brow = 0.004 * Math.exp(-(((y - 0.046) / 0.01) ** 2)) * Math.exp(-((x / 0.05) ** 4));
        // lips
        const lips = 0.005 * Math.exp(-((x / 0.022) ** 2) - (((y + 0.078) / 0.007) ** 2)) - 0.002 * Math.exp(-((x / 0.02) ** 2) - (((y + 0.07) / 0.004) ** 2));
        const chin = 0.004 * Math.exp(-((x / 0.02) ** 2) - (((y + 0.11) / 0.012) ** 2));
        z += (nose + s + brow + lips + chin) * fz;
      }
      p.setXYZ(i, x, y, z);
    }
    sg.computeVertexNormals();
    const m = mesh(sg, maskM, 'Mask'); m.position.set(...MC); g.add(m);
  }

  // ---------------- hair ----------------
  const ho = { base: '#0c0c0f', light: '#30303a', dark: '#000000', seed: 5, lightAmt: 0.55, sheen: 0.05 };
  const hm = hairMat({ ...ho, spec: 0.4, rough: 0.52 }), hb = hairBaseMat({ ...ho, spec: 0.4, rough: 0.52 });
  const head = { c: [0, 1.685, -0.008], r: [0.094, 0.132, 0.108] };
  const torsoCol = { type: 'zcol', y0: 0.8, y1: 1.5, rx: y => 0.25, rz: y => (y > 1.42 ? 0.1 : 0.125), cz: -0.005, pad: 0.012 };
  const neckCol = { c: [0, 1.5, 0.0], r: [0.075, 0.08, 0.075], pad: 0.05 };
  const hair = growHair({
    head, part: 'center', count: 260, azRange: [-Math.PI, Math.PI], skip: a => Math.abs(a) < 0.78,
    departPolar: a => 1.5 + 0.35 * Math.abs(a) / Math.PI,
    tipY: (a, r) => (Math.abs(a) < 1.75 ? 1.425 : 1.31) + (r() - 0.5) * 0.012,
    side: a => (Math.abs(a) < 1.75 ? 1 : -1),
    colliders: [{ c: head.c, r: head.r, pad: 0.04 }, neckCol, torsoCol, { c: MC, r: [ma, mb, mc], pad: 0.06 }],
    mat: hm, baseMat: hb, base: { count: 44, width: 0.07 }, width: 0.045, pad: 0.045, taper: 0.25,
  });
  g.add(hair.cards); g.add(hair.base);
  g.add(fringe({ head: { c: [0, 1.685, 0.012], r: [0.095, 0.132, 0.12] }, azRange: [-0.95, 0.95], cutY: 1.722, count: 64, rootPolar: 0.3, lift: 0.1, width: 0.032, pad: 0.06, mat: hairMat({ ...ho, blunt: true, seed: 9 }) }));
  // scalp cap
  { const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), hb); cap.scale.set(head.r[0] * 1.02, head.r[1] * 1.02, head.r[2] * 1.02); cap.position.set(...head.c); g.add(cap); }

  // ---------------- earrings ----------------
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(0, 1.655, 0.03); eg.rotation.x = -0.28; g.add(eg);
    const g0 = g; { const g = eg;
    const x = 0.108 * s, z = 0.0, Y = y => y - 1.655;
    g.add(mesh(tube([[x, Y(1.655), z], [x, Y(1.625), z]], 0.0012, { n: 4, r: 6 }), hamM));
    for (const [y, r] of [[1.612, 0.006], [1.592, 0.0135], [1.566, 0.006], [1.545, 0.0165]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), goldBead); b.scale.set(r, r * 1.15, r); b.position.set(x, Y(y), z); g.add(b);
    }
    // tassel: fine silk cord bundle
    const tg = loft(t => ({ c: [x, Y(1.525 - t * 0.175), z], rx: 0.007 + 0.015 * Math.min(1, t * 4) ** 0.6 + 0.004 * t, rz: 0.007 + 0.015 * Math.min(1, t * 4) ** 0.6 + 0.004 * t, f: (a) => 1 + 0.06 * Math.sin(a * 23 + t * 2) + 0.04 * Math.sin(a * 41) }), { n: 20, r: 48, vRep: 1 });
    // ragged bottom
    { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < Y(1.36)) p.setY(i, p.getY(i) + 0.006 * Math.sin(i * 1.7)); tg.computeVertexNormals(); }
    g.add(mesh(tg, tassM, 'Tassel'));
    const capT = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), tassM); capT.scale.set(0.008, 0.012, 0.008); capT.position.set(x, Y(1.527), z); g.add(capT);
  } }

  // ---------------- turtleneck (rolled, scrunched linen) ----------------
  {
    const fl = folds(31, 7, 0.06);
    const tn = loft(t => ({ c: [0, 1.43 + t * 0.15, 0.0], rx: 0.066 - 0.008 * t, rz: 0.064 - 0.006 * t,
      f: (a) => 1 + 0.07 * Math.sin(t * Math.PI * 4.5 + Math.sin(a * 2) * 0.8) ** 2 + fl(a, t) }), { n: 30, r: 48, vRep: 1 });
    g.add(mesh(tn, linenFine, 'Turtleneck'));
  }
  // linen shirt body under the vest (shoulders)
  g.add(mesh(loft(t => ({ c: [0, 1.36 + t * 0.12, -0.005], rx: 0.17 - 0.09 * t ** 1.5, rz: 0.108 - 0.04 * t, p: 2.3 })), linen, 'Shirt'));

  // ---------------- felt vest ----------------
  const vrx = prof([[0, 0.182], [0.12, 0.174], [0.3, 0.158], [0.42, 0.156], [0.6, 0.168], [0.8, 0.176], [0.92, 0.168], [1, 0.088]]);
  const vrz = prof([[0, 0.135], [0.3, 0.112], [0.6, 0.118], [0.85, 0.112], [1, 0.07]]);
  const vfl = folds(12, 3, 0.012);
  const vest = loft(t => ({
    c: [0, 0.985 + t * 0.49, -0.005], rx: vrx(t), rz: vrz(t), p: 2.4,
    f: (a) => 1 + vfl(a, t, t < 0.35 ? 1 : 0.3),
    dy: (a) => t === 1 ? 0 : 0,
  }), { n: 48, r: 96, a0: -Math.PI, aLen: Math.PI * 2 });
  g.add(mesh(vest, vestM, 'Vest'));
  // vest hem edge roll
  g.add(mesh(tube(Array.from({ length: 49 }, (_, i) => { const a = i / 48 * Math.PI * 2; return [Math.sin(a) * 0.183, 0.987, Math.cos(a) * 0.136 - 0.005]; }), 0.005, { n: 96, r: 8, caps: false }), vestM));

  // ---------------- silver belt ----------------
  {
    const bt = loft(t => ({ c: [0, 1.152 + t * 0.048, -0.005], rx: 0.1615 + 0.001 * Math.sin(Math.PI * t), rz: 0.1185 + 0.001 * Math.sin(Math.PI * t), p: 2.4 }), { n: 6, r: 96, a0: -Math.PI, aLen: Math.PI * 2 });
    g.add(mesh(bt, beltM, 'Belt'));
  }

  // ---------------- balloon sleeves ----------------
  for (const s of [-1, 1]) {
    const S = new V3(0.185 * s, 1.43, -0.005), E = new V3((J2.elbow[0] + SP * 0.5 + 0.02) * s, 1.15, -0.02), W = new V3((J2.wrist[0] + SP) * s, 0.905, 0.01);
    const pts = [S, S.clone().lerp(E, 0.5).add(new V3(0.015 * s, 0, 0)), E.clone().add(new V3(0.02 * s, 0, 0)), E.clone().lerp(W, 0.55).add(new V3(0.025 * s, 0, 0)), W];
    const R = prof([[0, 0.07], [0.12, 0.074], [0.16, 0.07], [0.32, 0.088], [0.55, 0.112], [0.74, 0.126], [0.84, 0.122], [0.92, 0.088], [0.97, 0.055], [1, 0.046]]);
    const fl = folds(40 + s, 5, 0.09), gather = folds(50 + s, 22, 0.08);
    const sl = tube(pts, (t, a) => {
      // droop: bottom of the balloon sags outward/down (a measured from ref normal = +z)
      const sag = 1 + 0.08 * Math.max(0, t - 0.5) * (1 + Math.cos(a - (s > 0 ? Math.PI / 2 : -Math.PI / 2)));
      const env = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.15) / 0.8)));
      const gat = (t > 0.88 ? (t - 0.88) / 0.12 : 0) + (t < 0.2 && t > 0.08 ? 1 - Math.abs(t - 0.14) / 0.06 : 0);
      return R(t) * sag * (1 + fl(a, t * 3, env) + gather(a, t, gat));
    }, { n: 64, r: 56, ref: [0, 0, 1], caps: false });
    g.add(mesh(sl, linen, 'Sleeve'));
    // frilled gathered band at the shoulder: a row of small puffs
    const frillPts = []; const N = 40;
    const cv = sl.userData.curve, c0 = cv.getPointAt(0.14), tan = cv.getTangentAt(0.14);
    const nrm = new V3(0, 0, 1).sub(tan.clone().multiplyScalar(tan.z)).normalize(), bin = new V3().crossVectors(tan, nrm);
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; const rr = R(0.14) * 1.04; frillPts.push(c0.clone().add(nrm.clone().multiplyScalar(Math.cos(a) * rr)).add(bin.clone().multiplyScalar(Math.sin(a) * rr))); }
    const fr = tube(frillPts, (t, a) => 0.006 + 0.004 * Math.abs(Math.sin(t * Math.PI * 20)), { n: 160, r: 10, caps: false, tension: 0.5 });
    g.add(mesh(fr, linen, 'Frill'));
    const fr2Pts = frillPts.map(p => p.clone().add(tan.clone().multiplyScalar(-0.018)));
    g.add(mesh(tube(fr2Pts, (t) => 0.004 + 0.003 * Math.abs(Math.sin(t * Math.PI * 26 + 1)), { n: 160, r: 8, caps: false }), linen, 'Frill2'));

    // ---------------- silver cuff stack with bells ----------------
    const wd = W.clone().sub(E).normalize();
    const cuffC = W.clone().add(wd.clone().multiplyScalar(0.004));
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), wd.clone().negate());
    const cuff = new THREE.Group(); cuff.position.copy(cuffC); cuff.quaternion.copy(q);
    cuff.add(mesh(loft(t => ({ c: [0, -0.02 + t * 0.055, 0], rx: 0.05 + 0.003 * Math.sin(Math.PI * t), rz: 0.046 + 0.003 * Math.sin(Math.PI * t) }), { n: 8, r: 48 }), cuffM, 'Cuff'));
    cuff.add(mesh(loft(t => ({ c: [0, -0.047 + t * 0.024, 0], rx: 0.047, rz: 0.043 }), { n: 4, r: 48 }), hamM, 'Cuff2'));
    for (const y of [-0.021, 0.035, 0.042]) { const tor = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0035, 8, 40), hamM); tor.rotation.x = Math.PI / 2; tor.scale.set(1, 0.92, 1); tor.position.y = y; cuff.add(tor); }
    // thin rings below
    for (const y of [-0.05]) { const tor = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.004, 8, 40), hamM); tor.rotation.x = Math.PI / 2; tor.position.y = y; cuff.add(tor); }
    // bells/charms hanging off the lower ring
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2 + 0.3;
      const bx = Math.sin(a) * 0.05, bz = Math.cos(a) * 0.046;
      const bell = new THREE.Group(); bell.position.set(bx, -0.052, bz);
      bell.add(mesh(tube([[0, 0, 0], [0, -0.012, 0]], 0.0013, { n: 3, r: 5 }), hamM));
      const b = loft(t => ({ c: [0, -0.012 - t * 0.022, 0], rx: 0.004 + 0.007 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.8, rz: 0.004 + 0.007 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.8 }), { n: 10, r: 14 });
      bell.add(mesh(b, hamM));
      cuff.add(bell);
    }
    g.add(cuff);
  }

  // ---------------- balloon trousers ----------------
  {
    const hipFl = folds(70, 16, 0.13);
    g.add(mesh(loft(t => ({ c: [0, 0.84 + t * 0.18, 0.0], rx: 0.215 - 0.05 * t ** 2, rz: 0.145 - 0.025 * t ** 2, p: 2.2, f: (a) => 1 + hipFl(a, t * 2, (0.6 + 0.4 * (1 - t)) * Math.min(1, (1 - t) * 4)) }), { n: 20, r: 96 }), linen, 'TrouserTop'));
    for (const s of [-1, 1]) {
      const R = prof([[0, 0.072], [0.03, 0.095], [0.1, 0.15], [0.25, 0.168], [0.45, 0.162], [0.7, 0.14], [0.88, 0.12], [1, 0.09]]);
      const dfl = folds(80 + s, 7, 0.2), fine = folds(90 + s, 15, 0.05), gat = folds(95 + s, 26, 0.12);
      const leg = loft(t => {
        const y = 0.205 + t * 0.78;
        const cx = (0.1 + 0.035 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (1 - t * 0.5)) * s;
        return {
          c: [cx, y, 0.012], rx: R(t) * 0.98, rz: R(t) * 0.94, p: 2.1,
          f: (a) => {
            const env = Math.min(1, t * 6) * (1 - 0.3 * t);
            const d = dfl(a, t * 2.5, env); let k = 1 + (d > 0 ? d : d * 1.6) + fine(a, t * 4, env * 0.7);
            if (t < 0.08) k += gat(a, 0, 1 - t / 0.08);
            return k;
          },
          // blouse over the cuff: hem rises slightly at the back
          dy: (a) => (t === 0 ? 0.01 * Math.cos(a * 3) : 0),
        };
      }, { n: 56, r: 96 });
      g.add(mesh(leg, linen, 'TrouserLeg'));
      // ankle cuff band
      g.add(mesh(loft(t => ({ c: [0.104 * s, 0.19 + t * 0.03, 0.012], rx: 0.07 + 0.006 * Math.sin(Math.PI * t), rz: 0.07 + 0.006 * Math.sin(Math.PI * t), f: (a) => 1 + 0.04 * Math.sin(a * 20) }), { n: 6, r: 64 }), linen, 'AnkleCuff'));
    }
  }

  // ---------------- textured silver boots ----------------
  for (const s of [-1, 1]) {
    const bx = 0.1 * s;
    // shaft
    g.add(mesh(loft(t => ({ c: [bx, 0.035 + t * 0.175, -0.004], rx: 0.058 + 0.005 * t, rz: 0.064 + 0.003 * t, p: 2.2 }), { n: 12, r: 48, uRep: 1 }), bootM, 'BootShaft'));
    // ribbed crown band at the top
    g.add(mesh(loft(t => ({ c: [bx, 0.17 + t * 0.045, -0.004], rx: 0.065 + 0.002 * Math.sin(Math.PI * t), rz: 0.07 + 0.002 * Math.sin(Math.PI * t), p: 2.2 }), { n: 6, r: 64 }), ribM, 'BootBand'));
    // foot: rounded toe, flat sole
    const fx = profile2([[0, 0.05], [0.25, 0.056], [0.6, 0.06], [0.9, 0.05], [1, 0.03]]);
    const fh = profile2([[0, 0.06], [0.3, 0.062], [0.6, 0.046], [0.9, 0.034], [1, 0.02]]);
    const fg = tube([[bx, 0.055, -0.065], [bx, 0.055, -0.02], [bx + 0.004 * s, 0.045, 0.06], [bx + 0.008 * s, 0.035, 0.14], [bx + 0.01 * s, 0.03, 0.172]],
      (t, a) => { const ca = Math.cos(a), sa = Math.sin(a); return 1 / Math.sqrt((ca / fh(t)) ** 2 + (sa / fx(t)) ** 2); }, { n: 24, r: 28, ref: [0, 1, 0] });
    { const p = fg.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.012) p.setY(i, 0.006 + (p.getY(i) - 0.012) * 0.1); fg.computeVertexNormals(); }
    g.add(mesh(fg, bootFootM, 'BootFoot'));
    // sole edge
    g.add(mesh(loft(t => ({ c: [bx + 0.004 * s, 0.002 + t * 0.008, 0.052], rx: 0.058, rz: 0.125, p: 2.4 }), { n: 2, r: 48 }), hamM, 'Sole'));
    // front seam: column of small knobs
    for (let k = 0; k < 6; k++) {
      const y = 0.06 + k * 0.022, z = 0.062 + (k < 2 ? 0.02 * (2 - k) : 0);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), hamM); b.position.set(bx, y, z); g.add(b);
    }
  }
  jpegTextures(g);
  return g;
}

// relaxed hand: palm faces the thigh, fingers curl toward the palm, thumb in front
export function skinMat2(hex, o = {}) {
  const n = parseInt(hex.slice(1), 16), b = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const s = surface({ w: 512, seed: o.seed ?? 4, rough: 0.55, nStrength: 0.8, repeat: [5, 5],
    pixel: (u, v) => { const q = fbm(u, v, 8, 4, 3), pore = fbm(u, v, 96, 2, 9); const k = 0.93 + 0.1 * q;
      return { a: [b[0] * k, b[1] * (k - 0.015 * (1 - q)), b[2] * (k - 0.03 * q)], h: 0.5 + (pore - 0.5) * 0.5, r: 0.5 + 0.12 * pore }; } });
  return pbr({ surf: s, sheen: 0.15, sheenColor: '#f3d8c8', nScale: 0.5, name: 'Skin' });
}

export function handR(W, E, s, m) {
  const grp = new THREE.Group(); grp.name = 'Hand';
  const dir = W.clone().sub(E).normalize();
  const inward = new V3(-s, 0, 0); inward.sub(dir.clone().multiplyScalar(inward.dot(dir))).normalize();
  const fwd = new V3().crossVectors(inward, dir).normalize(); if (fwd.z < 0) fwd.negate();
  const base = W.clone().add(dir.clone().multiplyScalar(-0.004));
  const palmL = 0.085, pw = 0.036, pt = 0.014;
  grp.add(mesh(tube([base, base.clone().add(dir.clone().multiplyScalar(palmL * 0.5)).add(inward.clone().multiplyScalar(0.002)), base.clone().add(dir.clone().multiplyScalar(palmL))],
    (t, a) => { const ca = Math.cos(a), sa = Math.sin(a); const rw = pw * (0.82 + 0.18 * Math.sin(Math.PI * Math.min(1, t * 1.2))), rt = pt * (1.05 - 0.25 * t); return 1 / Math.sqrt((ca / rw) ** 2 + (sa / rt) ** 2); },
    { n: 10, r: 18, ref: fwd.toArray() }), m, 'Palm'));
  const lens = [0.07, 0.078, 0.074, 0.06], curls = [0.55, 0.65, 0.75, 0.85];
  for (let f = 0; f < 4; f++) {
    const off = (f - 1.5) / 1.5 * pw * 0.72;
    let p = base.clone().add(dir.clone().multiplyScalar(palmL * 0.97)).add(fwd.clone().multiplyScalar(-off));
    let d = dir.clone().add(fwd.clone().multiplyScalar(-off * 1.2)).normalize();
    const pts = [p.clone()];
    const segL = [0.45, 0.32, 0.23];
    for (let k = 0; k < 3; k++) {
      const th = curls[f] * (k + 1) * 0.55;
      d = dir.clone().multiplyScalar(Math.cos(th)).add(inward.clone().multiplyScalar(Math.sin(th))).add(fwd.clone().multiplyScalar(-off * 1.2)).normalize();
      p = p.clone().add(d.clone().multiplyScalar(lens[f] * segL[k])); pts.push(p.clone());
    }
    grp.add(mesh(tube(pts, t => (f === 3 ? 0.0062 : 0.0072) * (1 - 0.3 * t), { n: 12, r: 10 }), m, 'Finger'));
  }
  const ts = base.clone().add(dir.clone().multiplyScalar(0.018)).add(fwd.clone().multiplyScalar(pw * 0.85)).add(inward.clone().multiplyScalar(0.006));
  const tp = [ts, ts.clone().add(dir.clone().multiplyScalar(0.028)).add(fwd.clone().multiplyScalar(0.01)).add(inward.clone().multiplyScalar(0.012)), ts.clone().add(dir.clone().multiplyScalar(0.05)).add(fwd.clone().multiplyScalar(0.006)).add(inward.clone().multiplyScalar(0.022))];
  grp.add(mesh(tube(tp, t => 0.0095 * (1 - 0.25 * t), { n: 10, r: 10 }), m, 'Thumb'));
  return grp;
}

function profile2(keys) {
  return t => {
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      if (t <= t1) { const k = (t - t0) / (t1 - t0), s = k * k * (3 - 2 * k); return v0 + (v1 - v0) * s; }
    }
    return keys[keys.length - 1][1];
  };
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
