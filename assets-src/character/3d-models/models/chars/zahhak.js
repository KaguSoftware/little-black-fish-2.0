import * as THREE from 'three';
import { human2, hand, J2 } from '../body.js';
import { pbr, rng } from '../pbr.js';
import { tube, loft, mesh, curve, merge } from '../geo.js';
import { hairMat, hairBaseMat, growHair, pushOut } from '../hair.js';
import * as TX from '../tex_zahhak.js';
import { linen } from '../tex_eblis.js';

export const frame = { ty: 0.98, dist: 5.6, fov: 24, size: [900, 1300] };
const V3 = THREE.Vector3;
const pre = TX.pre;
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const prof = keys => t => { for (let i = 0; i < keys.length - 1; i++) { const [t0, v0] = keys[i], [t1, v1] = keys[i + 1]; if (t <= t1) { const k = (t - t0) / (t1 - t0), s = k * k * (3 - 2 * k); return v0 + (v1 - v0) * s; } } return keys[keys.length - 1][1]; };

// cobra / snake head: wedge-shaped head pointing along d, optional flared hood behind it (normal facing d)
function snakeHead(tip, d, up, r0, hood, m) {
  const grp = new THREE.Group();
  const z = d.clone().normalize(), y0 = up.clone().normalize();
  const x = new V3().crossVectors(y0, z).normalize(), y = new V3().crossVectors(z, x).normalize();
  const basis = new THREE.Matrix4().makeBasis(x, y, z);
  const hg = new THREE.SphereGeometry(1, 20, 14);
  const p = hg.attributes.position;
  for (let i = 0; i < p.count; i++) { const X = p.getX(i), Y = p.getY(i), Z = p.getZ(i); const k = 1 - 0.55 * Math.max(0, Z) ** 1.2; p.setXYZ(i, X * r0 * 0.85 * k, Y * r0 * 0.5 * (1 - 0.35 * Math.max(0, Z)), Z * r0 * 1.9); }
  hg.computeVertexNormals();
  const h = new THREE.Mesh(hg, m); h.name = 'SnakeHead';
  h.applyMatrix4(basis); h.position.copy(tip.clone().sub(z.clone().multiplyScalar(r0 * 0.6)));
  grp.add(h);
  if (hood) {
    const hd = new THREE.SphereGeometry(1, 20, 14);
    const q = hd.attributes.position;
    for (let i = 0; i < q.count; i++) { const X = q.getX(i), Y = q.getY(i), Z = q.getZ(i); q.setXYZ(i, X * r0 * 1.7 * (1 - 0.45 * Math.max(0, -Y)) * (1 - 0.3 * Math.max(0, Y)), Y * r0 * 2.4, Z * r0 * 0.32 - X * X * r0 * 0.35); }
    hd.computeVertexNormals();
    const hm = new THREE.Mesh(hd, m); hm.name = 'CobraHood';
    // hood stands along the neck (y = up), faces forward (z = d flattened)
    const zf = new V3(d.x, 0, d.z).normalize(); const yf = new V3(0, 1, 0); const xf = new V3().crossVectors(yf, zf).normalize();
    hm.applyMatrix4(new THREE.Matrix4().makeBasis(xf, yf, zf));
    hm.position.copy(tip.clone().sub(z.clone().multiplyScalar(r0 * 1.6)).add(new V3(0, -r0 * 2.6, 0)).sub(zf.clone().multiplyScalar(r0 * 0.8)));
    grp.add(hm);
  }
  return grp;
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
  const g = new THREE.Group(); g.name = 'Zahhak';
  const r = rng(91);
  const SP = 0.04;
  const skinCol = '#5a3e33';
  const body = human2({ skin: skinCol, spread: SP });
  // replace his right arm (-x) with a posed one that grips the staff
  const drop = [];
  body.traverse(o => { if (o.isMesh && ['Arm', 'Deltoid', 'Palm', 'Finger', 'Thumb'].includes(o.name)) { o.geometry.computeBoundingBox(); const c = new V3(); o.geometry.boundingBox.getCenter(c); o.localToWorld(c); if (c.x < -0.12) drop.push(o); } });
  for (const o of drop) o.parent.remove(o);
  g.add(body);
  const skinM = body.getObjectByName('Torso').material;
  const S = new V3(-J2.shoulder[0], J2.shoulder[1], J2.shoulder[2]), E = new V3(-0.25, 1.17, 0.05), W = new V3(-0.27, 1.04, 0.2);
  {
    const rr = prof([[0, 0.05], [0.12, 0.05], [0.3, 0.041], [0.47, 0.034], [0.58, 0.037], [0.75, 0.031], [1, 0.024]]);
    g.add(mesh(tube([S.clone().add(new V3(0.012, 0.012, 0)), S, S.clone().lerp(E, 0.5), E, E.clone().lerp(W, 0.5), W], t => rr(t), { n: 30, r: 16 }), skinM, 'ArmR'));
    g.add(hand(W, E, -1, skinM, { curl: 1.1 }));
  }
  const WL = new V3(J2.wrist[0] + SP, J2.wrist[1], J2.wrist[2]), EL = new V3(J2.elbow[0] + SP * 0.5, J2.elbow[1], J2.elbow[2]), SL = new V3(J2.shoulder[0], J2.shoulder[1], J2.shoulder[2]);

  // ---------- black crushed-velvet robe, floor length
  const velvetM = pbr({ surf: TX.velvet([5, 6]), sheen: 0.7, sheenColor: '#4a4e5a', sheenRough: 0.3, name: 'CrushedVelvet' });
  const rRx = prof([[0, 0.32], [0.3, 0.27], [0.6, 0.225], [0.8, 0.205], [0.92, 0.2], [0.97, 0.15], [1, 0.075]]);
  const rRz = prof([[0, 0.25], [0.3, 0.2], [0.6, 0.15], [0.8, 0.13], [0.92, 0.12], [0.97, 0.1], [1, 0.07]]);
  const ph = Array.from({ length: 5 }, () => r() * 6.28);
  const robeF = (a, t) => 1 + (0.012 + 0.06 * (1 - t) ** 1.3) * (Math.sin(9 * a + ph[0]) * 0.6 + Math.sin(15 * a + ph[1] + t * 2) * 0.35 + Math.sin(5 * a + ph[2]) * 0.4);
  const RH = 1.53;
  g.add(mesh(loft(t => ({ c: [0, t * RH, -0.01], rx: rRx(t), rz: rRz(t), f: robeF }), {
    n: 50, r: 120, uRep: 5, vRep: 6,
    deform: (x, y, z, a, t) => { if (t < 0.02) { const k = 1.06; return [x * k, 0.006, z * k]; } return [x, y, z]; },
  }), velvetM, 'Robe'));
  // white standing collar
  const collarM = pbr({ surf: linen('#e9e4da', [3, 1], 8), sheen: 0.3, name: 'Collar' });
  g.add(mesh(loft(t => ({ c: [0, 1.5 + t * 0.075, 0.0], rx: 0.068 - 0.006 * t, rz: 0.062 - 0.004 * t, p: 2.2 }), { n: 6, r: 40 }), collarM, 'Collar'));

  // ---------- wide velvet sleeves with dragon embroidery
  const dragonSurf = TX.dragonSleeve();
  let dragonMat = null;
  const sleeve = (P, sgn) => {
    const sr = prof([[0, 0.075], [0.25, 0.08], [0.6, 0.095], [1, 0.115]]);
    const s = dragonSurf;
    const m = dragonMat ?? pbr({ surf: s, sheen: 0.6, sheenColor: '#454a55', sheenRough: 0.32, name: 'DragonSleeve' });
    dragonMat = m;
    for (const t of [m.map, m.normalMap, m.roughnessMap]) { t.offset.x = 0.27; }
    return mesh(tube(P, (t, a) => sr(t) * (1 + 0.05 * Math.sin(5 * a + sgn) * t), { n: 30, r: 40, ref: [0, 0, 1], caps: false }), m, 'Sleeve');
  };
  g.add(sleeve([SL.clone().add(new V3(-0.03, 0.03, 0)), SL.clone().lerp(EL, 0.5), EL, EL.clone().lerp(WL, 0.5), WL.clone().add(new V3(0, -0.03, 0))], 1));
  g.add(sleeve([S.clone().add(new V3(0.03, 0.03, 0)), S.clone().lerp(E, 0.5), E, E.clone().lerp(W, 0.5), W.clone().add(new V3(0, -0.02, -0.01))], -1));

  // ---------- cracked bronze mask: tall boxy head-covering face
  {
    const mg = new THREE.SphereGeometry(1, 72, 56);
    mg.rotateY(-Math.PI / 2);
    const p = mg.attributes.position, P = 3.1;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const k = 1 / Math.pow(Math.abs(x) ** P + Math.abs(y) ** P + Math.abs(z) ** P, 1 / P);
      x *= k; y *= k; z *= k;
      const taper = 1 - 0.12 * Math.max(0, -y);
      const jaw = 1 - 0.16 * Math.max(0, -y - 0.2); let X = x * 0.09 * taper * jaw, Y = y * 0.16, Z = z * 0.105 * taper;
      if (z > 0.3) {
        const f = sstep(0.3, 0.8, z);
        // brow ridge, eye sockets, nose, mouth, chin
        Z += f * 2.4 * (0.006 * Math.exp(-(((Y - 0.035) / 0.012) ** 2)) * Math.exp(-((X / 0.07) ** 2))
          - 0.007 * Math.exp(-(((Y - 0.015) / 0.014) ** 2)) * Math.exp(-(((Math.abs(X) - 0.038) / 0.02) ** 2))
          + 0.02 * Math.exp(-((X / 0.011) ** 2)) * sstep(0.03, -0.015, Y) * sstep(-0.06, -0.035, Y)
          + 0.004 * Math.exp(-(((Y + 0.085) / 0.008) ** 2)) * Math.exp(-((X / 0.025) ** 2))
          - 0.004 * Math.exp(-(((Y + 0.1) / 0.005) ** 2)) * Math.exp(-((X / 0.03) ** 2)));
      }
      p.setXYZ(i, X, Y, Z);
    }
    mg.computeVertexNormals();
    const maskM = pbr({ surf: TX.crackedMask([1, 1]), irid: 0.25, iridIOR: 1.45, iridRange: [280, 520], env: 1.1, side: THREE.FrontSide, name: 'CrackedBronzeMask' });
    const m = mesh(mg, maskM, 'Mask'); m.position.set(0, 1.71, 0.018); g.add(m);
    const slit = pbr({ color: '#050404', rough: 0.9, name: 'EyeSlit' });
    for (const s of [-1, 1]) {
      const e = new THREE.SphereGeometry(1, 16, 8); e.scale(0.022, 0.0042, 0.006); e.rotateZ(-0.06 * s);
      const em = mesh(e, slit, 'EyeSlit'); em.position.set(0.038 * s, 1.722, 0.018 + 0.103); g.add(em);
    }
    const mo = new THREE.SphereGeometry(1, 16, 8); mo.scale(0.022, 0.0028, 0.005);
    const mm = mesh(mo, slit, 'Mouth'); mm.position.set(0, 1.616, 0.018 + 0.1); g.add(mm);
  }

  // ---------- crown: tall aged gold spikes, dark jewels, band of dark bronze balls
  {
    const gold = pbr({ surf: TX.crownGold(), env: 1.15, name: 'CrownGold' });
    const bronze = pbr({ surf: TX.darkBronze(), env: 1.1, name: 'CrownBronze' });
    const jewel = pbr({ color: '#1b0d10', rough: 0.15, clearcoat: 1, clearcoatRough: 0.05, name: 'Jewel' });
    const cy = 1.86, crx = 0.1, crz = 0.108, cz = 0.012;
    g.add(mesh(loft(t => ({ c: [0, cy - 0.02 + t * 0.03, cz], rx: crx + 0.004, rz: crz + 0.004, p: 2.6 }), { n: 3, r: 64, uRep: 3 }), bronze, 'CrownBand'));
    const balls = [], beadsG = [], spikes = [], jewels = [];
    const ring = (a, k = 1) => [Math.sin(a) * crx * k, Math.cos(a) * crz * k + cz];
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2, [x, z] = ring(a, 1.08); const b = new THREE.SphereGeometry(0.021, 14, 10); b.translate(x, cy + 0.02, z); balls.push(b); }
    for (let i = 0; i < 40; i++) { const a = (i + 0.5) / 40 * Math.PI * 2, [x, z] = ring(a, 1.06); const b = new THREE.SphereGeometry(0.007, 8, 6); b.translate(x, cy - 0.005, z); beadsG.push(b); }
    for (let i = 0; i < 16; i++) {
      const a = (i + 0.5) / 16 * Math.PI * 2, [x, z] = ring(a, 0.98);
      const front = Math.cos(a), h = 0.17 + 0.05 * Math.max(0, front) + 0.025 * r();
      const pts = [[x, cy + 0.03, z], [x * 1.02, cy + 0.03 + h * 0.5, z * 1.0 + 0.002], [x * 1.04, cy + 0.03 + h, z * 1.01]];
      spikes.push(tube(pts, t => 0.0085 * (1 - t) ** 0.85 * (t < 0.1 ? 1.35 : 1) + 0.0005, { n: 16, r: 10 }));
      const j = new THREE.SphereGeometry(1, 12, 10); j.scale(0.009, 0.013, 0.006); j.lookAt(new V3(x, 0, z - cz));
      j.translate(x * 1.06, cy + 0.055, (z - cz) * 1.06 + cz); jewels.push(j);
    }
    g.add(mesh(merge(balls), bronze, 'CrownBalls')); g.add(mesh(merge(beadsG), bronze, 'CrownBeads'));
    g.add(mesh(merge(spikes), gold, 'CrownSpikes')); g.add(mesh(merge(jewels), jewel, 'CrownJewels'));
  }

  // ---------- big wavy grey-brown hair, knee length at the back
  const ho = { base: pre('#26211c'), light: pre('#6c6459'), dark: pre('#0c0a08'), seed: 22, lightAmt: 0.9, wave: 0.06, waveF: 6, frizz: 0.02, tipMin: 0.3, spread: 0.8 };
  const hm = hairMat({ ...ho, rough: 0.58, aniso: 0.35, spec: 0.45 }), hb = hairBaseMat({ ...ho, rough: 0.6 });
  const head = { c: [0, 1.72, 0.0], r: [0.1, 0.15, 0.112] };
  const robeCol = { type: 'zcol', y0: 0.0, y1: 1.56, rx: y => 0.34, rz: y => rRz(Math.min(1, y / RH)) * 1.05 + 0.03, cz: -0.01 };
  const hairO = {
    head, part: 'crown', crownPolar: 0.35, departPolar: a => 1.5 + 0.25 * Math.abs(a) / Math.PI,
    colliders: [{ c: head.c, r: head.r, pad: 0.03 }, robeCol], side: a => Math.abs(a) < 1.4 ? 1 : -1,
    mat: hm, baseMat: hb, pad: 0.03, wave: 0.07, waveF: 11, volume: 0.07,
  };
  for (const [a0, a1, sd] of [[1.45, Math.PI, 31], [-Math.PI, -1.45, 32]]) {
    const hh = growHair({ ...hairO, seed: sd, count: 300, azRange: [a0, a1], tipY: (a, rr) => 0.45 + rr() * 0.3 + 0.15 * (1 - (Math.abs(a) - 1.45) / 1.7), width: 0.04, flare: 0.16, taper: 0.45, base: { count: 18, width: 0.08, shorter: 0.15 } });
    g.add(hh.cards); g.add(hh.base);
  }
  for (const [a0, a1, sd] of [[0.75, 1.3, 33], [-1.3, -0.75, 34]]) {
    const hh = growHair({ ...hairO, seed: sd, count: 45, azRange: [a0, a1], tipY: (a, rr) => 0.9 + rr() * 0.15, width: 0.04, flare: 0.0, taper: 0.45, lean: (a, t) => [Math.sign(a) * 0.03 * t, 0.02 * t], base: { count: 8, width: 0.06, shorter: 0.1 } });
    g.add(hh.cards); g.add(hh.base);
  }

  // ---------- snakes: loose S-curves draped over him, cobra heads raised
  const scaleM = pbr({ surf: TX.scales([4, 1]), env: 0.9, nScale: 1.8, sheen: 0.3, sheenColor: '#5a6060', name: 'SnakeScales' });
  const headM = pbr({ surf: TX.scales([1, 1]), env: 0.9, nScale: 0.4, clearcoat: 0.25, clearcoatRough: 0.3, name: 'SnakeHeadSkin' });
  const bodyCols = [{ type: 'col', y0: 0, y1: 1.5, rx: y => rRx(Math.min(1, y / RH)) * 1.06 + 0.02, rz: y => rRz(Math.min(1, y / RH)) * 1.06 + 0.02, cz: -0.01 },
    { c: [0, 1.5, -0.01], r: [0.19, 0.08, 0.13], pad: 0.12 }, { c: [0.24, 1.15, 0.0], r: [0.12, 0.3, 0.12], pad: 0.05 }];
  const snakes = [];
  const addSnake = (ctrl, r0, hood = false, collide = true) => {
    r0 *= 1.3;
    let pts = curve(ctrl, 0.5).getSpacedPoints(Math.max(20, ctrl.length * 8));
    if (collide) pts = pts.map((p, i) => i < 4 ? p : pushOut(p, bodyCols));
    const cv = curve(pts, 0.5);
    const L = cv.getLength();
    snakes.push(tube(pts, (t, a) => {
      const neck = t < 0.04 ? 0.75 + t * 6 : 1;
      return r0 * neck * (1 - 0.92 * sstep(0.45, 1, t)) * (1 - 0.18 * Math.max(0, -Math.cos(a)) ** 2);
    }, { n: Math.round(L * 120), r: 12, ref: [0, 1, 0], vRep: Math.max(1, Math.round(L * 24)) }));
    // head: points along the first segment direction (pts[0] is the snout end)
    const a = cv.getPointAt(0), b = cv.getPointAt(0.02), d = a.clone().sub(b).normalize();
    g.add(snakeHead(a, d, cv.getTangentAt(0.07).negate(), r0, hood, headM));
  };
  // 1. around the neck: head raised over his left shoulder, body over the right shoulder and down the chest
  addSnake([[0.13, 1.58, 0.22], [0.15, 1.58, 0.15], [0.17, 1.5, 0.1], [0.14, 1.46, -0.06], [0, 1.5, -0.13], [-0.15, 1.47, -0.07], [-0.2, 1.44, 0.08], [-0.12, 1.3, 0.17], [0.05, 1.18, 0.19], [0.13, 1.05, 0.2], [0.04, 0.92, 0.22], [-0.06, 0.82, 0.24]], 0.024, false, true);
  // 2. raised head at his right shoulder, body down the back in loose S bends
  addSnake([[-0.12, 1.6, 0.2], [-0.15, 1.6, 0.13], [-0.17, 1.52, 0.07], [-0.2, 1.42, -0.06], [-0.12, 1.3, -0.17], [0.06, 1.15, -0.17], [0.12, 0.95, -0.2], [-0.06, 0.75, -0.24], [-0.12, 0.55, -0.27]], 0.022, false, true);
  // 3. across the chest and belly
  addSnake([[0.06, 1.38, 0.22], [0.0, 1.36, 0.16], [-0.12, 1.25, 0.16], [-0.14, 1.12, 0.17], [0.0, 1.02, 0.2], [0.18, 0.92, 0.21], [0.2, 0.78, 0.23]], 0.02, false, true);
  // 4. lower robe front, head near the hem rising
  addSnake([[0.16, 0.2, 0.36], [0.15, 0.13, 0.33], [0.05, 0.2, 0.3], [-0.12, 0.33, 0.28], [-0.08, 0.5, 0.25], [0.08, 0.62, 0.24], [0.12, 0.74, 0.22]], 0.023, false, true);
  // 5. over his left arm, head near the left wrist
  addSnake([[0.36, 0.86, 0.13], [0.33, 0.92, 0.12], [0.36, 1.02, 0.02], [0.3, 1.12, -0.08], [0.32, 1.24, 0.08], [0.24, 1.36, 0.06], [0.2, 1.42, -0.06]], 0.019, false, true);
  // 6. down his right side to the knee
  addSnake([[-0.3, 0.45, 0.16], [-0.3, 0.52, 0.12], [-0.27, 0.62, 0.15], [-0.31, 0.75, 0.04], [-0.27, 0.9, -0.08], [-0.24, 1.02, -0.02], [-0.25, 1.12, 0.06]], 0.02, false, true);
  // 7. lower back coils
  addSnake([[0.3, 0.12, -0.26], [0.25, 0.18, -0.25], [0.1, 0.3, -0.27], [-0.1, 0.4, -0.25], [-0.2, 0.25, -0.27], [-0.05, 0.12, -0.32], [0.12, 0.06, -0.32]], 0.022, false, true);
  // 8. raised horn-like pair rising beside the head (both shoulders)
  addSnake([[0.2, 1.66, 0.12], [0.22, 1.63, 0.05], [0.24, 1.55, 0.0], [0.2, 1.46, 0.06], [0.08, 1.43, 0.15], [-0.04, 1.33, 0.19], [-0.1, 1.2, 0.18]], 0.024, false, true);
  addSnake([[-0.21, 1.66, 0.1], [-0.23, 1.62, 0.04], [-0.24, 1.54, -0.02], [-0.18, 1.45, 0.05], [-0.06, 1.38, 0.18], [0.08, 1.28, 0.19], [0.16, 1.15, 0.18], [0.1, 1.0, 0.21]], 0.024, false, true);
  // 9. over the upper arms / sleeves
  addSnake([[0.33, 1.06, 0.12], [0.3, 1.1, 0.14], [0.22, 1.18, 0.16], [0.3, 1.28, 0.12], [0.34, 1.36, -0.02], [0.24, 1.42, -0.1]], 0.02, false, true);
  addSnake([[-0.2, 1.02, 0.28], [-0.22, 1.08, 0.22], [-0.3, 1.16, 0.08], [-0.33, 1.28, -0.04], [-0.25, 1.38, 0.1]], 0.02, false, true);
  // 10. lower robe loops at the sides and back
  addSnake([[-0.22, 0.12, 0.3], [-0.24, 0.18, 0.26], [-0.3, 0.3, 0.12], [-0.22, 0.42, 0.22], [-0.06, 0.55, 0.26], [-0.2, 0.68, 0.2]], 0.024, false, true);
  addSnake([[0.32, 0.5, 0.0], [0.3, 0.56, -0.05], [0.26, 0.42, -0.18], [0.12, 0.62, -0.23], [0.24, 0.8, -0.17], [0.27, 0.95, -0.02]], 0.022, false, true);
  g.add(mesh(merge(snakes), scaleM, 'Snakes'));
  {
    const eyeM = pbr({ color: '#0a0806', rough: 0.1, clearcoat: 1, name: 'SnakeEye' });
    // eyes are part of the heads' darkness; skipped as separate geometry to keep heads clean
    void eyeM;
  }

  // ---------- twisted dark wood staff with a cobra head
  {
    const woodM = pbr({ surf: TX.wood([2, 14]), clearcoat: 0.35, clearcoatRough: 0.35, name: 'StaffWood' });
    const gx = W.x - 0.02, gz = W.z + 0.04;
    const pts = []; for (let i = 0; i <= 20; i++) { const y = i / 20 * 1.5; pts.push([gx - 0.01 * Math.sin(y * 2) + 0.004 * Math.sin(y * 9), y, gz + 0.006 * Math.cos(y * 7)]); }
    pts.push([gx - 0.005, 1.55, gz + 0.01]);
    g.add(mesh(tube(pts, (t, a) => (0.019 + 0.003 * Math.sin(t * 40)) * (1 + 0.2 * Math.sin(2 * a + t * 70)) * (t > 0.97 ? 0.9 : 1), { n: 160, r: 16, vRep: 1 }), woodM, 'Staff'));
    // carved cobra: neck rises from the staff, hood flared, head tipped forward
    const top = new V3(gx - 0.005, 1.55, gz + 0.01);
    const neckPts = [top.clone(), top.clone().add(new V3(0, 0.05, 0.0)), top.clone().add(new V3(0, 0.1, 0.012)), top.clone().add(new V3(0, 0.13, 0.03))];
    g.add(mesh(tube(neckPts, t => 0.017 - 0.004 * t, { n: 12, r: 14 }), woodM, 'StaffNeck'));
    g.add(snakeHead(top.clone().add(new V3(0, 0.15, 0.05)), new V3(0, -0.3, 1).normalize(), new V3(0, 1, 0.15).normalize(), 0.032, true, woodM));
  }
  return jpegTextures(g);
}
