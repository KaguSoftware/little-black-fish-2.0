import { BufferGeometry, Float32BufferAttribute, Matrix4, SphereGeometry, CapsuleGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Small geometry helpers shared by the Masked Lady parts. */

export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Add (or overwrite) a constant per-vertex colour attribute. */
export function tint(g: BufferGeometry, r: number, gr: number, b: number): BufferGeometry {
  const n = g.getAttribute("position").count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    c[i * 3] = r;
    c[i * 3 + 1] = gr;
    c[i * 3 + 2] = b;
  }
  g.setAttribute("color", new Float32BufferAttribute(c, 3));
  return g;
}

/** Overwrite every UV with one constant point (samples a flat patch of a texture). */
export function flatUV(g: BufferGeometry, u: number, v: number): BufferGeometry {
  const n = g.getAttribute("position").count;
  const a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    a[i * 2] = u;
    a[i * 2 + 1] = v;
  }
  g.setAttribute("uv", new Float32BufferAttribute(a, 2));
  return g;
}

export function ellipsoid(
  rx: number,
  ry: number,
  rz: number,
  at: readonly [number, number, number] = [0, 0, 0],
  seg: readonly [number, number] = [20, 14],
): BufferGeometry {
  const g = new SphereGeometry(1, seg[0], seg[1]);
  g.applyMatrix4(new Matrix4().makeScale(rx, ry, rz));
  g.translate(at[0], at[1], at[2]);
  return g;
}

/** Capsule from y0 (bottom) to y1 (top) of radius r, optionally squashed in x/z, tilted about x/z. */
export function limb(
  r: number,
  y0: number,
  y1: number,
  o: { x?: number; z?: number; sx?: number; sz?: number; rotX?: number; rotZ?: number; seg?: number } = {},
): BufferGeometry {
  const len = Math.max(0.001, y1 - y0 - 2 * r);
  const g = new CapsuleGeometry(r, len, 3, o.seg ?? 8);
  g.applyMatrix4(new Matrix4().makeScale(o.sx ?? 1, 1, o.sz ?? 1));
  if (o.rotX) g.rotateX(o.rotX);
  if (o.rotZ) g.rotateZ(o.rotZ);
  g.translate(o.x ?? 0, (y0 + y1) / 2, o.z ?? 0);
  return g;
}

/** Merge geometries that share the same attribute set (position, normal, uv[, color]). */
export function merge(list: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(list, false);
  if (!out) throw new Error("maskedLady: geometry merge failed (attribute mismatch)");
  list.forEach((g) => g.dispose());
  return out;
}
