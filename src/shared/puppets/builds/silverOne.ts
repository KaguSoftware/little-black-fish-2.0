import {
  AdditiveBlending,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MirroredRepeatWrapping,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  TorusGeometry,
  Texture,
  Uint16BufferAttribute,
  Vector3,
} from "three";
import { TEXTURES } from "../../content/textures";
import {
  EYE_LIMITS,
  assemblePuppet,
  createFurShells,
  createHairCurtain,
  createLatheRobe,
  createScaffold,
  makeChrome,
  makeFabric,
  makeLame,
  makeMotion,
  secondaryMotion,
  swayRobe,
  type FurHandle,
} from "../kit";
import type { BuildOptions, Puppet, PuppetBuilder } from "../types";
import { RingTubes } from "./snakeKing/ringTubes";
import { buildCloak, cloakDistance } from "./silverOne/cloak";
import { buildChromeMask, chromeGlowTexture, eggFrontZ, glintTexture } from "./silverOne/mask";

/**
 * THE SILVER ONE. A featureless chrome oval for a face, hair like two dark-auburn curtains,
 * a crinkled silver lamé cloak with a long train, a linen under-robe with fringe, panels of lapis
 * beads and big white fur cuffs. No eyes: the "pupils" drive a bright reflection that slides over
 * the chrome, so the face still follows you.
 */

const WAIST_Y = 1.0;
const NECK_Y = 1.45;
const FACE_Y = 0.22;
const TEX = TEXTURES["silver-one"];
const HAIR_TOP = 1.82;
const HAIR_X = 0.108;
const HAIR_Z = 0.095;

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Linen under-robe: [radius, y] hem to neck, plus its depth squash. */
const LINEN: [number, number][] = [
  [0.4, 0],
  [0.37, 0.2],
  [0.31, 0.5],
  [0.24, 0.8],
  [0.2, 1.05],
  [0.158, 1.14],
  [0.2, 1.26],
  [0.205, 1.33],
  [0.13, 1.42],
  [0.07, 1.46],
  [0.06, 1.5],
];
const LINEN_Z = 0.78;
const linenR = (y: number): number => {
  if (y <= LINEN[0][1]) return LINEN[0][0];
  for (let i = 1; i < LINEN.length; i++) {
    if (y <= LINEN[i][1]) {
      const t = (y - LINEN[i - 1][1]) / (LINEN[i][1] - LINEN[i - 1][1]);
      return LINEN[i - 1][0] + (LINEN[i][0] - LINEN[i - 1][0]) * t;
    }
  }
  return LINEN[LINEN.length - 1][0];
};

const mirrored = (t: Texture): Texture => {
  if (t.wrapS !== MirroredRepeatWrapping) {
    t.wrapS = t.wrapT = MirroredRepeatWrapping;
    if (t.image) t.needsUpdate = true;
  }
  return t;
};
const repeating = (t: Texture): Texture => {
  if (t.wrapS !== RepeatWrapping) {
    t.wrapS = t.wrapT = RepeatWrapping;
    if (t.image) t.needsUpdate = true;
  }
  return t;
};

/** Vertical beaded ribbons hugging the linen robe: [x, yTop, yBottom]. One merged geometry. */
function buildBeadPanels(panels: [number, number, number][]): BufferGeometry {
  const rows = 24;
  const cols = 3;
  const w = 0.026;
  const per = rows * cols;
  const pos = new Float32Array(panels.length * per * 3);
  const uv = new Float32Array(panels.length * per * 2);
  const idx: number[] = [];
  panels.forEach(([X, yTop, yBot], p) => {
    for (let j = 0; j < rows; j++) {
      const y = yTop + (yBot - yTop) * (j / (rows - 1));
      for (let k = 0; k < cols; k++) {
        const x = X + (k - 1) * w;
        const r = linenR(y);
        const z = LINEN_Z * Math.sqrt(Math.max(0, r * r - x * x)) + 0.006;
        const i = p * per + j * cols + k;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        uv[i * 2] = k / (cols - 1);
        uv[i * 2 + 1] = (j / (rows - 1)) * Math.abs(yTop - yBot) * 2.6;
      }
    }
    for (let j = 0; j < rows - 1; j++) {
      for (let k = 0; k < cols - 1; k++) {
        const a = p * per + j * cols + k;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(new Uint16BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

const build: PuppetBuilder = (opts: BuildOptions): Puppet => {
  const q = opts.quality;
  const low = q === "low";

  const chrome = buildChromeMask(q);
  const sc = createScaffold({
    waistY: WAIST_Y,
    neckY: NECK_Y,
    face: [0, FACE_Y, 0],
    jaw: [0, FACE_Y + chrome.hingeY, 0],
    hands: [0.25, 0.8, 0.11],
    feet: [0.1, 0.04, 0.05],
  });
  sc.object.name = "puppet-silver-one";
  const { root, body, head, face } = sc;

  // ── materials ────────────────────────────────────────────────────────────
  const lameTex = mirrored(opts.texture(TEX.lame, { srgb: true, repeat: [1, 1] }));
  const linenTex = mirrored(opts.texture(TEX.linen, { srgb: true, repeat: [1, 1] }));
  const beadsTex = repeating(opts.texture(TEX.beads, { srgb: true }));
  const chromeMat = makeChrome({ color: "#f2f5fb", roughness: 0.1, envMapIntensity: 3.4 });
  chromeMat.emissive = new Color("#ffffff");
  chromeMat.emissiveMap = chromeGlowTexture();
  chromeMat.emissiveIntensity = 0.5;
  const cloakMat = makeLame({ color: "#cfd8dc", map: lameTex, roughness: 0.42, side: DoubleSide, lite: low });
  cloakMat.metalness = 0.62;
  cloakMat.emissive = new Color("#2a3440");
  cloakMat.emissiveIntensity = 0.55;
  const linenMat = makeFabric({ map: linenTex, color: "#cdbf9f", roughness: 0.92, sheen: 0.2, side: DoubleSide });
  const sleeveMat = makeFabric({ map: linenTex, color: "#d6c6a2", roughness: 0.92, sheen: 0.2, side: DoubleSide });
  const beadMat = new MeshPhysicalMaterial({
    map: beadsTex,
    color: "#ffffff",
    roughness: 0.28,
    metalness: 0.15,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
    emissive: new Color("#3d5bd0"),
    emissiveMap: beadsTex,
    emissiveIntensity: 0.12,
    side: DoubleSide,
  });
  const darkMat = new MeshStandardMaterial({ color: "#1b0907", roughness: 0.7 });

  // ── cloak, linen robe, beads (root: they do not need to follow the waist) ──
  const cloak = new Mesh(buildCloak(q), cloakMat);
  cloak.name = "cloak";
  root.add(cloak);
  const cloakSway = swayRobe(cloakMat, { hemY: 0, topY: 1.15, amplitude: 0.075, waves: 4, speed: 0.9, flare: 0.05 });
  const linen = createLatheRobe(LINEN, {
    material: linenMat,
    quality: q,
    folds: 11,
    foldDepth: 0.13,
    uvRepeat: [1.5, 1.6],
    capTop: true,
    sway: { amplitude: 0.025, waves: 3, speed: 1.0, flare: 0.03 },
    seed: 7,
  });
  linen.mesh.scale.z = LINEN_Z;
  root.add(linen.mesh);
  // a twisted linen cord at the waist gives the robe a figure
  const cordGeo = new TorusGeometry(0.19, 0.012, 8, 40);
  cordGeo.scale(1, LINEN_Z, 1);
  cordGeo.rotateX(Math.PI / 2);
  const cord = new Mesh(cordGeo, new MeshStandardMaterial({ color: "#d9c79c", roughness: 0.85 }));
  cord.position.y = 1.12;
  root.add(cord);
  const beads = new Mesh(
    buildBeadPanels([
      [0.12, 1.1, 0.5],
      [-0.12, 1.1, 0.5],
      [0.205, 0.84, 0.5],
      [-0.205, 0.84, 0.5],
    ]),
    beadMat,
  );
  beads.name = "bead-panels";
  root.add(beads);

  // fringe along the hem of the linen robe (front), hair-card strands in linen colour
  const fringe = createHairCurtain({
    radiusX: 0.325,
    radiusZ: 0.255,
    center: [0, 0.5, 0],
    arc: [-1.2, 1.2],
    length: 0.42,
    color: "#cdb88f",
    tipColor: "#e6d7b4",
    layers: 2,
    flare: 0.03,
    quality: q,
    seed: 41,
    roughness: 0.8,
  });
  root.add(fringe.object);

  // ── fur: hem panels and the two big cuffs ────────────────────────────────
  const furOpts = {
    quality: q,
    length: 0.075,
    color: "#efecf7",
    tipColor: "#ffffff",
    rootColor: "#9a94b0",
    density: 130,
    gravity: 0.55,
    wind: 0.55,
  } as const;
  const hemGeo = new CylinderGeometry(0.4, 0.44, 0.5, low ? 24 : 40, low ? 4 : 8, true, -1.15, 2.3);
  hemGeo.scale(1, 1, 0.8);
  hemGeo.translate(0, 0.25, 0);
  const hemFur = createFurShells(hemGeo, { ...furOpts, shells: low ? 6 : 9 });
  root.add(hemFur.object);
  const cuffGeoL = new CapsuleGeometry(0.075, 0.2, 5, 14);
  cuffGeoL.scale(1, 1, 0.9);
  cuffGeoL.translate(0, -0.14, 0);
  const cuffL = createFurShells(cuffGeoL, { ...furOpts, shells: low ? 6 : 9 });
  const cuffGeoR = cuffGeoL.clone();
  const cuffR = createFurShells(cuffGeoR, { ...furOpts, shells: low ? 6 : 9 });
  sc.handL!.add(cuffL.object);
  sc.handR!.add(cuffR.object);
  const furs: FurHandle[] = [hemFur, cuffL, cuffR];

  // ── mask, seam, glints ───────────────────────────────────────────────────
  const maskUpper = new Mesh(chrome.upper, chromeMat);
  maskUpper.name = "mask";
  face.add(maskUpper);
  const maskLower = new Mesh(chrome.lower, chromeMat);
  maskLower.name = "mask-lower";
  sc.jaw!.add(maskLower);
  const skull = new Mesh(new SphereGeometry(1, 24, 16), darkMat);
  skull.scale.set(0.092, 0.15, 0.1);
  skull.position.set(0, 0.255, -0.02);
  head.add(skull);

  const glintMat = new MeshBasicMaterial({
    map: glintTexture(),
    color: new Color(1.5, 1.6, 1.9),
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const glintGeo = new PlaneGeometry(0.085, 0.085);
  const EYE_X = 0.036;
  const EYE_Y = 0.035;
  const makeGlint = (sx: number) => {
    const z = eggFrontZ(sx * EYE_X, EYE_Y) + 0.004;
    const pupil = new Group();
    pupil.name = sx > 0 ? "pupilL" : "pupilR";
    pupil.position.set(sx * EYE_X, EYE_Y, z);
    const plane = new Mesh(glintGeo, glintMat);
    plane.rotation.y = sx * 0.28;
    plane.renderOrder = 4;
    pupil.add(plane);
    face.add(pupil);
    const lid = new Group();
    lid.name = sx > 0 ? "lidL" : "lidR";
    face.add(lid);
    return { pupil, plane, lid };
  };
  const gL = makeGlint(1);
  const gR = makeGlint(-1);
  sc.eyeAnchorL.position.set(EYE_X, EYE_Y, eggFrontZ(EYE_X, EYE_Y) + 0.002);
  sc.eyeAnchorR.position.set(-EYE_X, EYE_Y, eggFrontZ(EYE_X, EYE_Y) + 0.002);
  face.add(sc.eyeAnchorL, sc.eyeAnchorR);

  // ── hair: two long curtains that drape over the cloak ────────────────────
  const hairLen = (phi: number) => 1.06 + 0.16 * Math.max(0, -Math.cos(phi));
  const hairProfile = (t: number, phi: number, layer: number) => {
    const y = HAIR_TOP - t * hairLen(phi);
    const d = cloakDistance(y, phi);
    const chest = 0.03 + 0.05 * sstep(0.12, 0.4, t);
    // hair at the back rests on the cloak; hair at the front hangs free over the linen
    const over = d > 0 ? d + 0.03 + layer * 0.012 - 0.09 : 0;
    return Math.max(chest, over);
  };
  const hairBase = {
    radiusX: HAIR_X,
    radiusZ: HAIR_Z,
    center: [0, HAIR_TOP - NECK_Y, -0.004] as const,
    length: hairLen,
    color: "#34110d",
    tipColor: "#6a2a1c",
    layers: 3,
    rows: low ? 10 : 20,
    quality: q,
    roughness: 0.55,
    profile: hairProfile,
  };
  const hairFrontL = createHairCurtain({ ...hairBase, arc: [1.0, 1.75], cards: low ? 10 : 30, seed: 23 });
  const hairFrontR = createHairCurtain({ ...hairBase, arc: [Math.PI * 2 - 1.75, Math.PI * 2 - 1.0], cards: low ? 10 : 30, seed: 24 });
  const hairBack = createHairCurtain({ ...hairBase, arc: [1.75, Math.PI * 2 - 1.75], seed: 25, layers: low ? 2 : 4 });
  const hairs = [hairFrontL, hairFrontR, hairBack];
  for (const h of hairs) {
    h.material.sheen = 0.08;
    h.material.sheenRoughness = 0.3;
    h.material.sheenColor = new Color("#6a2616");
    h.material.specularIntensity = 0.1;
    h.material.anisotropy = 0.2;
    h.material.anisotropyRotation = Math.PI / 2;
    head.add(h.object);
  }

  // ── arms: linen sleeves from the shoulders to the fur cuffs ──────────────
  const RINGS = 14;
  const sleeves = new RingTubes(2, RINGS, 9, (_i, k) => (k / (RINGS - 1)) * 0.8, 1);
  const sleeveMesh = new Mesh(sleeves.geometry, sleeveMat);
  sleeveMesh.frustumCulled = false;
  sleeveMesh.name = "sleeves";
  body.add(sleeveMesh);
  const invBody = new Matrix4();
  const wv = new Vector3();
  const poseSleeves = () => {
    body.updateMatrix();
    invBody.copy(body.matrix).invert();
    for (let side = 0; side < 2; side++) {
      const hand = side === 0 ? sc.handL! : sc.handR!;
      const sx = side === 0 ? 1 : -1;
      wv.copy(hand.position).applyMatrix4(invBody);
      const Sx = sx * 0.17;
      const Sy = 0.34;
      const Cx = (Sx + wv.x) / 2 + sx * 0.08;
      const Cy = (Sy + wv.y) / 2;
      const Cz = wv.z / 2 - 0.06;
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
        const r = 0.058 + 0.016 * Math.sin(t * Math.PI * 0.8) + 0.01 * t;
        sleeves.RX[ro + k] = r;
        sleeves.RY[ro + k] = r * 0.92;
      }
      sleeves.build(side);
    }
    sleeves.flush();
  };
  poseSleeves();

  // ── frame update ─────────────────────────────────────────────────────────
  const motion = makeMotion();
  const update = (ctx: Parameters<Puppet["update"]>[0]) => {
    const m = secondaryMotion(ctx, motion);
    m.wind = Math.max(-0.5, Math.min(0.5, m.wind));
    // a dreamy, always-moving drift on top of the mood
    m.sway = Math.min(0.9, Math.max(m.sway, 0.6) + Math.sin(ctx.time * 0.5) * 0.1);
    m.billow = Math.max(m.billow, 0.18 + 0.12 * Math.sin(ctx.time * 0.37));
    for (const h of hairs) h.update(ctx.time, m);
    fringe.update(ctx.time, m);
    cloakSway.update(ctx.time, m);
    linen.update(ctx.time, m);
    const wind = ctx.hero ? m.fur : m.fur * 0.7;
    for (const f of furs) f.update(ctx.time, wind);
    poseSleeves();
    // the glints: blink squashes them, surprise flares them, they slide with the pupil handles
    for (const g of [gL, gR]) {
      const lidRot = g.lid.rotation.x;
      const closed = Math.min(1, Math.max(0, lidRot / EYE_LIMITS.lidClosed));
      const open = lidRot < 0 ? Math.min(0.35, -lidRot * 0.6) : 0;
      const pulse = 1 + Math.sin(ctx.time * 1.7 + (g === gL ? 0 : 1.3)) * 0.05 + ctx.talking * 0.12;
      g.plane.scale.set(pulse * (1 + open * 0.5), pulse * Math.max(0.05, 1 - closed * 0.96) * (1 + open), 1);
    }
    beadMat.emissiveIntensity = 0.1 + 0.07 * (0.5 + 0.5 * Math.sin(ctx.time * 1.3));
  };

  return assemblePuppet({
    id: "silver-one",
    scaffold: sc,
    height: 1.85,
    waistY: WAIST_Y,
    pupilL: gL.pupil,
    pupilR: gR.pupil,
    lidL: gL.lid,
    lidR: gR.lid,
    limits: {
      headYaw: 0.55,
      headPitch: 0.3,
      pupil: { x: 0.022, y: 0.013 },
      lidNeutral: EYE_LIMITS.lidNeutral,
      lidOpen: EYE_LIMITS.lidOpen,
      lidClosed: EYE_LIMITS.lidClosed,
      jawOpen: 0.12,
      gait: "biped",
      stride: 0.4,
    },
    update,
    dispose() {
      hairs.forEach((h) => h.dispose());
      fringe.dispose();
      furs.forEach((f) => f.dispose());
      hemGeo.dispose();
      cuffGeoL.dispose();
      cuffGeoR.dispose();
      glintGeo.dispose();
      glintMat.dispose();
      sleeves.dispose();
      linen.dispose();
    },
  });
};

export default build;
