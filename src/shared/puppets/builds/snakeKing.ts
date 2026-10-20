import {
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  DoubleSide,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  MirroredRepeatWrapping,
  SphereGeometry,
  Texture,
  Vector3,
  type BufferGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TEXTURES } from "../../content/textures";
import {
  EYE_LIMITS,
  assemblePuppet,
  buildTubeGeometry,
  createEye,
  createHairCurtain,
  createHairStrands,
  createLatheRobe,
  createScaffold,
  createStaff,
  makeBronze,
  makeSkin,
  makeVelvet,
  makeMotion,
  secondaryMotion,
  type EyeRig,
} from "../kit";
import type { BuildOptions, Puppet, PuppetBuilder } from "../types";
import { createCobraNest, makeCobraMaterial, type CobraSpec, type NestDrive } from "./snakeKing/cobras";
import { MASK, buildBeads, buildMask, buildSpikes, maskFrontZ } from "./snakeKing/mask";
import { RingTubes } from "./snakeKing/ringTubes";

/**
 * THE SNAKE KING. Cracked bronze mask under a crown of tall gold spikes, black velvet robe,
 * ten black cobras coiled around him (two rear at the shoulders, flaring when he is angry),
 * hair to the hips, and a carved cobra-headed staff in the right hand.
 */

const WAIST_Y = 1.0;
const NECK_Y = 1.5;
const FACE_Y = 0.2; // mask centre above the neck pivot
const TEX = TEXTURES["snake-king"];

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** [radius, y] profiles, hem to neck. Skirt in root space, bodice in body space (pivot at the waist). */
const SKIRT: [number, number][] = [
  [0.56, 0],
  [0.52, 0.1],
  [0.45, 0.33],
  [0.35, 0.6],
  [0.27, 0.84],
  [0.2, 1.0],
  [0.165, 1.07],
];
const SKIRT_Z = 0.86;
const BODICE: [number, number][] = [
  [0.172, -0.08],
  [0.168, 0.02],
  [0.176, 0.14],
  [0.19, 0.26],
  [0.24, 0.34],
  [0.215, 0.41],
  [0.13, 0.465],
  [0.075, 0.5],
  [0.062, 0.53],
];
const BODICE_Z = 0.72;

function profileAt(p: [number, number][], y: number): number {
  if (y <= p[0][1]) return p[0][0];
  for (let i = 1; i < p.length; i++) {
    if (y <= p[i][1]) {
      const t = (y - p[i - 1][1]) / (p[i][1] - p[i - 1][1]);
      return p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t;
    }
  }
  return p[p.length - 1][0];
}

function spiral(prof: (y: number) => [number, number], y0: number, y1: number, turns: number, a0: number, dir: 1 | -1, off: number): Vector3[] {
  const n = Math.ceil(turns * 9) + 3;
  const pts: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + dir * turns * Math.PI * 2 * t;
    const y = y0 + (y1 - y0) * t;
    const [rx, rz] = prof(y);
    pts.push(new Vector3(Math.sin(a) * (rx + off), y, Math.cos(a) * (rz + off)));
  }
  return pts;
}

/** Coil around a straight axis (arm), in body space. */
function coilAround(a: Vector3, b: Vector3, t0: number, t1: number, turns: number, rad: number, a0: number): Vector3[] {
  const axis = new Vector3().subVectors(b, a).normalize();
  const u = new Vector3().crossVectors(axis, new Vector3(0, 0, 1)).normalize();
  const v = new Vector3().crossVectors(axis, u).normalize();
  const n = Math.ceil(turns * 9) + 3;
  const pts: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = a0 + turns * Math.PI * 2 * t;
    const c = new Vector3().lerpVectors(a, b, t0 + (t1 - t0) * t);
    pts.push(c.addScaledVector(u, Math.cos(ang) * rad).addScaledVector(v, Math.sin(ang) * rad));
  }
  return pts;
}

const mirrored = (t: Texture): Texture => {
  if (t.wrapS !== MirroredRepeatWrapping) {
    t.wrapS = t.wrapT = MirroredRepeatWrapping;
    if (t.image) t.needsUpdate = true;
  }
  return t;
};

function pts(list: number[][], sx: number): Vector3[] {
  return list.map((p) => new Vector3(p[0] * sx, p[1], p[2]));
}

/** Staff carvings: a coiled serpent up the shaft and a hooded cobra head on top. */
function buildStaffCarving(top: Vector3, L: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const helix: Vector3[] = [];
  const turns = 5.5;
  const n = 90;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    const y = L * (0.18 + 0.76 * t);
    const r = 0.026 - t * 0.004;
    helix.push(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  parts.push(
    buildTubeGeometry(new CatmullRomCurve3(helix), {
      tubular: 150,
      radial: 6,
      radius: (s) => 0.0105 * (0.5 + 0.5 * Math.min(1, s * 6)) * (1 - 0.35 * s),
    }),
  );
  const hood = new SphereGeometry(1, 18, 12);
  hood.scale(0.05, 0.085, 0.014);
  hood.translate(top.x, top.y + 0.1, top.z);
  parts.push(hood);
  const neck = new SphereGeometry(1, 10, 8);
  neck.scale(0.016, 0.06, 0.016);
  neck.translate(top.x, top.y + 0.02, top.z);
  parts.push(neck);
  const head = new SphereGeometry(1, 16, 12);
  head.scale(0.024, 0.021, 0.058);
  head.rotateX(0.45);
  head.translate(top.x, top.y + 0.17, top.z + 0.05);
  parts.push(head);
  for (const sx of [-1, 1]) {
    const eye = new SphereGeometry(0.006, 6, 5);
    eye.translate(top.x + sx * 0.016, top.y + 0.18, top.z + 0.065);
    parts.push(eye);
  }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  return g;
}

const build: PuppetBuilder = (opts: BuildOptions): Puppet => {
  const low = opts.quality === "low";
  const q = opts.quality;

  // ── rig scaffold ─────────────────────────────────────────────────────────
  const maskGeo = buildMask(q);
  const sc = createScaffold({
    waistY: WAIST_Y,
    neckY: NECK_Y,
    face: [0, FACE_Y, 0],
    jaw: [0, FACE_Y + maskGeo.hingeY, 0],
    hands: [0.27, 0.86, 0.06],
    feet: [0.11, 0.045, 0.05],
  });
  sc.object.name = "puppet-snake-king";
  const { body, head, face, root } = sc;

  // ── materials ────────────────────────────────────────────────────────────
  const velvetTex = mirrored(opts.texture(TEX.velvet, { srgb: true, repeat: [2, 2.5] }));
  const velvetMat = () => makeVelvet({ color: "#8c8c98", map: velvetTex, sheenColor: "#8497a0", sheen: 1, pile: 0.5 });
  const maskTex = opts.texture(TEX["mask-face"], { srgb: true });
  const maskMat = new MeshStandardMaterial({
    map: maskTex,
    bumpMap: maskTex,
    bumpScale: 1.8,
    color: new Color("#f2e6e0"),
    roughness: 0.52,
    metalness: 0.3,
    envMapIntensity: 1.3,
  });
  const beadMat = makeBronze({ color: "#8a6a3c", cracks: false, seed: 4, roughness: 0.55 });
  const goldMat = new MeshStandardMaterial({ color: "#d8aa4c", metalness: 1, roughness: 0.3, envMapIntensity: 1.8, emissive: new Color("#4a3208"), emissiveIntensity: 0.5 });
  const darkMat = new MeshStandardMaterial({ color: "#060505", roughness: 0.9, metalness: 0 });
  const skinMat = makeSkin("#6c5143");
  const woodMat = new MeshStandardMaterial({ color: "#8c5530", roughness: 0.48, metalness: 0.08, envMapIntensity: 1.1 });
  const embroTex = mirrored(opts.texture(TEX.embroidery, { srgb: true, repeat: [1, 1.4] }));
  const sleeveMat = makeVelvet({ color: "#e4e4e4", map: embroTex, sheenColor: "#3b4a44", sheen: 0.3, pile: 0.3, side: DoubleSide });
  const cobraMat = makeCobraMaterial();

  // ── robe: skirt (root) + bodice (body) ───────────────────────────────────
  const skirt = createLatheRobe(SKIRT, {
    material: velvetMat(),
    quality: q,
    folds: 11,
    foldDepth: 0.075,
    uvRepeat: [1.6, 1],
    capTop: true,
    sway: { amplitude: 0.06, waves: 3, speed: 1.2, flare: 0.05 },
    seed: 5,
  });
  skirt.mesh.scale.z = SKIRT_Z;
  root.add(skirt.mesh);
  const bodice = createLatheRobe(BODICE, {
    material: velvetMat(),
    quality: q,
    folds: 7,
    foldDepth: 0.025,
    uvRepeat: [1.2, 1],
    capTop: true,
    sway: false,
    seed: 2,
  });
  bodice.mesh.scale.z = BODICE_Z;
  body.add(bodice.mesh);

  const collar = new Mesh(new CylinderGeometry(0.066, 0.078, 0.05, 20, 1, true), new MeshStandardMaterial({ color: "#cfc6b2", roughness: 0.9, side: DoubleSide }));
  collar.position.y = 0.5;
  body.add(collar);

  // ── mask, crown, interior ────────────────────────────────────────────────
  const maskUpper = new Mesh(maskGeo.upper, maskMat);
  maskUpper.name = "mask";
  face.add(maskUpper);
  const jawMesh = new Mesh(maskGeo.jaw, maskMat);
  jawMesh.name = "mask-jaw";
  sc.jaw!.add(jawMesh);
  const skull = new Mesh(new SphereGeometry(1, 28, 18), darkMat);
  skull.scale.set(0.094, 0.165, 0.078);
  skull.position.set(0, 0.012, -0.004);
  face.add(skull);
  const beads = new Mesh(buildBeads(q), beadMat);
  beads.name = "crown-beads";
  face.add(beads);
  const spikes = new Mesh(buildSpikes(q), goldMat);
  spikes.name = "crown-spikes";
  face.add(spikes);

  // ── eyes in the slits ────────────────────────────────────────────────────
  const eyeZ = maskFrontZ(MASK.eyeX, MASK.eyeF) - 0.017;
  const eyes: EyeRig[] = [];
  const irisMats: MeshStandardMaterial[] = [];
  const makeEye = (sx: number): EyeRig => {
    const e = createEye({ radius: 0.012, sclera: "#1a120b", iris: "#e6a93a", glow: 1.1, pupilSize: 0.35, lidMaterial: makeBronze({ cracks: false, seed: 6 }) });
    e.group.position.set(sx * MASK.eyeX, maskGeo.eyeY, eyeZ);
    face.add(e.group);
    // inside a slit only the glowing iris and the lid are ever seen: drop the rest to save draw calls
    const ball = e.group.children[0] as Mesh;
    const aim = e.group.children[2];
    ball.visible = false;
    (aim.children[1] as Mesh).visible = false;
    (aim.children[2] as Mesh).visible = false;
    irisMats.push((aim.children[0] as Mesh).material as MeshStandardMaterial);
    return e;
  };
  const eyeL = makeEye(1);
  const eyeR = makeEye(-1);
  eyes.push(eyeL, eyeR);
  sc.eyeAnchorL.position.set(MASK.eyeX, maskGeo.eyeY, maskFrontZ(MASK.eyeX, MASK.eyeF) + 0.004);
  sc.eyeAnchorR.position.set(-MASK.eyeX, maskGeo.eyeY, maskFrontZ(MASK.eyeX, MASK.eyeF) + 0.004);
  face.add(sc.eyeAnchorL, sc.eyeAnchorR);

  // ── hair: a wavy curtain mass for the volume, fewer fine strands for breakup ──
  const HAIR_TOP = 0.3; // head-local height of the hair line
  const hairLen = (phi: number) => 1.2 + 0.14 * Math.max(0, -Math.cos(phi));
  const nearBlack = new Color().setRGB(0.02, 0.013, 0.01);
  const hairTip = new Color().setRGB(0.04, 0.026, 0.018);
  const curtain = createHairCurtain({
    radiusX: 0.114,
    radiusZ: 0.108,
    center: [0, HAIR_TOP, -0.008],
    arc: [0.95, Math.PI * 2 - 0.95],
    length: hairLen,
    color: nearBlack,
    tipColor: hairTip,
    layers: 3,
    rows: low ? 10 : 22,
    quality: q,
    roughness: 0.62,
    seed: 31,
    profile: (t, phi, layer) => {
      // drape over the shoulders at the sides, fall behind the body at the back, soft waves all the way down
      const side = Math.abs(Math.sin(phi));
      const ramp = sstep(0.04, 0.42, t);
      const base = 0.012 + ramp * (0.03 + 0.14 * side) + 0.05 * sstep(0.45, 1, t) * (1 - side);
      const wave = Math.sin(t * 8.5 + phi * 3.3 + layer * 1.7) * 0.016 * sstep(0.1, 0.5, t);
      return Math.max(0.01, base + wave + layer * 0.01);
    },
  });
  curtain.material.sheen = 0;
  curtain.material.sheenColor = new Color().setRGB(0.12, 0.07, 0.04);
  curtain.material.specularIntensity = 0.04;
  head.add(curtain.object);
  const hair = createHairStrands({
    count: 420,
    length: 1.2,
    quality: q,
    color: nearBlack,
    tipColor: hairTip,
    thickness: 0.0021,
    curl: 0.6,
    gravity: 0.97,
    stiffness: 0.05,
    lengthVariation: 0.3,
    roughness: 0.65,
    sheen: 0.1,
    seed: 11,
    rootShape: (i) => {
      const f1 = (i * 0.6180339887) % 1;
      const f2 = (i * 0.7548776662) % 1;
      const phi = 1.5 + f1 * (Math.PI * 2 - 3.0);
      const y = 0.12 + Math.pow(f2, 0.85) * 0.2;
      const k = 1 - 0.1 * sstep(0.27, 0.34, y);
      const sinP = Math.sin(phi);
      const cosP = Math.cos(phi);
      return {
        pos: { x: sinP * 0.118 * k, y, z: cosP * 0.112 * k },
        normal: { x: sinP * 0.3, y: -0.95, z: cosP * 0.3 },
      };
    },
  });
  hair.material.sheen = 0;
  hair.material.sheenColor = new Color().setRGB(0.1, 0.06, 0.035);
  hair.material.specularIntensity = 0.08;
  head.add(hair.object);

  // ── arms: wide velvet sleeves that follow the hands ──────────────────────
  const RINGS = 16;
  const sleeves = new RingTubes(2, RINGS, 10, (_i, k) => (k / (RINGS - 1)) * 1.0, 1);
  const sleeveMesh = new Mesh(sleeves.geometry, sleeveMat);
  sleeveMesh.frustumCulled = false;
  sleeveMesh.name = "sleeves";
  body.add(sleeveMesh);
  const shoulderX = 0.2;
  const shoulderY = 0.36;
  const invBody = new Matrix4();
  const wv = new Vector3();
  const poseSleeves = () => {
    body.updateMatrix();
    invBody.copy(body.matrix).invert();
    for (let side = 0; side < 2; side++) {
      const hand = side === 0 ? sc.handL! : sc.handR!;
      const sx = side === 0 ? 1 : -1;
      wv.copy(hand.position).applyMatrix4(invBody);
      const Sx = sx * shoulderX;
      const Sy = shoulderY;
      const Cx = (Sx + wv.x) / 2 + sx * 0.1;
      const Cy = (Sy + wv.y) / 2 - 0.04;
      const Cz = wv.z / 2 - 0.14;
      const po = side * RINGS * 3;
      const ro = side * RINGS;
      for (let k = 0; k < RINGS; k++) {
        const t = k / (RINGS - 1);
        const a = (1 - t) * (1 - t);
        const b = 2 * t * (1 - t);
        const c = t * t;
        sleeves.P[po + k * 3] = a * Sx + b * Cx + c * wv.x;
        sleeves.P[po + k * 3 + 1] = a * Sy + b * Cy + c * wv.y;
        sleeves.P[po + k * 3 + 2] = b * Cz + c * wv.z;
        const r = 0.064 + 0.02 * Math.sin(Math.min(1, t * 1.1) * Math.PI * 0.6) + (t > 0.9 ? -0.05 * ((t - 0.9) / 0.1) : 0) + 0.018 * t;
        sleeves.RX[ro + k] = r;
        sleeves.RY[ro + k] = r * 0.92;
      }
      sleeves.build(side);
    }
    sleeves.flush();
  };

  // ── hands and staff ──────────────────────────────────────────────────────
  const fistGeo = new SphereGeometry(1, 14, 10);
  const fistL = new Mesh(fistGeo, skinMat);
  fistL.scale.set(0.03, 0.05, 0.032);
  fistL.position.y = -0.02;
  sc.handL!.add(fistL);
  const fistR = new Mesh(fistGeo, skinMat);
  fistR.scale.set(0.036, 0.034, 0.036);
  sc.handR!.add(fistR);

  const STAFF_L = 1.62;
  const staff = createStaff({ length: STAFF_L, radius: 0.0165, material: woodMat, trimMaterial: beadMat, crooked: 0.008, knots: 2, seed: 3 });
  const carve = new Mesh(buildStaffCarving(staff.top.position, STAFF_L), woodMat);
  carve.name = "staff-carving";
  staff.object.add(carve);
  staff.object.position.copy(staff.grip.position).multiplyScalar(-1);
  sc.handR!.add(staff.object);
  // the right hand rests a little ahead of the hip, the staff at his side
  sc.handR!.position.set(-0.3, 1.0, 0.16);

  // ── cobras ───────────────────────────────────────────────────────────────
  const bodyProf = (y: number): [number, number] => [profileAt(BODICE, y) * 1.0, profileAt(BODICE, y) * BODICE_Z];
  const skirtProf = (y: number): [number, number] => [profileAt(SKIRT, y), profileAt(SKIRT, y) * SKIRT_Z];
  const R = 0.024;
  const shoulder = (sx: 1 | -1, phase: number): CobraSpec => ({
    rest: pts(
      [
        [0.05, -0.05, -0.15],
        [0.17, 0.0, -0.13],
        [0.26, 0.08, -0.04],
        [0.28, 0.17, 0.08],
        [0.24, 0.25, 0.15],
        [0.25, 0.34, 0.14],
        [0.3, 0.43, 0.08],
        [0.31, 0.53, 0.07],
        [0.29, 0.6, 0.13],
        [0.27, 0.62, 0.2],
      ],
      sx * 1.1,
    ),
    reared: pts(
      [
        [0.05, -0.05, -0.15],
        [0.17, 0.0, -0.13],
        [0.26, 0.08, -0.04],
        [0.28, 0.17, 0.08],
        [0.26, 0.3, 0.12],
        [0.31, 0.5, 0.08],
        [0.32, 0.68, 0.07],
        [0.31, 0.8, 0.1],
        [0.3, 0.86, 0.17],
        [0.29, 0.87, 0.25],
      ],
      sx * 1.1,
    ),
    radius: R * 1.08,
    gain: 1,
    phase,
    slither: 0.6,
    hood: 0.12,
  });
  const upper: CobraSpec[] = [shoulder(1, 0.4), shoulder(-1, 2.6)];
  const armS = (sx: number) => new Vector3(sx * 0.2, 0.34, 0.0);
  const armW = (sx: number) => new Vector3(sx * 0.27, -0.12, 0.05);
  upper.push({
    rest: spiral(bodyProf, -0.06, 0.3, 1.3, 2.0, -1, R * 0.75),
    radius: R,
    gain: 0.55,
    phase: 1.3,
    lift: 0.09,
    out: 0.05,
  });
  if (!low) {
    upper.push({
      rest: spiral(bodyProf, 0.3, -0.06, 1.0, -0.5, 1, R * 0.75),
      radius: R * 0.95,
      gain: 0.55,
      phase: 3.7,
      lift: 0.08,
      out: 0.05,
    });
    upper.push({
      rest: coilAround(armS(1), armW(1), 0.05, 0.7, 1.6, 0.083, 0.4),
      radius: R * 0.85,
      gain: 0.5,
      phase: 5.1,
      lift: 0.07,
      out: 0.04,
    });
    upper.push({
      rest: coilAround(armS(-1), armW(-1), 0.7, 0.05, 1.5, 0.083, 1.9),
      radius: R * 0.85,
      gain: 0.5,
      phase: 0.9,
      lift: 0.07,
      out: 0.04,
    });
  }
  const lower: CobraSpec[] = [
    { rest: spiral(skirtProf, 0.03, 0.8, 1.4, 0.6, 1, R * 0.8), radius: R * 1.05, gain: 0.55, phase: 2.2, lift: 0.09, out: 0.06 },
  ];
  if (!low) {
    lower.push(
      { rest: spiral(skirtProf, 0.9, 0.12, 1.1, 3.4, -1, R * 0.8), radius: R, gain: 0.55, phase: 4.4, lift: 0.09, out: 0.06 },
      { rest: spiral(skirtProf, 0.1, 0.62, 1.0, -1.7, 1, R * 0.8), radius: R * 0.95, gain: 0.55, phase: 0.2, lift: 0.09, out: 0.06 },
      { rest: spiral(skirtProf, 0.72, 0.28, 0.8, 1.9, 1, R * 0.8), radius: R * 0.9, gain: 0.55, phase: 3.1, lift: 0.09, out: 0.06 },
    );
  }
  const nestUpper = createCobraNest(upper.map((s) => s), q, cobraMat);
  body.add(nestUpper.object);
  const nestLower = createCobraNest(lower, q, cobraMat);
  root.add(nestLower.object);

  // ── frame update ─────────────────────────────────────────────────────────
  const motion = makeMotion();
  const irisBase = 1.1;
  const drive: NestDrive = { rear: 0, slither: 1, speed: 1, flare: 0, look: 0 };
  const update = (ctx: Parameters<Puppet["update"]>[0]) => {
    const m = secondaryMotion(ctx, motion);
    hair.update(ctx.time, m);
    curtain.update(ctx.time, m);
    skirt.update(ctx.time, m);
    const slither = 0.8 + ctx.anger * 0.7 + ctx.walk * 0.4;
    drive.rear = ctx.anger;
    drive.slither = slither;
    drive.speed = 1 + ctx.anger * 0.9 + ctx.walk * 0.3;
    drive.flare = ctx.surprise;
    drive.look = ctx.lookYaw;
    nestUpper.update(ctx.time, drive);
    nestLower.update(ctx.time, drive);
    poseSleeves();
    eyeL.sync();
    eyeR.sync();
    const glow = irisBase + ctx.anger * 1.6 + ctx.surprise * 0.6;
    for (const mat of irisMats) mat.emissiveIntensity = glow;
  };
  poseSleeves();

  return assemblePuppet({
    id: "snake-king",
    scaffold: sc,
    height: 2.05,
    waistY: WAIST_Y,
    pupilL: eyeL.pupil,
    pupilR: eyeR.pupil,
    lidL: eyeL.lid ?? undefined,
    lidR: eyeR.lid ?? undefined,
    limits: {
      headYaw: 0.55,
      headPitch: 0.3,
      pupil: eyeL.pupilRange,
      lidNeutral: EYE_LIMITS.lidNeutral,
      lidOpen: EYE_LIMITS.lidOpen,
      lidClosed: EYE_LIMITS.lidClosed,
      jawOpen: 0.5,
      gait: "biped",
      stride: 0.42,
    },
    update,
    dispose() {
      hair.dispose();
      curtain.dispose();
      eyes.forEach((e) => e.dispose());
      nestUpper.dispose();
      nestLower.dispose();
      sleeves.dispose();
      staff.dispose();
      cobraMat.dispose();
      skirt.dispose();
      bodice.dispose();
    },
  });
};

export default build;
