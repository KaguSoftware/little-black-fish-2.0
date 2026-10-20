import * as THREE from 'three';
import { human2, hand, skinMat } from '../body.js';
import { pbr, rng, fbm } from '../pbr.js';
import { tube, loft, mesh, displace } from '../geo.js';
import { hairMat, hairBaseMat, growHair } from '../hair.js';
import * as TK from '../tex_keyumars.js';

export const frame = { ty: 0.9, dist: 5.3, fov: 24, size: [900, 1300] };
const V3 = THREE.Vector3;

export function build() {
  const g = new THREE.Group(); g.name = 'Keyumars';
  const skin = skinMat('#d6c3b6', { seed: 8, shade: '#b29d90' });
  const body = human2({ skin: '#d6c3b6', mat: skin, spread: 0.0 });
  // drop the stock straight arms: he gets his own (one bent to hold the staff)
  body.children.filter(c => ['Arm', 'Deltoid', 'Hand'].includes(c.name)).forEach(c => body.remove(c));
  g.add(body);

  // ---- placeholder face (only seen from behind in the references): weathered, simple ----
  const dark = pbr({ color: '#2a1d18', rough: 0.7, name: 'FaceDark' });
  const brow = pbr({ color: '#b9c6c3', rough: 1, name: 'Brow' });
  { const n = mesh(new THREE.SphereGeometry(1, 14, 10), skin, 'Nose'); n.scale.set(0.017, 0.038, 0.024); n.position.set(0, 1.668, 0.098); n.rotation.x = -0.2; g.add(n); }
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(1, 10, 6), dark); e.scale.set(0.016, 0.006, 0.008); e.position.set(0.035 * s, 1.705, 0.091); g.add(e);
    const b = mesh(new THREE.SphereGeometry(1, 10, 6), brow); b.scale.set(0.026, 0.007, 0.012); b.position.set(0.036 * s, 1.722, 0.09); b.rotation.z = -0.15 * s; g.add(b);
  }
  { const m = mesh(new THREE.SphereGeometry(1, 10, 6), dark); m.scale.set(0.024, 0.004, 0.008); m.position.set(0, 1.622, 0.096); g.add(m); }

  // ---- robe: dark plum boucle knit with dense teal rosettes, ankle length, A-line ----
  const knit = TK.knitSurface([3.6, 5]);
  const knitM = pbr({ surf: knit, sheen: 0.7, sheenColor: '#b0607e', sheenRough: 0.75, nScale: 1.3, name: 'PlumBoucleKnit' });
  const knitS = TK.knitSurface([1.4, 2.2]);
  const knitSM = pbr({ surf: knitS, sheen: 0.7, sheenColor: '#b0607e', sheenRough: 0.75, nScale: 1.3, name: 'PlumBoucleKnitSleeve' });
  const prof = (keys) => t => { for (let i = 0; i < keys.length - 1; i++) { const [t0, v0] = keys[i], [t1, v1] = keys[i + 1]; if (t <= t1) { const k = (t - t0) / (t1 - t0), s = k * k * (3 - 2 * k); return v0 + (v1 - v0) * s; } } return keys[keys.length - 1][1]; };
  const Y = [0.025, 1.54];
  const rx = prof([[0, 0.29], [0.35, 0.235], [0.62, 0.2], [0.82, 0.198], [0.9, 0.205], [0.94, 0.18], [0.975, 0.11], [1, 0.072]]);
  const rz = prof([[0, 0.235], [0.35, 0.175], [0.62, 0.14], [0.82, 0.135], [0.9, 0.13], [0.95, 0.11], [0.98, 0.08], [1, 0.062]]);
  const robe = loft(t => {
    const y = Y[0] + (Y[1] - Y[0]) * t;
    return {
      c: [0, y, 0.005 + 0.025 * Math.max(0, t - 0.75) / 0.25], rx: rx(t), rz: rz(t), p: 2.1,
      f: (a) => {
        let k = 1 + (0.03 * Math.sin(7 * a + 0.4) + 0.018 * Math.sin(13 * a + 1.3) + 0.01 * Math.sin(23 * a)) * Math.max(0, 0.75 - t) / 0.75;
        // rounded old back: a little hump high on the back
        k += 0.07 * Math.max(0, -Math.cos(a)) ** 2 * Math.exp(-(((t - 0.86) / 0.07) ** 2));
        // shoulders: squarer at the sides
        k += 0.05 * Math.abs(Math.sin(a)) ** 4 * Math.exp(-(((t - 0.91) / 0.05) ** 2));
        return k;
      },
      dy: (a) => t < 0.02 ? 0.012 * Math.sin(5 * a + 1) + (Math.cos(a) < 0 ? -0.008 : 0) : 0,
    };
  }, { n: 64, r: 96, uRep: 1 });
  displace(robe, (x, y, z) => 0.004 * (fbm(x * 2 + 0.5, y * 1.5, 4, 3, 7) - 0.5) - 0.0025 * Math.max(0, Math.sin(y * 18 + x * 4)) * (y < 1.1 ? 1 : 0));
  g.add(mesh(robe, knitM, 'Robe'));
  // rolled collar
  { const tor = new THREE.TorusGeometry(0.07, 0.022, 12, 40); const m = mesh(tor, knitSM, 'Collar'); m.rotation.x = Math.PI / 2 + 0.12; m.position.set(0, 1.535, 0.012); m.scale.set(1.15, 1, 1); g.add(m); }

  // ---- arms in long knit sleeves; right hand (model -x) raised to hold the staff ----
  const handM = skin;
  const arms = [
    { s: 1, S: [0.19, 1.42, -0.005], E: [0.245, 1.14, -0.015], W: [0.262, 0.89, 0.03] },
    { s: -1, S: [-0.19, 1.42, -0.005], E: [-0.25, 1.15, 0.0], W: [-0.27, 1.17, 0.21] },
  ];
  for (const A of arms) {
    const S = new V3(...A.S), E = new V3(...A.E), W = new V3(...A.W);
    const pts = [S.clone().add(new V3(-0.05 * A.s, 0.02, 0)), S, S.clone().lerp(E, 0.5), E, E.clone().lerp(W, 0.5), W];
    g.add(mesh(tube(pts, (t, a) => (0.072 + 0.01 * Math.sin(Math.PI * t) - 0.012 * t) * (1 + 0.04 * Math.sin(a * 5 + t * 8)), { n: 40, r: 24, caps: false }), knitSM, 'Sleeve'));
    // cuff roll
    const dir = W.clone().sub(E).normalize();
    const cuff = mesh(new THREE.TorusGeometry(0.058, 0.014, 10, 28), knitSM, 'Cuff');
    cuff.position.copy(W.clone().sub(dir.clone().multiplyScalar(0.01))); cuff.quaternion.setFromUnitVectors(new V3(0, 0, 1), dir); g.add(cuff);
    // inner wrist + hand
    g.add(mesh(tube([W.clone().sub(dir.clone().multiplyScalar(0.06)), W.clone().add(dir.clone().multiplyScalar(0.01))], 0.026, { n: 4, r: 12 }), skin, 'Wrist'));
    { // fuller, older hand: scale the stock hand about the wrist
      const piv = W.clone().add(dir.clone().multiplyScalar(0.01));
      const hgp = hand(piv, E, A.s, handM, { curl: A.s < 0 ? 1.25 : 0.45 });
      hgp.position.copy(piv).multiplyScalar(-1);
      const outer = new THREE.Group(); outer.add(hgp); outer.position.copy(piv); outer.scale.set(1.28, 1.15, 1.28); outer.name = 'Hand';
      g.add(outer);
    }
  }

  // ---- gnarled pale driftwood staff, taller than him, in the right hand ----
  const woodM = pbr({ surf: TK.driftwoodSurface(), nScale: 1.4, name: 'DriftwoodStaff' });
  {
    const r = rng(19), pts = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14, y = -0.0 + t * 1.86;
      pts.push([-0.28 + 0.02 * Math.sin(t * 7.5) + (r() - 0.5) * 0.02, y, 0.38 - 0.15 * t + 0.018 * Math.cos(t * 6) + (r() - 0.5) * 0.02]);
    }
    const knots = [0.18, 0.37, 0.52, 0.71, 0.86];
    const st = tube(pts, (t, a) => {
      let k = 0.017 + 0.005 * (1 - t);
      for (const q of knots) k += 0.008 * Math.exp(-(((t - q) / 0.012) ** 2)) * (0.6 + 0.4 * Math.cos(a * 2 + q * 20));
      return k * (1 + 0.08 * Math.sin(a * 3 + t * 40));
    }, { n: 160, r: 12 });
    g.add(mesh(st, woodM, 'Staff'));
    // forked, broken top
    const top = new V3(...pts[pts.length - 1]);
    g.add(mesh(tube([top.clone().add(new V3(0, -0.06, 0)), top.clone().add(new V3(-0.03, 0.03, 0.01)), top.clone().add(new V3(-0.045, 0.07, 0.0))], t => 0.014 * (1 - 0.6 * t), { n: 10, r: 8 }), woodM, 'StaffFork'));
    g.add(mesh(tube([top.clone().add(new V3(0, -0.03, 0)), top.clone().add(new V3(0.02, 0.04, -0.01))], t => 0.012 * (1 - 0.5 * t), { n: 6, r: 8 }), woodM, 'StaffFork2'));
  }

  // ---- huge shaggy grey-teal hair: spreads over both shoulders, matted clumps, ragged tips at mid-back ----
  const ho = { base: '#93a5a3', light: '#cfdcda', dark: '#5f7172', seed: 61, wave: 0.016, waveF: 4, frizz: 0.05, tipMin: 0.25, count: 1100, wMin: 1.2, wVar: 2.6, lightAmt: 0.55 };
  const hm = hairMat({ ...ho, rough: 0.74, aniso: 0.3, sheen: 0.35, sheenColor: '#d9e6e3', spec: 0.4 });
  const hm2 = hairMat({ ...ho, seed: 66, rough: 0.76, aniso: 0.25, sheen: 0.35, sheenColor: '#d9e6e3', spec: 0.4 });
  const hb = hairBaseMat({ ...ho, rough: 0.78, aniso: 0.3, sheen: 0.3, sheenColor: '#d9e6e3', spec: 0.4 });
  const head = { c: [0, 1.695, -0.004], r: [0.094, 0.128, 0.106] };
  const robeCol = { type: 'zcol', y0: 0.9, y1: 1.5, rx: y => 0.3, rz: y => 0.145 + 0.02 * Math.exp(-(((y - 1.36) / 0.08) ** 2)), cz: -0.0, pad: 0.012 };
  const shoulders = [-1, 1].map(s => ({ c: [0.2 * s, 1.41, -0.01], r: [0.12, 0.075, 0.13], pad: 0.08 }));
  const cols = (hp, sp) => [{ c: head.c, r: head.r, pad: hp }, ...shoulders.map(q => ({ ...q, pad: sp })), robeCol];
  const ragged = (a, r) => (Math.abs(a) > 2.3 ? 1.0 : Math.abs(a) > 1.6 ? 1.06 : 1.16) + r() * 0.2;
  // inner mass
  const H = growHair({
    head, part: 'center', count: 520, azRange: [-Math.PI, Math.PI], skip: a => Math.abs(a) < 0.95,
    departPolar: a => 1.4 + 0.5 * Math.abs(a) / Math.PI, tipY: ragged,
    colliders: cols(0.1, 0.06), side: a => Math.abs(a) < 1.35 ? 1 : -1, pad: 0.1,
    wave: 0.025, waveF: 6, volume: 0.035, flare: 0.05, mat: hm, width: 0.036, seed: 5, taper: 0.6,
  });
  g.add(H.cards);
  // outer shaggy clumps, wider than the shoulder line
  const H2 = growHair({
    head, part: 'center', count: 300, azRange: [-Math.PI, Math.PI], skip: a => Math.abs(a) < 1.15,
    departPolar: a => 1.35 + 0.5 * Math.abs(a) / Math.PI, tipY: (a, r) => ragged(a, r) + 0.03,
    colliders: cols(0.15, 0.1), side: a => Math.abs(a) < 1.5 ? 1 : -1, pad: 0.15,
    wave: 0.035, waveF: 5, volume: 0.05, flare: 0.1, mat: hm2, width: 0.05, seed: 9, taper: 0.75,
  });
  g.add(H2.cards);
  // frizz: thin flyaway wisps over the top of the mass
  const H3 = growHair({
    head, part: 'center', count: 140, azRange: [-Math.PI, Math.PI], skip: a => Math.abs(a) < 1.2,
    departPolar: a => 1.3 + 0.5 * Math.abs(a) / Math.PI, tipY: (a, r) => ragged(a, r) + 0.05,
    colliders: cols(0.2, 0.14), side: a => Math.abs(a) < 1.5 ? 1 : -1, pad: 0.2,
    wave: 0.05, waveF: 8, volume: 0.05, flare: 0.09, mat: hairMat({ ...ho, seed: 71, count: 500, rough: 0.8 }), width: 0.016, seed: 13, taper: 0.8,
  });
  g.add(H3.cards);
  // scalp: crown cap plus the back of the head only (face stays clear)
  { const sg = new THREE.SphereGeometry(1, 32, 12, 0, Math.PI * 2, 0, 0.8); sg.scale(head.r[0] * 1.08, head.r[1] * 1.06, head.r[2] * 1.08); const cap = mesh(sg, hb, 'Scalp'); cap.position.set(...head.c); g.add(cap);
    const bg = new THREE.SphereGeometry(1, 32, 16, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0.7, 1.4); bg.scale(head.r[0] * 1.08, head.r[1] * 1.06, head.r[2] * 1.08); const bk = mesh(bg, hb, 'ScalpBack'); bk.position.set(...head.c); g.add(bk); }

  // ---- dark worn shoes just showing under the hem ----
  const shoeM = pbr({ color: '#1a1614', rough: 0.55, clearcoat: 0.2, name: 'Shoes' });
  for (const s of [-1, 1]) { const sh = mesh(new THREE.SphereGeometry(1, 20, 12), shoeM, 'Shoe'); sh.scale.set(0.05, 0.045, 0.12); sh.position.set(0.095 * s, 0.035, 0.07); g.add(sh); }
  return jpegify(g);
}

// smaller GLB: store opaque textures as JPEG (alpha-tested hair/fur maps stay PNG)
function jpegify(root) {
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
