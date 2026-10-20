/**
 * Crops material swatches out of the character sheets and stills for the procedural puppets.
 *
 * Run:  node scripts/crop-swatches.mjs
 *
 * In : assets-src/stills/{n}.jpg
 * Out: public/textures/<teller>/<name>.webp   (512x512 for crops >= 300px, else 256x256; q72)
 *
 * Coordinates are in source pixels (s05/s06/s08/s09/s14/s22/s23/s26 are 1376x768, s11 is 1536x1024).
 * Small crops are written at 256px: upscaling them to 512 adds bytes and GPU memory but no detail
 * (they are soft either way: treat them as colour + pattern references rather than hi-res detail).
 * Each entry: [src, left, top, width, height]
 */
import sharp from "sharp";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "assets-src/stills");
const OUT = resolve(ROOT, "public/textures");

/** @type {Record<string, Record<string, [number, number, number, number, number]>>} */
const CROPS = {
  "snake-king": {
    velvet: [5, 987, 100, 170, 170],
    embroidery: [5, 1171, 88, 176, 176],
    mask: [5, 987, 420, 170, 170],
    "crown-metal": [5, 1171, 450, 176, 176],
    "mask-face": [5, 95, 200, 340, 340],
  },
  "silver-one": {
    lame: [22, 992, 40, 200, 200],
    linen: [22, 1210, 20, 160, 160],
    beads: [22, 992, 388, 200, 190],
    fur: [22, 995, 620, 140, 140],
    chrome: [22, 55, 50, 330, 330],
  },
  "masked-lady": {
    "mask-face": [26, 105, 80, 340, 340],
    "vest-embroidery": [26, 0, 515, 253, 253],
    linen: [26, 330, 520, 200, 200],
    cuff: [26, 875, 545, 185, 185],
    belt: [11, 1280, 700, 130, 130],
    tweed: [11, 1290, 270, 220, 220],
    bib: [11, 1265, 0, 260, 260],
    tassel: [11, 300, 520, 145, 145],
  },
  creature: {
    fur: [23, 1035, 160, 220, 220],
    skin: [23, 1170, 120, 200, 200],
    saddle: [23, 1034, 388, 340, 340],
  },
  elder: {
    knit: [8, 835, 480, 250, 250],
    hair: [14, 1080, 80, 250, 250],
    stone: [8, 995, 110, 70, 70],
  },
  child: {
    "skin-marks": [9, 605, 290, 180, 180],
    cloth: [9, 612, 520, 160, 160],
    "paper-mask": [9, 625, 110, 133, 133],
  },
};

let n = 0;
for (const [teller, items] of Object.entries(CROPS)) {
  mkdirSync(resolve(OUT, teller), { recursive: true });
  for (const [name, [src, left, top, width, height]] of Object.entries(items)) {
    const input = resolve(SRC, `${src}.jpg`);
    if (!existsSync(input)) {
      console.warn(`skip ${teller}/${name}: missing ${input}`);
      continue;
    }
    const size = Math.max(width, height) >= 300 ? 512 : 256;
    await sharp(input)
      .extract({ left, top, width, height })
      .resize(size, size, { fit: "cover", kernel: "lanczos3" })
      .webp({ quality: 72, effort: 6 })
      .toFile(resolve(OUT, teller, `${name}.webp`));
    n++;
    console.log(`public/textures/${teller}/${name}.webp  <- s${src} [${left},${top},${width}x${height}]`);
  }
}
console.log(`wrote ${n} swatches`);
