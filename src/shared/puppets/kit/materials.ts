import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Texture,
  type ColorRepresentation,
} from "three";
import { addPatch } from "./shaderPatch";
import { cached, fieldToCanvas, makeCanvas, noiseField, rng, toTexture } from "./canvas";

/**
 * Material recipes for the six puppets. Every factory returns a FRESH material
 * (so builders can tweak and dispose freely); the canvas textures behind them are
 * generated once and cached, and must never be disposed by builders.
 * The stage is dark and lit by a spotlight + accent rim, so all of these are PBR.
 */

const col = (c: ColorRepresentation) => new Color(c);
const lighten = (c: ColorRepresentation, k: number) => col(c).lerp(new Color(1, 1, 1), k);

// ────────────────────────────────────────────────────────────────────────────
// Velvet
// ────────────────────────────────────────────────────────────────────────────

/** Soft short-pile noise used as a velvet bump. */
export function velvetBump(): Texture {
  return cached("tex:velvetBump", () => {
    const size = 256;
    const f = noiseField(size, 11, 32, 3, 0.6);
    return toTexture(fieldToCanvas(f, size), { srgb: false, repeat: [3, 3] });
  });
}

export interface VelvetOptions {
  color: ColorRepresentation;
  map?: Texture | null;
  /** Sheen tint; defaults to a lifted version of `color`. */
  sheenColor?: ColorRepresentation;
  sheen?: number;
  /** Bump strength for the pile. */
  pile?: number;
  side?: 0 | 1 | 2;
}

/** Black crushed velvet: high roughness, strong grazing-angle sheen. */
export function makeVelvet(o: VelvetOptions): MeshPhysicalMaterial {
  const base = col(o.color);
  const m = new MeshPhysicalMaterial({
    color: base,
    map: o.map ?? null,
    roughness: 0.92,
    metalness: 0,
    sheen: o.sheen ?? 1,
    sheenRoughness: 0.45,
    sheenColor: o.sheenColor ? col(o.sheenColor) : lighten(base, 0.35).multiplyScalar(0.9),
    bumpMap: velvetBump(),
    bumpScale: o.pile ?? 0.4,
  });
  if (o.side !== undefined) m.side = o.side;
  return m;
}

// ────────────────────────────────────────────────────────────────────────────
// Chrome
// ────────────────────────────────────────────────────────────────────────────

export interface ChromeOptions {
  color?: ColorRepresentation;
  roughness?: number;
  envMapIntensity?: number;
}

/** Mirror chrome. Needs scene.environment (see <StageEnvironment/>) or it renders black. */
export function makeChrome(o: ChromeOptions = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: col(o.color ?? "#eef1f6"),
    metalness: 1,
    roughness: o.roughness ?? 0.06,
    envMapIntensity: o.envMapIntensity ?? 1.6,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Knit / fabric
// ────────────────────────────────────────────────────────────────────────────

/** Tileable knit stitch pattern (V columns), luminance = height. */
export function knitPattern(): Texture {
  return cached("tex:knit", () => {
    const { canvas, ctx } = makeCanvas(128);
    ctx.fillStyle = "#555";
    ctx.fillRect(0, 0, 128, 128);
    const cols = 8;
    const rows = 8;
    const cw = 128 / cols;
    const rh = 128 / rows;
    const rand = rng(4);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cw;
        const y = r * rh;
        const tone = 0.82 + rand() * 0.18;
        for (const side of [-1, 1]) {
          const g = ctx.createLinearGradient(x + cw / 2, y, x + cw / 2 + side * cw * 0.5, y + rh);
          g.addColorStop(0, `rgba(${Math.round(255 * tone)},${Math.round(255 * tone)},${Math.round(255 * tone)},1)`);
          g.addColorStop(1, "rgba(60,60,60,1)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(x + cw / 2 + side * cw * 0.22, y + rh * 0.52, cw * 0.2, rh * 0.52, side * 0.42, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return toTexture(canvas, { srgb: false, repeat: [1, 1] });
  });
}

export interface FabricOptions {
  map?: Texture | null;
  color?: ColorRepresentation;
  repeat?: readonly [number, number];
  roughness?: number;
  bump?: Texture | null;
  bumpScale?: number;
  sheen?: number;
  side?: 0 | 1 | 2;
}

/** Matte woven cloth. Clones the map so `repeat` does not leak between users of a cached texture. */
export function makeFabric(o: FabricOptions = {}): MeshPhysicalMaterial {
  let map = o.map ?? null;
  if (map && o.repeat) {
    map = map.clone();
    map.needsUpdate = true;
    map.repeat.set(o.repeat[0], o.repeat[1]);
  }
  const m = new MeshPhysicalMaterial({
    color: col(o.color ?? "#ffffff"),
    map,
    roughness: o.roughness ?? 0.88,
    metalness: 0,
    sheen: o.sheen ?? 0.35,
    sheenRoughness: 0.7,
    sheenColor: new Color(0.5, 0.5, 0.5),
    bumpMap: o.bump ?? null,
    bumpScale: o.bumpScale ?? 0.6,
  });
  if (o.side !== undefined) m.side = o.side;
  return m;
}

/** Chunky knit: fabric with a procedural stitch bump. */
export function makeKnit(o: FabricOptions = {}): MeshPhysicalMaterial {
  const rep = o.repeat ?? [6, 6];
  const bump = knitPattern().clone();
  bump.needsUpdate = true;
  bump.repeat.set(rep[0], rep[1]);
  return makeFabric({ roughness: 0.95, sheen: 0.5, bumpScale: 1.4, ...o, bump, repeat: o.map ? rep : undefined });
}

// ────────────────────────────────────────────────────────────────────────────
// Paper
// ────────────────────────────────────────────────────────────────────────────

export interface PaperOptions {
  size?: number;
  seed?: number;
  paper?: ColorRepresentation;
  ink?: ColorRepresentation;
  /** Marks per 100k px. 0 for a blank sheet. */
  marks?: number;
  /** Accent used for a few painted marks. */
  accent?: ColorRepresentation;
}

function scribble(ctx: CanvasRenderingContext2D, rand: () => number, x: number, y: number, s: number): void {
  const kind = Math.floor(rand() * 7);
  ctx.beginPath();
  switch (kind) {
    case 0: {
      // squiggle
      ctx.moveTo(x, y);
      let px = x;
      let py = y;
      let a = rand() * 6.28;
      for (let i = 0; i < 6; i++) {
        a += (rand() - 0.5) * 2.4;
        const nx = px + Math.cos(a) * s * 0.35;
        const ny = py + Math.sin(a) * s * 0.35;
        ctx.quadraticCurveTo(px + (rand() - 0.5) * s * 0.4, py + (rand() - 0.5) * s * 0.4, nx, ny);
        px = nx;
        py = ny;
      }
      break;
    }
    case 1:
      ctx.arc(x, y, s * (0.15 + rand() * 0.2), 0, 6.28 * (0.7 + rand() * 0.3));
      break;
    case 2: {
      // spiral
      for (let t = 0; t < 14; t += 0.35) {
        const r = t * s * 0.025;
        const px = x + Math.cos(t) * r;
        const py = y + Math.sin(t) * r;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      break;
    }
    case 3:
      // cross / tick marks
      ctx.moveTo(x - s * 0.2, y - s * 0.2);
      ctx.lineTo(x + s * 0.2, y + s * 0.2);
      ctx.moveTo(x + s * 0.2, y - s * 0.2);
      ctx.lineTo(x - s * 0.2, y + s * 0.2);
      break;
    case 4:
      // ladder / tally
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(x + i * s * 0.12, y - s * 0.22);
        ctx.lineTo(x + i * s * 0.12 + (rand() - 0.5) * 3, y + s * 0.22);
      }
      ctx.moveTo(x - s * 0.06, y);
      ctx.lineTo(x + s * 0.42, y + 3);
      break;
    case 5: {
      // letter-like glyph: arcs + stem
      ctx.moveTo(x, y - s * 0.25);
      ctx.lineTo(x + (rand() - 0.5) * 4, y + s * 0.25);
      ctx.moveTo(x, y - s * 0.1);
      ctx.bezierCurveTo(x + s * 0.3, y - s * 0.3, x + s * 0.3, y + s * 0.1, x + s * 0.02, y + s * 0.05);
      break;
    }
    default: {
      // dots row
      for (let i = 0; i < 5; i++) {
        ctx.moveTo(x + i * s * 0.1 + 2, y);
        ctx.arc(x + i * s * 0.1, y + (rand() - 0.5) * 4, 1.4, 0, 6.28);
      }
    }
  }
  ctx.stroke();
}

/** Paper with fibres, stains and scribbled glyph marks. Cached by option set. */
export function paperTexture(o: PaperOptions = {}): Texture {
  const size = o.size ?? 512;
  const seed = o.seed ?? 3;
  const paper = col(o.paper ?? "#e9e0cb");
  const ink = col(o.ink ?? "#2b2319");
  const marks = o.marks ?? 36;
  const accent = o.accent ? col(o.accent) : null;
  const key = `tex:paper:${size}:${seed}:${paper.getHexString()}:${ink.getHexString()}:${marks}:${accent?.getHexString() ?? "-"}`;
  return cached(key, () => {
    const { canvas, ctx } = makeCanvas(size);
    const rand = rng(seed);
    ctx.fillStyle = `#${paper.getHexString()}`;
    ctx.fillRect(0, 0, size, size);
    // stains: big soft blotches
    for (let i = 0; i < 14; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = size * (0.08 + rand() * 0.22);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = rand() < 0.7;
      g.addColorStop(0, dark ? "rgba(90,70,40,0.07)" : "rgba(255,250,235,0.1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // fibres
    for (let i = 0; i < size * 6; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const a = rand() * 6.28;
      const l = 2 + rand() * 9;
      ctx.strokeStyle = rand() < 0.5 ? "rgba(70,55,35,0.09)" : "rgba(255,255,248,0.13)";
      ctx.lineWidth = 0.6 + rand() * 0.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    // creases
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = "rgba(60,45,25,0.1)";
      ctx.beginPath();
      const y = rand() * size;
      ctx.moveTo(0, y);
      ctx.lineTo(size, y + (rand() - 0.5) * size * 0.3);
      ctx.stroke();
    }
    // glyph scribbles
    const n = Math.round((marks * size * size) / 100000 * 10);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let i = 0; i < n; i++) {
      const useAccent = accent && rand() < 0.12;
      const c = useAccent ? accent! : ink;
      ctx.strokeStyle = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${0.45 + rand() * 0.4})`;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 0.9 + rand() * 1.6;
      scribble(ctx, rand, rand() * size, rand() * size, 26 + rand() * 38);
    }
    return toTexture(canvas, { srgb: true });
  });
}

/** Paper bump from fibre noise. */
function paperBump(): Texture {
  return cached("tex:paperBump", () => {
    const size = 256;
    const f = noiseField(size, 21, 48, 3, 0.55);
    return toTexture(fieldToCanvas(f, size), { srgb: false });
  });
}

/** Paper with scribbled marks (the Child's mask). */
export function makePaper(o: PaperOptions & { color?: ColorRepresentation; side?: 0 | 1 | 2 } = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: col(o.color ?? "#ffffff"),
    map: paperTexture(o),
    bumpMap: paperBump(),
    bumpScale: 0.35,
    roughness: 0.92,
    metalness: 0,
    side: o.side ?? 0,
  });
}

export interface PaintedBodyOptions {
  seed?: number;
  base?: ColorRepresentation;
  ink?: ColorRepresentation;
  colors?: ColorRepresentation[];
  width?: number;
  height?: number;
}

/**
 * Skin covered in painted marks and a few stickers: stripes, ladders, spirals,
 * handwriting. 1:2 aspect, wraps around a limb or torso (u around, v up).
 */
export function paintedBodyTexture(o: PaintedBodyOptions = {}): Texture {
  const w = o.width ?? 512;
  const h = o.height ?? 1024;
  const seed = o.seed ?? 8;
  const base = col(o.base ?? "#cdb393");
  const ink = col(o.ink ?? "#2c241c");
  const palette = (o.colors ?? ["#2fb3a8", "#e8e2d2", "#b8452f", "#d6a43a"]).map(col);
  const key = `tex:painted:${w}x${h}:${seed}:${base.getHexString()}:${ink.getHexString()}:${palette.map((c) => c.getHexString()).join("")}`;
  return cached(key, () => {
    const { canvas, ctx } = makeCanvas(w, h);
    const rand = rng(seed);
    ctx.fillStyle = `#${base.getHexString()}`;
    ctx.fillRect(0, 0, w, h);
    // skin mottling
    for (let i = 0; i < 60; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const r = 30 + rand() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rand() < 0.5 ? "rgba(120,80,50,0.07)" : "rgba(255,240,220,0.08)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // painted bands
    for (let i = 0; i < 9; i++) {
      const y = rand() * h;
      const c = palette[Math.floor(rand() * palette.length)];
      ctx.strokeStyle = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},0.7)`;
      ctx.lineWidth = 5 + rand() * 10;
      ctx.beginPath();
      ctx.moveTo(-10, y);
      for (let x = 0; x <= w + 20; x += 40) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * (4 + rand() * 6));
      ctx.stroke();
    }
    // scribbled marks, ink and colour
    const n = 260;
    for (let i = 0; i < n; i++) {
      const useCol = rand() < 0.35;
      const c = useCol ? palette[Math.floor(rand() * palette.length)] : ink;
      ctx.strokeStyle = `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${0.55 + rand() * 0.35})`;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 1.4 + rand() * 2.6;
      scribble(ctx, rand, rand() * w, rand() * h, 34 + rand() * 46);
    }
    // stickers: rounded paper rectangles with a glyph
    for (let i = 0; i < 7; i++) {
      const sw = 40 + rand() * 40;
      const sh = 34 + rand() * 34;
      const x = rand() * (w - sw);
      const y = rand() * (h - sh);
      ctx.save();
      ctx.translate(x + sw / 2, y + sh / 2);
      ctx.rotate((rand() - 0.5) * 0.4);
      const c = palette[Math.floor(rand() * palette.length)];
      ctx.fillStyle = `rgb(${Math.round(c.r * 230 + 25)},${Math.round(c.g * 230 + 25)},${Math.round(c.b * 230 + 25)})`;
      ctx.strokeStyle = "rgba(40,30,20,0.6)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 6);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(30,22,15,0.8)";
      ctx.lineWidth = 2;
      scribble(ctx, rand, 0, 0, Math.min(sw, sh) * 1.4);
      ctx.restore();
    }
    return toTexture(canvas, { srgb: true });
  });
}

export function makePaintedBody(o: PaintedBodyOptions & { roughness?: number } = {}): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    map: paintedBodyTexture(o),
    roughness: o.roughness ?? 0.7,
    metalness: 0,
    sheen: 0.25,
    sheenColor: new Color(0.9, 0.7, 0.6),
    sheenRoughness: 0.6,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Stone
// ────────────────────────────────────────────────────────────────────────────

export interface StoneOptions {
  color?: ColorRepresentation;
  /** Number of block rows/cols for mortar seams (0 = solid slab). */
  blocks?: number;
  seed?: number;
  repeat?: readonly [number, number];
  roughness?: number;
  bumpScale?: number;
}

function stoneTextures(seed: number, blocks: number): { map: Texture; bump: Texture } {
  return cached(`tex:stone:${seed}:${blocks}`, () => {
    const size = 512;
    const big = noiseField(size, seed, 4, 4, 0.55);
    const fine = noiseField(size, seed + 7, 64, 3, 0.5);
    const rand = rng(seed + 3);
    const mapCanvas = fieldToCanvas(big, size, (v, i) => {
      const f = fine[i];
      const t = 0.5 + (v - 0.5) * 0.9 + (f - 0.5) * 0.35;
      return [t * 215, t * 205, t * 190];
    });
    const bumpCanvas = fieldToCanvas(big, size, (v, i) => {
      const t = 0.55 * v + 0.45 * fine[i];
      return [t * 255, t * 255, t * 255];
    });
    for (const cv of [mapCanvas, bumpCanvas]) {
      const ctx = cv.getContext("2d")!;
      // cracks
      ctx.lineCap = "round";
      for (let i = 0; i < 7; i++) {
        let x = rand() * size;
        let y = rand() * size;
        let a = rand() * 6.28;
        ctx.strokeStyle = cv === mapCanvas ? "rgba(20,16,12,0.5)" : "rgba(0,0,0,0.9)";
        ctx.lineWidth = 1 + rand() * 1.2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 22; s++) {
          a += (rand() - 0.5) * 0.9;
          x += Math.cos(a) * 12;
          y += Math.sin(a) * 12;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (blocks > 0) {
        ctx.strokeStyle = cv === mapCanvas ? "rgba(15,12,10,0.65)" : "rgba(0,0,0,1)";
        ctx.lineWidth = 3.5;
        const step = size / blocks;
        for (let r = 0; r <= blocks; r++) {
          ctx.beginPath();
          ctx.moveTo(0, r * step);
          ctx.lineTo(size, r * step);
          ctx.stroke();
          const off = r % 2 ? step * 0.5 : 0;
          for (let c = 0; c <= blocks; c++) {
            ctx.beginPath();
            ctx.moveTo(c * step + off, r * step);
            ctx.lineTo(c * step + off, (r + 1) * step);
            ctx.stroke();
          }
        }
      }
    }
    return {
      map: toTexture(mapCanvas, { srgb: true }),
      bump: toTexture(bumpCanvas, { srgb: false }),
    };
  });
}

/** Rough stone with mottling, cracks and optional block seams. */
export function makeStone(o: StoneOptions = {}): MeshStandardMaterial {
  const { map, bump } = stoneTextures(o.seed ?? 5, o.blocks ?? 0);
  const rep = o.repeat ?? [1, 1];
  const m = map.clone();
  const b = bump.clone();
  m.needsUpdate = b.needsUpdate = true;
  m.repeat.set(rep[0], rep[1]);
  b.repeat.set(rep[0], rep[1]);
  return new MeshStandardMaterial({
    color: col(o.color ?? "#b9b2a4"),
    map: m,
    bumpMap: b,
    bumpScale: o.bumpScale ?? 2.2,
    roughness: o.roughness ?? 0.93,
    metalness: 0,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Bronze (cracked) / Lamé
// ────────────────────────────────────────────────────────────────────────────

export interface BronzeOptions {
  color?: ColorRepresentation;
  seed?: number;
  roughness?: number;
  cracks?: boolean;
}

/** Aged bronze with patina mottling and optional cracks (Snake King mask). */
export function makeBronze(o: BronzeOptions = {}): MeshStandardMaterial {
  const seed = o.seed ?? 9;
  const cracks = o.cracks ?? true;
  const tex = cached(`tex:bronze:${seed}:${cracks}`, () => {
    const size = 512;
    const a = noiseField(size, seed, 6, 4, 0.55);
    const b = noiseField(size, seed + 4, 40, 3, 0.5);
    const mapC = fieldToCanvas(a, size, (v, i) => {
      const t = 0.7 + (v - 0.5) * 0.7 + (b[i] - 0.5) * 0.25;
      return [t * 200, t * 150, t * 95];
    });
    const rough = fieldToCanvas(a, size, (v, i) => {
      const t = 0.38 + v * 0.35 + b[i] * 0.2;
      return [t * 255, t * 255, t * 255];
    });
    if (cracks) {
      const rand = rng(seed + 1);
      for (const [cv, c, w] of [
        [mapC, "rgba(18,10,6,0.9)", 1.6],
        [rough, "rgba(255,255,255,1)", 1.6],
      ] as const) {
        const ctx = cv.getContext("2d")!;
        ctx.lineCap = "round";
        for (let k = 0; k < 6; k++) {
          let x = rand() * size;
          let y = rand() * size * 0.5;
          let ang = Math.PI / 2 + (rand() - 0.5) * 1.2;
          ctx.strokeStyle = c;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(x, y);
          for (let s = 0; s < 26; s++) {
            ang += (rand() - 0.5) * 0.8;
            x += Math.cos(ang) * 10;
            y += Math.sin(ang) * 10;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
    }
    return { map: toTexture(mapC, { srgb: true }), rough: toTexture(rough, { srgb: false }) };
  });
  return new MeshStandardMaterial({
    color: col(o.color ?? "#c9a066"),
    map: tex.map,
    roughnessMap: tex.rough,
    roughness: o.roughness ?? 0.8,
    metalness: 0.85,
    envMapIntensity: 1.3,
  });
}

function lameWeave(): Texture {
  return cached("tex:lameWeave", () => {
    const size = 128;
    const f = noiseField(size, 31, 64, 2, 0.5);
    const c = fieldToCanvas(f, size, (v, i) => {
      const x = i % size;
      const y = Math.floor(i / size);
      const w = 0.5 + 0.28 * Math.sin(x * 1.57) * Math.sin(y * 1.57) + (v - 0.5) * 0.4;
      return [w * 255, w * 255, w * 255];
    });
    return toTexture(c, { srgb: false, repeat: [10, 10] });
  });
}

export interface LameOptions {
  color?: ColorRepresentation;
  map?: Texture | null;
  roughness?: number;
  side?: 0 | 1 | 2;
  /** Low quality: skip the thin-film iridescence and anisotropic highlight (two extra lobes per pixel). */
  lite?: boolean;
}

/** Silver lamé: metallic sheen fabric with fine weave sparkle. */
export function makeLame(o: LameOptions = {}): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: col(o.color ?? "#cfd3dc"),
    map: o.map ?? null,
    metalness: 0.88,
    roughness: o.roughness ?? 0.3,
    sheen: 0.6,
    sheenRoughness: 0.35,
    sheenColor: new Color(0.7, 0.75, 0.95),
    iridescence: o.lite ? 0 : 0.22,
    iridescenceIOR: 1.6,
    anisotropy: o.lite ? 0 : 0.55,
    anisotropyRotation: 1.1,
    bumpMap: lameWeave(),
    bumpScale: 0.5,
    envMapIntensity: 1.25,
  });
  if (o.side !== undefined) m.side = o.side;
  return m;
}

// ────────────────────────────────────────────────────────────────────────────
// Skin and eyes
// ────────────────────────────────────────────────────────────────────────────

export function makeSkin(color: ColorRepresentation = "#9a7762"): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: col(color),
    roughness: 0.58,
    metalness: 0,
    sheen: 0.3,
    sheenRoughness: 0.5,
    sheenColor: new Color(1, 0.7, 0.6),
  });
}

export interface EyeOptions {
  /** Eyeball radius in metres. */
  radius?: number;
  sclera?: ColorRepresentation;
  iris?: ColorRepresentation;
  /** Emissive glow (e.g. Snake King's eyes behind the mask). 0 = none. */
  glow?: number;
  /** Lid skin; omit for the default, or null for an eye with no lid. */
  lidMaterial?: MeshStandardMaterial | MeshPhysicalMaterial | null;
  /** Pupil (black core) size relative to the iris. */
  pupilSize?: number;
}

/** Lid angles the controller expects when you use `createEye` (all offsets from the lid's rest). */
export const EYE_LIMITS = {
  lidNeutral: 0,
  lidOpen: -0.55,
  lidClosed: 1.9,
} as const;

export interface EyeRig {
  group: Group;
  /**
   * Rig handle (an empty group): the controller translates it within `pupilRange`.
   * Call `sync()` every frame (from the puppet's `update`) so the iris slides over the eyeball to match.
   */
  pupil: Group;
  /** Rig handle: rotate about x (offsets from rest, see EYE_LIMITS). */
  lid: Mesh | null;
  /** Dive target at the cornea. */
  anchor: Group;
  /** Pass to RigLimits.pupil. */
  pupilRange: { x: number; y: number };
  /** Turn the iris to follow `pupil`'s offset (a cheap rotation; allocation-free). */
  sync(): void;
  dispose(): void;
}

/**
 * A complete little eye: pearly sclera, an iris cap + pupil + glint that rotate over it, and a
 * dome lid that rotates about x. Place `group` where the eye sits, facing +Z.
 */
export function createEye(o: EyeOptions = {}): EyeRig {
  const r = o.radius ?? 0.02;
  const group = new Group();
  const scleraMat = new MeshPhysicalMaterial({
    color: col(o.sclera ?? "#e9e4d8"),
    roughness: 0.22,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
  });
  const irisMat = new MeshStandardMaterial({
    color: col(o.iris ?? "#6a4a2a"),
    roughness: 0.25,
    emissive: col(o.iris ?? "#6a4a2a"),
    emissiveIntensity: o.glow ?? 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pupilMat = new MeshStandardMaterial({
    color: "#050505",
    roughness: 0.15,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const glintMat = new MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 1.5, roughness: 0.2 });
  const geos: SphereGeometry[] = [];
  const geo = (...args: ConstructorParameters<typeof SphereGeometry>) => {
    const g = new SphereGeometry(...args);
    geos.push(g);
    return g;
  };

  const ball = new Mesh(geo(r, 24, 16), scleraMat);
  group.add(ball);

  const pupil = new Group();
  group.add(pupil);

  // Iris, pupil and glint are caps on the eyeball surface, aimed by rotating `aim` about the eye centre.
  const aim = new Group();
  group.add(aim);
  const irisGeo = geo(r * 1.004, 28, 4, 0, Math.PI * 2, 0, 0.62);
  irisGeo.rotateX(Math.PI / 2);
  aim.add(new Mesh(irisGeo, irisMat));
  const coreGeo = geo(r * 1.007, 20, 3, 0, Math.PI * 2, 0, 0.62 * (o.pupilSize ?? 0.5));
  coreGeo.rotateX(Math.PI / 2);
  aim.add(new Mesh(coreGeo, pupilMat));
  const glint = new Mesh(geo(r * 0.085, 8, 6), glintMat);
  glint.position.set(r * 0.16, r * 0.17, r * 0.98);
  aim.add(glint);

  const anchor = new Group();
  anchor.position.z = r * 1.0;
  group.add(anchor);

  let lid: Mesh | null = null;
  let lidMat: MeshStandardMaterial | MeshPhysicalMaterial | null = null;
  if (o.lidMaterial !== null) {
    lidMat = (o.lidMaterial ?? makeSkin()).clone();
    lidMat.side = DoubleSide;
    lid = new Mesh(geo(r * 1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lidMat);
    lid.rotation.x = -0.5; // rest: raised, eye open
    group.add(lid);
  }

  const range = { x: r * 0.22, y: r * 0.16 };
  return {
    group,
    pupil,
    lid,
    anchor,
    pupilRange: range,
    sync() {
      aim.rotation.y = (pupil.position.x / range.x) * 0.42;
      aim.rotation.x = -(pupil.position.y / range.y) * 0.3;
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      [scleraMat, irisMat, pupilMat, glintMat].forEach((m) => m.dispose());
      lidMat?.dispose();
    },
  };
}

/** Patch a material so its colour can be dimmed at runtime through `uDim.value` (0..1). */
export function makeDimmable(mat: MeshStandardMaterial | MeshPhysicalMaterial): { value: number } {
  const uDim = { value: 1 };
  addPatch(mat, {
    key: "dim",
    uniforms: { uDim },
    fragmentHead: "uniform float uDim;",
    fragmentColor: "diffuseColor.rgb *= uDim;",
  });
  return uDim;
}
