import * as THREE from 'three';
import { humanS } from '../body_siyamak.js';
import { pbr, rng, fbm } from '../pbr.js';
import { tube, loft, mesh, displace, curve } from '../geo.js';
import { hairMat, hairBaseMat, growHair } from '../hair.js';
import * as TS from '../tex_siyamak.js';

export const frame = { ty: 0.9, dist: 5.2, fov: 24, size: [900, 1300] };
const V3 = THREE.Vector3;

function skin(surf, name) { return pbr({ surf, sheen: 0.2, sheenColor: '#ffd9c8', nScale: 0.6, name }); }

export function build() {
  const g = new THREE.Group(); g.name = 'Siyamak';

  // ---- skin: every part gets its own hand-drawn writing ----
  const torsoS = TS.skinSurface('torso', 5, {
    count: 240, size: 40, yMax: 0.72,
    density: (u, v) => { const front = Math.cos(u * 6.283); return 0.4 + 0.6 * Math.max(0, front) ** 0.7; },
    flush: (u, v) => { // nipples + shoulder/chest redness
      let f = 0; for (const uc of [0.072, 0.928]) f += Math.exp(-(((u - uc) / 0.012) ** 2 + ((v - 0.27) / 0.012) ** 2)) * 2.5;
      return f + 0.25 * Math.exp(-(((v - 0.1) / 0.1) ** 2));
    },
    paint: (L, w, h, r, wrap) => {
      // gold glitter band across the collarbones
      wrap(dx => { for (let i = 0; i < 9; i++) { const u = -0.16 + i * 0.04; TS.glitter(L, u * w + dx, h * (0.07 + 0.02 * Math.sin(i)), 60, 22, r, { density: 0.45 }); } });
      // torn paper patches on the chest + lower ribs, glitter patch on the belly
      wrap(dx => {
        TS.paper(L, w * 0.88 + dx, h * 0.18, 80, 64, r, { paint: '#e1a77f' }); TS.paper(L, w * 0.9 + dx, h * 0.33, 60, 70, r);
        TS.paper(L, w * 0.05 + dx, h * 0.33, 50, 40, r); TS.paper(L, w * 0.12 + dx, h * 0.47, 70, 60, r, { paint: '#d79a6b' });
        TS.glitter(L, w * 0.09 + dx, h * 0.52, 90, 70, r, { density: 0.35 });
        TS.glitter(L, w * 0.93 + dx, h * 0.5, 50, 60, r, { density: 0.3 });
      });
      // two tall teal strokes down the centre of the chest, a cross under them
      wrap(dx => {
        TS.glyph(L, 'I', w * 0.975 + dx, h * 0.32, 120, TS.INK.teal, r, { lw: 14, rot: 0.03 });
        TS.glyph(L, 'I', w * 0.03 + dx, h * 0.31, 110, TS.INK.navy, r, { lw: 13, rot: -0.04 });
        TS.glyph(L, 'plus', w * 0.0 + dx, h * 0.46, 70, TS.INK.teal, r, { lw: 8 });
        TS.word(L, w * 0.06 + dx, h * 0.27, 17, TS.INK.navy, r, 5);
        TS.glyph(L, 'arrow', w * 0.04 + dx, h * 0.42, 60, TS.INK.red, r, { lw: 6 });
        TS.glyph(L, 'N', w * 0.22 + dx, h * 0.18, 70, TS.INK.teal, r, { lw: 10 });
        TS.glyph(L, 'hash', w * 0.24 + dx, h * 0.3, 60, TS.INK.teal, r, { lw: 8 });
      });
      // back: large red-brown blots and dark letters
      for (const [u, v, rx, ry] of [[0.5, 0.35, 34, 70], [0.44, 0.22, 26, 30], [0.57, 0.5, 30, 26], [0.6, 0.2, 20, 26]]) {
        L.a.save(); L.a.globalAlpha = 0.75; L.a.fillStyle = r() < 0.5 ? '#8c3a2a' : '#5a3326'; L.a.beginPath(); L.a.ellipse(u * w, v * h, rx, ry, r(), 0, 6.28); L.a.fill(); L.a.restore();
      }
      TS.glyph(L, 'Y', w * 0.47, h * 0.12, 60, TS.INK.black, r, { lw: 9 });
    },
  });
  const armS = [TS.skinSurface('arm', 21, { count: 90, size: 34 }), TS.skinSurface('arm', 33, { count: 90, size: 34 })];
  const legS = [TS.skinSurface('leg', 41, { count: 80, size: 40, yMax: 0.62 }), TS.skinSurface('leg', 57, { count: 80, size: 40, yMax: 0.62 })];
  const torsoM = skin(torsoS, 'SkinTorso');
  const armM = armS.map((s, i) => skin(s, 'SkinArm' + i));
  const legM = legS.map((s, i) => skin(s, 'SkinLeg' + i));
  const plain = skin(TS.skinSurface('arm', 9, { count: 0 }), 'Skin');
  const neckM = skin(TS.skinSurface('arm', 63, { count: 10, size: 30 }), 'SkinNeck');
  const body = humanS({ neckMat: neckM, male: true, thin: 0.55, spread: -0.005, curl: 0.45, trunkMat: torsoM, mat: plain, armMatFor: s => armM[s > 0 ? 1 : 0], legMatFor: s => legM[s > 0 ? 1 : 0] });
  g.add(body);

  // ---- paper-collage mask: tall rectangle, torn edges, bent around the face ----
  const maskSurf = TS.maskSurface();
  const maskM = pbr({ surf: maskSurf, side: THREE.DoubleSide, sheen: 0.15, sheenColor: '#fff4dc', name: 'CollageMask' });
  {
    const W = 0.178, H = 0.262, r = rng(12);
    const shp = new THREE.Shape();
    const N = 60, pts = [];
    for (let i = 0; i < N; i++) {
      const t = i / N, side = Math.floor(t * 4), f = (t * 4) % 1;
      let x, y;
      if (side === 0) { x = -W / 2 + W * f; y = -H / 2; } else if (side === 1) { x = W / 2; y = -H / 2 + H * f; } else if (side === 2) { x = W / 2 - W * f; y = H / 2; } else { x = -W / 2; y = H / 2 - H * f; }
      // slightly wider at the jaw, torn paper edge
      x *= 1 + 0.04 * (-y / H);
      pts.push(new THREE.Vector2(x + (r() - 0.5) * 0.004, y + (r() - 0.5) * 0.004));
    }
    shp.setFromPoints(pts);
    const eg = new THREE.ExtrudeGeometry(shp, { depth: 0.003, bevelEnabled: false, curveSegments: 4 });
    // subdivide-free bend: rebuild as a fine grid instead for smooth curvature
    const pg = new THREE.PlaneGeometry(W, H, 40, 56);
    const pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i);
      const xx = x * (1 + 0.04 * (-y / H));
      const z = -((xx / 0.1) ** 2) * 0.055 - ((y / 0.2) ** 2) * 0.012 + 0.003 * (fbm(x * 4 + 0.5, y * 4 + 0.5, 6, 3, 4) - 0.5);
      pp.setXYZ(i, xx, y, z);
    }
    // torn edge: drop the outermost cells with an alpha-free jagged trim (move border verts inward)
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), y = pp.getY(i);
      const ex = Math.abs(x) > W * 0.49 * (1 + 0.04 * (-y / H)), ey = Math.abs(y) > H * 0.495;
      if (ex) pp.setX(i, x * (1 - 0.012 * r()));
      if (ey) pp.setY(i, y * (1 - 0.01 * r()));
    }
    pg.computeVertexNormals();
    eg.dispose();
    const mk = mesh(pg, maskM, 'CollageMask');
    mk.position.set(0, 1.678, 0.116); mk.rotation.z = -0.02; mk.rotation.x = -0.03;
    g.add(mk);
    // rim: thin paper edge so the mask reads as a card, not a decal
    const rimM = pbr({ color: '#d9ccb2', rough: 0.9, name: 'MaskEdge' });
    const back = mesh(pg.clone(), rimM, 'MaskBack'); back.position.copy(mk.position).add(new V3(0, 0, -0.003)); back.rotation.copy(mk.rotation); g.add(back);
    // folded-paper nose with dark nostrils
    const noseM = pbr({ surf: maskSurf, name: 'MaskNose' });
    const ng = new THREE.BufferGeometry();
    const top = [0, 0.045, 0.0], tip = [0, -0.04, 0.036], l = [-0.021, -0.046, 0.0], rr = [0.021, -0.046, 0.0];
    ng.setAttribute('position', new THREE.Float32BufferAttribute([...top, ...tip, ...l, ...top, ...rr, ...tip, ...l, ...tip, ...rr], 3));
    ng.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0.6, 0.5, 0.42, 0.45, 0.4, 0.5, 0.6, 0.55, 0.4, 0.5, 0.42, 0.45, 0.4, 0.5, 0.42, 0.55, 0.4], 2));
    ng.computeVertexNormals();
    const nose = mesh(ng, noseM, 'MaskNose'); nose.position.set(0, 1.683, 0.117); g.add(nose);
    const dark = pbr({ color: '#140f0c', rough: 0.9, name: 'Nostril' });
    for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(1, 10, 8), dark); e.scale.set(0.0065, 0.004, 0.004); e.position.set(0.009 * s, 1.639, 0.139); g.add(e); }
    // mask straps hidden under the hair
  }

  // ---- shoulder-length+ dark brown messy hair ----
  const ho = { base: '#4a3727', light: '#9c7a5c', dark: '#1a120c', seed: 31, wave: 0.008, waveF: 4, frizz: 0.02, tipMin: 0.25, count: 1300 };
  const hm = hairMat({ ...ho, rough: 0.58, aniso: 0.35, sheen: 0.12 }), hb = hairBaseMat({ ...ho, rough: 0.6 });
  const head = { c: [0, 1.69, -0.004], r: [0.092, 0.128, 0.104] };
  const torsoCol = { type: 'zcol', y0: 0.9, y1: 1.5, rx: y => 0.26, rz: y => 0.105 + (y > 1.38 ? 0.0 : -0.005), cz: -0.012, pad: 0.012 };
  const H = growHair({
    head, part: 'center', count: 330, azRange: [-Math.PI, Math.PI], skip: a => Math.abs(a) < 0.62,
    departPolar: a => 1.45 + 0.4 * Math.abs(a) / Math.PI, tipY: (a, r) => 1.2 + (Math.abs(a) > 2 ? 0.02 : 0.04) + r() * 0.14,
    colliders: [{ c: head.c, r: head.r, pad: 0.1 }, torsoCol], side: a => Math.abs(a) < 1.7 ? 1 : -1, pad: 0.1,
    wave: 0.02, waveF: 6, volume: 0.03, flare: 0.07,
    mat: hm, baseMat: hb, base: { count: 30, width: 0.06, shorter: 0.14 }, width: 0.032, seed: 8, taper: 0.7,
  });
  g.add(H.cards); if (H.base) g.add(H.base);
  // flyaway strands
  {
    const r = rng(77); const geos = [];
    const thin = hairMat({ ...ho, seed: 44, count: 300, rough: 0.6 });
    const fly = growHair({ head, part: 'center', count: 40, azRange: [-Math.PI, Math.PI], skip: a => Math.abs(a) < 0.7,
      departPolar: a => 1.3 + 0.4 * Math.abs(a) / Math.PI, tipY: (a, rr) => 1.33 + rr() * 0.12, colliders: [{ c: head.c, r: head.r, pad: 0.09 }, torsoCol],
      side: a => Math.abs(a) < 1.7 ? 1 : -1, pad: 0.11, wave: 0.02, waveF: 5, flare: 0.02, mat: thin, width: 0.01, seed: 3 });
    g.add(fly.cards);
  }
  // scalp cap
  { const sg = new THREE.SphereGeometry(1, 32, 20, 0, Math.PI * 2, 0, 1.9); sg.scale(head.r[0] * 1.03, head.r[1] * 1.03, head.r[2] * 1.03); const cap = mesh(sg, hb, 'Scalp'); cap.position.set(...head.c); g.add(cap); }

  // ---- worn teal jacket tied at the waist ----
  const jS = TS.jacketSurface([3, 2]);
  const jM = pbr({ surf: jS, sheen: 0.35, sheenColor: '#6ea2a6', sheenRough: 0.6, nScale: 1.2, name: 'TealJacket' });
  const jS2 = TS.jacketSurface([1.5, 1]);
  const jM2 = pbr({ surf: jS2, sheen: 0.35, sheenColor: '#6ea2a6', sheenRough: 0.6, nScale: 1.2, name: 'TealJacketSleeve' });
  // body of the jacket hanging round the hips like a wrap
  const skirt = loft(t => {
    const y = 1.045 - t * 0.44;
    return {
      c: [0, y, 0.004], rx: 0.168 + 0.05 * Math.min(1, t * 1.8) ** 0.8, rz: 0.112 + 0.03 * Math.min(1, t * 1.8) ** 0.8, p: 2.2,
      f: (a) => 1 + (0.035 * Math.sin(6 * a + 0.7) + 0.02 * Math.sin(11 * a + 2.1 + t * 3) + 0.015 * Math.sin(17 * a)) * Math.min(1, t * 1.4),
      dy: (a) => t > 0.97 ? (0.018 * Math.sin(3 * a + 1) + 0.012 * Math.sin(7 * a) + (Math.cos(a) > 0.2 && Math.sin(a) < 0 ? -0.03 : 0)) * t : 0,
    };
  }, { n: 34, r: 96, uRep: 2 });
  displace(skirt, (x, y, z) => 0.006 * (fbm(x * 2 + 0.5, y * 2, 4, 3, 7) - 0.5));
  g.add(mesh(skirt, jM, 'JacketBody'));
  // twisted sleeve roll round the waist (two sleeves) meeting in a knot at the front
  const ring = (y, rx, rz, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [Math.sin(a) * rx, y + 0.006 * Math.sin(a * 3), Math.cos(a) * rz + 0.004]; });
  g.add(mesh(tube(ring(1.03, 0.185, 0.128, 0.32, Math.PI * 1.02), (t, a) => 0.034 * (1 + 0.15 * Math.sin(t * 13) ** 2) * (1 - 0.18 * Math.abs(Math.sin(a + t * 9))), { n: 90, r: 14 }), jM2, 'SleeveRollL'));
  g.add(mesh(tube(ring(1.02, 0.186, 0.13, Math.PI * 0.98, Math.PI * 2 - 0.05), (t, a) => 0.032 * (1 + 0.15 * Math.sin(t * 11 + 1) ** 2) * (1 - 0.18 * Math.abs(Math.sin(a + t * 8))), { n: 90, r: 14 }), jM2, 'SleeveRollR'));
  // knot: lumpy cloth bunch slightly right of centre
  {
    const kg = new THREE.SphereGeometry(1, 28, 20); kg.scale(0.055, 0.04, 0.035);
    displace(kg, (x, y, z) => 0.012 * (fbm(x * 9 + 0.5, y * 9 + 0.5, 3, 3, 21) - 0.5) + 0.006 * Math.sin(x * 140 + y * 60));
    const k = mesh(kg, jM2, 'Knot'); k.position.set(0.055, 1.025, 0.14); k.rotation.z = 0.4; g.add(k);
    const kg2 = new THREE.SphereGeometry(1, 20, 14); kg2.scale(0.04, 0.03, 0.03);
    displace(kg2, (x, y, z) => 0.008 * (fbm(x * 9, y * 9 + 0.3, 3, 3, 5) - 0.5));
    const k2 = mesh(kg2, jM2, 'Knot2'); k2.position.set(0.02, 1.035, 0.15); g.add(k2);
  }
  // sleeve ends hanging from the knot: one long flat panel (cuff end) and one short one
  const flat = (rw, rt) => (t, a) => { const ca = Math.cos(a), sa = Math.sin(a); return 1 / Math.sqrt((ca / rt(t)) ** 2 + (sa / rw(t)) ** 2); };
  g.add(mesh(tube([[0.075, 1.02, 0.152], [0.09, 0.95, 0.172], [0.1, 0.86, 0.178], [0.104, 0.76, 0.172], [0.106, 0.715, 0.168]],
    flat(t => 0.064 + 0.01 * t, t => 0.012 + 0.004 * Math.sin(t * 9)), { n: 40, r: 20, ref: [0, 0, 1] }), jM2, 'SleeveEnd'));
  g.add(mesh(tube([[0.04, 1.02, 0.16], [0.025, 0.97, 0.168], [0.018, 0.92, 0.165]],
    flat(t => 0.036 + 0.006 * t, t => 0.01), { n: 16, r: 16, ref: [0, 0, 1] }), jM2, 'SleeveEnd2'));
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
