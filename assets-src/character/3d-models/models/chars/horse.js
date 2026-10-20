import * as THREE from 'three';
import { pbr, rng } from '../pbr.js';
import { tube, mesh, merge, displace } from '../geo.js';
import * as TH from '../tex_horse.js';

export const frame = { ty: 0.62, dist: 6.4, fov: 24, size: [1300, 900] };
const V3 = THREE.Vector3;

const prof = (keys) => t => { for (let i = 0; i < keys.length - 1; i++) { const [t0, v0] = keys[i], [t1, v1] = keys[i + 1]; if (t <= t1) { const k = (t - t0) / (t1 - t0), s = k * k * (3 - 2 * k); return v0 + (v1 - v0) * s; } } return keys[keys.length - 1][1]; };
const ell = (rw, rh) => (t, a) => { const ca = Math.cos(a), sa = Math.sin(a); return 1 / Math.sqrt((ca / rw(t)) ** 2 + (sa / rh(t)) ** 2); };

// area-weighted surface samples of a geometry (world = local here)
function samples(geo, count, seed, filter) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, tri = P.count / 3;
  const cum = []; let tot = 0;
  const a = new V3(), b = new V3(), c = new V3();
  for (let i = 0; i < tri; i++) { a.fromBufferAttribute(P, i * 3); b.fromBufferAttribute(P, i * 3 + 1); c.fromBufferAttribute(P, i * 3 + 2); tot += b.clone().sub(a).cross(c.clone().sub(a)).length() / 2; cum.push(tot); }
  const r = rng(seed), out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const x = r() * tot; let lo = 0, hi = tri - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < x) lo = m + 1; else hi = m; }
    let u = r(), v = r(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    a.fromBufferAttribute(P, lo * 3); b.fromBufferAttribute(P, lo * 3 + 1); c.fromBufferAttribute(P, lo * 3 + 2);
    const p = a.clone().multiplyScalar(1 - u - v).add(b.clone().multiplyScalar(u)).add(c.clone().multiplyScalar(v));
    const n = new V3().fromBufferAttribute(N, lo * 3).normalize();
    if (filter && !filter(p, n)) continue;
    out.push({ p, n });
  }
  return out;
}

// matted fur locks: short curved alpha cards hanging with gravity
function locks(S, o) {
  const r = rng(o.seed ?? 1), pos = [], uv = [], idx = [];
  const SEG = 4;
  for (const { p, n } of S) {
    let L = (o.len ?? 0.12) * (0.6 + r() * 0.9), W = (o.w ?? 0.05) * (0.8 + r() * 0.6);
    const flow = o.flow ? o.flow(p) : new V3(0, 0, -1);
    // lay the lock along the surface (matted), pulled down by gravity and along the body flow
    let tg = new V3(0, -(o.grav ?? 0.8), 0).add(flow.clone().multiplyScalar(o.flowK ?? 0.3)).add(new V3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.6));
    tg.sub(n.clone().multiplyScalar(tg.dot(n)));
    if (tg.lengthSq() < 1e-6) tg.set(0, -1, 0);
    const d = tg.normalize().add(n.clone().multiplyScalar(o.out ?? 0.22)).normalize();
    // shorter locks low on the belly so they don't hang like a skirt
    const lowK = p.y < 0.25 ? 0.4 + 0.6 * Math.max(0, (p.y - 0.07) / 0.18) : 1;
    L *= lowK;
    let side = new V3().crossVectors(d, n); if (side.lengthSq() < 1e-6) side.set(1, 0, 0); side.normalize();
    const root = p.clone().sub(n.clone().multiplyScalar(0.01));
    const mid = p.clone().add(d.clone().multiplyScalar(L * 0.5)).add(n.clone().multiplyScalar(o.lift ?? 0.005));
    const tip = p.clone().add(d.clone().multiplyScalar(L)).add(new V3(0, -L * 0.25 * (o.droop ?? 1), 0));
    const u0 = r() * 0.65, u1 = u0 + 0.3;
    const base = pos.length / 3;
    for (let k = 0; k <= SEG; k++) {
      const t = k / SEG, q = root.clone().multiplyScalar((1 - t) ** 2).add(mid.clone().multiplyScalar(2 * t * (1 - t))).add(tip.clone().multiplyScalar(t * t));
      const ww = W * 0.5 * (1 - 0.55 * t);
      const bow = n.clone().multiplyScalar(ww * 0.2);
      pos.push(q.x - side.x * ww + bow.x, q.y - side.y * ww + bow.y, q.z - side.z * ww + bow.z, q.x + side.x * ww + bow.x, q.y + side.y * ww + bow.y, q.z + side.z * ww + bow.z);
      uv.push(u0, 1 - t, u1, 1 - t);
    }
    for (let k = 0; k < SEG; k++) { const a = base + k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return mesh(g, o.mat, o.name ?? 'FurLocks');
}

export function build() {
  const g = new THREE.Group(); g.name = 'JamshidHorse';
  const furS = TH.furBodySurface([4, 4]);
  const fur = pbr({ surf: furS, sheen: 0.6, sheenColor: '#d8daea', sheenRough: 0.6, nScale: 1.2, name: 'Fur' });
  const lt = TH.lockTex(4), lt2 = TH.lockTex(9);
  const lockM = (t, name) => { const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: t.map, normalMap: t.normalMap, roughness: 0.82, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.38 }); m.sheen = 0.55; m.sheenColor = new THREE.Color('#dfe1ef'); m.sheenRoughness = 0.55; m.name = name; return m; };
  const lockA = lockM(lt, 'FurLocks'), lockB = lockM(lt2, 'FurLocks2');
  const skinS = TH.skinSurface([1.5, 1.5]);
  const skinM = pbr({ surf: skinS, sheen: 0.25, sheenColor: '#f2dcd6', nScale: 1.3, name: 'WrinkledSkin' });
  const toeS = TH.skinSurface([1, 1], { seed: 31, warts: 20, base: '#d4c6bd' });
  const toeM = pbr({ surf: toeS, sheen: 0.2, sheenColor: '#f2dcd6', nScale: 1.3, name: 'ToeSkin' });
  const tipM = pbr({ surf: TH.skinSurface([1, 1], { seed: 7, warts: 20, pinkAll: 0.55 }), nScale: 1.2, name: 'SnoutTip' });

  // ---------- body masses ----------
  const bodyPath = [[0, 0.52, -1.0], [0, 0.48, -0.62], [0, 0.42, -0.2], [0, 0.46, 0.2], [0, 0.54, 0.46]];
  const bry = prof([[0, 0.28], [0.18, 0.36], [0.5, 0.33], [0.82, 0.36], [1, 0.28]]), brx = prof([[0, 0.3], [0.18, 0.4], [0.5, 0.38], [0.82, 0.38], [1, 0.3]]);
  const torsoG = tube(bodyPath, ell(t => brx(t), t => bry(t)), { n: 40, r: 40, ref: [1, 0, 0] });
  { const p = torsoG.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.07) p.setY(i, 0.07 + (p.getY(i) - 0.07) * 0.2); torsoG.computeVertexNormals(); }
  g.add(mesh(torsoG, fur, 'Torso'));
  // folded hind legs: big haunches + paws pointing forward along the ground
  const haunch = [];
  for (const s of [-1, 1]) {
    const hg = new THREE.SphereGeometry(1, 28, 20); hg.scale(0.2, 0.33, 0.38); hg.translate(0.31 * s, 0.42, -0.72);
    { const p = hg.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.07) p.setY(i, 0.07); hg.computeVertexNormals(); }
    haunch.push(hg); g.add(mesh(hg, fur, 'Haunch'));
  }
  // front legs: upper leg down to the elbow on the ground, forearm stretched forward
  const legGeos = [];
  for (const s of [-1, 1]) {
    const lg = tube([[0.22 * s, 0.58, 0.42], [0.26 * s, 0.34, 0.52], [0.28 * s, 0.14, 0.62], [0.295 * s, 0.11, 0.9], [0.305 * s, 0.1, 1.12]],
      ell(prof([[0, 0.15], [0.35, 0.135], [0.5, 0.115], [1, 0.095]]), prof([[0, 0.15], [0.35, 0.13], [0.5, 0.1], [1, 0.075]])), { n: 30, r: 20, ref: [1, 0, 0] });
    legGeos.push(lg); g.add(mesh(lg, fur, 'FrontLeg'));
  }
  // hind lower legs / paws
  const hindGeos = [];
  for (const s of [-1, 1]) {
    const hl = tube([[0.36 * s, 0.17, -0.8], [0.38 * s, 0.11, -0.56], [0.385 * s, 0.09, -0.4]], ell(t => 0.085 - 0.01 * t, t => 0.075 - 0.01 * t), { n: 14, r: 16, ref: [1, 0, 0] });
    hindGeos.push(hl); g.add(mesh(hl, fur, 'HindLeg'));
  }
  // huge paws with thick fleshy toes
  const paw = (x, z, s, sc = 1) => {
    const pg = new THREE.SphereGeometry(1, 24, 16); pg.scale(0.115 * sc, 0.075 * sc, 0.12 * sc);
    displace(pg, (px, py, pz) => 0.006 * Math.sin(px * 80) * Math.sin(pz * 60));
    const pm = mesh(pg, toeM, 'PawPad'); pm.position.set(x, 0.075 * sc, z); g.add(pm);
    for (let k = 0; k < 4; k++) {
      const dx = (k - 1.5) * 0.062 * sc, L = (k === 0 || k === 3 ? 0.13 : 0.16) * sc;
      const pts = [[x + dx, 0.1 * sc, z + 0.03 * sc], [x + dx * 1.25, 0.095 * sc, z + 0.03 * sc + L * 0.55], [x + dx * 1.45, 0.045 * sc, z + 0.03 * sc + L]];
      const tg = tube(pts, (t, a) => (0.042 * sc) * (1 - 0.25 * t) * (1 + 0.12 * Math.exp(-(((t - 0.45) / 0.12) ** 2))) * (1 + 0.06 * Math.sin(t * 50) * Math.max(0, Math.sin(a))), { n: 14, r: 14 });
      { const p = tg.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.012) p.setY(i, 0.012); tg.computeVertexNormals(); }
      g.add(mesh(tg, toeM, 'Toe'));
    }
  };
  for (const s of [-1, 1]) { paw(0.31 * s, 1.14, s, 1.3); paw(0.39 * s, -0.38, s, 1.05); }

  // ---------- neck ----------
  const neckPts = [[0, 0.6, 0.38], [0, 0.88, 0.47], [0, 1.15, 0.53], [0, 1.35, 0.55], [0, 1.47, 0.52]];
  const neckG = tube(neckPts, ell(prof([[0, 0.29], [0.35, 0.21], [0.7, 0.155], [1, 0.13]]), prof([[0, 0.3], [0.35, 0.21], [0.7, 0.16], [1, 0.14]])), { n: 30, r: 28, ref: [1, 0, 0] });
  g.add(mesh(neckG, fur, 'Neck'));

  // ---------- long, heavy, curved hanging head (laterally flat "hammer" skull) ----------
  const headPts = [[0, 1.5, 0.41], [0, 1.6, 0.57], [0, 1.565, 0.78], [0, 1.41, 0.96], [0, 1.2, 1.05], [0, 1.05, 1.05]];
  const hw = prof([[0, 0.09], [0.2, 0.115], [0.45, 0.1], [0.75, 0.08], [1, 0.05]]), hh = prof([[0, 0.13], [0.2, 0.21], [0.45, 0.25], [0.72, 0.21], [0.9, 0.12], [1, 0.035]]);
  const headG = tube(headPts, (t, a) => {
    const base = ell(hw, hh)(t, a);
    // dorsal ridge and a heavier jaw on the underside
    const up = Math.sin(a); // sin(a) along the sagittal direction
    return base * (1 + 0.06 * Math.exp(-((Math.cos(a) / 0.25) ** 2)) * (up < 0 ? 1.4 : 0.6));
  }, { n: 48, r: 32, ref: [1, 0, 0] });
  displace(headG, (x, y, z) => 0.004 * Math.sin(y * 70 + z * 30) * Math.sin(x * 90));
  g.add(mesh(headG, skinM, 'Head'));
  // rounded pink snout end
  { const tg = new THREE.SphereGeometry(1, 20, 14); tg.scale(0.048, 0.055, 0.05); const t = mesh(tg, tipM, 'SnoutTip'); t.position.set(0, 1.07, 1.05); g.add(t); }
  // mouth line: a dark slit along the lower edge
  {
    const mp = []; const cv = headG.userData.curve;
    for (let i = 0; i <= 10; i++) { const t = 0.45 + i / 10 * 0.5; const p = cv.getPointAt(t), T = cv.getTangentAt(t); const nrm = new V3(1, 0, 0).cross(T).normalize(); mp.push(p.clone().add(nrm.multiplyScalar(hh(t) * 0.6))); }
    g.add(mesh(tube(mp, t => 0.009 * (1 - 0.4 * t), { n: 20, r: 6 }), pbr({ color: '#6a4a45', rough: 0.6, name: 'MouthLine' }), 'Mouth'));
  }
  // small reddish eyes with wrinkled lids
  const eyeM = pbr({ color: '#7d2a26', rough: 0.15, clearcoat: 1, clearcoatRough: 0.05, name: 'Eye' });
  for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(1, 16, 12), eyeM, 'Eye'); e.scale.set(0.012, 0.014, 0.017); e.position.set(0.112 * s, 1.555, 0.64); g.add(e);
    const lid = mesh(new THREE.TorusGeometry(0.02, 0.008, 8, 20), skinM, 'Lid'); lid.position.set(0.114 * s, 1.555, 0.64); lid.rotation.y = Math.PI / 2; lid.scale.set(1, 0.85, 1.1); g.add(lid);
  }
  for (const s of [-1, 1]) {
    const bg = new THREE.SphereGeometry(1, 16, 12); bg.scale(0.03, 0.022, 0.07);
    const b = mesh(bg, skinM, 'Brow'); b.position.set(0.1 * s, 1.585, 0.64); b.rotation.x = 0.35; g.add(b);
  }
  // two horns pointing back from the top of the skull
  const hornM = pbr({ surf: TH.hornSurface(), nScale: 1.2, name: 'Horn' });
  for (const s of [-1, 1]) {
    g.add(mesh(tube([[0.05 * s, 1.62, 0.5], [0.07 * s, 1.7, 0.38], [0.09 * s, 1.76, 0.25], [0.11 * s, 1.79, 0.13]], (t, a) => 0.052 * (1 - 0.85 * t) * (1 + 0.05 * Math.sin(t * 60)), { n: 30, r: 16 }), hornM, 'Horn'));
  }

  // ---------- tail along the ground ----------
  const tailPts = [[0, 0.5, -1.2], [0.04, 0.26, -1.38], [0.18, 0.09, -1.56], [0.42, 0.065, -1.74], [0.68, 0.06, -1.8], [0.86, 0.06, -1.74]];
  const tailG = tube(tailPts, t => 0.07 - 0.035 * t, { n: 40, r: 14 });
  g.add(mesh(tailG, fur, 'Tail'));

  // ---------- saddle blanket draped over the back ----------
  const rugM = pbr({ surf: TH.rugSurface(), sheen: 1, sheenColor: '#c2404e', sheenRough: 0.35, nScale: 1, name: 'SaddleBlanket' });
  const cv = torsoG.userData.curve;
  const zAt = z => { // find body cross-section at z
    let best = 0, bd = 9; for (let i = 0; i <= 60; i++) { const t = i / 60, p = cv.getPointAt(t); if (Math.abs(p.z - z) < bd) { bd = Math.abs(p.z - z); best = t; } }
    return { t: best, c: cv.getPointAt(best) };
  };
  {
    const NU = 50, NV = 24, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NV; j++) {
      const v = j / NV, z = -0.62 + v * 0.72, { t, c } = zAt(z);
      const rx = brx(t) * 1.06 + 0.012, ry = bry(t) * 1.06 + 0.012;
      for (let i = 0; i <= NU; i++) {
        const u = i / NU, L = (u - 0.5) * 2; // -1..1 across
        const arc = Math.abs(L) * 1.0; // arc length param in "rx units"
        const s = Math.sign(L) || 1;
        let x, y;
        const phiMax = Math.PI / 2;
        const phi = arc * 2.55;
        if (phi < phiMax) { x = Math.sin(phi) * rx * s; y = c.y + Math.cos(phi) * ry; }
        else { const drop = (phi - phiMax) * ry * 0.95; x = (rx + 0.01 + drop * 0.04) * s; y = c.y - drop; }
        // folds on the hanging sides, slight lift at the front/back edges
        const hang = Math.max(0, phi - phiMax);
        x += s * 0.018 * Math.sin(v * 26 + s) * hang;
        const zz = z + 0.015 * Math.sin(u * 20) * hang - (v < 0.04 || v > 0.96 ? 0.01 : 0);
        y = Math.max(y, 0.12 + 0.02 * Math.sin(v * 17));
        pos.push(x, y, zz); uv.push(u, v);
      }
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + NU + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); rg.setIndex(idx); rg.computeVertexNormals();
    g.add(mesh(rg, rugM, 'SaddleBlanket'));
  }
  const underRug = (p) => p.z > -0.6 && p.z < 0.08 && p.y > 0.2;

  // ---------- matted fur locks over everything furry ----------
  const back = new V3(0, 0, -1);
  g.add(locks(samples(torsoG, 2600, 3, (p) => !underRug(p) && p.y > 0.09), { mat: lockA, len: 0.13, w: 0.085, seed: 1, out: 0.14, droop: 0.6, flow: () => back }));
  for (const hg of haunch) g.add(locks(samples(hg, 700, 5, p => p.y > 0.09), { mat: lockB, len: 0.125, w: 0.085, seed: 2, out: 0.14, droop: 0.6, flow: () => back }));
  g.add(locks(samples(neckG, 1700, 7, p => p.y < 1.38), { mat: lockA, len: 0.13, w: 0.075, seed: 3, grav: 1.0, out: 0.14, droop: 0.6, flow: () => new V3(0, -1, 0) }));
  for (const lg of legGeos) g.add(locks(samples(lg, 600, 9, p => p.y > 0.08), { mat: lockB, len: 0.11, w: 0.07, seed: 4, out: 0.14, droop: 0.6, flow: () => new V3(0, -1, -0.3) }));
  for (const hl of hindGeos) g.add(locks(samples(hl, 120, 11, p => p.y > 0.08), { mat: lockB, len: 0.08, w: 0.045, seed: 5 }));
  g.add(locks(samples(tailG, 260, 13), { mat: lockA, len: 0.09, w: 0.05, seed: 6, grav: 0.4, out: 0.25, flow: () => new V3(0.6, 0, -0.3) }));
  // tail tip tuft
  { const tip = new V3(...tailPts[tailPts.length - 2]); const S = []; const r = rng(17); for (let i = 0; i < 160; i++) { const n = new V3(r() - 0.5, r() * 0.6, r() - 0.5).normalize(); S.push({ p: tip.clone().add(new V3((r() - 0.3) * 0.35, 0.02, (r() - 0.5) * 0.12)), n }); } g.add(locks(S, { mat: lockA, len: 0.2, w: 0.06, seed: 8, grav: 0.3, out: 0.9, flow: () => new V3(1, 0, 0), flowK: 0.8 })); }
  // a few locks creeping onto the back of the skull
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
