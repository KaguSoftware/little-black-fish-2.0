import {
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import type { BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { PuppetBuilder, PuppetFrameContext } from "../types";
import {
  EYE_LIMITS,
  assemblePuppet,
  createEye,
  createHairCurtain,
  createHairStrands,
  createLatheRobe,
  createScaffold,
  makeFabric,
  makeMotion,
  makeSkin,
  secondaryMotion,
  type EyeRig,
} from "../kit";
import { TEXTURES } from "../../content/textures";
import { createLimbSet } from "./child/limbs";
import { makeInkSkin } from "./child/ink";
import { EYE_PLANE_Y, EYE_X, bowZ, createMask } from "./child/mask";
import { capsule, ellipsoid, merge, place, torsoSlice, uvWindow, type Section } from "./child/parts";

/**
 * The Child: thin, bouncy, barefoot. Skin covered in handwritten marks and paper stickers, a teal
 * cloth knotted at the waist, long dark hair, and a flat paper mask tied on with string. The mask has
 * two real eye holes; the actual eyes (wet sclera, iris, catchlight, skin lids) sit behind the paper
 * and look out through them: this is the face the home page and the series open on.
 *
 * Draw calls (high): torso 2, limbs 1, hands 2, feet 2, skirt+sash 1, skull 1, chin 1, mask 2, trim 1,
 * eyes 10, hair 1 = 24.
 */

const H = 1.55;
const WAIST_Y = 0.84;
const NECK_Y = 1.3;
const FACE: readonly [number, number, number] = [0, 0.125, 0.09];
const SHOULDER_X = 0.146;
const SHOULDER_Y = 0.385;
const HIP_X = 0.055;
const HIP_Y = -0.075;
const WRIST_UP = 0.028;
const ANKLE_UP = 0.07;
const ARM = { l1: 0.235, l2: 0.22 };
const LEG = { l1: 0.37, l2: 0.36 };

const TORSO: Section[] = [
  { y: -0.1, rx: 0.08, rz: 0.052 },
  { y: 0.0, rx: 0.074, rz: 0.048 },
  { y: 0.08, rx: 0.078, rz: 0.05 },
  { y: 0.18, rx: 0.088, rz: 0.054 },
  { y: 0.28, rx: 0.105, rz: 0.058 },
  { y: 0.35, rx: 0.12, rz: 0.057 },
  { y: 0.385, rx: 0.126, rz: 0.05 },
  { y: 0.405, rx: 0.092, rz: 0.042 },
  { y: 0.425, rx: 0.048, rz: 0.036 },
  { y: 0.45, rx: 0.034, rz: 0.033 },
  { y: 0.53, rx: 0.031, rz: 0.031 },
];

const build: PuppetBuilder = (opts) => {
  const low = opts.quality === "low";
  const sc = createScaffold({
    waistY: WAIST_Y,
    neckY: NECK_Y,
    face: FACE,
    jaw: [0, 0.05, 0.02],
    hands: [0.178, 0.745, 0.01],
    feet: [HIP_X + 0.012, 0, 0],
  });
  sc.object.name = "puppet-child";
  const { root, body, head, face } = sc;

  // ── materials ─────────────────────────────────────────────────────────────
  const marksTex = opts.texture(TEXTURES.child["skin-marks"], { srgb: true });
  const chestMat = new MeshPhysicalMaterial({
    map: marksTex,
    roughness: 0.62,
    sheen: 0.3,
    sheenRoughness: 0.55,
    sheenColor: new Color(0.9, 0.7, 0.6),
  });
  chestMat.color.setRGB(1.5, 1.4, 1.34);
  const skinMat = makeInkSkin("#ffffff", 31);
  const backMat = makeInkSkin("#ffffff", 47);
  const chinMat = makeSkin("#a98270");
  const clothTex = opts.texture(TEXTURES.child.cloth, { srgb: true, repeat: [1, 1] });
  const clothMat = makeFabric({ map: clothTex, repeat: [1, 1], color: "#ffffff", roughness: 0.92, sheen: 0.25 });
  clothMat.color.setRGB(1.5, 1.45, 1.4);

  // ── torso: chest from the painted photo, back from the procedural marks ──
  const sides = low ? 14 : 22;
  const rings = low ? 18 : 28;
  const chestUV = (_x: number, y: number, th: number): [number, number] => [0.5 + th * 0.2406, 1 - (235 + (0.275 - y) * 1449) / 512];
  const backUV = (_x: number, y: number, th: number): [number, number] => [th / (Math.PI * 2) + 0.5, (y + 0.1) * 1.9];
  const HALF = 1.75;
  const front = torsoSlice({ sections: TORSO, rings, half: HALF, sides, uv: chestUV });
  const back = torsoSlice({ sections: TORSO, rings, half: HALF, back: true, sides: Math.round(sides * 0.62), uv: backUV });
  const torsoGeo = mergeGeometries([front, back], true);
  front.dispose();
  back.dispose();
  const torso = new Mesh(torsoGeo, [chestMat, backMat]);
  torso.name = "torso";
  body.add(torso);

  // ── skirt (teal cloth knotted at the waist) ──────────────────────────────
  const profile: [number, number][] = [
    [0.205, -0.31], [0.19, -0.26], [0.167, -0.19], [0.14, -0.12], [0.117, -0.05], [0.102, 0.01], [0.094, 0.05], [0.09, 0.085],
  ];
  const robe = createLatheRobe(profile, {
    material: clothMat,
    quality: opts.quality,
    folds: 7,
    foldDepth: 0.1,
    uvRepeat: [2, 1],
    capTop: false,
    sway: { amplitude: 0.075, waves: 3, speed: 1.9, flare: 0.09 },
    seed: 5,
  });
  const sash: BufferGeometry[] = [
    place(new TorusGeometry(0.094, 0.021, 8, low ? 20 : 32), [0, 0.052, 0], [1, 1, 1], [Math.PI / 2, 0, 0]),
    ellipsoid([0.062, 0.032, 0.102], [0.036, 0.03, 0.022], 10, [0.2, 0.3, 0.4]),
    ellipsoid([0.03, 0.05, 0.108], [0.03, 0.022, 0.02], 10, [0, 0, 0.5]),
  ];
  const flap = new PlaneGeometry(0.105, 0.16, 3, 5);
  const fp = flap.getAttribute("position");
  for (let i = 0; i < fp.count; i++) {
    const y = fp.getY(i);
    fp.setZ(i, 0.012 * Math.sin(fp.getX(i) * 42) * (0.3 + (0.08 - y) * 3) - (0.08 - y) * 0.06);
  }
  flap.computeVertexNormals();
  sash.push(place(flap, [0.05, -0.015, 0.118], [1, 1, 1], [0, 0, -0.06]));
  const robeGeo = merge([robe.mesh.geometry, ...sash]);
  robe.mesh.geometry = robeGeo;
  robe.mesh.scale.set(1, 1, 0.74);
  body.add(robe.mesh);

  // ── head: skull, chin, hair ──────────────────────────────────────────────
  const skullGeo = ellipsoid([0, 0.135, -0.02], [0.072, 0.112, 0.058], low ? 14 : 22);
  {
    const p = skullGeo.getAttribute("position");
    const cols = new Float32Array(p.count * 3);
    const skin = new Color("#cfa994");
    const dark = new Color("#1c1511");
    const c = new Color();
    for (let i = 0; i < p.count; i++) {
      const k = Math.min(1, Math.max(0, (p.getY(i) - 0.04) / 0.06));
      c.copy(skin).lerp(dark, k * k * (3 - 2 * k));
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    skullGeo.setAttribute("color", new Float32BufferAttribute(cols, 3));
  }
  const skullMat = makeSkin("#ffffff");
  skullMat.vertexColors = true;
  const skull = new Mesh(skullGeo, skullMat);
  skull.name = "skull";
  head.add(skull);
  const jaw = sc.jaw!;
  const chin = new Mesh(ellipsoid([0, -0.038, 0.034], [0.026, 0.015, 0.016], 12), chinMat);
  chin.name = "chin";
  jaw.add(chin);

  const crown = createHairStrands({
    count: 950,
    length: 0.4,
    quality: opts.quality,
    thickness: 0.0028,
    color: "#1a130e",
    tipColor: "#2f241b",
    gravity: 0.94,
    stiffness: 0.12,
    lengthVariation: 0.3,
    roughness: 0.7,
    sheen: 0.12,
    seed: 11,
    rootShape: (i, n) => {
      const u = (i + 0.5) / n;
      const a = 1.05 + ((i * 0.6180339) % 1) * (Math.PI * 2 - 2.1);
      const cp = 1 - u * 1.25;
      const sp = Math.sqrt(1 - cp * cp);
      const dx = sp * Math.sin(a);
      const dz = sp * Math.cos(a);
      const k = 1.03;
      return {
        pos: { x: dx * 0.072 * k, y: 0.135 + cp * 0.112 * k, z: dz * 0.08 * k },
        normal: { x: dx, y: cp * 0.6, z: dz * 0.6 - 0.1 },
      };
    },
  });
  const curtain = createHairCurtain({
    radiusX: 0.082,
    radiusZ: 0.085,
    center: [0, 0.17, 0.02],
    arc: [1.15, Math.PI * 2 - 1.15],
    length: (a) => 0.44 + 0.07 * Math.sin(a) ** 2,
    profile: (t, a) => (0.012 + 0.05 * t * t) * (0.4 + 0.6 * Math.sin(a) ** 2),
    color: "#1b1410",
    tipColor: "#2d231b",
    quality: opts.quality,
    seed: 7,
    cards: 120,
    layers: low ? 3 : 4,
    roughness: 0.75,
  });
  head.add(curtain.object);
  const hair = {
    object: crown.object,
    update: (t: number, m: Parameters<typeof crown.update>[1]) => {
      crown.update(t, m);
      curtain.update(t, m);
    },
    dispose: () => {
      crown.dispose();
      curtain.dispose();
    },
  };
  head.add(hair.object);

  // ── mask, eyes ───────────────────────────────────────────────────────────
  const photo = opts.texture(TEXTURES.child["paper-mask"], { srgb: true });
  const mask = createMask(photo, opts.quality);
  face.add(mask.front, mask.back);

  const makeEyeAt = (sx: number): EyeRig => {
    const eye = createEye({
      radius: 0.0175,
      sclera: "#92897a",
      iris: "#48301f",
      glow: 0.1,
      pupilSize: 0.46,
      lidMaterial: makeSkin("#3a2c26"),
    });
    const x = sx * EYE_X;
    eye.group.position.set(x, EYE_PLANE_Y, bowZ(x, EYE_PLANE_Y) - 0.028);
    if (eye.lid) {
      eye.lid.rotation.x = -0.4;
      eye.lid.scale.setScalar(0.93);
    }
    eye.group.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (m && (o as Mesh).isMesh && m.emissiveIntensity > 0) m.roughness = 0.08;
    });
    face.add(eye.group);
    return eye;
  };
  const eyeL = makeEyeAt(1);
  const eyeR = makeEyeAt(-1);
  const anchorOf = (eye: EyeRig, a: Group) => {
    a.position.set(eye.group.position.x, eye.group.position.y, bowZ(eye.group.position.x, EYE_PLANE_Y));
    face.add(a);
  };
  anchorOf(eyeL, sc.eyeAnchorL);
  anchorOf(eyeR, sc.eyeAnchorR);

  // trim: paper rims inside the eye holes + the string that ties the mask on (head space -> face space)
  const stringPts = [
    [-0.08, 0.2, 0.074], [-0.078, 0.197, 0.04], [-0.074, 0.194, -0.005], [-0.056, 0.19, -0.055], [0, 0.188, -0.078],
    [0.056, 0.19, -0.055], [0.074, 0.194, -0.005], [0.078, 0.197, 0.04], [0.08, 0.2, 0.074],
  ].map(([x, y, z]) => new Vector3(x - FACE[0], y - FACE[1], z - FACE[2]));
  const stringGeo = new TubeGeometry(new CatmullRomCurve3(stringPts), low ? 24 : 48, 0.0013, 4, false);
  const trimGeo = merge([mask.rimGeometry.clone(), stringGeo]);
  const trimMat = new MeshStandardMaterial({ color: "#c4b492", roughness: 0.8, side: 2 });
  const trim = new Mesh(trimGeo, trimMat);
  trim.name = "mask-trim";
  face.add(trim);

  // ── hands, feet ──────────────────────────────────────────────────────────
  const handGeo = (sx: number) =>
    uvWindow(
      merge([
        ellipsoid([0, -0.012, 0], [0.019, 0.032, 0.009], 12),
        capsule([-0.0125, -0.065, 0.002], 0.0064, 0.044, [0.1, 0, 0]),
        capsule([-0.0042, -0.071, 0.003], 0.0066, 0.05, [0.12, 0, 0]),
        capsule([0.0042, -0.069, 0.003], 0.0064, 0.048, [0.14, 0, 0]),
        capsule([0.0125, -0.061, 0.002], 0.0057, 0.036, [0.16, 0, 0]),
        capsule([-sx * 0.021, -0.034, 0.006], 0.0066, 0.034, [0.2, 0, -sx * 0.4]),
      ]),
      0.1,
      0.2,
      0.4,
      0.5,
    );
  const handL = new Mesh(handGeo(1), skinMat);
  handL.scale.setScalar(1.25);
  const handR = new Mesh(handGeo(-1), skinMat);
  handR.scale.setScalar(1.25);
  sc.handL!.add(handL);
  sc.handR!.add(handR);
  const footGeo = (sx: number) =>
    uvWindow(
      merge([
        ellipsoid([0, 0.03, 0.045], [0.034, 0.026, 0.098], 14),
        ellipsoid([0, 0.036, -0.026], [0.029, 0.032, 0.036], 12),
        ellipsoid([sx * -0.017, 0.014, 0.137], [0.011, 0.011, 0.014], 8),
        ellipsoid([sx * -0.006, 0.012, 0.145], [0.0085, 0.009, 0.012], 8),
        ellipsoid([sx * 0.0045, 0.011, 0.142], [0.0085, 0.0085, 0.011], 8),
        ellipsoid([sx * 0.0145, 0.01, 0.133], [0.0075, 0.0078, 0.01], 8),
        ellipsoid([sx * 0.0225, 0.009, 0.12], [0.0065, 0.007, 0.009], 8),
      ]),
      0.05,
      0.05,
      0.5,
      0.5,
    );
  sc.footL!.add(new Mesh(footGeo(1), skinMat));
  sc.footR!.add(new Mesh(footGeo(-1), skinMat));

  // ── limbs (IK-deformed tubes, one draw call) ────────────────────────────
  const armR = (t: number) => 0.0135 + 0.0135 * Math.pow(1 - t, 0.9) + 0.0035 * Math.sin(t * Math.PI);
  const legR = (t: number) =>
    t < 0.5 ? 0.05 - 0.02 * Math.pow(t / 0.5, 1.3) : 0.0175 + 0.0125 * Math.pow(1 - (t - 0.5) / 0.5, 1.4) + 0.0045 * Math.sin(((t - 0.5) / 0.5) * Math.PI);
  const limbs = createLimbSet(
    [
      { ...ARM, radius: armR, uv: { uSpan: 1, v0: 0.1, vSpan: 1.4 } },
      { ...ARM, radius: armR, uv: { uSpan: 1, v0: 0.4, vSpan: 1.4, u0: 0.5 } },
      { ...LEG, radius: legR, uv: { uSpan: 1, v0: 0.2, vSpan: 1.3 } },
      { ...LEG, radius: legR, uv: { uSpan: 1, v0: 0.6, vSpan: 1.3, u0: 0.3 } },
    ],
    skinMat,
    { rings: low ? 9 : 13, sides: low ? 7 : 10 },
  );
  root.add(limbs.mesh);

  // neck-to-head glue is in the torso lathe; the controller moves hands/feet, we follow them
  const vt = new Vector3();
  const motion = makeMotion();
  const handLn = sc.handL!;
  const handRn = sc.handR!;
  const footLn = sc.footL!;
  const footRn = sc.footR!;

  const solveArm = (i: number, sx: number, h: Group) => {
    vt.set(sx * SHOULDER_X, SHOULDER_Y, 0).applyMatrix4(body.matrix);
    const rz = h.rotation.z;
    const wx = h.position.x - Math.sin(rz) * WRIST_UP;
    const wy = h.position.y + Math.cos(rz) * WRIST_UP;
    limbs.set(i, vt.x, vt.y, vt.z, wx, wy, h.position.z, sx * 0.35, -0.2, -1);
  };
  const solveLeg = (i: number, sx: number, f: Group) => {
    vt.set(sx * HIP_X, HIP_Y, 0).applyMatrix4(body.matrix);
    const a = f.rotation.x;
    const c = Math.cos(a);
    const s = Math.sin(a);
    limbs.set(
      i, vt.x, vt.y, vt.z,
      f.position.x, f.position.y + ANKLE_UP * c + 0.005 * s, f.position.z + ANKLE_UP * s - 0.005 * c,
      sx * 0.12, 0, 1,
    );
  };

  const poseLimbs = () => {
    body.updateMatrix();
    solveArm(0, 1, handLn);
    solveArm(1, -1, handRn);
    solveLeg(2, 1, footLn);
    solveLeg(3, -1, footRn);
    limbs.commit();
  };
  const update = (ctx: PuppetFrameContext) => {
    const m = secondaryMotion(ctx, motion);
    hair.update(ctx.time, m);
    robe.update(ctx.time, m);
    eyeL.sync();
    eyeR.sync();
    poseLimbs();
  };
  // pose the limbs once so the first frame is right even before the controller runs
  poseLimbs();

  return assemblePuppet({
    id: "child",
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
      jawOpen: 0.45,
      gait: "biped",
      stride: 0.4,
    },
    update,
    dispose() {
      hair.dispose();
      robe.dispose();
      eyeL.dispose();
      eyeR.dispose();
      limbs.dispose();
      mask.dispose();
      [chestMat, skinMat, backMat, chinMat, skullMat, trimMat].forEach((m) => m.dispose());
    },
  });
};

export default build;
