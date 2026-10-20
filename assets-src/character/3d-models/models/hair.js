// Hair system: strand-card textures (colour + alpha + strand relief) and generators that
// grow cards from a part line over the skull, drape them past colliders and cut them.
import * as THREE from 'three';
import { makeCanvas, heightToNormal, rng } from './pbr.js';
import { ribbon, merge, collide, smooth, curve } from './geo.js';
const V3 = THREE.Vector3;

const hex = c => { const v = new THREE.Color(c); return [v.r * 255, v.g * 255, v.b * 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// strand texture: canvas top = root, bottom = tip
export function strandTex(o = {}) {
  const w = o.w ?? 512, h = o.h ?? 1024, r = rng(o.seed ?? 3);
  const base = hex(o.base ?? '#111'), light = hex(o.light ?? '#555'), dark = hex(o.dark ?? '#000');
  const A = makeCanvas(w, h), a = A.getContext('2d');
  const Hc = makeCanvas(w, h), hh = Hc.getContext('2d');
  hh.fillStyle = '#000'; hh.fillRect(0, 0, w, h);
  if (o.solid) { a.fillStyle = `rgb(${base.join(',')})`; a.fillRect(0, 0, w, h); }
  const n = o.count ?? 1600;
  a.lineCap = hh.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x0 = w * (0.5 + (r() - 0.5) * (o.spread ?? 0.94));
    const end = o.blunt ? h * (0.96 + r() * 0.04) : h * ((o.tipMin ?? 0.55) + r() * (1 - (o.tipMin ?? 0.55)));
    const start = o.rootMin ? h * r() * o.rootMin : 0;
    const lw = (o.wMin ?? 0.9) + r() * (o.wVar ?? 1.8);
    const tcol = r(), c = tcol < 0.33 ? mix(base, light, r() * (o.lightAmt ?? 0.8)) : tcol < 0.66 ? mix(base, dark, r() * 0.8) : base;
    const amp = (o.wave ?? 0) * (0.6 + r() * 0.8), fq = (o.waveF ?? 3) * (0.8 + r() * 0.4), ph = r() * 6.28;
    const frizz = o.frizz ?? 0;
    const steps = 24;
    const path = [];
    for (let k = 0; k <= steps; k++) {
      const y = start + (end - start) * k / steps;
      const tt = y / h;
      path.push([x0 + Math.sin(tt * fq * 6.28 + ph) * amp * w * tt + (r() - 0.5) * frizz * w * tt, y]);
    }
    const al = (o.alphaMin ?? 0.75) + r() * (1 - (o.alphaMin ?? 0.75));
    // draw tapered: thick part then thinner toward tip
    for (let seg = 0; seg < 3; seg++) {
      const k0 = Math.floor(seg * steps / 3), k1 = Math.floor((seg + 1) * steps / 3);
      const lwS = lw * (1 - seg * 0.28);
      a.strokeStyle = `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${al})`; a.lineWidth = lwS;
      a.beginPath(); a.moveTo(...path[k0]); for (let k = k0 + 1; k <= k1; k++) a.lineTo(...path[k]); a.stroke();
      const hv = 120 + r() * 135;
      hh.strokeStyle = `rgb(${hv | 0},${hv | 0},${hv | 0})`; hh.lineWidth = lwS;
      hh.beginPath(); hh.moveTo(...path[k0]); for (let k = k0 + 1; k <= k1; k++) hh.lineTo(...path[k]); hh.stroke();
    }
  }
  // fade alpha toward the very top edge rows so card roots blend into the scalp
  const id = a.getImageData(0, 0, w, h);
  if (o.rootFade) for (let y = 0; y < h * o.rootFade; y++) { const k = y / (h * o.rootFade); for (let x = 0; x < w; x++) id.data[(y * w + x) * 4 + 3] *= k; }
  a.putImageData(id, 0, 0);
  const mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; return t; };
  return { map: mk(A, true), normalMap: mk(heightToNormal(Hc, o.nStrength ?? 1.5), false) };
}

export function hairMat(o = {}) {
  const t = o.tex ?? strandTex(o);
  const m = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: t.map, normalMap: t.normalMap,
    roughness: o.rough ?? 0.5, metalness: 0, side: THREE.DoubleSide,
    alphaTest: o.alphaTest ?? 0.42,
  });
  m.normalScale.set(o.nScale ?? 0.6, o.nScale ?? 0.6);
  m.anisotropy = o.aniso ?? 0.5; m.anisotropyRotation = Math.PI / 2;
  m.sheen = o.sheen ?? 0.08; m.sheenColor = new THREE.Color(o.sheenColor ?? o.light ?? '#666'); m.sheenRoughness = 0.4;
  m.specularIntensity = o.spec ?? 0.5;
  m.name = o.name ?? 'Hair';
  return m;
}
// solid version for the underlayer (no alpha): same colour family
export function hairBaseMat(o = {}) {
  const t = strandTex({ ...o, solid: true, count: (o.count ?? 1600), seed: (o.seed ?? 3) + 5 });
  const m = new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: t.map, normalMap: t.normalMap, roughness: o.rough ?? 0.5, metalness: 0, side: THREE.DoubleSide });
  m.normalScale.set(0.5, 0.5);
  m.anisotropy = o.aniso ?? 0.5; m.anisotropyRotation = Math.PI / 2;
  m.sheen = o.sheen ?? 0.08; m.sheenColor = new THREE.Color(o.sheenColor ?? o.light ?? '#666'); m.sheenRoughness = 0.4;
  m.specularIntensity = o.spec ?? 0.5;
  m.name = (o.name ?? 'Hair') + 'Base';
  return m;
}

// Column collider: elliptical cylinder whose radii vary with height (torso, shoulders, cloak)
export function pushOut(p, cols) {
  for (const C of cols) {
    if (C.type === 'col') {
      if (p.y < C.y0 || p.y > C.y1) continue;
      const rx = C.rx(p.y) * (1 + (C.pad ?? 0)), rz = C.rz(p.y) * (1 + (C.pad ?? 0));
      const cx = C.cx ?? 0, cz = typeof C.cz === 'function' ? C.cz(p.y) : (C.cz ?? 0);
      const dx = (p.x - cx) / rx, dz = (p.z - cz) / rz, L = Math.hypot(dx, dz);
      if (L < 1 && L > 1e-6) { p.x = cx + dx / L * rx; p.z = cz + dz / L * rz; }
    } else if (C.type === 'zcol') {
      // torso slab: resolve by moving front/back only (hair rests on chest or back, never flares sideways)
      if (p.y < C.y0 || p.y > C.y1) continue;
      const rx = C.rx(p.y), rz = C.rz(p.y) + (C.pad ?? 0);
      const cz = typeof C.cz === 'function' ? C.cz(p.y) : (C.cz ?? 0);
      const dx = p.x / rx; if (Math.abs(dx) >= 1) continue;
      const zs = rz * Math.sqrt(1 - dx * dx);
      const side = p.userData?.side ?? Math.sign(p.z - cz || 1);
      if (side > 0 && p.z < cz + zs) p.z = cz + zs;
      if (side < 0 && p.z > cz - zs) p.z = cz - zs;
    } else {
      const d = new V3((p.x - C.c[0]) / C.r[0], (p.y - C.c[1]) / C.r[1], (p.z - C.c[2]) / C.r[2]);
      const L = d.length(), pad = 1 + (C.pad ?? 0);
      if (L < pad && L > 1e-6) { d.multiplyScalar(pad / L); p.set(C.c[0] + d.x * C.r[0], C.c[1] + d.y * C.r[1], C.c[2] + d.z * C.r[2]); }
    }
  }
  return p;
}

// Grow one strand path. az = azimuth (0 front, +x side positive), returns V3[]
// head = { c, r } skull ellipsoid; o.part: 'center' | 'crown'; o.departPolar(az) polar angle (rad from top) where it leaves the skull
export function strandPath(az, o, r) {
  const { c, r: R } = o.head;
  const pad = 1 + (o.pad ?? 0.04) + (r() - 0.5) * (o.padJit ?? 0.02);
  const dirTo = (pol, a) => new V3(Math.sin(pol) * Math.sin(a), Math.cos(pol), Math.sin(pol) * Math.cos(a));
  const onHead = d => new V3(c[0] + d.x * R[0] * pad, c[1] + d.y * R[1] * pad, c[2] + d.z * R[2] * pad);
  let root;
  if (o.part === 'center') {
    // root on the part line x≈0; front strands rooted at the hairline, back strands at the crown
    const psi = Math.min(Math.PI * 0.95, Math.abs(az)) * (o.partSpan ?? 0.8);
    const pol0 = o.hairline ?? 0.5;
    root = new V3(Math.sign(az || 1) * 0.02, Math.cos(pol0 * Math.cos(psi)), Math.sin(pol0) * Math.cos(psi) * 0.9).normalize();
    // keep root on the part line
    root.x = Math.sign(az || 1) * 0.015;
    root.normalize();
  } else {
    root = dirTo(o.crownPolar ?? 0.25, az + Math.PI);
  }
  const pol = o.departPolar(az);
  const dep = dirTo(pol, az);
  const pts = [];
  const NS = 8;
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    const d = root.clone().lerp(dep, t).normalize();
    pts.push(onHead(d));
  }
  // fall
  const D = pts[pts.length - 1].clone();
  const tipY = o.tipY(az, r);
  const fallN = Math.max(4, Math.ceil((D.y - tipY) / 0.04));
  const flare = o.flare ?? 0;
  for (let i = 1; i <= fallN; i++) {
    const t = i / fallN;
    const y = D.y + (tipY - D.y) * t;
    const out = new V3(D.x - c[0], 0, D.z - c[2]).normalize();
    const p = new V3(D.x + out.x * flare * t, y, D.z + out.z * flare * t);
    if (o.lean) { const l = o.lean(az, t); p.x += l[0]; p.z += l[1]; }
    pts.push(p);
  }
  // collide + smooth a few rounds so the strand drapes over shoulders/back
  let P = pts;
  const side = o.side ? o.side(az) : Math.sign(Math.cos(az) || 1);
  const tag = p => { p.userData = { side }; return p; };
  for (let k = 0; k < (o.relax ?? 4); k++) {
    P = P.map(p => pushOut(tag(p.clone()), o.colliders ?? []));
    P = smooth(P, 1);
  }
  P = P.map(p => pushOut(tag(p), o.colliders ?? []));
  // waves / frizz after draping
  if (o.wave) {
    const ph = r() * 6.28, A = o.wave * (0.7 + r() * 0.6), F = (o.waveF ?? 6) * (0.85 + r() * 0.3);
    const L0 = NS;
    P = P.map((p, i) => {
      if (i <= L0 - 2) return p;
      const t = (i - L0 + 2) / (P.length - L0 + 2);
      const out = new V3(p.x - c[0], 0, p.z - c[2]).normalize();
      const side = new V3(-out.z, 0, out.x);
      const s = Math.sin(t * F + ph) * A * Math.min(1, t * 3);
      return p.clone().add(side.multiplyScalar(s)).add(out.clone().multiplyScalar(Math.abs(s) * 0.5 + (o.volume ?? 0) * Math.min(1, t * 2)));
    });
    P = P.map(p => pushOut(tag(p), o.colliders ?? []));
  }
  return P;
}

// Build a set of hair cards. Returns { cards: Mesh, base: Mesh|null }
export function growHair(o) {
  const r = rng(o.seed ?? 11);
  const geos = [], baseGeos = [];
  const c = o.head.c;
  const outward = (p) => new V3(p.x - c[0], Math.max(0, p.y - c[1]) * 1.2, p.z - c[2]);
  const azs = [];
  const n = o.count ?? 160;
  for (let i = 0; i < n; i++) {
    const a = o.azRange[0] + (o.azRange[1] - o.azRange[0]) * ((i + r() * 0.9) / n);
    if (o.skip && o.skip(a)) continue;
    azs.push(a);
  }
  for (const az of azs) {
    const P = strandPath(az, o, r);
    const w = (o.width ?? 0.04) * (0.7 + r() * 0.6);
    const u0 = r() * 0.6, u1 = u0 + 0.25 + r() * 0.15;
    const taper = o.taper ?? 0.5;
    geos.push(ribbon(P, t => w * (1 - taper * t ** 1.5) * (t < 0.04 ? 0.6 + t * 10 : 1), outward, { n: o.segs ?? 28, u0, u1, bow: o.bow ?? 0.25, tension: 0.5 }));
  }
  if (o.base) {
    const nb = o.base.count ?? 48;
    for (let i = 0; i < nb; i++) {
      const az = o.azRange[0] + (o.azRange[1] - o.azRange[0]) * ((i + 0.5) / nb);
      if (o.skip && o.skip(az)) continue;
      const P = strandPath(az, { ...o, pad: (o.pad ?? 0.04) - 0.012, padJit: 0, wave: o.wave ? o.wave * 0.6 : 0, tipY: (a, rr) => o.tipY(a, rr) + (o.base.shorter ?? 0.03) }, r);
      baseGeos.push(ribbon(P, o.base.width ?? 0.07, outward, { n: o.segs ?? 28, bow: 0.15 }));
    }
  }
  const cards = new THREE.Mesh(merge(geos), o.mat); cards.name = (o.name ?? 'Hair') + 'Cards';
  const base = baseGeos.length ? new THREE.Mesh(merge(baseGeos), o.baseMat ?? o.mat) : null;
  if (base) base.name = (o.name ?? 'Hair') + 'Base';
  return { cards, base };
}

// Fringe: cards rooted behind the front hairline, laid forward over the forehead, cut straight at cutY
export function fringe(o) {
  const r = rng(o.seed ?? 21);
  const { c, r: R } = o.head;
  const geos = [];
  const n = o.count ?? 40;
  for (let i = 0; i < n; i++) {
    const az = o.azRange[0] + (o.azRange[1] - o.azRange[0]) * ((i + r()) / n);
    const pad = 1 + (o.pad ?? 0.05) + r() * 0.025;
    const pts = [];
    const pol0 = o.rootPolar ?? 0.35, pol1 = Math.acos(Math.max(-1, Math.min(1, (o.cutY - c[1]) / (R[1] * pad))));
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, pol = pol0 + (pol1 - pol0) * t;
      const d = new V3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az));
      // lift off the forehead a little (fringe stands proud of the mask)
      const lift = 1 + (o.lift ?? 0.06) * Math.sin(Math.PI * Math.min(1, t * 1.2));
      pts.push(new V3(c[0] + d.x * R[0] * pad * lift, c[1] + d.y * R[1] * pad, c[2] + d.z * R[2] * pad * lift));
    }
    const last = pts[pts.length - 1]; last.y = o.cutY + (r() - 0.5) * (o.cutJit ?? 0.004);
    const w = (o.width ?? 0.03) * (0.7 + r() * 0.6);
    const u0 = r() * 0.6;
    geos.push(ribbon(pts, w, p => new V3(p.x - c[0], (p.y - c[1]) * 0.3, p.z - c[2]), { n: 16, u0, u1: u0 + 0.3, bow: 0.2 }));
  }
  const m = new THREE.Mesh(merge(geos), o.mat); m.name = 'Fringe';
  return m;
}
