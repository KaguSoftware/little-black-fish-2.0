// Geometry helpers: smooth tubes with shaped cross-sections, ribbons (hair cards, fringe strips),
// lofted rings (garments with real hems), simple colliders for draping.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const V3 = THREE.Vector3;

export function curve(pts, tension = 0.5) {
  return new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : new V3(...p)), false, 'catmullrom', tension);
}

// parallel-transport frames along a curve (no Frenet flips). ref = preferred "normal" direction at start.
export function frames(cv, N, ref = [0, 0, 1]) {
  const T = [], Nn = [], B = [], P = [];
  for (let i = 0; i <= N; i++) { const t = i / N; P.push(cv.getPointAt(t)); T.push(cv.getTangentAt(t).normalize()); }
  let n = new V3(...ref); n.sub(T[0].clone().multiplyScalar(n.dot(T[0])));
  if (n.lengthSq() < 1e-6) n = new V3(1, 0, 0).sub(T[0].clone().multiplyScalar(T[0].x));
  n.normalize();
  for (let i = 0; i <= N; i++) {
    if (i > 0) {
      const ax = new V3().crossVectors(T[i - 1], T[i]);
      const s = ax.length();
      if (s > 1e-6) { ax.normalize(); const ang = Math.asin(Math.min(1, s)) * (T[i - 1].dot(T[i]) < 0 ? -1 : 1); n.applyAxisAngle(ax, ang); }
      n.sub(T[i].clone().multiplyScalar(n.dot(T[i]))).normalize();
    }
    Nn.push(n.clone()); B.push(new V3().crossVectors(T[i], n).normalize());
  }
  return { P, T, N: Nn, B };
}

// Tube with radius r(t, a) (a = angle around, 0 along the ref normal). Capped ends optional.
export function tube(pts, r, o = {}) {
  const cv = pts.isCurve ? pts : curve(pts, o.tension ?? 0.5);
  const N = o.n ?? 48, R = o.r ?? 16;
  const fr = frames(cv, N, o.ref ?? [0, 0, 1]);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = fr.P[i], nn = fr.N[i], bb = fr.B[i];
    for (let j = 0; j <= R; j++) {
      const a = j / R * Math.PI * 2, rr = typeof r === 'number' ? r : r(t, a);
      const c = Math.cos(a), s = Math.sin(a);
      pos.push(p.x + rr * (c * nn.x + s * bb.x), p.y + rr * (c * nn.y + s * bb.y), p.z + rr * (c * nn.z + s * bb.z));
      uv.push(j / R * (o.uRep ?? 1), t * (o.vRep ?? 1));
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
    const a = i * (R + 1) + j, b = a + R + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const caps = o.caps ?? true;
  if (caps) for (const [i, flip] of [[0, true], [N, false]]) {
    const c = fr.P[i], ci = pos.length / 3; pos.push(c.x, c.y, c.z); uv.push(0.5, i / N);
    for (let j = 0; j < R; j++) { const a = i * (R + 1) + j; flip ? idx.push(ci, a + 1, a) : idx.push(ci, a, a + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.userData.curve = cv;
  return g;
}

// Loft: rings stacked by t. ring(t) -> { c:[x,y,z], rx, rz, p (superellipse power, 2 = ellipse), f(a) radial multiplier, dy(a) vertical offset }
// a = angle around Y, 0 = front (+z), increasing towards +x. Outward faces.
export function loft(ring, o = {}) {
  const N = o.n ?? 40, R = o.r ?? 64, a0 = o.a0 ?? 0, aL = o.aLen ?? Math.PI * 2;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, q = ring(t);
    const p = q.p ?? 2;
    for (let j = 0; j <= R; j++) {
      const a = a0 + aL * j / R;
      const s = Math.sin(a), c = Math.cos(a);
      const k = 1 / Math.pow(Math.abs(s) ** p + Math.abs(c) ** p, 1 / p);
      const f = q.f ? q.f(a, t) : 1;
      let x = q.c[0] + s * k * q.rx * f, z = q.c[2] + c * k * q.rz * f, y = q.c[1] + (q.dy ? q.dy(a, t) : 0);
      if (o.deform) { const d = o.deform(x, y, z, a, t); x = d[0]; y = d[1]; z = d[2]; }
      pos.push(x, y, z);
      uv.push(j / R * (o.uRep ?? 1), t * (o.vRep ?? 1));
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
    const a = i * (R + 1) + j, b = a + R + 1;
    o.flip ? idx.push(a, b, a + 1, b, b + 1, a + 1) : idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Ribbon (flat card) along points. w(t) width; outward(p, t) -> V3 normal the card should face.
// u runs across [u0,u1], v runs 1 (root) -> 0 (tip) so canvas-top textures sit at the root.
export function ribbon(pts, w, outward, o = {}) {
  const cv = pts.isCurve ? pts : curve(pts, o.tension ?? 0.5);
  const N = o.n ?? 24;
  const pos = [], uv = [], idx = [];
  const u0 = o.u0 ?? 0, u1 = o.u1 ?? 1;
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = cv.getPointAt(t), T = cv.getTangentAt(t);
    const out = outward(p, t).clone().normalize();
    let side = new V3().crossVectors(T, out);
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    side.normalize();
    if (o.twist) side.applyAxisAngle(T, o.twist(t));
    const ww = (typeof w === 'number' ? w : w(t)) / 2;
    const bow = o.bow ? out.clone().multiplyScalar(o.bow * ww) : new V3();
    pos.push(p.x - side.x * ww + bow.x, p.y - side.y * ww + bow.y, p.z - side.z * ww + bow.z);
    pos.push(p.x, p.y, p.z);
    pos.push(p.x + side.x * ww + bow.x, p.y + side.y * ww + bow.y, p.z + side.z * ww + bow.z);
    const v = (o.v0 ?? 1) - t * ((o.v0 ?? 1) - (o.v1 ?? 0));
    uv.push(u0, v, (u0 + u1) / 2, v, u1, v);
  }
  for (let i = 0; i < N; i++) {
    const a = i * 3;
    idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function merge(geos) {
  const clean = geos.map(g => { const n = g.index ? g : g; if (!n.attributes.normal) n.computeVertexNormals(); return n; });
  return mergeGeometries(clean);
}

// Ellipsoid colliders: push points out of [{c, r:[rx,ry,rz], pad}]
export function collide(pts, cols, iters = 3) {
  const out = pts.map(p => p.isVector3 ? p.clone() : new V3(...p));
  for (let k = 0; k < iters; k++) for (const p of out) for (const C of cols) {
    const d = new V3((p.x - C.c[0]) / C.r[0], (p.y - C.c[1]) / C.r[1], (p.z - C.c[2]) / C.r[2]);
    const L = d.length(), pad = 1 + (C.pad ?? 0);
    if (L < pad && L > 1e-6) {
      d.multiplyScalar(pad / L);
      p.set(C.c[0] + d.x * C.r[0], C.c[1] + d.y * C.r[1], C.c[2] + d.z * C.r[2]);
    }
  }
  return out;
}

export function smooth(pts, iters = 2, keepFirst = true) {
  let p = pts.map(q => q.clone());
  for (let k = 0; k < iters; k++) {
    const n = p.map(q => q.clone());
    for (let i = 1; i < p.length - 1; i++) n[i] = p[i - 1].clone().add(p[i + 1]).multiplyScalar(0.25).add(p[i].clone().multiplyScalar(0.5));
    if (!keepFirst) n[0] = p[0];
    p = n;
  }
  return p;
}

// displace a geometry's vertices along normals by f(x,y,z) (adds folds / lumps after the fact)
export function displace(g, f) {
  g.computeVertexNormals();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), d = f(x, y, z, i);
    p.setXYZ(i, x + n.getX(i) * d, y + n.getY(i) * d, z + n.getZ(i) * d);
  }
  g.computeVertexNormals();
  return g;
}

export function mesh(g, m, name) { const me = new THREE.Mesh(g, m); if (name) me.name = name; return me; }
