import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Matrix4,
  Uint32BufferAttribute,
  Vector3,
} from "three";
import { buildTubeGeometry } from "../../kit";
import { ellipsoid, merge, smooth, tint } from "../maskedLady/geo";

/**
 * Geometry for the Creature (metres, facing +Z, feet on y = 0). Every part is a tube or blob so the
 * fur shells can wrap it; legs hang along -Y from their hip so they can be aimed at the paw each frame.
 */

export const BODY = { y: 0.98, rump: -0.82, chest: 0.54, rx: 0.34, ry: 0.37 };
export const LEG_HIP_Y = 0.86;
export const HIP = {
  front: { x: 0.185, z: 0.3 },
  hind: { x: 0.2, z: -0.5 },
};
export const PAW = {
  front: { x: 0.2, z: 0.33 },
  hind: { x: 0.215, z: -0.5 },
};
export const HEAD_AT = { y: 1.78, z: 0.56 };
export const LEG_L = LEG_HIP_Y;

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

function tube(pts: Vector3[], radius: (s: number) => number, tubular: number, radial: number): BufferGeometry {
  return buildTubeGeometry(new CatmullRomCurve3(pts, false, "catmullrom", 0.5), { radius, tubular, radial, uvRepeat: 1 });
}

/** Colour the rings of a tube along its length: f(s) -> rgb. */
function paintRings(g: BufferGeometry, radial: number, f: (s: number) => readonly [number, number, number]): BufferGeometry {
  const n = g.getAttribute("position").count;
  const cols = radial + 1;
  const rings = n / cols;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = Math.floor(i / cols) / (rings - 1);
    const col = f(s);
    c[i * 3] = col[0];
    c[i * 3 + 1] = col[1];
    c[i * 3 + 2] = col[2];
  }
  g.setAttribute("color", new Float32BufferAttribute(c, 3));
  return g;
}

/** Rescale a geometry's UVs into a sub-rectangle of the texture. */
export function remapUV(g: BufferGeometry, u0: number, u1: number, v0: number, v1: number): BufferGeometry {
  const uv = g.getAttribute("uv");
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  uv.needsUpdate = true;
  return g;
}

// ── fur bodies (geometry fed to createFurShells) ────────────────────────────────────────────────

export function bodyGeometry(low: boolean): BufferGeometry {
  const pts = [V(0, BODY.y, BODY.rump), V(0, BODY.y + 0.01, -0.2), V(0, BODY.y + 0.03, 0.2), V(0, BODY.y + 0.02, BODY.chest)];
  const R = (s: number) => {
    const w = Math.pow(Math.sin(Math.PI * s), 0.42);
    // heavier chest and withers, tapered rump
    return BODY.ry * w * (0.94 + 0.16 * smooth(0.2, 0.85, s));
  };
  const g = tube(pts, R, low ? 22 : 36, low ? 14 : 24);
  g.applyMatrix4(new Matrix4().makeScale(BODY.rx / BODY.ry, 1, 1));
  return g;
}

/** Neck centre line, local to the head pivot (origin): up top, down into the chest. */
const NECK_PTS = [V(0, 0.02, -0.02), V(0, -0.24, -0.05), V(0, -0.5, -0.12), V(0, -0.74, -0.22), V(0, -0.9, -0.31)];
const neckR = (s: number) => 0.1 + 0.02 * Math.sin(s * 3) + 0.2 * Math.pow(smooth(0.4, 1, s), 1.5);

/** Neck hangs from the head pivot (origin) down into the chest; the base is wide and buried so the fur blends. */
export function neckGeometry(low: boolean): BufferGeometry {
  const g = tube(NECK_PTS.map((p) => p.clone()), neckR, low ? 18 : 30, low ? 10 : 16);
  g.applyMatrix4(new Matrix4().makeScale(0.92, 1, 1));
  return g;
}

/** Droopy mane along the front of the neck (fed to a long, heavy fur shell). */
export function maneGeometry(low: boolean): BufferGeometry {
  const curve = new CatmullRomCurve3(NECK_PTS.map((p) => p.clone()), false, "catmullrom", 0.5);
  const pts: Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = 0.04 + (0.86 * i) / 8;
    const c = curve.getPoint(t);
    pts.push(V(0, c.y - 0.01, c.z + neckR(t) * 0.78));
  }
  return tube(pts, (s) => 0.04 + 0.05 * Math.sin(Math.PI * Math.min(1, s * 1.05)) + 0.02 * s, low ? 14 : 22, low ? 6 : 8);
}

/** Tail hangs from its pivot at the rump, sweeping back and curling up at the tuft. */
export function tailGeometry(low: boolean): BufferGeometry {
  const pts = [V(0, 0, 0), V(0, -0.04, -0.2), V(0, -0.2, -0.42), V(0, -0.4, -0.55), V(0, -0.52, -0.5), V(0, -0.58, -0.4)];
  const R = (s: number) => 0.045 + 0.03 * Math.sin(Math.PI * Math.min(1, s * 1.1)) + 0.045 * smooth(0.6, 0.85, s) * (1 - smooth(0.93, 1, s) * 0.85);
  return tube(pts, R, low ? 16 : 26, low ? 8 : 12);
}

/** One leg, hip at the origin, hanging along -Y, with a gentle dog-leg bend (front: forward knee, hind: back hock). */
export function legGeometry(front: boolean, low: boolean): BufferGeometry {
  const L = LEG_L - 0.04;
  const b = front ? 0.05 : -0.06;
  const pts = [V(0, 0, 0), V(0, -0.3 * L, front ? -0.02 : 0.05), V(0, -0.62 * L, b), V(0, -0.88 * L, b * 0.3), V(0, -L, 0)];
  const R = (s: number) => 0.115 - 0.04 * Math.sin(Math.min(1, s * 1.1) * Math.PI * 0.5) + 0.028 * smooth(0.78, 1, s) + 0.012 * Math.exp(-(((s - 0.5) / 0.07) ** 2));
  return tube(pts, R, low ? 12 : 18, low ? 9 : 12);
}

// ── skin parts ──────────────────────────────────────────────────────────────────────────────────

const SKIN: readonly [number, number, number] = [0.94, 0.93, 0.95];
const TIP: readonly [number, number, number] = [0.9, 0.46, 0.42];
const HORN: readonly [number, number, number] = [0.95, 0.9, 0.8];

/** Skull + upper beak + horn in head space (origin = head pivot at the top of the neck). Merged, vertex coloured. */
export function headGeometry(low: boolean): BufferGeometry {
  const T = low ? 18 : 30;
  const S = low ? 12 : 20;
  const upper = tube(
    [V(0, 0.05, -0.11), V(0, 0.065, 0.0), V(0, 0.04, 0.13), V(0, -0.015, 0.25), V(0, -0.085, 0.325), V(0, -0.135, 0.348)],
    (s) => {
      const k = [
        [0, 0.07],
        [0.12, 0.104],
        [0.3, 0.124],
        [0.55, 0.114],
        [0.8, 0.078],
        [0.93, 0.036],
        [1, 0.006],
      ];
      let i = 0;
      while (i < k.length - 2 && s > k[i + 1][0]) i++;
      const u = (s - k[i][0]) / (k[i + 1][0] - k[i][0]);
      return k[i][1] + (k[i + 1][1] - k[i][1]) * (u * u * (3 - 2 * u));
    },
    T,
    S,
  );
  upper.applyMatrix4(new Matrix4().makeScale(0.8, 1, 1));
  remapUV(upper, 0.4, 0.95, 0.5, 0.95);
  paintRings(upper, S, (s) => {
    const t = smooth(0.8, 0.96, s);
    return [SKIN[0] + (TIP[0] - SKIN[0]) * t, SKIN[1] + (TIP[1] - SKIN[1]) * t, SKIN[2] + (TIP[2] - SKIN[2]) * t];
  });
  // brow / socket mass so the eye sits in a wrinkled recess
  const brows = [-1, 1].map((sg) => remapUV(tint(ellipsoid(0.036, 0.022, 0.06, [sg * 0.07, 0.112, 0.03], low ? [10, 8] : [14, 10]), SKIN[0], SKIN[1], SKIN[2]), 0.5, 0.8, 0.6, 0.9));
  const horn = tube(
    [V(0, 0.09, -0.03), V(0, 0.15, -0.1), V(0, 0.178, -0.19), V(0, 0.17, -0.27)],
    (s) => (0.034 * (1 - s) + 0.004) * (1 + 0.09 * Math.sin(s * 58)),
    low ? 10 : 16,
    low ? 6 : 8,
  );
  paintRings(horn, low ? 6 : 8, () => HORN);
  remapUV(horn, 0.45, 0.9, 0.55, 0.9);
  return merge([upper, ...brows, horn]);
}

/** Lower beak: hinge at the origin, hanging forward and down to a hooked tip. */
export function jawGeometry(low: boolean): BufferGeometry {
  const T = low ? 14 : 22;
  const S = low ? 10 : 16;
  const g = tube(
    [V(0, -0.015, 0.0), V(0, -0.03, 0.09), V(0, -0.058, 0.19), V(0, -0.09, 0.27), V(0, -0.12, 0.31)],
    (s) => {
      const k = [
        [0, 0.05],
        [0.3, 0.078],
        [0.65, 0.06],
        [0.92, 0.03],
        [1, 0.006],
      ];
      let i = 0;
      while (i < k.length - 2 && s > k[i + 1][0]) i++;
      const u = (s - k[i][0]) / (k[i + 1][0] - k[i][0]);
      return k[i][1] + (k[i + 1][1] - k[i][1]) * (u * u * (3 - 2 * u));
    },
    T,
    S,
  );
  g.applyMatrix4(new Matrix4().makeScale(0.9, 1, 1));
  remapUV(g, 0.4, 0.95, 0.5, 0.95);
  paintRings(g, S, (s) => {
    const t = smooth(0.78, 0.95, s);
    return [SKIN[0] + (TIP[0] - SKIN[0]) * t, SKIN[1] + (TIP[1] - SKIN[1]) * t, SKIN[2] + (TIP[2] - SKIN[2]) * t];
  });
  return g;
}

/** Padded paw with four toes (origin on the ground under the ankle). */
export function pawGeometry(low: boolean): BufferGeometry {
  const seg: [number, number] = low ? [10, 8] : [14, 10];
  const parts: BufferGeometry[] = [ellipsoid(0.1, 0.055, 0.12, [0, 0.05, 0.03], seg)];
  const toes = [
    [-0.062, 0.112, 0.03],
    [-0.021, 0.134, 0.034],
    [0.021, 0.134, 0.034],
    [0.062, 0.112, 0.03],
  ];
  for (const t of toes) parts.push(ellipsoid(0.036, 0.03, 0.05, [t[0], t[2] - 0.003, t[1]], seg));
  for (const p of parts) tint(p, 0.92, 0.88, 0.86);
  return merge(parts);
}

/**
 * Saddle cloth: a sheet draped over the withers, following the body ellipse plus a small offset, hanging
 * down both flanks with a ragged hem and a gold fringe. u across (0..1 over the arc), v along z.
 * Vertex colours: cloth white, fringe gold.
 */
export function saddleGeometry(low: boolean): BufferGeometry {
  const I = low ? 14 : 28; // across
  const J = low ? 6 : 10; // along
  const cols = I + 1;
  const z0 = -0.3;
  const z1 = 0.14;
  const at = (u: number, v: number, out: number[]) => {
    const z = z0 + (z1 - z0) * v;
    const s = (z - BODY.rump) / (BODY.chest - BODY.rump);
    const w = Math.pow(Math.sin(Math.PI * s), 0.42) * (0.94 + 0.16 * smooth(0.2, 0.85, s));
    const ry = BODY.ry * w + 0.045;
    const rx = BODY.rx * w + 0.045;
    const hem = 1.9 + 0.14 * Math.sin(v * 9 + u * 3) + 0.06 * Math.sin(u * 17);
    const th = (u * 2 - 1) * hem;
    const zc = (z0 + z1) / 2;
    out[0] = Math.sin(th) * rx;
    out[1] = BODY.y + 0.02 + Math.cos(th) * ry;
    out[2] = zc + (z - zc) * (1 - 0.3 * smooth(0.9, hem, Math.abs(th)));
    return th;
  };
  const pos = new Float32Array(cols * (J + 1) * 3);
  const uv = new Float32Array(cols * (J + 1) * 2);
  const p = [0, 0, 0];
  for (let j = 0; j <= J; j++) {
    for (let i = 0; i <= I; i++) {
      at(i / I, j / J, p);
      const k = j * cols + i;
      pos.set(p, k * 3);
      uv[k * 2] = i / I;
      uv[k * 2 + 1] = j / J;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < J; j++) {
    for (let i = 0; i < I; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const cloth = new BufferGeometry();
  cloth.setAttribute("position", new Float32BufferAttribute(pos, 3));
  cloth.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  cloth.setIndex(new Uint32BufferAttribute(idx, 1));
  cloth.computeVertexNormals();
  tint(cloth, 1, 1, 1);

  // fringe: tapered strips hanging from both hems
  const n = low ? 12 : 22;
  const fp: number[] = [];
  const fuv: number[] = [];
  const fi: number[] = [];
  let vi = 0;
  for (const u of [0, 1]) {
    for (let k = 0; k < n; k++) {
      const v = (k + 0.5) / n;
      const th = at(u, v, p);
      const len = 0.075 + 0.04 * Math.abs(Math.sin(k * 2.7 + u * 5));
      const hw = 0.0075;
      const nx = Math.sign(Math.sin(th)) * 0.02; // hangs a touch outward
      fp.push(p[0] - 0, p[1], p[2] - hw, p[0], p[1], p[2] + hw, p[0] + nx * 0.6, p[1] - len * 0.55, p[2] + hw * 0.8, p[0] + nx * 0.6, p[1] - len * 0.55, p[2] - hw * 0.8, p[0] + nx, p[1] - len, p[2]);
      for (let q = 0; q < 5; q++) fuv.push(0.06, 0.85);
      fi.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3, vi + 3, vi + 2, vi + 4);
      vi += 5;
    }
  }
  const fringe = new BufferGeometry();
  fringe.setAttribute("position", new Float32BufferAttribute(fp, 3));
  fringe.setAttribute("uv", new Float32BufferAttribute(fuv, 2));
  fringe.setIndex(new Uint32BufferAttribute(fi, 1));
  fringe.computeVertexNormals();
  tint(fringe, 1.1, 0.85, 0.45);
  return merge([cloth, fringe]);
}
