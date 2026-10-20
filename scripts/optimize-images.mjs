/**
 * Builds web assets from the 27 production stills.
 *
 * Run:  node scripts/optimize-images.mjs
 *
 * In : assets-src/stills/{n}.jpg                 (n = 1..27)
 * Out: public/stills/s{nn}-640.webp|avif  (q72 / q50)  (cards on small screens)
 *      public/stills/s{nn}-1200.webp|avif (q70 / q48)  (cards, reel, teasers)
 *      public/plates/s{nn}.webp           (PLATE_W max, q62, series backdrop textures)
 *      public/hero/s{nn}-1280|960.webp    (q50 / q45, home lantern wall: halftone, fog and grain
 *                                          sit on top, so these can be soft)
 *      public/portraits/{teller}.webp     (240x320, 3:4 face crops, q75; shown at most ~68x88 CSS px.
 *                                          Sheets cannot be cropped cleanly with CSS object-position,
 *                                          so these are baked)
 *
 * Nothing is ever upscaled, so the portrait still (939w) keeps its native width.
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = resolve(ROOT, "assets-src/stills");
const STILLS = resolve(ROOT, "public/stills");
const PLATES = resolve(ROOT, "public/plates");
mkdirSync(STILLS, { recursive: true });
mkdirSync(PLATES, { recursive: true });

const PORTRAITS = resolve(ROOT, "public/portraits");
mkdirSync(PORTRAITS, { recursive: true });
const HERO = resolve(ROOT, "public/hero");
mkdirSync(HERO, { recursive: true });

const PLATE_W = 1600;

const COUNT = 27;
let total = 0;
const write = async (pipeline, out) => {
  const info = await pipeline.toFile(out);
  total += info.size;
  return info;
};

for (let n = 1; n <= COUNT; n++) {
  const id = `s${String(n).padStart(2, "0")}`;
  const input = resolve(SRC, `${n}.jpg`);
  const meta = await sharp(input).metadata();
  const base = () => sharp(input).rotate();
  const fit = (w) => ({ width: w, withoutEnlargement: true });

  const webp = (quality) => ({ quality, effort: 6, smartSubsample: true });
  const avif = (quality) => ({ quality, effort: 6 });
  await write(base().resize(fit(640)).webp(webp(72)), resolve(STILLS, `${id}-640.webp`));
  await write(base().resize(fit(640)).avif(avif(50)), resolve(STILLS, `${id}-640.avif`));
  await write(base().resize(fit(1200)).webp(webp(70)), resolve(STILLS, `${id}-1200.webp`));
  await write(base().resize(fit(1200)).avif(avif(48)), resolve(STILLS, `${id}-1200.avif`));
  await write(base().resize(fit(1280)).webp(webp(50)), resolve(HERO, `${id}-1280.webp`));
  await write(base().resize(fit(960)).webp(webp(45)), resolve(HERO, `${id}-960.webp`));
  const plate = await write(base().resize(fit(PLATE_W)).webp(webp(62)), resolve(PLATES, `${id}.webp`));

  console.log(
    `${id}  ${meta.width}x${meta.height}  aspect ${(meta.width / meta.height).toFixed(4)}  plate ${(plate.size / 1024).toFixed(0)} KB`,
  );
}
console.log(`done: ${(total / 1024 / 1024).toFixed(2)} MB total across ${COUNT} stills`);

// 3:4 face crops in source pixels: [src, left, top, width, height]
const PORTRAIT_CROPS = {
  child: [9, 451, 0, 480, 640],
  elder: [8, 760, 0, 480, 640],
  "snake-king": [5, 0, 20, 513, 684],
  "silver-one": [22, 0, 0, 430, 573],
  "masked-lady": [26, 93, 0, 384, 512],
  creature: [23, 1089, 0, 287, 383],
};
for (const [teller, [src, left, top, width, height]] of Object.entries(PORTRAIT_CROPS)) {
  const info = await sharp(resolve(SRC, `${src}.jpg`))
    .extract({ left, top, width, height })
    .resize(240, 320, { fit: "cover", kernel: "lanczos3" })
    .webp({ quality: 75, effort: 6 })
    .toFile(resolve(PORTRAITS, `${teller}.webp`));
  console.log(`portrait ${teller}  <- s${src}  ${(info.size / 1024).toFixed(0)} KB`);
}
