import {
  BufferGeometry,
  CapsuleGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  SphereGeometry,
  Uint32BufferAttribute,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Small geometry helpers shared by the Child and the Elder builds. */

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

/** Place a geometry: scale, then Euler rotation, then translate. Returns the same geometry. */
export function place<T extends BufferGeometry>(
  g: T,
  pos: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
  rot: readonly [number, number, number] = [0, 0, 0],
): T {
  _p.set(pos[0], pos[1], pos[2]);
  _s.set(scale[0], scale[1], scale[2]);
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  _m.compose(_p, _q, _s);
  g.applyMatrix4(_m);
  return g;
}

/** Remap a geometry's UVs into a window of the texture (so tiny parts show readable marks). */
export function uvWindow<T extends BufferGeometry>(g: T, u0: number, v0: number, su: number, sv: number): T {
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * su, v0 + uv.getY(i) * sv);
  uv.needsUpdate = true;
  return g;
}

export function merge(parts: BufferGeometry[]): BufferGeometry {
  const out = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return out;
}

export function ellipsoid(
  pos: readonly [number, number, number],
  r: readonly [number, number, number],
  detail = 12,
  rot?: readonly [number, number, number],
): BufferGeometry {
  return place(new SphereGeometry(1, detail, Math.max(6, Math.round(detail * 0.7))), pos, r, rot);
}

export function capsule(
  pos: readonly [number, number, number],
  radius: number,
  length: number,
  rot: readonly [number, number, number] = [0, 0, 0],
  scale: readonly [number, number, number] = [1, 1, 1],
): BufferGeometry {
  return place(new CapsuleGeometry(radius, length, 3, 8), pos, scale, rot);
}

// ────────────────────────────────────────────────────────────────────────────
// Smooth section interpolation
// ────────────────────────────────────────────────────────────────────────────

export interface Section {
  y: number;
  rx: number;
  rz: number;
}

/** Smoothly interpolate a list of sections (sorted by y) at height y. */
export function sectionAt(secs: readonly Section[], y: number): { rx: number; rz: number; drx: number; drz: number } {
  const f = (yy: number) => {
    let k = 0;
    while (k < secs.length - 2 && yy > secs[k + 1].y) k++;
    const a = secs[k];
    const b = secs[k + 1];
    const t = Math.min(1, Math.max(0, (yy - a.y) / (b.y - a.y)));
    const s = t * t * (3 - 2 * t);
    return [a.rx + (b.rx - a.rx) * s, a.rz + (b.rz - a.rz) * s] as const;
  };
  const [rx, rz] = f(y);
  const [rx2, rz2] = f(y + 0.004);
  return { rx, rz, drx: (rx2 - rx) / 0.004, drz: (rz2 - rz) / 0.004 };
}

export interface TorsoOptions {
  sections: readonly Section[];
  rings: number;
  /** Angular range kept, centred on +Z (θ = 0): [-half, +half]; for the back use `back: true`. */
  half: number;
  back?: boolean;
  sides: number;
  uv: (x: number, y: number, theta: number) => readonly [number, number];
}

/** Elliptical lathe covering a slice of angle, with analytic normals. */
export function torsoSlice(o: TorsoOptions): BufferGeometry {
  const { sections: secs, rings, sides } = o;
  const y0 = secs[0].y;
  const y1 = secs[secs.length - 1].y;
  const span = o.back ? Math.PI * 2 - o.half * 2 : o.half * 2;
  const th0 = o.back ? o.half : -o.half; // slice starts here (θ measured from +Z toward +X)
  const cols = sides + 1;
  const pos = new Float32Array(rings * cols * 3);
  const nor = new Float32Array(rings * cols * 3);
  const uv = new Float32Array(rings * cols * 2);
  for (let r = 0; r < rings; r++) {
    const y = y0 + (r / (rings - 1)) * (y1 - y0);
    const s = sectionAt(secs, Math.min(y, y1 - 0.0045));
    for (let c = 0; c < cols; c++) {
      const th = th0 + (c / sides) * span;
      const x = Math.sin(th) * s.rx;
      const z = Math.cos(th) * s.rz;
      const i = r * cols + c;
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      let nx = x / (s.rx * s.rx);
      let nz = z / (s.rz * s.rz);
      let ny = -(x * x * s.drx) / (s.rx * s.rx * s.rx) - (z * z * s.drz) / (s.rz * s.rz * s.rz);
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l;
      ny /= l;
      nz /= l;
      nor[i * 3] = nx;
      nor[i * 3 + 1] = ny;
      nor[i * 3 + 2] = nz;
      const [u, v] = o.uv(x, y, th);
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let c = 0; c < sides; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      // winding: outward normal (rings go up, columns go from +Z toward +X)
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  return g;
}
