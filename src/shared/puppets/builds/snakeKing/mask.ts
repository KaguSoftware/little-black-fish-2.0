import { BufferGeometry, ConeGeometry, Float32BufferAttribute, Matrix4, SphereGeometry, Uint32BufferAttribute } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The Snake King's mask: a tall boxy bronze plate wrapped around the head, with a nose, brow,
 * cheekbones, real eye-slit openings and a separate lower plate (the jaw). Face-local space:
 * origin at the centre of the mask, +Z forward, +Y up. The frontal UVs are a planar projection
 * of the cropped `mask-face` texture so the painted cracks and slits line up with the geometry.
 */

export const MASK = {
  /** Half width, half depth, height. */
  a: 0.105,
  b: 0.098,
  h: 0.27,
  /** Fraction from the top where the lower plate starts. */
  split: 0.8,
  /** Eye slit centre: x offset and fraction from the top. */
  eyeX: 0.053,
  eyeF: 0.46,
  /** Reach of the side wrap, radians either side of straight ahead. */
  wrap: 1.75,
};

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x: number, s: number) => Math.exp(-(x * x) / (s * s));
const spow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

/** Surface z of the front of the mask at (x, fraction-from-top). */
export function maskFrontZ(x: number, f: number): number {
  let lo = 0;
  let hi = Math.PI / 2;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (maskPoint(Math.sign(x) * mid, f)[0] * Math.sign(x) < Math.abs(x)) lo = mid;
    else hi = mid;
  }
  return maskPoint(Math.sign(x || 1) * lo, f)[2];
}

const N_EXP = 3.2;

function maskPoint(th: number, f: number): [number, number, number] {
  const { a, b, h } = MASK;
  const ex = spow(Math.sin(th), 2 / N_EXP);
  const ez = spow(Math.cos(th), 2 / N_EXP);
  const wk = 1 - 0.15 * sstep(0.55, 1, f) + 0.03 * sstep(0, 0.25, f) * (1 - sstep(0.25, 0.5, f));
  const dk = 1 - 0.12 * sstep(0.72, 1, f);
  const x = a * wk * ex;
  let z = b * dk * ez;
  const y = h / 2 - f * h;
  const front = sstep(0.0, 0.55, ez);
  const ax = Math.abs(x);
  // nose ridge and bulb
  const ridge = gauss(x, 0.011) * sstep(0.34, 0.52, f) * (1 - sstep(0.7, 0.78, f)) * 0.021;
  const bulb = gauss(x, 0.017) * gauss(f - 0.73, 0.05) * 0.012;
  const alae = gauss(ax - 0.02, 0.009) * gauss(f - 0.74, 0.035) * 0.008;
  // brow, eye sockets, cheekbones, mouth groove, chin
  const brow = gauss(f - 0.355, 0.035) * 0.008 * (1 - sstep(0.07, 0.1, ax));
  const sockets = -0.007 * gauss(ax - MASK.eyeX, 0.026) * gauss(f - MASK.eyeF, 0.05);
  const cheeks = 0.006 * gauss(ax - 0.066, 0.02) * gauss(f - 0.58, 0.07);
  const mouth = -0.005 * gauss(f - 0.885, 0.012) * gauss(x, 0.04);
  const chin = 0.007 * gauss(f - 0.96, 0.035) * gauss(x, 0.035);
  z += (ridge + bulb + alae + brow + sockets + cheeks + mouth + chin) * front;
  return [x, y, z];
}

function slit(x: number, y: number): boolean {
  const ey = MASK.h / 2 - MASK.eyeF * MASK.h;
  return Math.abs(Math.abs(x) - MASK.eyeX) < 0.021 && Math.abs(y - ey) < 0.0058;
}

function buildPlate(f0: number, f1: number, nu: number, nv: number, withSlits: boolean): BufferGeometry {
  const cols = nu + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  for (let j = 0; j <= nv; j++) {
    const f = f0 + (j / nv) * (f1 - f0);
    for (let i = 0; i <= nu; i++) {
      const th = -MASK.wrap + (i / nu) * MASK.wrap * 2;
      const [x, y, z] = maskPoint(th, f);
      pos.push(x, y, z);
      // planar projection into the cropped mask area of mask-face.webp
      const u = 0.5 + (Math.max(-MASK.a, Math.min(MASK.a, x)) / (MASK.a * 2)) * 0.6;
      const v = 1 - (0.12 + f * 0.85);
      uv.push(u, v);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      if (withSlits) {
        const cx = (pos[a * 3] + pos[d * 3]) / 2;
        const cy = (pos[a * 3 + 1] + pos[d * 3 + 1]) / 2;
        const cz = (pos[a * 3 + 2] + pos[d * 3 + 2]) / 2;
        if (cz > 0 && slit(cx, cy)) continue;
      }
      // front faces point +Z (counter-clockwise seen from the front)
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

export interface MaskGeometry {
  upper: BufferGeometry;
  /** In jaw-local space (origin at the hinge, which sits at y = hingeY in face space). */
  jaw: BufferGeometry;
  hingeY: number;
  eyeY: number;
}

export function buildMask(quality: "high" | "low"): MaskGeometry {
  const low = quality === "low";
  const nu = low ? 48 : 88;
  const nvUp = low ? 34 : 60;
  const nvLow = low ? 8 : 14;
  const upper = buildPlate(0, MASK.split, nu, nvUp, true);
  const jaw = buildPlate(MASK.split, 1, nu, nvLow, false);
  const hingeY = MASK.h / 2 - MASK.split * MASK.h;
  jaw.translate(0, -hingeY, 0);
  return { upper, jaw, hingeY, eyeY: MASK.h / 2 - MASK.eyeF * MASK.h };
}

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Bead band (two rows of round beads). One merged geometry, face space. */
export function buildBeads(quality: "high" | "low"): BufferGeometry {
  const low = quality === "low";
  const per = low ? 18 : 30;
  const geos: BufferGeometry[] = [];
  const m = new Matrix4();
  const topY = MASK.h / 2;
  const sph = new SphereGeometry(1, low ? 6 : 10, low ? 5 : 8);
  for (let row = 0; row < 2; row++) {
    const n = row === 0 ? per : per - 2;
    for (let i = 0; i < n; i++) {
      const th = ((i + (row ? 0.5 : 0)) / n) * Math.PI * 2;
      const r = 0.0125 + hash(i * 3.1 + row * 17) * 0.0035;
      const k = row === 0 ? 1.0 : 0.96;
      const g = sph.clone();
      m.makeScale(r, r * 0.92, r);
      m.setPosition(Math.sin(th) * (MASK.a * 1.04 + 0.006) * k, topY + 0.008 + row * 0.024, Math.cos(th) * (MASK.b * 1.06 + 0.006) * k);
      g.applyMatrix4(m);
      geos.push(g);
    }
  }
  // a plain band under the beads so the join to the plate reads as one piece
  const band = new SphereGeometry(1, 28, 3, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.16);
  band.scale(MASK.a * 1.03, 0.03, MASK.b * 1.05);
  band.translate(0, topY, 0);
  geos.push(band);
  sph.dispose();
  const merged = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  return merged;
}

/** Tall gold spikes standing on the bead band. */
export function buildSpikes(quality: "high" | "low"): BufferGeometry {
  const low = quality === "low";
  const n = low ? 13 : 19;
  const geos: BufferGeometry[] = [];
  const m = new Matrix4();
  const rot = new Matrix4();
  const tmp = new Matrix4();
  const baseY = MASK.h / 2 + 0.04;
  for (let i = 0; i < n; i++) {
    // denser and taller across the front, shorter at the back
    const u = (i + 0.5) / n;
    const th = u * Math.PI * 2;
    const front = 0.5 + 0.5 * Math.cos(th);
    const hgt = (0.085 + front * 0.075) * (0.86 + hash(i * 5.3) * 0.28);
    const rad = 0.0078 - front * 0.0006;
    const g = new ConeGeometry(rad, 1, low ? 5 : 7, 1);
    g.translate(0, 0.5, 0);
    g.scale(1, hgt, 1);
    const tilt = 0.1 + hash(i * 1.7) * 0.07;
    // lean outward from the ring centre
    rot.makeRotationX(Math.cos(th) * tilt).multiply(tmp.makeRotationZ(-Math.sin(th) * tilt));
    g.applyMatrix4(rot);
    m.makeTranslation(Math.sin(th) * (MASK.a * 1.02), baseY, Math.cos(th) * (MASK.b * 1.04));
    g.applyMatrix4(m);
    geos.push(g);
  }
  const merged = mergeGeometries(geos, false)!;
  geos.forEach((g) => g.dispose());
  return merged;
}
