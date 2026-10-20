import { DoubleSide, Group, Mesh, MeshStandardMaterial, MirroredRepeatWrapping, Quaternion, Vector3, type Texture } from "three";
import { TEXTURES } from "../../content/textures";
import {
  EYE_LIMITS,
  assemblePuppet,
  createEye,
  createHairCurtain,
  createScaffold,
  createTassel,
  makeFabric,
  makeMotion,
  makeSkin,
  secondaryMotion,
} from "../kit";
import type { PuppetBuilder } from "../types";
import {
  DIM,
  LEG_L,
  LEG_X,
  SLEEVE_L,
  beltGeometry,
  blouseGeometry,
  bootGeometry,
  cuffGeometry,
  engraveBump,
  legGeometry,
  sleeveGeometry,
  vestGeometry,
} from "./maskedLady/costume";
import { EARRING_LEN, earringGeometry } from "./maskedLady/earring";
import { smooth } from "./maskedLady/geo";
import { silkHairTexture } from "./maskedLady/hairTex";
import { CAP, FACE_AT, buildMaskGeometry, eyeAt, makeMaskMaterial } from "./maskedLady/mask";

/**
 * The Masked Lady: tall, composed, ceremonial. Carved ivory mask with real eyes behind almond
 * openings, long blunt-fringed black hair, tasselled earrings, ivory turtleneck, embroidered
 * indigo vest, silver belt, huge puffed linen sleeves gathered into silver cuffs, balloon
 * trousers and embossed silver boots.
 *
 * Draw calls (high): mask+cap+fringe 1, eyes 10, hair 1, blouse 1, vest 1, belt 1, trousers 2,
 * sleeves+hands 2, cuffs 2, boots 2, earrings 2 = 25.
 *
 * Rig: handL/R are wrist anchors (the sleeves aim themselves at them), footL/R carry the boots,
 * the trouser legs swing from the hips to follow the feet. No jaw (a carved mask does not talk).
 */

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

const build: PuppetBuilder = (opts) => {
  const low = opts.quality === "low";
  const tex = TEXTURES["masked-lady"];
  const sc = createScaffold({
    waistY: DIM.waistY,
    neckY: DIM.neckY,
    face: FACE_AT,
    jaw: null,
    hands: [DIM.wristX, DIM.wristY, 0.015],
    feet: [DIM.footX, 0, 0.03],
  });
  const disposables: { dispose(): void }[] = [];

  // ── materials ─────────────────────────────────────────────────────────────────────────────────
  const mirrored = (t: Texture): Texture => {
    // cached + shared: only this build uses these keys, so mirror the tiling once (no needsUpdate: set before the image uploads)
    t.wrapS = t.wrapT = MirroredRepeatWrapping;
    return t;
  };
  const linenMap = mirrored(opts.texture(tex.linen, { srgb: true, repeat: [1, 1] }));
  const linen = () => {
    const m = makeFabric({ map: linenMap, roughness: 0.9, sheen: 0.55 });
    m.color.setRGB(2.3, 2.2, 2.0);
    return m;
  };
  const sleeveMat = linen();
  sleeveMat.vertexColors = true;
  const blouseMat = linen();
  blouseMat.vertexColors = true;
  const legMat = linen();
  const vestMat = makeFabric({
    map: mirrored(opts.texture(tex["vest-embroidery"], { srgb: true, repeat: [1, 1] })),
    color: "#ffffff",
    roughness: 0.96,
    sheen: 0.2,
  });
  vestMat.color.setRGB(1.6, 1.6, 1.6);
  const bump = engraveBump();
  const silver = (rep: [number, number]) => {
    const b = bump.clone();
    b.needsUpdate = true;
    b.repeat.set(rep[0], rep[1]);
    disposables.push(b);
    return new MeshStandardMaterial({ color: "#d9dbe0", metalness: 0.92, roughness: 0.36, bumpMap: b, bumpScale: 1.4, side: DoubleSide });
  };
  const cuffMat = silver([5, 1]);
  const beltMat = silver([9, 1]);
  const bootMat = silver([5, 3]);
  const earMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
  const lidSkin = makeSkin("#a8795c");

  // ── head: mask + cap + fringe, eyes, hair, earrings ──────────────────────────────────────────
  const maskMat = makeMaskMaterial(opts.texture(tex["mask-face"], { srgb: true }), low);
  const mask = new Mesh(buildMaskGeometry(low), maskMat);
  mask.name = "mask";
  sc.face.add(mask);

  const eyes = ([1, -1] as const).map((sg) => {
    const p = eyeAt(sg);
    const eye = createEye({ radius: 0.0135, sclera: "#c4b8a6", iris: "#2e1c0e", lidMaterial: lidSkin });
    if (eye.lid) eye.lid.rotation.x = -0.22; // serene, half-lidded rest (the controller works from this rest pose)
    eye.group.position.set(p.x, p.y, p.z - 0.017);
    sc.face.add(eye.group);
    disposables.push(eye);
    const anchor = sg > 0 ? sc.eyeAnchorL : sc.eyeAnchorR;
    anchor.position.set(p.x, p.y, p.z + 0.002);
    sc.face.add(anchor);
    return eye;
  });
  const [eyeL, eyeR] = eyes;

  // Hair is rooted at the crown and drapes over the cap, then flares out over the shoulders.
  const HAIR = { y: 0.258, rx: 0.052, rz: 0.06 };
  const hairLen = (a: number) => {
    const f = Math.min(a, TAU - a);
    return 0.6 + 0.07 * smooth(1.6, 2.7, f);
  };
  const hair = createHairCurtain({
    radiusX: HAIR.rx,
    radiusZ: HAIR.rz,
    center: [0, HAIR.y, CAP.cz],
    arc: [0.92, TAU - 0.92],
    length: hairLen,
    color: "#100f14",
    tipColor: "#23212b",
    layers: 3,
    cards: low ? 70 : 130,
    profile: (t, a, layer) => {
      const y = HAIR.y - t * hairLen(a);
      const yy = Math.max(y, CAP.cy);
      const q = Math.min(1, (yy - CAP.cy) / CAP.ry);
      const f = Math.sqrt(1 - q * q);
      const sa = Math.sin(a);
      const ca = Math.cos(a);
      const nx = sa / HAIR.rx;
      const nz = ca / HAIR.rz;
      const nl = Math.hypot(nx, nz) || 1;
      const dx = sa * (CAP.rx * f - HAIR.rx);
      const dz = ca * (CAP.rz * f - HAIR.rz);
      const dome = (dx * nx + dz * nz) / nl;
      // the kit adds 12 mm per layer; take most of it back so the layers read as one mass
      return Math.max(0, dome) + 0.012 + 0.05 * smooth(0.04, -0.14, y) - layer * 0.009;
    },
    quality: opts.quality,
    seed: 41,
    roughness: 0.62,
  });
  hair.material.map = silkHairTexture();
  hair.material.alphaTest = 0.4;
  hair.material.specularIntensity = 0.45;
  hair.material.anisotropy = 0.75;
  hair.material.anisotropyRotation = Math.PI / 2;
  hair.material.sheen = 0.9;
  hair.material.sheenRoughness = 0.3;
  hair.material.sheenColor.setRGB(0.12, 0.14, 0.26);
  sc.head.add(hair.object);

  const earGeo = earringGeometry(low);
  const tassels = ([1, -1] as const).map((sg, i) => {
    const t = createTassel({ length: EARRING_LEN, phase: i * 2.1, stiffness: 0.8 });
    t.object.position.set(sg * 0.108, 0.1, 0.05);
    t.object.add(new Mesh(earGeo, earMat));
    sc.head.add(t.object);
    return t;
  });

  // ── body: blouse + turtleneck, vest, belt ────────────────────────────────────────────────────
  const torsoGroup = new Group();
  torsoGroup.position.y = -DIM.waistY;
  torsoGroup.scale.z = DIM.torsoZ;
  sc.body.add(torsoGroup);
  torsoGroup.add(new Mesh(blouseGeometry(blouseMat, low), blouseMat));
  torsoGroup.add(new Mesh(vestGeometry(vestMat, low), vestMat));
  torsoGroup.add(new Mesh(beltGeometry(), beltMat));

  // ── legs (swing from the hips to follow the feet) ────────────────────────────────────────────
  const legs = ([1, -1] as const).map((sg) => {
    const g = new Group();
    g.position.set(sg * LEG_X, DIM.hipY, 0);
    g.add(new Mesh(legGeometry(sg, legMat, low), legMat));
    sc.root.add(g);
    return g;
  });
  const bootGeo = bootGeometry();
  sc.footL?.add(new Mesh(bootGeo, bootMat));
  sc.footR?.add(new Mesh(bootGeo, bootMat));

  // ── sleeves: aimed shoulder -> wrist anchor every frame ──────────────────────────────────────
  const cuffGeo = cuffGeometry();
  const sleeves = ([1, -1] as const).map((sg) => {
    const g = new Group();
    g.add(new Mesh(sleeveGeometry(sg, sleeveMat, low), sleeveMat));
    g.add(new Mesh(cuffGeo, cuffMat));
    sc.root.add(g);
    return g;
  });

  // ── secondary motion ─────────────────────────────────────────────────────────────────────────
  const mot = makeMotion();
  const hairM = { sway: 0, walk: 0, phase: 0, wind: 0 };
  const drive = { x: 0, z: 0 };
  const v = new Vector3();
  const dir = new Vector3();
  const q = new Quaternion();
  const DOWN = new Vector3(0, -1, 0);
  let prevYaw = 0;
  const restFootZ = 0.03;

  const update: Parameters<typeof assemblePuppet>[0]["update"] = (ctx) => {
    secondaryMotion(ctx, mot);
    const t = ctx.time;
    const dt = ctx.dt;

    hairM.sway = mot.sway * 0.45;
    hairM.walk = mot.walk * 0.55;
    hairM.phase = mot.phase;
    hairM.wind = mot.wind;
    hair.update(t, hairM);
    eyeL.sync();
    eyeR.sync();

    // earrings: inertia of the head turn plus the walk
    const yawVel = dt > 0 ? (ctx.lookYaw - prevYaw) / dt : 0;
    prevYaw = ctx.lookYaw;
    const swing = Math.sin(ctx.gaitPhase) * ctx.walk;
    for (let i = 0; i < 2; i++) {
      const sg = i === 0 ? 1 : -1;
      drive.x = clamp(yawVel * 0.05, -0.5, 0.5) * 1 + sg * 0.03 * ctx.walk;
      drive.z = swing * 0.14 + ctx.anger * 0.05;
      tassels[i].update(dt, t, drive);
    }

    // sleeves aim shoulder -> wrist and breathe
    sc.body.updateMatrix();
    for (let i = 0; i < 2; i++) {
      const sg = i === 0 ? 1 : -1;
      const hand = i === 0 ? sc.handL : sc.handR;
      const g = sleeves[i];
      if (!hand) continue;
      v.set(sg * DIM.shoulderX, DIM.shoulderY - DIM.waistY, 0).applyMatrix4(sc.body.matrix);
      dir.subVectors(hand.position, v);
      const len = Math.max(0.05, dir.length());
      dir.multiplyScalar(1 / len);
      q.setFromUnitVectors(DOWN, dir);
      g.quaternion.copy(q);
      g.position.copy(v);
      const br = 1 + 0.014 * Math.sin(t * 1.7 + i * 1.3) + 0.03 * mot.billow + 0.012 * ctx.walk;
      g.scale.set(br, len / SLEEVE_L, br);
    }

    // trouser legs follow the boots
    for (let i = 0; i < 2; i++) {
      const foot = i === 0 ? sc.footL : sc.footR;
      const sg = i === 0 ? 1 : -1;
      if (!foot) continue;
      const dz = foot.position.z - restFootZ;
      const dx = foot.position.x - sg * DIM.footX;
      const dy = foot.position.y;
      const g = legs[i];
      g.rotation.x = -dz / LEG_L;
      g.rotation.z = dx / LEG_L;
      g.scale.set(1 + 0.02 * mot.billow, 1 - dy / LEG_L, 1 + 0.02 * mot.billow);
    }
  };

  return assemblePuppet({
    id: "masked-lady",
    scaffold: sc,
    height: 1.8,
    waistY: DIM.waistY,
    pupilL: eyeL.pupil,
    pupilR: eyeR.pupil,
    lidL: eyeL.lid ?? undefined,
    lidR: eyeR.lid ?? undefined,
    limits: {
      headYaw: 0.6,
      headPitch: 0.35,
      pupil: eyeL.pupilRange,
      lidNeutral: EYE_LIMITS.lidNeutral,
      lidOpen: EYE_LIMITS.lidOpen,
      lidClosed: EYE_LIMITS.lidClosed,
      jawOpen: 0,
      gait: "biped",
      stride: 0.42,
    },
    update,
    dispose() {
      hair.dispose();
      disposables.forEach((d) => d.dispose());
      [sleeveMat, blouseMat, legMat, vestMat, cuffMat, beltMat, bootMat, earMat, lidSkin, maskMat].forEach((m) => m.dispose());
    },
  });
};

export default build;
