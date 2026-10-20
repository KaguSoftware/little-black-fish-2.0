import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from "three";

/**
 * The Silver One's cloak: a crinkled lamé cape that wraps the back and sides (open at the front),
 * falls to the floor and trails behind in a long train. Pure CPU geometry plus an analytic
 * "distance from the body axis" function so the hair can drape on top of it.
 */

export const CLOAK_SPAN = 2.3; // radians either side of straight back
const TOP_Y = 1.47;
const Z_SCALE = 0.86;

/** [y, radius] from the neck down to the hem. */
const PROFILE: [number, number][] = [
  [1.47, 0.085],
  [1.43, 0.14],
  [1.37, 0.26],
  [1.3, 0.31],
  [1.15, 0.335],
  [0.95, 0.345],
  [0.7, 0.4],
  [0.4, 0.47],
  [0.15, 0.55],
  [0.0, 0.62],
];

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function radiusAtV(v: number): number {
  const y = TOP_Y - v * TOP_Y;
  for (let i = 1; i < PROFILE.length; i++) {
    if (y >= PROFILE[i][0]) {
      const t = (y - PROFILE[i - 1][0]) / (PROFILE[i][0] - PROFILE[i - 1][0]);
      return PROFILE[i - 1][1] + (PROFILE[i][1] - PROFILE[i - 1][1]) * t;
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

const trainAt = (v: number) => 1.15 * Math.pow(sstep(0.22, 1, v), 1.5);
const bumpAt = (a: number) => Math.exp(-Math.pow(a / 0.8, 2));

/**
 * Distance from the body axis to the cloak surface at height y, in the direction of hair angle `phi`
 * (0 = +Z front, π = back). Returns 0 where the cloak does not reach (the open front).
 */
export function cloakDistance(y: number, phi: number): number {
  let a = Math.PI - phi;
  a -= Math.PI * 2 * Math.round(a / (Math.PI * 2));
  const w = 1 - sstep(CLOAK_SPAN - 0.25, CLOAK_SPAN + 0.35, Math.abs(a));
  if (w <= 0) return 0;
  const v = Math.min(1, Math.max(0, (TOP_Y - y) / TOP_Y));
  const s = Math.sin(a);
  const c = Math.cos(a);
  const r = radiusAtV(v) * Math.sqrt(s * s + Z_SCALE * Z_SCALE * c * c) + trainAt(v) * bumpAt(a) * Math.max(0, c);
  return r * w;
}

export function buildCloak(quality: "high" | "low"): BufferGeometry {
  const low = quality === "low";
  const nu = low ? 84 : 170;
  const nv = low ? 40 : 84;
  const cols = nu + 1;
  const pos = new Float32Array((nv + 1) * cols * 3);
  const uv = new Float32Array((nv + 1) * cols * 2);
  for (let j = 0; j <= nv; j++) {
    const v = j / nv;
    const y0 = TOP_Y - v * TOP_Y;
    const r0 = radiusAtV(v);
    const train = trainAt(v);
    const amp = 0.012 + 0.058 * Math.pow(v, 1.3);
    for (let i = 0; i <= nu; i++) {
      const u = (i / nu) * 2 - 1;
      const a = u * CLOAK_SPAN;
      // crinkles: long folds that drift with height, plus finer creases
      const f =
        Math.sin(a * 9 + Math.sin(v * 4.1) * 1.3 + 0.6) * 0.55 +
        Math.sin(a * 21 + v * 5.3 + 1.1) * 0.3 +
        Math.sin(a * 47 + v * 11) * 0.15;
      const edge = sstep(0.8, 1, Math.abs(u));
      let rr = r0 * (1 + 0.0) + f * amp * (1 + 0.5 * v);
      rr *= 1 - 0.1 * edge * v;
      const tb = train * bumpAt(a) * (0.85 + 0.15 * Math.sin(a * 13 + v * 6));
      const x = rr * Math.sin(a);
      const z = -(rr * Z_SCALE * Math.cos(a) + tb * Math.max(0.0, Math.cos(a)));
      let y = y0 + Math.sin(a * 17 + v * 14) * 0.006 * v;
      // the hem lies on the floor and the train drags along it
      y = Math.max(y, 0.004 + Math.max(0, f) * 0.02 * v * v);
      const k = j * cols + i;
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z;
      uv[k * 2] = (i / nu) * 2.2;
      uv[k * 2 + 1] = (1 - v) * 2.4;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}
