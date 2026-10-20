import { BufferGeometry, LatheGeometry, Vector2, type Texture } from "three";
import { cached, makeCanvas, toTexture } from "../../kit";

/**
 * The Silver One's mask: one polished chrome egg, long and pointed at the chin, with a faint
 * vertical seam down its lower half. Two lathe pieces (upper and the barely-parting lower half)
 * share one profile. Face space: origin at the mask's centre, +Z forward.
 */

export const EGG = {
  /** Half width at the widest, height, depth squash, seam split (fraction of height from the chin). */
  w: 0.09,
  h: 0.36,
  zScale: 0.7,
  split: 0.4,
  /** The mask centre sits this far forward of the face group origin. */
  zOffset: 0.04,
};

/** Radius at t (0 chin tip .. 1 crown). */
function eggRadius(t: number): number {
  return EGG.w * Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, Math.max(0, t)), 1.45)), 0.66);
}

/** Front surface z (face space) at height y (face space) and lateral offset x. */
export function eggFrontZ(x: number, y: number): number {
  const t = y / EGG.h + 0.5;
  const r = eggRadius(t);
  const q = Math.max(0, r * r - x * x);
  return EGG.zOffset + EGG.zScale * Math.sqrt(q);
}

function plate(t0: number, t1: number, segs: number, rings: number): BufferGeometry {
  const pts: Vector2[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = t0 + (i / rings) * (t1 - t0);
    pts.push(new Vector2(Math.max(eggRadius(t), 0.0001), (t - 0.5) * EGG.h));
  }
  const g = new LatheGeometry(pts, segs, Math.PI, Math.PI * 2);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const t = y / EGG.h + 0.5;
    // the seam: a shallow vertical crease on the lower half of the front
    const seam = z > 0 ? 0.0032 * Math.exp(-Math.pow(x / 0.0075, 2)) * (1 - Math.min(1, Math.max(0, (t - 0.5) / 0.14))) * Math.min(1, t / 0.07) : 0;
    p.setXYZ(i, x, y, (z - seam / EGG.zScale) * EGG.zScale + EGG.zOffset);
  }
  g.computeVertexNormals();
  return g;
}

export interface ChromeMask {
  upper: BufferGeometry;
  /** In jaw-local space (origin at the hinge). */
  lower: BufferGeometry;
  hingeY: number;
}

export function buildChromeMask(quality: "high" | "low"): ChromeMask {
  const low = quality === "low";
  const segs = low ? 28 : 56;
  const upper = plate(EGG.split, 1, segs, low ? 26 : 52);
  const lower = plate(0, EGG.split, segs, low ? 12 : 24);
  const hingeY = (EGG.split - 0.5) * EGG.h;
  lower.translate(0, -hingeY, 0);
  return { upper, lower, hingeY };
}

/** Soft white-blue hot spot with a faint cross flare, used as the chrome "pupil" reflection. */
export function glintTexture(): Texture {
  return cached("tex:silverGlint", () => {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);
    ctx.clearRect(0, 0, size, size);
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.18, "rgba(235,244,255,0.95)");
    g.addColorStop(0.5, "rgba(190,210,255,0.28)");
    g.addColorStop(1, "rgba(160,190,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // streaks
    for (const [w, h, a] of [
      [size * 0.95, 3, 1],
      [3, size * 0.7, 0.8],
    ] as const) {
      const lg = ctx.createLinearGradient(size / 2 - w / 2, 0, size / 2 + w / 2, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)");
      lg.addColorStop(0.5, `rgba(255,255,255,${0.7 * a})`);
      lg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(size / 2 - w / 2, size / 2 - h / 2, w, h);
    }
    return toTexture(canvas, { srgb: true, wrap: false });
  });
}

/** Vertical bloom for the chrome (bright across the brow and cheeks, dark at the chin tip and crown). */
export function chromeGlowTexture(): Texture {
  return cached("tex:silverChromeGlow", () => {
    const { canvas, ctx } = makeCanvas(8, 128);
    const g = ctx.createLinearGradient(0, 128, 0, 0);
    g.addColorStop(0, "#000000");
    g.addColorStop(0.18, "#2c2f36");
    g.addColorStop(0.5, "#aeb6c4");
    g.addColorStop(0.7, "#dfe6f2");
    g.addColorStop(0.9, "#8f98a8");
    g.addColorStop(1, "#1a1c20");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 128);
    return toTexture(canvas, { srgb: true });
  });
}
