import { DoubleSide, Group, Mesh, MirroredRepeatWrapping, Quaternion, Vector3, type Texture } from "three";
import { TEXTURES } from "../../content/textures";
import {
  EYE_LIMITS,
  assemblePuppet,
  cached,
  createEye,
  createFurShells,
  createScaffold,
  fieldToCanvas,
  makeFabric,
  makeMotion,
  makeSkin,
  noiseField,
  secondaryMotion,
  swayRobe,
  toTexture,
  type FurHandle,
} from "../kit";
import type { PuppetBuilder } from "../types";
import {
  BODY,
  HEAD_AT,
  HIP,
  LEG_HIP_Y,
  LEG_L,
  PAW,
  bodyGeometry,
  headGeometry,
  jawGeometry,
  legGeometry,
  maneGeometry,
  neckGeometry,
  pawGeometry,
  saddleGeometry,
  tailGeometry,
} from "./creature/parts";

/**
 * The Creature: a large, pale, shaggy blue-white quadruped, camel crossed with a shoebill. Long furry
 * neck, a deep leathery beak with a swept-back horn, small pink eyes, heavy padded paws, a long
 * swishing tail and a worn crimson saddle cloth.
 *
 * Rig: handL/R are the FRONT paws, footL/R the HIND paws (the controller trots diagonal pairs). Legs
 * are fur tubes aimed from the hip to the paw anchor every frame. The neck follows part of the head's
 * rotation; the tail swishes and flicks.
 *
 * Draw calls (high): body, neck, mane, tail, 4 legs fur = 8; 4 paws; head, jaw; saddle; 2 eyes x 5 = 25.
 */

/** Wrinkled leather: ridged noise as a bump map (cached, shared, never disposed). */
function leatherBump(): Texture {
  return cached("tex:creatureLeather", () => {
    const size = 256;
    const a = noiseField(size, 61, 7, 4, 0.55);
    const b = noiseField(size, 67, 26, 3, 0.5);
    const c = fieldToCanvas(a, size, (v, i) => {
      const ridge = 1 - Math.abs(v - 0.5) * 2.4;
      const t = Math.min(1, Math.max(0, 0.35 + 0.5 * ridge * ridge + (b[i] - 0.5) * 0.35));
      return [t * 255, t * 255, t * 255];
    });
    return toTexture(c, { srgb: false, repeat: [3, 3] });
  });
}

const build: PuppetBuilder = (opts) => {
  const low = opts.quality === "low";
  const tex = TEXTURES.creature;
  const sc = createScaffold({
    waistY: BODY.y,
    neckY: HEAD_AT.y,
    face: [0, 0.03, 0.1],
    jaw: [0, -0.06, 0.01],
    hands: [PAW.front.x, 0, PAW.front.z],
    feet: [PAW.hind.x, 0, PAW.hind.z],
  });
  sc.head.position.z = HEAD_AT.z;
  const disposables: { dispose(): void }[] = [];

  // ── materials ───────────────────────────────────────────────────────────────────────────────
  const clampTex = (t: Texture): Texture => {
    t.wrapS = t.wrapT = MirroredRepeatWrapping;
    return t;
  };
  const skinMat = makeSkin("#e6dcd5");
  skinMat.map = clampTex(opts.texture(tex.skin, { srgb: true, repeat: [1, 1] }));
  skinMat.vertexColors = true;
  skinMat.roughness = 0.66;
  skinMat.bumpMap = leatherBump();
  skinMat.bumpScale = 3;
  skinMat.sheenColor.setRGB(0.9, 0.78, 0.78);
  skinMat.color.setRGB(1.05, 1.0, 1.0);
  const pawMat = makeSkin("#bfaea6");
  pawMat.vertexColors = true;
  pawMat.roughness = 0.8;
  const saddleMat = makeFabric({
    map: opts.texture(tex.saddle, { srgb: true }),
    roughness: 0.92,
    sheen: 0.15,
    side: DoubleSide,
  });
  saddleMat.color.setRGB(1.25, 1.1, 1.1);
  saddleMat.vertexColors = true;
  const saddleSway = swayRobe(saddleMat, { hemY: 0.84, topY: 1.22, amplitude: 0.05, waves: 2, speed: 1.1, flare: 0.03 });

  const fur = (geo: ReturnType<typeof bodyGeometry>, length: number, density = 150, gravity = 0.5): FurHandle => {
    const f = createFurShells(geo, {
      quality: opts.quality,
      shells: low ? 8 : 14,
      length,
      color: "#a8b2cb",
      tipColor: "#e7ebf6",
      rootColor: "#46506b",
      density,
      gravity,
      wind: 0.4,
      roughness: 0.93,
    });
    disposables.push(f);
    return f;
  };
  const furs: FurHandle[] = [];

  // ── body, neck, tail ────────────────────────────────────────────────────────────────────────
  const bodyFur = fur(bodyGeometry(low), 0.085, 95);
  bodyFur.object.position.y = -BODY.y;
  sc.body.add(bodyFur.object);
  furs.push(bodyFur);

  const saddle = new Mesh(saddleGeometry(low), saddleMat);
  saddle.position.y = -BODY.y;
  sc.body.add(saddle);

  const neckG = new Group();
  neckG.position.copy(sc.head.position);
  neckG.rotation.order = "YXZ";
  sc.body.add(neckG);
  const neckFur = fur(neckGeometry(low), 0.1, 100);
  neckG.add(neckFur.object);
  furs.push(neckFur);
  const maneFur = fur(maneGeometry(low), 0.17, 70, 0.95);
  neckG.add(maneFur.object);
  furs.push(maneFur);

  const tailG = new Group();
  tailG.position.set(0, 0.07, -0.78);
  sc.body.add(tailG);
  const tailFur = fur(tailGeometry(low), 0.12, 80);
  tailG.add(tailFur.object);
  furs.push(tailFur);

  // ── legs: fur tubes hip -> paw; paws ride the rig anchors ───────────────────────────────────
  const pawGeo = pawGeometry(low);
  const legs = (
    [
      { h: sc.handL, front: true, sg: 1 },
      { h: sc.handR, front: true, sg: -1 },
      { h: sc.footL, front: false, sg: 1 },
      { h: sc.footR, front: false, sg: -1 },
    ] as const
  ).map((d) => {
    const g = new Group();
    const lf = fur(legGeometry(d.front, low), 0.07, 100);
    g.add(lf.object);
    furs.push(lf);
    sc.root.add(g);
    d.h?.add(new Mesh(pawGeo, pawMat));
    const hip = d.front ? HIP.front : HIP.hind;
    return { g, h: d.h, hipX: d.sg * hip.x, hipZ: hip.z };
  });

  // ── head ────────────────────────────────────────────────────────────────────────────────────
  const headMesh = new Mesh(headGeometry(low), skinMat);
  headMesh.position.set(0, -0.03, -0.1);
  sc.face.add(headMesh);
  const jawMesh = new Mesh(jawGeometry(low), skinMat);
  sc.jaw?.add(jawMesh);

  const eyes = ([1, -1] as const).map((sg) => {
    const eye = createEye({ radius: 0.02, sclera: "#f0cbc2", iris: "#d4616f", lidMaterial: skinMat, pupilSize: 0.5 });
    eye.group.position.set(sg * 0.083, 0.043, -0.068);
    eye.group.rotation.y = sg * 1.15;
    sc.face.add(eye.group);
    eye.group.add(sg > 0 ? sc.eyeAnchorL : sc.eyeAnchorR);
    (sg > 0 ? sc.eyeAnchorL : sc.eyeAnchorR).position.set(0, 0, 0.02);
    disposables.push(eye);
    return eye;
  });
  const [eyeL, eyeR] = eyes;

  // ── secondary motion ────────────────────────────────────────────────────────────────────────
  const mot = makeMotion();
  const v = new Vector3();
  const dir = new Vector3();
  const q = new Quaternion();
  const DOWN = new Vector3(0, -1, 0);

  const update: Parameters<typeof assemblePuppet>[0]["update"] = (ctx) => {
    secondaryMotion(ctx, mot);
    const t = ctx.time;
    eyeL.sync();
    eyeR.sync();

    // neck follows part of the head's rotation (the head pivot itself is the controller's)
    const hr = sc.head.rotation;
    neckG.rotation.set(hr.x * 0.4, hr.y * 0.45, hr.z * 0.3);

    // legs: hip (follows the body) -> paw anchor
    sc.body.updateMatrix();
    for (const leg of legs) {
      if (!leg.h) continue;
      v.set(leg.hipX, LEG_HIP_Y - BODY.y, leg.hipZ).applyMatrix4(sc.body.matrix);
      dir.subVectors(leg.h.position, v);
      const len = Math.max(0.2, dir.length());
      dir.multiplyScalar(1 / len);
      q.setFromUnitVectors(DOWN, dir);
      leg.g.quaternion.copy(q);
      leg.g.position.copy(v);
      leg.g.scale.set(1, len / LEG_L, 1);
    }

    // tail: lazy swish, quick flicks, lifts when angry
    const flick = Math.pow(Math.max(0, Math.sin(t * 0.83) * Math.sin(t * 1.37 + 0.4)), 3) * 0.9;
    tailG.rotation.y = Math.sin(t * 1.05) * 0.2 + Math.sin(t * 2.7 + 1.0) * 0.05 + flick * Math.sin(t * 17) * 0.35 + Math.sin(ctx.gaitPhase) * ctx.walk * 0.22;
    tailG.rotation.x = -0.06 - ctx.anger * 0.35 - ctx.surprise * 0.2 + Math.sin(t * 0.7 + 2) * 0.04;
    tailG.rotation.z = Math.sin(t * 1.3 + 0.5) * 0.05;

    // fur
    saddleSway.update(t, mot);
    for (const f of furs) f.update(t, mot.fur);
  };

  return assemblePuppet({
    id: "creature",
    scaffold: sc,
    height: 1.95,
    waistY: BODY.y,
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
      jawOpen: 0.5,
      gait: "quadruped",
      stride: 0.6,
    },
    update,
    dispose() {
      disposables.forEach((d) => d.dispose());
      [skinMat, pawMat, saddleMat].forEach((m) => m.dispose());
    },
  });
};

export default build;
