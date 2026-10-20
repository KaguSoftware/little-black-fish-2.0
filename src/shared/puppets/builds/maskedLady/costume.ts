import {
  BufferGeometry,
  CylinderGeometry,
  Matrix4,
  SphereGeometry,
  TorusGeometry,
  type Material,
} from "three";
import { cached, createLatheRobe, makeCanvas, rng, toTexture, type RobeProfile } from "../../kit";
import { ellipsoid, limb, merge, smooth, tint } from "./geo";

/** Geometry for the Masked Lady's costume (all metres, standing on y = 0, +Z forward). */

export const DIM = {
  waistY: 1.0,
  neckY: 1.5,
  shoulderX: 0.212,
  shoulderY: 1.45,
  wristX: 0.3,
  wristY: 0.86,
  footX: 0.115,
  hipY: 0.98,
  hemY: 0.2,
  torsoZ: 0.75,
} as const;

/** Catmull-Rom through [t, value] control points. */
function curve(ctrl: ReadonlyArray<readonly [number, number]>, t: number): number {
  let k = 0;
  while (k < ctrl.length - 2 && t > ctrl[k + 1][0]) k++;
  const p0 = ctrl[Math.max(0, k - 1)];
  const p1 = ctrl[k];
  const p2 = ctrl[k + 1];
  const p3 = ctrl[Math.min(ctrl.length - 1, k + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]);
  const u2 = u * u;
  const u3 = u2 * u;
  return (
    0.5 *
    (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)
  );
}

function profile(ctrl: ReadonlyArray<readonly [number, number]>, y0: number, y1: number, steps: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push([curve(ctrl, t), y0 + (y1 - y0) * t]);
  }
  return out;
}

function lathe(p: RobeProfile, material: Material, o: { segments: number; folds: number; depth: number; cap?: boolean; seed?: number; uv?: [number, number] }): BufferGeometry {
  const r = createLatheRobe(p, {
    material,
    sway: false,
    segments: o.segments,
    folds: o.folds,
    foldDepth: o.depth,
    capTop: o.cap,
    seed: o.seed,
    uvRepeat: o.uv,
  });
  return r.mesh.geometry;
}

// ── sleeves + hands (one mesh each: linen + skin through vertex colour) ─────────────────────────

export const SLEEVE_L = 0.6;
export const SKIN: readonly [number, number, number] = [0.8, 0.58, 0.47];

export function sleeveGeometry(side: 1 | -1, material: Material, low: boolean): BufferGeometry {
  const L = SLEEVE_L;
  const ctrl = [
    [0, 0.05],
    [0.04, 0.072],
    [0.13, 0.122],
    [0.3, 0.158],
    [0.5, 0.158],
    [0.72, 0.134],
    [0.86, 0.112],
    [0.95, 0.075],
    [1, 0.02],
  ] as const;
  const g = lathe(profile(ctrl, -L, 0, low ? 14 : 24), material, {
    segments: low ? 28 : 48,
    folds: 7,
    depth: 0.07,
    cap: true,
    seed: side > 0 ? 2 : 5,
    uv: [2, 1.2],
  });
  tint(g, 1, 1, 1);
  // hand, wrist at y = -L; thumb toward the body
  const yw = -L;
  const parts: BufferGeometry[] = [g];
  const hand: BufferGeometry[] = [];
  hand.push(ellipsoid(0.034, 0.05, 0.02, [0, yw - 0.06, 0], [12, 8]));
  const fx = [-0.0135, -0.0045, 0.0045, 0.0135];
  const fl = [0.058, 0.068, 0.064, 0.05];
  for (let i = 0; i < 4; i++) hand.push(limb(0.0078, yw - 0.095 - fl[i], yw - 0.092, { x: fx[i], z: 0.004, rotX: -0.12, seg: 6 }));
  hand.push(limb(0.0095, yw - 0.115, yw - 0.045, { x: -side * 0.033, z: 0.006, rotZ: side * 0.45, seg: 6 }));
  for (const h of hand) parts.push(tint(h, SKIN[0], SKIN[1], SKIN[2]));
  return merge(parts);
}

// ── silver: cuff with charms, belt, boots ───────────────────────────────────────────────────────

/** Engraved-metal bump: rosette rows and fine lines (cached, shared; never disposed). */
export function engraveBump() {
  return cached("tex:ladyEngrave", () => {
    const S = 256;
    const { canvas, ctx } = makeCanvas(S);
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, S, S);
    const rand = rng(12);
    ctx.lineCap = "round";
    for (let row = 0; row < 2; row++) {
      for (let c = 0; c < 4; c++) {
        const x = c * 64 + 32;
        const y = row * 128 + 64;
        for (let k = 0; k < 3; k++) {
          ctx.strokeStyle = k === 1 ? "#202020" : "#e8e8e8";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(x, y, 8 + k * 7, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.strokeStyle = "#f4f4f4";
        ctx.lineWidth = 2.5;
        for (let p = 0; p < 8; p++) {
          const a = (p / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10);
          ctx.lineTo(x + Math.cos(a) * 22, y + Math.sin(a) * 22);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = "#101010";
      ctx.lineWidth = 2;
      for (let x = 0; x < S; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x, row * 128 + 4);
        ctx.lineTo(x + 4, row * 128 + 10 + rand() * 3);
        ctx.lineTo(x + 8, row * 128 + 4);
        ctx.stroke();
      }
    }
    return toTexture(canvas, { srgb: false });
  });
}

export function cuffGeometry(): BufferGeometry {
  const y = -SLEEVE_L;
  const parts: BufferGeometry[] = [];
  const band = new CylinderGeometry(0.064, 0.06, 0.07, 22, 1, true);
  band.translate(0, y + 0.012, 0);
  parts.push(band);
  for (const dy of [0.047, -0.023]) {
    const t = new TorusGeometry(0.063, 0.0065, 6, 22);
    t.rotateX(Math.PI / 2);
    t.translate(0, y + dy, 0);
    parts.push(t);
  }
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const c = new SphereGeometry(0.0085, 8, 6);
    c.translate(Math.sin(a) * 0.063, y - 0.04 - (i % 2) * 0.012, Math.cos(a) * 0.063);
    parts.push(c);
  }
  return merge(parts);
}

export function beltGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const m = new Matrix4().makeScale(0.172, 1, 0.172);
  const band = new CylinderGeometry(1, 1, 0.052, 40, 1, true);
  band.applyMatrix4(m);
  band.translate(0, 1.19, 0);
  parts.push(band);
  for (const dy of [0.028, -0.028]) {
    const t = new TorusGeometry(1, 0.035, 5, 40);
    t.rotateX(Math.PI / 2);
    t.applyMatrix4(new Matrix4().makeScale(0.172, 0.2, 0.172));
    t.translate(0, 1.19 + dy, 0);
    parts.push(t);
  }
  return merge(parts);
}

export function bootGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const shaft = new CylinderGeometry(0.068, 0.062, 0.2, 20, 1, false);
  shaft.translate(0, 0.12, -0.012);
  parts.push(shaft);
  const rim = new TorusGeometry(0.068, 0.009, 6, 20);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, 0.222, -0.012);
  parts.push(rim);
  parts.push(ellipsoid(0.056, 0.05, 0.125, [0, 0.05, 0.05], [18, 10]));
  const toe = new SphereGeometry(0.05, 12, 8);
  toe.applyMatrix4(new Matrix4().makeScale(1, 0.85, 1.2));
  toe.translate(0, 0.042, 0.115);
  parts.push(toe);
  return merge(parts);
}

// ── trousers ─────────────────────────────────────────────────────────────────────────────────────

export const LEG_L = DIM.hipY - DIM.hemY;
export const LEG_X = 0.078;

export function legGeometry(side: 1 | -1, material: Material, low: boolean): BufferGeometry {
  const ctrl = [
    [0, 0.082],
    [0.04, 0.108],
    [0.12, 0.178],
    [0.28, 0.232],
    [0.48, 0.238],
    [0.68, 0.196],
    [0.86, 0.148],
    [1, 0.118],
  ] as const;
  const g = lathe(profile(ctrl, -LEG_L, 0.04, low ? 14 : 22), material, {
    segments: low ? 30 : 52,
    folds: 8,
    depth: 0.055,
    cap: true,
    seed: side > 0 ? 3 : 7,
    uv: [2.5, 1.6],
  });
  // lean the leg outward toward the foot (hips sit closer together than the feet)
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const k = Math.min(1, Math.max(0, -y / LEG_L));
    p.setX(i, p.getX(i) + side * (DIM.footX - LEG_X) * k);
    p.setZ(i, p.getZ(i) * 0.92);
  }
  p.needsUpdate = true;
  return g;
}

// ── torso: blouse + turtleneck, vest ─────────────────────────────────────────────────────────────

export function blouseGeometry(material: Material, low: boolean): BufferGeometry {
  const ctrl: [number, number][] = [
    [0.15, 0.99],
    [0.152, 1.1],
    [0.146, 1.2],
    [0.152, 1.31],
    [0.17, 1.4],
    [0.18, 1.445],
    [0.158, 1.458],
    [0.118, 1.468],
    [0.082, 1.482],
    [0.07, 1.5],
    [0.07, 1.54],
    [0.078, 1.572],
    [0.074, 1.592],
    [0.06, 1.6],
  ];
  const g = lathe(ctrl, material, { segments: low ? 28 : 48, folds: 5, depth: 0.02, cap: true });
  tint(g, 1, 1, 1);
  return g;
}

/** Vest: a lathe whose UVs are rewritten so the embroidered front fills the front and plain wool the back. */
export function vestGeometry(material: Material, low: boolean): BufferGeometry {
  const ctrl: [number, number][] = [
    [0.158, 0.99],
    [0.162, 1.05],
    [0.154, 1.19],
    [0.16, 1.3],
    [0.178, 1.4],
    [0.19, 1.44],
    [0.165, 1.457],
    [0.125, 1.468],
    [0.092, 1.476],
  ];
  const segs = low ? 28 : 56;
  const g = lathe(ctrl, material, { segments: segs, folds: 3, depth: 0.008 });
  const uv = g.getAttribute("uv");
  const cols = segs + 1;
  const rings = ctrl.length;
  for (let r = 0; r < rings; r++) {
    const v = (ctrl[r][1] - ctrl[0][1]) / (ctrl[rings - 1][1] - ctrl[0][1]);
    for (let c = 0; c < cols; c++) {
      let a = (c / segs) * Math.PI * 2;
      if (a > Math.PI) a -= Math.PI * 2;
      const w = smooth(1.2, 1.75, Math.abs(a));
      const fu = 0.5 + (a / 1.35) * 0.5;
      const fv = 0.02 + v * 0.98;
      const bu = 0.84 + 0.12 * (Math.abs(a) / Math.PI);
      const bv = 0.3 + 0.1 * v;
      uv.setXY(r * cols + c, fu + (bu - fu) * w, fv + (bv - fv) * w);
    }
  }
  uv.needsUpdate = true;
  return g;
}
