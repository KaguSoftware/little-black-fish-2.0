/**
 * Optimises the seven character models and gives each one a rig the puppet controller can drive.
 *
 * Run:  node scripts/optimize-characters.mjs [name ...]
 * (suggested package.json script: "assets:characters": "node scripts/optimize-characters.mjs")
 *
 * In : assets-src/character/3d-models/<name>.glb   (Blender exports: meshopt geometry, 2048 PBR maps)
 * Out: public/models/<name>.glb   (then bump MODELS_REV in src/shared/content/characters.ts)
 *
 * The exports are static statues: every mesh hangs off the root in world space, the mask / hair /
 * crown are siblings of `Head`, and left/right parts share names. This script bakes every mesh into
 * world space, classifies it (by its own or nearest ancestor's name, then by position) and re-parents
 * it under pivot nodes placed at the generator's joints (body.js `J2`):
 *
 *   Rig_Root                (extras.propHand: "L" | "R" when a hand grips a staff)
 *    ├ Rig_Body  @ waist
 *    │   ├ Rig_Head @ neck ── Rig_Face (mask/skull only, for GiantFace), Rig_EyeL/R markers
 *    │   ├ Rig_ArmL @ shoulder ── Rig_WristL marker   (+ anything held in that hand)
 *    │   └ Rig_ArmR @ shoulder ── Rig_WristR marker
 *    ├ Rig_LegL @ hip ── Rig_AnkleL marker
 *    └ Rig_LegR @ hip ── Rig_AnkleR marker
 *
 * Pivots carry translation only; meshes under a pivot are offset by minus its world position, so
 * world-space geometry is unchanged at rest. L = +x (the figure's own left; it faces +Z).
 * Then: join per pivot, dedup, weld, simplify (sub-millimetre error), quantize, meshopt, and WebP
 * textures (colour maps 1024, data maps 512, lossy alpha: hair cards are alpha-tested anyway).
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS, EXTTextureWebP } from "@gltf-transform/extensions";
import {
  clearNodeTransform,
  dedup,
  flatten,
  getBounds,
  join,
  listTextureSlots,
  meshopt,
  prune,
  quantize,
  simplify,
  weld,
} from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { mkdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = resolve(ROOT, "assets-src/character/3d-models");
const OUT_DIR = resolve(ROOT, "public/models");

// ── joints (generator body.js J2, +x side) ────────────────────────────────
const HUMAN = {
  waist: [0, 1.0, 0],
  neck: [0, 1.56, -0.01],
  shoulder: [0.17, 1.43, -0.005],
  hip: [0.088, 0.94, 0],
  ankle: [0.094, 0.08, -0.005],
  eye: [0.036, 1.705],
};

/**
 * Per-character overrides. `kind: "quad"` has no limb pivots (the horse lies down); `arms: false`
 * keeps the arms on the body (Eblis's are hidden inside the cloak, so swinging them only clips).
 */
const CHARACTERS = {
  keyumars: { ...HUMAN, eye: [0.026, 1.742] }, // stone block mask: eye holes sit high
  siyamak: { ...HUMAN },
  arnavaz: { ...HUMAN, shoulder: [0.185, 1.43, -0.005] },
  shahrnaz: { ...HUMAN },
  eblis: { ...HUMAN, arms: false },
  zahhak: { ...HUMAN },
  horse: { kind: "quad", waist: [0, 0.45, 0], neck: [0, 0.72, 0.42], eye: [0.112, 1.555] },
};

// ── classification by name ────────────────────────────────────────────────
const FACE = new Set([
  "Head", "Nose", "Mask", "MaskBack", "MaskNose", "CollageMask", "EyeSlit", "Mouth", "Scalp", "ScalpBack",
  "StoneMask", "StoneMaskNose", "MaskEye", "MaskMouth",
  "CrownBand", "CrownBalls", "CrownBeads", "CrownSpikes", "CrownJewels", "Eye", "Lid", "Brow", "Horn", "SnoutTip",
]);
const HEAD = new Set(["HairCards", "HairBase", "BeardCards", "Fringe", "Tassel"]);
const ARM = new Set([
  "Arm", "ArmR", "Deltoid", "Sleeve", "Cuff", "Cuff2", "Wrist", "Hand", "Palm", "Finger", "Thumb", "Frill", "Frill2",
  "PuffSleeve",
]); // not SleeveRoll*/SleeveEnd*: those are Siyamak's jacket sleeves knotted round his waist
const LEG = new Set([
  "Leg", "Foot", "Ankle", "Toe", "Shoe", "BootShaft", "BootBand", "BootFoot", "Sole", "TrouserLeg", "AnkleCuff",
]);
const PROP = new Set(["Staff", "StaffFork", "StaffFork2", "StaffNeck"]);
// horse: the whole neck swings with the head
const QUAD_HEAD = new Set(["Neck", "FurLocks"]);

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const center = (b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
const boxDist = (p, b) => Math.hypot(
  Math.max(b.min[0] - p[0], 0, p[0] - b.max[0]),
  Math.max(b.min[1] - p[1], 0, p[1] - b.max[1]),
  Math.max(b.min[2] - p[2], 0, p[2] - b.max[2]),
);
const inside = (b, outer, pad) =>
  b.min.every((v, i) => v >= outer.min[i] - pad) && b.max.every((v, i) => v <= outer.max[i] + pad);
const union = (boxes) => ({
  min: [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b.min[i]))),
  max: [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b.max[i]))),
});

const COLOR_SLOT = /baseColor|emissive|sheenColor|diffuse/;

async function compressTextures(doc) {
  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const tex of doc.getRoot().listTextures()) {
    const src = tex.getImage();
    if (!src) continue;
    const color = listTextureSlots(tex).some((s) => COLOR_SLOT.test(s));
    const max = color ? 1024 : 512;
    const out = await sharp(Buffer.from(src))
      .resize(max, max, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: color ? 80 : 74, alphaQuality: 70, effort: 6 })
      .toBuffer();
    tex.setImage(new Uint8Array(out)).setMimeType("image/webp").setURI(tex.getURI().replace(/\.\w+$/, ".webp"));
  }
}

async function processCharacter(name) {
  const cfg = CHARACTERS[name];
  const quad = cfg.kind === "quad";
  const doc = await io.read(resolve(SRC_DIR, `${name}.glb`));
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const before = getBounds(scene);

  // Label every mesh node with its own name or its nearest named ancestor's (anonymous fingers,
  // cuff tori and beads inherit from their group), before flatten() drops the hierarchy.
  // Blender suffixes duplicates ("Finger.003") and names unnamed objects "Node_29" / "Mesh_38".
  const baseName = (n) => n.getName().replace(/\.\d+$/, "").replace(/^(Node|Mesh)_\d+$/, "");
  const topName = baseName(scene.listChildren()[0]);
  const label = new Map();
  for (const node of root.listNodes()) {
    if (!node.getMesh()) continue;
    let n = node;
    let l = "";
    while (n) {
      const nm = baseName(n);
      if (nm && nm !== topName) {
        l = nm;
        break;
      }
      n = n.getParentNode();
    }
    label.set(node, l);
  }

  // Bake world transforms into the geometry (meshes used by several nodes are cloned first).
  await doc.transform(flatten());
  const meshNodes = root.listNodes().filter((n) => n.getMesh());
  for (const node of meshNodes) {
    const m = node.getMesh();
    if (m.listParents().filter((p) => p.propertyType === "Node").length > 1) node.setMesh(m.clone());
    clearNodeTransform(node);
  }

  // ── classify ────────────────────────────────────────────────────────────
  const parts = meshNodes.map((node) => {
    const b = getBounds(node);
    return { node, label: label.get(node), box: b, c: center(b), group: "" };
  });
  const side = (p) => (p.c[0] >= 0 ? "L" : "R");
  for (const p of parts) {
    const l = p.label;
    if (FACE.has(l)) p.group = "face";
    else if (HEAD.has(l) || (quad && QUAD_HEAD.has(l) && p.c[2] > 0.25)) p.group = "head";
    else if (quad) p.group = "body";
    else if (ARM.has(l)) p.group = cfg.arms === false ? "body" : `arm${side(p)}`;
    else if (LEG.has(l)) p.group = `leg${side(p)}`;
    else if (PROP.has(l)) p.group = "prop";
    else if (!l && p.box.min[1] > cfg.neck[1] - 0.03 && Math.abs(p.c[0]) < 0.15) p.group = "face"; // eyes, brows
  }
  // Pieces spanning both sides can't follow one limb: keep them on the body.
  for (const p of parts) {
    if ((p.group.startsWith("arm") || p.group.startsWith("leg")) && Math.abs(p.c[0]) < 0.04) {
      console.warn(`  ! ${name}: "${p.label}" spans both sides, kept on body`);
      p.group = "body";
    }
  }

  // Wrists: centre of each side's palms (falls back to the joint table).
  const wrist = {};
  for (const s of ["L", "R"]) {
    const palms = parts.filter((p) => p.group === `arm${s}` && (p.label === "Palm" || p.label === "Hand"));
    const sg = s === "L" ? 1 : -1;
    wrist[s] = palms.length ? center(union(palms.map((p) => p.box))) : [0.27 * sg, 0.9, 0.01];
  }
  // Props (staffs) go to the hand that grips them, along with anything sitting on top of them.
  const props = parts.filter((p) => p.group === "prop");
  let propHand = null;
  if (props.length) {
    const pb = union(props.map((p) => p.box));
    const s = boxDist(wrist.L, pb) < boxDist(wrist.R, pb) ? "L" : "R";
    propHand = s;
    for (const p of parts) if (p.group === "prop" || (!p.group && inside(p.box, pb, 0.09))) p.group = `arm${s}`;
  }
  for (const p of parts) if (!p.group) p.group = "body";

  // ── rebuild the hierarchy ───────────────────────────────────────────────
  const sx = (v, s) => [s === "L" ? v[0] : -v[0], v[1], v[2]];
  const pivots = { Rig_Root: [0, 0, 0], Rig_Body: cfg.waist, Rig_Head: cfg.neck, Rig_Face: cfg.neck };
  const parentOf = { Rig_Body: "Rig_Root", Rig_Head: "Rig_Body", Rig_Face: "Rig_Head" };
  const arms = !quad && cfg.arms !== false;
  for (const s of ["L", "R"]) {
    if (arms) {
      pivots[`Rig_Arm${s}`] = sx(cfg.shoulder, s);
      parentOf[`Rig_Arm${s}`] = "Rig_Body";
    }
    if (!quad) {
      pivots[`Rig_Leg${s}`] = sx(cfg.hip, s);
      parentOf[`Rig_Leg${s}`] = "Rig_Root";
    }
  }

  const nodes = {};
  for (const n of Object.keys(pivots)) nodes[n] = doc.createNode(n);
  for (const [n, p] of Object.entries(pivots)) {
    const parent = parentOf[n];
    nodes[n].setTranslation(parent ? sub(p, pivots[parent]) : p);
    if (parent) nodes[parent].addChild(nodes[n]);
  }
  const markers = [];
  const marker = (name, parent, world) => {
    markers.push(name);
    const m = doc.createNode(name).setTranslation(sub(world, pivots[parent]));
    nodes[parent].addChild(m);
  };

  // Eye markers: centre of each eye opening on the front surface of the face.
  const faceParts = parts.filter((p) => p.group === "face");
  for (const s of ["L", "R"]) {
    const ex = s === "L" ? cfg.eye[0] : -cfg.eye[0];
    const ey = cfg.eye[1];
    const hits = faceParts.filter((p) => p.box.min[0] <= ex && p.box.max[0] >= ex && p.box.min[1] <= ey && p.box.max[1] >= ey);
    const z = hits.length ? Math.max(...hits.map((p) => p.box.max[2])) : cfg.neck[2] + 0.1;
    marker(`Rig_Eye${s}`, "Rig_Face", [ex, ey, z]);
  }
  if (!quad) {
    for (const s of ["L", "R"]) {
      if (arms) marker(`Rig_Wrist${s}`, `Rig_Arm${s}`, wrist[s]);
      const feet = parts.filter((p) => p.group === `leg${s}` && /Foot|Shoe|Sole|Ankle/.test(p.label));
      const ankle = feet.length ? [center(union(feet.map((p) => p.box)))[0], cfg.ankle[1], cfg.ankle[2]] : sx(cfg.ankle, s);
      marker(`Rig_Ankle${s}`, `Rig_Leg${s}`, ankle);
    }
  }

  const groupPivot = { body: "Rig_Body", head: "Rig_Head", face: "Rig_Face", armL: "Rig_ArmL", armR: "Rig_ArmR", legL: "Rig_LegL", legR: "Rig_LegR" };
  // One unnamed holder per pivot so join() can merge everything that shares a material.
  const holders = {};
  for (const p of parts) {
    const pv = groupPivot[p.group];
    if (!holders[pv]) {
      holders[pv] = doc.createNode("").setTranslation(sub([0, 0, 0], pivots[pv]));
      nodes[pv].addChild(holders[pv]);
    }
    const n = p.node;
    for (const parent of n.listParents()) if (parent.propertyType === "Node" || parent.propertyType === "Scene") parent.removeChild(n);
    n.setName("");
    n.getMesh().setName("");
    holders[pv].addChild(n);
  }

  for (const c of scene.listChildren()) scene.removeChild(c);
  scene.addChild(nodes.Rig_Root);
  // Read by modelPuppet: the gripping arm swings less and the other hand does the waving.
  if (propHand && arms) nodes.Rig_Root.setExtras({ propHand });

  const counts = {};
  for (const p of parts) counts[p.group] = (counts[p.group] || 0) + 1;

  await doc.transform(
    join({ keepNamed: true, cleanup: false }), // its cleanup would prune the empty marker nodes
    dedup(),
    prune({ keepLeaves: true }),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: 0.0008, lockBorder: true }),
    quantize(),
  );
  await compressTextures(doc);
  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "medium" }));

  // ── verify ──────────────────────────────────────────────────────────────
  const after = getBounds(doc.getRoot().listScenes()[0]);
  const drift = Math.max(...[0, 1, 2].flatMap((i) => [Math.abs(after.min[i] - before.min[i]), Math.abs(after.max[i] - before.max[i])]));
  if (drift > 0.005) throw new Error(`${name}: bounds drifted ${drift.toFixed(4)} m`);
  const names = new Set(doc.getRoot().listNodes().map((n) => n.getName()));
  for (const n of [...Object.keys(pivots), ...markers]) if (!names.has(n)) throw new Error(`${name}: rig node ${n} lost`);
  const draws = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().length, 0);

  const out = resolve(OUT_DIR, `${name}.glb`);
  await io.write(out, doc);
  const kb = (statSync(out).size / 1024).toFixed(0);
  const srcMb = (statSync(resolve(SRC_DIR, `${name}.glb`)).size / 1048576).toFixed(1);
  const h = (before.max[1] - before.min[1]).toFixed(2);
  console.log(`${name.padEnd(9)} ${srcMb} MB -> ${kb} KB  h ${h} m  draws ${draws}  ${JSON.stringify(counts)}`);
}

mkdirSync(OUT_DIR, { recursive: true });
const only = process.argv.slice(2);
for (const name of Object.keys(CHARACTERS)) if (!only.length || only.includes(name)) await processCharacter(name);
