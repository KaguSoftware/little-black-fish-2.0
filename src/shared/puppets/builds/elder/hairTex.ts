import { cached, makeCanvas, rng, toTexture } from "../../kit";
import type { Texture } from "three";

/**
 * Fine, slightly wavy grey-white strands for the Elder's hair cards. Strands start opaque at the top and
 * fade toward ragged, soft tips (the cards are alpha-tested, so the fade becomes a feathered end).
 * `opaque` bakes a mid-grey ground behind the strands, for the crown dome.
 */
export function elderHairTexture(opaque = false): Texture {
  return cached(`tex:elderHair:${opaque}`, () => {
    const W = 256;
    const H = 512;
    const { canvas, ctx } = makeCanvas(W, H);
    const rand = rng(opaque ? 71 : 17);
    if (opaque) {
      ctx.fillStyle = "#7d878a";
      ctx.fillRect(0, 0, W, H);
    }
    ctx.lineCap = "round";
    // clumps: smooth lightness / density variation across the card so the hair streaks instead of reading as a sheet
    const clump = new Float32Array(W);
    let c = rand();
    for (let x = 0; x < W; x++) {
      c += (rand() - 0.5) * 0.32;
      c = Math.min(1, Math.max(0, c));
      clump[x] = c;
    }
    const strands = opaque ? 520 : 1100;
    for (let i = 0; i < strands; i++) {
      const x0 = rand() * W;
      const cl = clump[Math.floor(x0) % W];
      if (rand() > 0.35 + cl * 0.75) continue; // thinner where the clump is low
      const len = H * (0.62 + rand() * 0.38);
      const L = 95 + cl * 130 + rand() * 30;
      const w = 0.9 + rand() * 1.4;
      const ph = rand() * 6.28;
      const amp = 1 + rand() * 3.2;
      const fr = 0.008 + rand() * 0.012;
      let px = x0;
      let py = 0;
      for (let y = 18; y <= len; y += 18) {
        const x = x0 + Math.sin(y * fr + ph) * amp;
        const u = y / len;
        const a = u < 0.66 ? 1 : Math.max(0.05, 1 - (u - 0.66) / 0.34);
        ctx.strokeStyle = `rgba(${Math.round(L)},${Math.round(L + 5)},${Math.round(L + 8)},${a})`;
        ctx.lineWidth = w * (1 - 0.45 * u);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(x, y);
        ctx.stroke();
        px = x;
        py = y;
      }
    }
    return toTexture(canvas, { srgb: true, wrap: true, anisotropy: 8 });
  });
}
