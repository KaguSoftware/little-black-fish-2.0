import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, SRGBColorSpace } from "three";

/**
 * Canvas helpers for the procedural textures in the kit. Everything is generated
 * ONCE per key and cached for the lifetime of the page (textures are shared by every
 * puppet instance; builders and dispose() must never dispose them).
 */

/** Small, fast, seedable PRNG (mulberry32). Returns a function giving 0..1. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, unknown>();

/** Memoise anything expensive by key. */
export function cached<T>(key: string, make: () => T): T {
  if (cache.has(key)) return cache.get(key) as T;
  const v = make();
  cache.set(key, v);
  return v;
}

export function makeCanvas(w: number, h = w): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return { canvas, ctx };
}

export interface CanvasTexOptions {
  /** Colour data (true) or data such as bump/roughness (false). */
  srgb?: boolean;
  repeat?: readonly [number, number];
  wrap?: boolean;
  anisotropy?: number;
}

export function toTexture(canvas: HTMLCanvasElement, o: CanvasTexOptions = {}): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.colorSpace = o.srgb === false ? NoColorSpace : SRGBColorSpace;
  if (o.wrap !== false) {
    t.wrapS = t.wrapT = RepeatWrapping;
  }
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  t.anisotropy = o.anisotropy ?? 4;
  t.generateMipmaps = true;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.needsUpdate = true;
  return t;
}

/** Tileable value-noise field in 0..1 (size x size), fbm with `octaves`. */
export function noiseField(size: number, seed: number, baseFreq = 4, octaves = 4, persistence = 0.5): Float32Array {
  const rand = rng(seed);
  const out = new Float32Array(size * size);
  let amp = 1;
  let norm = 0;
  let freq = baseFreq;
  for (let o = 0; o < octaves; o++) {
    const g = freq;
    const lattice = new Float32Array(g * g);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rand();
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * g;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      const ya = y0 % g;
      const yb = (y0 + 1) % g;
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * g;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const xa = x0 % g;
        const xb = (x0 + 1) % g;
        const a = lattice[ya * g + xa];
        const b = lattice[ya * g + xb];
        const c = lattice[yb * g + xa];
        const d = lattice[yb * g + xb];
        const v = a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
        out[y * size + x] += v * amp;
      }
    }
    norm += amp;
    amp *= persistence;
    freq *= 2;
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/** Write a 0..1 scalar field into a canvas as greyscale (optionally mapped). */
export function fieldToCanvas(
  field: Float32Array,
  size: number,
  map: (v: number, i: number) => [number, number, number] = (v) => [v * 255, v * 255, v * 255],
): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < field.length; i++) {
    const [r, g, b] = map(field[i], i);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
