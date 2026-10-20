import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Texture,
  Vector3,
} from "three";
import { cached, makeCanvas, toTexture } from "../../kit";
import { merge } from "../child/parts";

/**
 * The Elder's mask: a long, narrow block of pale porous stone with a long ridge of a nose that ends
 * in a blunt tip at the chin, and two tiny eye slits cut through the front plate. The block is a hollow
 * shell (open at the back) so the real eyes sit inside it and glint through the slits.
 *
 * Mask space: centred, +Z toward the viewer, metres.
 */

export const MASK_W = 0.15;
export const MASK_H = 0.37;
export const MASK_D = 0.07;
/** Slit centre (x of the character's left eye is +), and half extents. */
export const SLIT_X = 0.034;
export const SLIT_Y = 0.085;
export const SLIT_RX = 0.0145;
export const SLIT_RY = 0.005;

/** Narrower toward the chin. */
export const taper = (y: number): number => 0.8 + 0.2 * Math.min(1, Math.max(0, (y + MASK_H / 2) / MASK_H));

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Z of the front plate at (x, y), mask space. */
export function frontZ(x: number, y: number): number {
  const hx = (MASK_W * taper(y)) / 2;
  const ex = Math.abs(x) / hx;
  const ey = Math.abs(y) / (MASK_H / 2);
  const round = -0.012 * smooth(0.78, 1, ex) - 0.01 * smooth(0.86, 1, ey);
  // nose: a ridge from the brow to a blunt tip at the chin
  const ny = Math.min(1, Math.max(0, (0.115 - y) / 0.27));
  const protr = 0.078 * Math.pow(ny, 1.25);
  const w = 0.014 + 0.012 * ny;
  const nose = protr * (1 - smooth(w * 0.7, w * 1.35, Math.abs(x)));
  // brow and cheek planes
  const brow = 0.004 * Math.exp(-(((y - 0.1) / 0.02) ** 2));
  return MASK_D / 2 + round + nose + brow - 0.004 * (x * x) / (hx * hx);
}

function slitAlpha(): Texture {
  return cached("tex:elderSlitAlpha", () => {
    const S = 512;
    const { canvas, ctx } = makeCanvas(S);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "#000";
    for (const sx of [-1, 1]) {
      const t = taper(SLIT_Y);
      const u = 0.5 + (sx * SLIT_X) / (MASK_W * t);
      const v = 1 - (SLIT_Y + MASK_H / 2) / MASK_H;
      ctx.beginPath();
      ctx.ellipse(u * S, v * S, (SLIT_RX / (MASK_W * t)) * S, (SLIT_RY / MASK_H) * S, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    return toTexture(canvas, { srgb: false, wrap: false });
  });
}

export interface StoneMask {
  body: BufferGeometry;
  rims: BufferGeometry;
  alpha: Texture;
}

export function createStoneMaskGeometry(quality: "high" | "low"): StoneMask {
  const sx = quality === "low" ? 16 : 30;
  const sy = quality === "low" ? 28 : 56;
  const box = new BoxGeometry(MASK_W, MASK_H, MASK_D, sx, sy, 2);
  // drop the back face (group 5): the shell is open behind, where the real eyes live
  const idx = box.getIndex()!;
  const keep: number[] = [];
  for (const g of box.groups) {
    if (g.materialIndex === 5) continue;
    for (let i = g.start; i < g.start + g.count; i++) keep.push(idx.getX(i));
  }
  box.setIndex(keep);
  box.clearGroups();
  const p = box.getAttribute("position");
  const n = box.getAttribute("normal");
  const uv = box.getAttribute("uv");
  const uv1 = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    const y = p.getY(i);
    let z = p.getZ(i);
    const front = n.getZ(i) > 0.5;
    x *= taper(y);
    if (front) {
      z = frontZ(x, y);
      uv1[i * 2] = uv.getX(i);
      uv1[i * 2 + 1] = uv.getY(i);
    } else {
      // flanks follow the rounded front edge; all non-front faces sample a solid-white corner of the alpha map
      if (z > 0) z = Math.min(z, frontZ(x, y));
      uv1[i * 2] = 0.01;
      uv1[i * 2 + 1] = 0.01;
    }
    p.setXYZ(i, x, y, z);
  }
  box.setAttribute("uv1", new Float32BufferAttribute(uv1, 2));
  box.computeVertexNormals();

  const parts: BufferGeometry[] = [];
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const pos = new Vector3();
  const s = new Vector3();
  for (const side of [-1, 1]) {
    const g = new CylinderGeometry(1, 1, 0.014, 20, 1, true);
    const x = side * SLIT_X;
    pos.set(x, SLIT_Y, frontZ(x, SLIT_Y) - 0.0065);
    q.setFromEuler(e.set(Math.PI / 2, 0, 0));
    s.set(SLIT_RX * 1.02, 1, SLIT_RY * 1.05);
    m.compose(pos, q, s);
    g.applyMatrix4(m);
    parts.push(g);
  }
  const rims = merge(parts);
  return { body: box, rims, alpha: slitAlpha() };
}
