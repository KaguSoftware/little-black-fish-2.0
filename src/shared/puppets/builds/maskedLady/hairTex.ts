import { cached, makeCanvas, rng, toTexture } from "../../kit";

/**
 * Silky straight-hair card texture: many fine, slightly overlapping strands with a soft sheen streak,
 * tapered ragged tips and thinning edges (so card borders dissolve instead of showing hard slab edges).
 * Grey, tinted by the hair material colour. Cached and shared; never disposed.
 */
export function silkHairTexture() {
  return cached("tex:ladySilkHair", () => {
    const w = 256;
    const h = 512;
    const { canvas, ctx } = makeCanvas(w, h);
    const rand = rng(77);
    ctx.clearRect(0, 0, w, h);
    for (let x = 0; x < w; x += 1) {
      const edge = Math.min(x, w - 1 - x) / (w * 0.5); // 0 at the sides, 1 mid
      const keep = 0.8 + 0.2 * Math.min(1, edge * 2.2);
      if (rand() > keep) continue;
      const end = h * (0.8 + 0.2 * rand() * (0.5 + 0.5 * edge));
      const g0 = 0.2 + 0.25 * rand();
      const hi = Math.min(1, g0 + 0.45 + 0.2 * rand());
      const grad = ctx.createLinearGradient(0, 0, 0, end);
      const c = (v: number) => Math.round(255 * v);
      grad.addColorStop(0, `rgb(${c(g0 * 0.6)},${c(g0 * 0.6)},${c(g0 * 0.6)})`);
      grad.addColorStop(0.28, `rgb(${c(g0)},${c(g0)},${c(g0)})`);
      grad.addColorStop(0.42, `rgb(${c(hi)},${c(hi)},${c(hi)})`);
      grad.addColorStop(0.62, `rgb(${c(g0)},${c(g0)},${c(g0)})`);
      grad.addColorStop(1, `rgb(${c(g0 * 0.8)},${c(g0 * 0.8)},${c(g0 * 0.8)})`);
      ctx.fillStyle = grad;
      const lw = 2.5 + rand() * 2;
      // slight wander so strands interleave
      ctx.fillRect(x + (rand() - 0.5), 0, lw, end);
    }
    return toTexture(canvas, { srgb: true, wrap: true });
  });
}
