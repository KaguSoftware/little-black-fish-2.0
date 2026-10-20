import {
  Group,
  Mesh,
  MeshStandardMaterial,
  MirroredRepeatWrapping,
  type BufferGeometry,
} from "three";
import type { PuppetBuilder, PuppetFrameContext } from "../types";
import {
  EYE_LIMITS,
  assemblePuppet,
  createEye,
  createHairCurtain,
  createHairStrands,
  createLatheRobe,
  createScaffold,
  createStaff,
  makeKnit,
  makeMotion,
  makeSkin,
  makeStone,
  addPatch,
  secondaryMotion,
  type EyeRig,
} from "../kit";
import { TEXTURES } from "../../content/textures";
import { createLimbSet } from "./child/limbs";
import { capsule, ellipsoid, merge, uvWindow } from "./child/parts";
import { elderHairTexture } from "./elder/hairTex";
import { SLIT_X, SLIT_Y, createStoneMaskGeometry, frontZ } from "./elder/stoneMask";

/**
 * The Elder: tall, heavy and slow. A long thick bouclé knit coat to the ankles, a narrow stone mask with a
 * long nose and two tiny eye slits (the real eyes glint inside), very long grey-white hair that falls from
 * the crown over the shoulders and back and under the mask like a beard, a crooked staff in the right hand.
 *
 * Draw calls (high): coat 1, sleeves 1, hands 2, shoes 2, mask 2, eyes 10, staff 2, hair 3 = 23.
 */

const H = 1.95;
const WAIST_Y = 1.05;
const NECK_Y = 1.5;
/** Mask centre, head space. */
const FACE: readonly [number, number, number] = [0, 0.19, 0.085];
const SHOULDER_X = 0.265;
const SHOULDER_Y = 1.36 - WAIST_Y;
const WRIST_UP = 0.05;
const ARM = { l1: 0.29, l2: 0.28 };
const HAND_L: readonly [number, number, number] = [0.31, 0.79, 0.03];
const HAND_R: readonly [number, number, number] = [-0.3, 0.95, 0.13];

const build: PuppetBuilder = (opts) => {
  const low = opts.quality === "low";
  const sc = createScaffold({
    waistY: WAIST_Y,
    neckY: NECK_Y,
    face: FACE,
    jaw: null,
    hands: HAND_L,
    feet: [0.1, 0, 0.02],
  });
  sc.object.name = "puppet-elder";
  sc.handR!.position.set(HAND_R[0], HAND_R[1], HAND_R[2]);
  const { root, body, head, face } = sc;

  // ── materials ─────────────────────────────────────────────────────────────
  const knitTex = opts.texture(TEXTURES.elder.knit, { srgb: true, repeat: [1, 1] });
  const knit = makeKnit({ map: knitTex, repeat: [1, 1], roughness: 0.96, bumpScale: 0.3 });
  knit.bumpMap?.repeat.set(2.5, 2.5);
  if (knit.map) {
    knit.map.wrapS = knit.map.wrapT = MirroredRepeatWrapping;
  }
  if (knit.bumpMap) knit.bumpMap.wrapS = knit.bumpMap.wrapT = MirroredRepeatWrapping;
  knit.color.setRGB(1.5, 1.15, 1.4);
  // the swatch photo is dark and muddy: lift it and push the pink / green flecks apart
  addPatch(knit, {
    key: "elderKnitBoost",
    fragmentColor: `
      {
        float l = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = max(mix(vec3(l), diffuseColor.rgb, 2.7), vec3(0.0));
        diffuseColor.rgb = pow(diffuseColor.rgb, vec3(0.9)) * vec3(1.2, 1.05, 1.1);
      }`,
  });
  const skin = makeSkin("#85746a");
  skin.roughness = 0.75;
  const shoeMat = new MeshStandardMaterial({ color: "#1b1613", roughness: 0.55, metalness: 0.05 });
  const woodMat = new MeshStandardMaterial({ color: "#5a4230", roughness: 0.82 });
  const ironMat = new MeshStandardMaterial({ color: "#2a2724", roughness: 0.5, metalness: 0.6 });
  const stoneMat = makeStone({ color: "#ecebe6", seed: 6, bumpScale: 2.5, roughness: 0.92 });
  stoneMat.color.setRGB(2.1, 2.2, 2.3);
  stoneMat.bumpScale = 1.4;
  // flatten the procedural mottling toward a pale, even grey (the real mask is clean porous stone)
  addPatch(stoneMat, {
    key: "elderStoneFlatten",
    fragmentColor: "diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.333))) * 1.15, 0.8);",
  });

  // ── coat (heavy knit, folds, hem sways) ──────────────────────────────────
  const prof: [number, number][] = [
    [0.375, 0.04], [0.355, 0.25], [0.32, 0.55], [0.285, 0.8], [0.255, 1.0], [0.245, 1.14], [0.26, 1.3], [0.268, 1.38],
    [0.2, 1.44], [0.12, 1.485], [0.098, 1.52],
  ].map(([r, y]) => [r, y - WAIST_Y] as [number, number]);
  const robe = createLatheRobe(prof, {
    material: knit,
    quality: opts.quality,
    folds: 8,
    foldDepth: 0.05,
    uvRepeat: [13, 11],
    capTop: true,
    sway: { amplitude: 0.04, waves: 3, speed: 0.95, flare: 0.05 },
    seed: 9,
  });
  robe.mesh.scale.set(1, 1, 0.74);
  body.add(robe.mesh);

  // ── mask: stone shell with long nose + slits, real eyes inside ───────────
  const sm = createStoneMaskGeometry(opts.quality);
  const alpha = sm.alpha.clone();
  alpha.channel = 1;
  alpha.needsUpdate = true;
  stoneMat.alphaMap = alpha;
  stoneMat.alphaTest = 0.5;
  const maskMesh = new Mesh(sm.body, stoneMat);
  maskMesh.name = "stone-mask";
  face.add(maskMesh);
  const rimMat = new MeshStandardMaterial({ color: "#5d584f", roughness: 0.95, side: 2 });
  const rim = new Mesh(sm.rims, rimMat);
  face.add(rim);

  const makeEyeAt = (sx: number): EyeRig => {
    const eye = createEye({
      radius: 0.0092,
      sclera: "#cfc8bb",
      iris: "#8fa3ad",
      glow: 0.35,
      pupilSize: 0.5,
      lidMaterial: makeSkin("#6b5a50"),
    });
    const x = sx * SLIT_X;
    eye.group.position.set(x, SLIT_Y, frontZ(x, SLIT_Y) - 0.0125);
    if (eye.lid) eye.lid.rotation.x = -0.16;
    eye.group.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (m && (o as Mesh).isMesh && m.emissiveIntensity > 0) m.roughness = 0.08;
    });
    face.add(eye.group);
    return eye;
  };
  const eyeL = makeEyeAt(1);
  const eyeR = makeEyeAt(-1);
  for (const [eye, a] of [[eyeL, sc.eyeAnchorL], [eyeR, sc.eyeAnchorR]] as const) {
    a.position.set(eye.group.position.x, SLIT_Y, frontZ(eye.group.position.x, SLIT_Y));
    face.add(a);
  }

  // ── hair: tall crown, layered curtains over the shoulders and back, beard under the mask ──
  const domeTex = elderHairTexture(true).clone();
  domeTex.repeat.set(5, 1.4);
  domeTex.needsUpdate = true;
  const domeMat = new MeshStandardMaterial({ map: domeTex, color: "#aeb9bc", roughness: 0.8 });
  const dome = new Mesh(ellipsoid([0, 0.322, -0.012], [0.124, 0.152, 0.108], low ? 14 : 24), domeMat);
  dome.name = "hair-crown";
  head.add(dome);

  const COL = "#b9c5c8";
  const TIP = "#e3eaea";
  const cardTex = elderHairTexture(false);
  // radius (from the head axis) that the hair follows going down: a narrow, tall cowl framing the mask,
  // widening over the shoulders
  const bell: ReadonlyArray<readonly [number, number]> = [
    [0, 0.045], [0.06, 0.088], [0.18, 0.118], [0.34, 0.138], [0.5, 0.19], [0.62, 0.252], [0.8, 0.275], [1, 0.285],
  ];
  const bellAt = (t: number): number => {
    let k = 0;
    while (k < bell.length - 2 && t > bell[k + 1][0]) k++;
    const [t0, r0] = bell[k];
    const [t1, r1] = bell[k + 1];
    const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    return r0 + (r1 - r0) * u * u * (3 - 2 * u);
  };
  const wave = (t: number, a: number, layer: number) =>
    Math.sin(a * 5 + t * 5.5 + layer * 1.9) * 0.014 * Math.min(1, t * 2.2) + Math.sin(a * 11 + t * 3 + layer) * 0.006 * t;
  const makeCurtain = (o: { scale: number; len: number; seed: number; color: string; layers: number; cards: number | undefined }) => {
    const c = createHairCurtain({
      radiusX: 0.045,
      radiusZ: 0.04,
      center: [0, 0.445, -0.012],
      arc: [0.55, Math.PI * 2 - 0.55],
      length: (a) =>
        o.len * (0.92 + 0.26 * Math.max(0, -Math.cos(a))) + 0.08 * Math.sin(a * 3.3 + o.seed) + 0.05 * Math.sin(a * 8.1 + o.seed * 2),
      profile: (t, a, layer) => ((bellAt(t) - 0.04) * (0.82 + 0.18 * Math.sin(a) ** 2) + wave(t, a, layer)) * o.scale,
      color: o.color,
      tipColor: TIP,
      cards: o.cards,
      layers: o.layers,
      rows: low ? 8 : 18,
      quality: opts.quality,
      seed: o.seed,
      roughness: 0.62,
    });
    c.material.map = cardTex;
    return c;
  };
  const curtain = makeCurtain({ scale: 1, len: 0.98, seed: 13, color: COL, layers: low ? 3 : 4, cards: low ? undefined : 130 });
  head.add(curtain.object);
  const under = makeCurtain({ scale: 0.9, len: 0.72, seed: 29, color: "#8e9ca1", layers: low ? 2 : 3, cards: low ? undefined : 90 });
  head.add(under.object);

  // a few fine strands, only to break up the outline
  const fuzz = createHairStrands({
    count: 150,
    length: 0.5,
    quality: opts.quality,
    thickness: 0.0015,
    color: COL,
    tipColor: TIP,
    gravity: 0.9,
    stiffness: 0.3,
    lengthVariation: 0.5,
    roughness: 0.7,
    sheen: 0.2,
    seed: 5,
    rootShape: (i, n) => {
      const u = (i + 0.5) / n;
      const side = i % 2 ? 1 : -1;
      const a = 0.9 + ((i * 0.6180339) % 1) * (Math.PI - 1.1);
      const t = 0.08 + u * 0.45;
      const r = bellAt(t) * 0.97;
      const sx = side * Math.sin(a);
      const cz = Math.cos(a);
      return { pos: { x: sx * r, y: 0.445 - t * 0.98, z: -0.012 + cz * r * 0.9 }, normal: { x: sx, y: -0.1, z: cz * 0.8 } };
    },
  });
  head.add(fuzz.object);

  const beardPivot = new Group();
  beardPivot.position.set(0, 0.012, 0);
  head.add(beardPivot);
  const beard = createHairCurtain({
    radiusX: 0.1,
    radiusZ: 0.1,
    center: [0, 0, 0.002],
    arc: [-1.05, 1.05],
    length: (a) => 0.62 - 0.12 * Math.abs(Math.sin(a * 1.2)) + 0.05 * Math.sin(a * 9),
    profile: (t, a, layer) => 0.02 + 0.15 * (1 - Math.pow(1 - t, 2.2)) + Math.sin(a * 6 + t * 6 + layer * 2) * 0.012 * t,
    color: COL,
    tipColor: TIP,
    cards: low ? 18 : 56,
    layers: low ? 3 : 4,
    rows: low ? 8 : 16,
    quality: opts.quality,
    seed: 21,
    roughness: 0.62,
  });
  beard.material.map = cardTex;
  beardPivot.add(beard.object);

  // ── hands, shoes ─────────────────────────────────────────────────────────
  const handGeo = (sx: number): BufferGeometry =>
    uvWindow(
      merge([
        ellipsoid([0, -0.012, 0], [0.021, 0.034, 0.011], 12),
        capsule([-0.0135, -0.066, 0.002], 0.0076, 0.046, [0.12, 0, 0]),
        capsule([-0.0045, -0.073, 0.003], 0.0078, 0.054, [0.14, 0, 0]),
        capsule([0.0048, -0.071, 0.003], 0.0076, 0.05, [0.16, 0, 0]),
        capsule([0.0135, -0.063, 0.002], 0.0068, 0.038, [0.18, 0, 0]),
        capsule([-sx * 0.023, -0.034, 0.008], 0.0078, 0.036, [0.2, 0, -sx * 0.4]),
      ]),
      0.1, 0.1, 0.5, 0.5,
    );
  const handL = new Mesh(handGeo(1), skin);
  handL.scale.setScalar(1.9);
  sc.handL!.add(handL);
  const fist = new Mesh(
    merge([
      ellipsoid([0, 0, 0], [0.043, 0.05, 0.044], 14),
      ellipsoid([0.001, 0.034, 0.046], [0.017, 0.013, 0.012], 8),
      ellipsoid([0.001, 0.011, 0.05], [0.0175, 0.0125, 0.012], 8),
      ellipsoid([0.001, -0.012, 0.049], [0.0175, 0.0125, 0.012], 8),
      ellipsoid([0.001, -0.034, 0.044], [0.016, 0.012, 0.011], 8),
      ellipsoid([0.032, 0.036, 0.02], [0.012, 0.02, 0.014], 8, [0, 0, -0.5]),
    ]),
    skin,
  );
  sc.handR!.add(fist);
  const shoeGeo = (): BufferGeometry =>
    merge([
      ellipsoid([0, 0.045, 0.045], [0.056, 0.046, 0.14], 14),
      ellipsoid([0, 0.04, 0.155], [0.05, 0.036, 0.06], 12),
    ]);
  sc.footL!.add(new Mesh(shoeGeo(), shoeMat));
  sc.footR!.add(new Mesh(shoeGeo(), shoeMat));

  // ── staff in the right hand ──────────────────────────────────────────────
  const staff = createStaff({
    length: 1.78,
    radius: 0.0185,
    material: woodMat,
    trimMaterial: ironMat,
    crooked: 0.022,
    knots: 4,
    crook: 0.1,
    seed: 4,
  });
  staff.object.position.set(0, -HAND_R[1], 0);
  sc.handR!.add(staff.object);

  // ── sleeves (knit tubes that follow the hands) ───────────────────────────
  const sleeveR = (t: number) =>
    (0.075 - 0.02 * t + 0.006 * Math.sin(t * Math.PI)) * (1 - 0.32 * Math.pow(Math.max(0, (t - 0.9) / 0.1), 2));
  const limbs = createLimbSet(
    [
      { ...ARM, radius: sleeveR, uv: { uSpan: 1.9, v0: 0.2, vSpan: 3.6 } },
      { ...ARM, radius: sleeveR, uv: { uSpan: 1.9, v0: 0.5, vSpan: 3.6, u0: 0.4 } },
    ],
    knit,
    { rings: low ? 9 : 14, sides: low ? 9 : 14 },
  );
  root.add(limbs.mesh);

  // ── per-frame ────────────────────────────────────────────────────────────
  const motion = makeMotion();
  const handLn = sc.handL!;
  const handRn = sc.handR!;
  const v = { x: 0, y: 0, z: 0 };
  const solveArm = (i: number, sx: number, h: Group) => {
    const m = body.matrix.elements;
    const lx = sx * SHOULDER_X;
    const ly = SHOULDER_Y;
    v.x = m[0] * lx + m[4] * ly + m[12];
    v.y = m[1] * lx + m[5] * ly + m[13];
    v.z = m[2] * lx + m[6] * ly + m[14];
    const rz = h.rotation.z;
    limbs.set(
      i, v.x, v.y, v.z,
      h.position.x - Math.sin(rz) * WRIST_UP, h.position.y + Math.cos(rz) * WRIST_UP, h.position.z,
      sx * 0.3, -0.25, -1,
    );
  };
  const poseLimbs = () => {
    body.updateMatrix();
    solveArm(0, 1, handLn);
    solveArm(1, -1, handRn);
    limbs.commit();
  };
  const update = (ctx: PuppetFrameContext) => {
    const m = secondaryMotion(ctx, motion);
    m.sway *= 0.7; // heavy
    curtain.update(ctx.time, m);
    fuzz.update(ctx.time, m);
    under.update(ctx.time, m);
    beard.update(ctx.time, m);
    robe.update(ctx.time, m);
    eyeL.sync();
    eyeR.sync();
    // beard wags a little when he talks
    beardPivot.rotation.x = ctx.talking * Math.max(0, Math.sin(ctx.time * 9)) * 0.05;
    poseLimbs();
    // plant the staff: the foot lifts as the hand swings forward, otherwise stays on the floor
    const lift = ctx.walk * 0.07 * Math.max(0, Math.sin(ctx.gaitPhase));
    staff.object.position.y = -handRn.position.y + lift;
    staff.object.rotation.x = ctx.walk * 0.06 * Math.sin(ctx.gaitPhase);
  };
  poseLimbs();

  return assemblePuppet({
    id: "elder",
    scaffold: sc,
    height: H,
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
      jawOpen: 0.2,
      gait: "biped",
      stride: 0.5,
    },
    update,
    dispose() {
      curtain.dispose();
      fuzz.dispose();
      under.dispose();
      domeTex.dispose();
      beard.dispose();
      robe.dispose();
      eyeL.dispose();
      eyeR.dispose();
      limbs.dispose();
      staff.dispose();
      alpha.dispose();
      [skin, shoeMat, woodMat, ironMat, stoneMat, rimMat, domeMat].forEach((mm) => mm.dispose());
    },
  });
};

export default build;
