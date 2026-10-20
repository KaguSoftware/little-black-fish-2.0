/**
 * Optimises the cartoon stand-in character.
 *
 * Run:  node scripts/optimize-model.mjs
 * (suggested package.json script: "assets:model": "node scripts/optimize-model.mjs")
 *
 * In : assets-src/character/test character v2.gltf (+ buffer.bin)
 * Out: public/models/standin.glb  (target < 500 KB)
 *
 * Steps: bake frame 0 of the (completely static) animation into node TRS, drop the
 * animation, zero emissive, tint teeth, dedup/prune/weld/quantize/meshopt.
 * Deliberately NOT used: flatten, join, instance, optimize preset (they destroy the named rig).
 */
import { NodeIO } from "@gltf-transform/core";
import { KHRONOS_EXTENSIONS, EXTMeshoptCompression } from "@gltf-transform/extensions";
import { dedup, prune, weld, quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import { statSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "assets-src/character/test character v2.gltf");
const OUT = resolve(ROOT, "public/models/standin.glb");

const REQUIRED_NODES = [
  "Root", "Kamar", "Kamar_bala", "Neck", "Head_Rotate", "Up_Head", "Down_Head",
  "Eyes_GRP", "Bored", "Angry", "Mardomak_L", "Mardomak_R",
  "Pelk_L_Up", "Pelk_R_Up", "Pelk_L_Up_1", "Pelk_R_Up_1",
  "Moch_L", "Moch_R", "Shoe_L", "Shoe_R", "Body_Top", "Top_Down", "Pant_L", "Pant_R",
];

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);

const io = new NodeIO()
  .registerExtensions([...KHRONOS_EXTENSIONS, EXTMeshoptCompression])
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });

const doc = await io.read(SRC);
const root = doc.getRoot();

// 1. Bake frame 0 of every animation channel into the node's TRS, then drop animations.
let baked = 0;
let changed = 0;
for (const anim of root.listAnimations()) {
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode();
    const sampler = ch.getSampler();
    if (!node || !sampler) continue;
    const out = sampler.getOutput();
    const path = ch.getTargetPath();
    const interp = sampler.getInterpolation();
    // CUBICSPLINE stores [in-tangent, value, out-tangent] per key; frame 0 value is element 1.
    const v = [];
    out.getElement(interp === "CUBICSPLINE" ? 1 : 0, v);
    const val = v.slice(0, out.getElementSize());
    const eq = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
    if (path === "translation") {
      if (!eq(node.getTranslation(), val)) changed++;
      node.setTranslation(val);
    } else if (path === "rotation") {
      if (!eq(node.getRotation(), val)) changed++;
      node.setRotation(val);
    } else if (path === "scale") {
      if (!eq(node.getScale(), val)) changed++;
      node.setScale(val);
    } else continue; // weights etc: not present in this rig
    baked++;
  }
}
console.log(`baked ${baked} channels (${changed} differed from node defaults)`);
for (const anim of root.listAnimations()) {
  for (const ch of anim.listChannels()) ch.dispose();
  for (const s of anim.listSamplers()) s.dispose();
  anim.dispose();
}

// 2. Materials.
for (const mat of root.listMaterials()) {
  mat.setEmissiveFactor([0, 0, 0]);
  if (mat.getName() === "lambert1") mat.setBaseColorFactor([0.85, 0.82, 0.76, 1]);
}

// 3. Safe optimisation passes only.
await doc.transform(
  dedup(),
  prune({ keepLeaves: true, keepAttributes: false }),
  weld(),
  quantize(),
  meshopt({ encoder: MeshoptEncoder, level: "medium" }),
);

mkdirSync(dirname(OUT), { recursive: true });
await io.write(OUT, doc);

// 4. Verify by re-reading.
const check = await io.read(OUT);
const names = new Set(check.getRoot().listNodes().map((n) => n.getName()));
const missing = REQUIRED_NODES.filter((n) => !names.has(n));
const anims = check.getRoot().listAnimations().length;
const hotMats = check
  .getRoot()
  .listMaterials()
  .filter((m) => m.getEmissiveFactor().some((x) => x !== 0));
const failures = [];
if (missing.length) failures.push(`missing nodes: ${missing.join(", ")}`);
if (anims) failures.push(`${anims} animations remain`);
if (hotMats.length) failures.push(`${hotMats.length} materials with non-zero emissive`);

const kb = statSync(OUT).size / 1024;
console.log(`wrote ${OUT}: ${kb.toFixed(1)} KB`);
console.log(`nodes: ${names.size}, materials: ${check.getRoot().listMaterials().length}, animations: ${anims}`);
console.log(`required nodes present: ${REQUIRED_NODES.length - missing.length}/${REQUIRED_NODES.length}`);
if (kb >= 500) failures.push(`size ${kb.toFixed(1)} KB exceeds 500 KB target`);
if (failures.length) {
  console.error("FAILED:\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log("ALL ASSERTIONS PASSED");
