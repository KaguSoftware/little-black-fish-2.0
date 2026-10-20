import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export { THREE };

const V3 = THREE.Vector3;

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  t.anisotropy = 8;
  return t;
}

export function mat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.85, metalness: o.metal ?? 0,
    side: o.side ?? THREE.DoubleSide, map: o.map || null,
    bumpMap: o.bump || null, bumpScale: o.bumpScale ?? 1,
    flatShading: !!o.flat,
  });
  if (o.name) m.name = o.name;
  return m;
}

export function physMat(color, o = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: o.rough ?? 0.9, metalness: 0, side: THREE.DoubleSide, map: o.map || null,
    sheen: o.sheen ?? 1, sheenColor: new THREE.Color(o.sheenColor ?? '#445566'), sheenRoughness: 0.5,
  });
  return m;
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function orient(o, a, b) {
  const A = new V3(...a), B = new V3(...b);
  const d = B.clone().sub(A);
  o.position.copy(A);
  o.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
}

export function ellipsoid(rx, ry, rz, m, o = {}) {
  const g = new THREE.SphereGeometry(1, o.w ?? 32, o.h ?? 20);
  if (o.faceFront) g.rotateY(-Math.PI / 2);
  g.scale(rx, ry, rz);
  const me = new THREE.Mesh(g, m);
  if (o.pos) me.position.set(...o.pos);
  if (o.rot) me.rotation.set(...o.rot);
  return me;
}

export function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }

export function box(w, h, d, m, pos) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  if (pos) me.position.set(...pos);
  return me;
}

export function cone(r, h, m, o = {}) {
  const g = new THREE.ConeGeometry(r, h, o.seg ?? 8, 1);
  const me = new THREE.Mesh(g, m);
  if (o.pos) me.position.set(...o.pos);
  if (o.rot) me.rotation.set(...o.rot);
  return me;
}

// Lathe around the Y axis. profile: [[radius, y], ...] ascending y gives outward faces.
export function lathe(profile, o = {}, m) {
  const seg = o.seg ?? 56, phiStart = o.phiStart ?? 0, phiLen = o.phiLen ?? Math.PI * 2;
  const sx = o.sx ?? 1, sz = o.sz ?? 1, n = profile.length;
  const f = o.folds;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    for (let j = 0; j <= seg; j++) {
      const phi = phiStart + phiLen * j / seg;
      let r = profile[i][0];
      if (f) {
        const env = f.env ? f.env(t) : (f.grow ? t : 1);
        r *= 1 + f.amp * env * (Math.sin(f.n * phi + (f.phase ?? 0) + t * (f.twist ?? 0)) + 0.45 * Math.sin(f.n * 2.3 * phi + 1.7 + t * 2));
      }
      let x = r * Math.sin(phi) * sx + (o.ox ?? 0);
      let y = profile[i][1] + (o.oy ?? 0);
      let z = r * Math.cos(phi) * sz + (o.oz ?? 0);
      if (o.deform) { const d = o.deform(x, y, z, phi, t); x = d[0]; y = d[1]; z = d[2]; }
      pos.push(x, y, z);
      uv.push(j / seg * (o.uRep ?? 1), t * (o.vRep ?? 1));
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = j + i * (seg + 1), b = a + seg + 1, c = b + 1, d = a + 1;
      idx.push(a, b, d, c, d, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

// Smooth profile helper: sample a function r(t) between y0 and y1
export function prof(y0, y1, fn, steps = 16) {
  const p = [];
  for (let k = 0; k <= steps; k++) { const t = k / steps; p.push([Math.max(0.0005, fn(t)), y0 + (y1 - y0) * t]); }
  return p;
}

// Lathe oriented from point a to point b, rFn(t) radius along the way
export function along(a, b, rFn, m, o = {}) {
  const L = dist(a, b);
  const me = lathe(prof(0, L, rFn, o.steps ?? 14), o, m);
  orient(me, a, b);
  return me;
}

export function limb(a, b, ra, rb, m, seg = 16) {
  const L = dist(a, b);
  const g = new THREE.CylinderGeometry(rb, ra, L, seg, 1, true);
  g.translate(0, L / 2, 0);
  const me = new THREE.Mesh(g, m);
  orient(me, a, b);
  const grp = new THREE.Group();
  grp.add(me);
  grp.add(ellipsoid(ra, ra, ra, m, { pos: a, w: 16, h: 10 }));
  grp.add(ellipsoid(rb, rb, rb, m, { pos: b, w: 16, h: 10 }));
  return grp;
}

export function taperTube(pts, rFn, m, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(p => new V3(...p)), false, 'catmullrom', 0.5);
  const N = o.n ?? 64, R = o.r ?? 8;
  const fr = curve.computeFrenetFrames(N, false);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPointAt(t), r = rFn(t), nn = fr.normals[i], bb = fr.binormals[i];
    for (let j = 0; j <= R; j++) {
      const a = j / R * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      pos.push(p.x + r * (c * nn.x + s * bb.x), p.y + r * (c * nn.y + s * bb.y), p.z + r * (c * nn.z + s * bb.z));
      uv.push(j / R, t * (o.vRep ?? 1));
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
    const a = i * (R + 1) + j, b = a + R + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.curve = curve;
  return new THREE.Mesh(g, m);
}

// A curved flat panel (hair curtains etc). Hangs from yTop to yBot, width w, bows forward by `bow`.
export function panel(w, yTop, yBot, m, o = {}) {
  const sw = o.sw ?? 8, sh = o.sh ?? 24;
  const g = new THREE.PlaneGeometry(w, yTop - yBot, sw, sh);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    const u = x / w * 2; // -1..1
    const t = 1 - (y + (yTop - yBot) / 2) / (yTop - yBot); // 0 top, 1 bottom
    let z = (o.bow ?? 0) * (1 - u * u);
    let nx = x;
    if (o.taper) nx = x * (1 - o.taper * t);
    if (o.wave) { nx += Math.sin(t * o.waveF * 6.28 + (o.phase ?? 0)) * o.wave * t; z += Math.cos(t * o.waveF * 6.28 * 0.8 + u) * o.wave * 0.4 * t; }
    if (o.flare) { nx *= 1 + o.flare * t; }
    p.setXYZ(i, nx, y + (yTop + yBot) / 2, z);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

// Cluster of tapered tufts (fur, fringe) merged in one mesh
export function tuftsOn(samples, m, o = {}) {
  const geos = [];
  const r = rng(o.seed ?? 7);
  for (const s of samples) {
    const len = (o.len ?? 0.08) * (0.6 + r() * 0.8), rad = (o.rad ?? 0.012) * (0.7 + r() * 0.6);
    const g = new THREE.ConeGeometry(rad, len, 5, 1);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), new V3(...s.dir).normalize());
    g.applyQuaternion(q);
    g.translate(...s.p);
    geos.push(g);
  }
  const mg = mergeGeometries(geos);
  mg.computeVertexNormals();
  return new THREE.Mesh(mg, m);
}

export function sampleEllipsoid(c, rad, count, o = {}) {
  const r = rng(o.seed ?? 3), out = [];
  for (let i = 0; i < count; i++) {
    const th = Math.acos(1 - 2 * r()), ph = r() * Math.PI * 2;
    let dx = Math.sin(th) * Math.cos(ph), dy = Math.cos(th), dz = Math.sin(th) * Math.sin(ph);
    if (o.filter && !o.filter(dx, dy, dz)) { i--; continue; }
    const p = [c[0] + dx * rad[0], c[1] + dy * rad[1], c[2] + dz * rad[2]];
    let nx = dx / rad[0], ny = dy / rad[1], nz = dz / rad[2];
    const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const g = o.gravity ?? 0.5, back = o.back ?? 0;
    const ou = o.out ?? 1;
    out.push({ p, dir: [nx * ou + (o.dx ?? 0), ny * ou - g + (o.dy ?? 0), nz * ou - back] });
  }
  return out;
}

// ---------- shared human body ----------
export const J = {
  hip: [0.09, 0.95, 0], knee: [0.095, 0.5, 0.012], ankle: [0.095, 0.075, 0],
  shoulder: [0.19, 1.44, 0], elbow: [0.255, 1.16, 0], wrist: [0.29, 0.9, 0.015],
  neck: [0, 1.48, 0], head: [0, 1.68, 0],
};

export function human(o = {}) {
  const g = new THREE.Group();
  g.name = 'body';
  const skin = mat(o.skin ?? '#c39673', { rough: 0.7, map: o.skinMap, name: 'Skin' });
  const trunkSkin = o.trunkSkin ?? skin;
  g.add(lathe([[0.1, 0.94], [0.135, 1.04], [0.14, 1.2], [0.16, 1.36], [0.14, 1.46], [0.05, 1.53]], { sx: 1.25, sz: 0.68, seg: 36, uRep: 2 }, trunkSkin));
  g.add(limb([0, 1.46, 0], [0, 1.6, 0.005], 0.052, 0.045, skin));
  g.add(ellipsoid(0.088, 0.122, 0.1, skin, { pos: [0, 1.68, 0], w: 28, h: 18 }));
  for (const s of [-1, 1]) {
    const sp = o.spread ?? 0;
    const P = k => [(J[k][0] + (k === 'wrist' ? sp : k === 'elbow' ? sp * 0.5 : 0)) * s, J[k][1], J[k][2]];
    g.add(limb(P('hip'), P('knee'), 0.088, 0.058, o.legSkin ?? skin));
    g.add(limb(P('knee'), P('ankle'), 0.056, 0.036, o.legSkin ?? skin));
    if (!o.noFeet) g.add(ellipsoid(0.042, 0.04, 0.115, o.legSkin ?? skin, { pos: [0.095 * s, 0.04, 0.05], w: 16, h: 10 }));
    if (!o.noArms) {
      g.add(limb(P('shoulder'), P('elbow'), 0.052, 0.04, o.armSkin ?? skin));
      g.add(limb(P('elbow'), P('wrist'), 0.039, 0.03, o.armSkin ?? skin));
      g.add(ellipsoid(0.03, 0.07, 0.02, skin, { pos: [(J.wrist[0] + sp) * s + 0.005 * s, 0.84, 0.02], w: 14, h: 10 }));
      g.add(ellipsoid(0.012, 0.035, 0.012, skin, { pos: [(J.wrist[0] + sp) * s - 0.028 * s, 0.86, 0.035], rot: [0, 0, 0.1 * s], w: 8, h: 6 }));
    }
  }
  return g;
}

export function onEllipsoid(a, b, c, x, y) {
  const q = 1 - (x / a) ** 2 - (y / b) ** 2;
  return c * Math.sqrt(Math.max(q, 0.01));
}

// Eye slits + nose for a mask whose ellipsoid is centred at ctr with radii (a,b,c)
export function maskFeatures(ctr, a, b, c, o = {}) {
  const grp = new THREE.Group();
  const dark = mat(o.eye ?? '#0b0908', { rough: 0.6, side: THREE.DoubleSide });
  const eyeY = o.eyeY ?? 0.18 * b, eyeX = o.eyeX ?? 0.4 * a;
  for (const s of [-1, 1]) {
    const x = eyeX * s, y = eyeY;
    const z = onEllipsoid(a, b, c, x, y);
    const e = ellipsoid(o.eyeW ?? 0.022, o.eyeH ?? 0.0075, 0.006, dark, { pos: [ctr[0] + x, ctr[1] + y, ctr[2] + z - 0.002], rot: [0, 0, -0.13 * s], w: 16, h: 8 });
    grp.add(e);
  }
  if (o.nose !== false) {
    const nm = o.noseMat;
    const ny = -0.05 * b, nz = onEllipsoid(a, b, c, 0, ny);
    const nose = ellipsoid(0.012, o.noseLen ?? 0.055, 0.016, nm, { pos: [ctr[0], ctr[1] + ny, ctr[2] + nz + 0.006], rot: [-0.18, 0, 0], w: 12, h: 10 });
    grp.add(nose);
  }
  if (o.mouth) {
    const my = -0.42 * b, mz = onEllipsoid(a, b, c, 0, my);
    grp.add(ellipsoid(0.03, 0.006, 0.006, o.mouth, { pos: [ctr[0], ctr[1] + my, ctr[2] + mz + 0.001], w: 14, h: 8 }));
  }
  return grp;
}

// strand-streak texture for hair
export function hairTex(base, light, seed = 5, w = 256, h = 256) {
  return canvasTex(w, h, (g) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, l = 40 + r() * 180;
      g.strokeStyle = r() < 0.5 ? light : '#000000';
      g.globalAlpha = 0.05 + r() * 0.14;
      g.lineWidth = 0.6 + r() * 1.4;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y + l); g.stroke();
    }
    g.globalAlpha = 1;
  });
}

export function noiseTex(base, speck = '#000', alpha = 0.1, n = 4000, seed = 2, w = 256, h = 256, size = 1.6) {
  return canvasTex(w, h, (g) => {
    const r = rng(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      g.globalAlpha = alpha * r();
      g.fillStyle = r() < 0.5 ? speck : '#ffffff';
      const s = 0.5 + r() * size;
      g.fillRect(r() * w, r() * h, s, s);
    }
    g.globalAlpha = 1;
  });
}

// superellipsoid ("rounded box") for boxy masks
export function boxy(rx, ry, rz, m, p = 3, o = {}) {
  const g = new THREE.SphereGeometry(1, o.w ?? 48, o.h ?? 32);
  if (o.faceFront) g.rotateY(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const k = 1 / Math.pow(Math.abs(x) ** p + Math.abs(y) ** p + Math.abs(z) ** p, 1 / p);
    pos.setXYZ(i, x * k * rx, y * k * ry, z * k * rz);
  }
  g.computeVertexNormals();
  const me = new THREE.Mesh(g, m);
  if (o.pos) me.position.set(...o.pos);
  return me;
}

// snake: tube with head at path start
export function snake(pts, m, o = {}) {
  const grp = new THREE.Group();
  const r0 = o.r ?? 0.022;
  grp.add(taperTube(pts, t => r0 * (1 - 0.8 * t ** 1.5) * (t < 0.03 ? 0.7 + t * 10 : 1), m, { n: o.n ?? 80, r: 8 }));
  const head = ellipsoid(o.hood ? 0.05 : 0.02, o.hood ? 0.065 : 0.017, o.hood ? 0.011 : 0.032, m, { w: 14, h: 10 });
  const a = new V3(...pts[0]), b = new V3(...pts[1]);
  head.position.copy(a);
  const d = a.clone().sub(b).normalize();
  head.quaternion.setFromUnitVectors(new V3(0, 0, 1), d);
  if (o.hood) { head.quaternion.setFromUnitVectors(new V3(0, 1, 0), d); head.rotation.z += 0; head.position.add(d.clone().multiplyScalar(0.03)); const h2 = ellipsoid(0.018, 0.017, 0.03, m, { w: 10, h: 8 }); h2.position.copy(a.clone().add(d.clone().multiplyScalar(0.075))); h2.position.z += 0.02; grp.add(h2); }
  grp.add(head);
  return grp;
}
