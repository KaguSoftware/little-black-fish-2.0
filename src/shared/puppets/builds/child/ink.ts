import { MeshPhysicalMaterial, Color, type Texture } from "three";
import { cached, makeCanvas, rng, toTexture } from "../../kit";

/**
 * The Child's limbs: pale skin written over with small hand-drawn marks in dark ink and teal, a few red
 * strokes and paper stickers, in loose columns like the reference (not the kit's banded body paint).
 * 1:2 canvas, wraps in both directions, cached.
 */

type Ctx = CanvasRenderingContext2D;

function glyph(ctx: Ctx, rand: () => number, x: number, y: number, s: number): void {
  const k = Math.floor(rand() * 9);
  ctx.beginPath();
  switch (k) {
    case 0: // cross
      ctx.moveTo(x - s * 0.3, y);
      ctx.lineTo(x + s * 0.3, y + (rand() - 0.5) * 3);
      ctx.moveTo(x, y - s * 0.34);
      ctx.lineTo(x + (rand() - 0.5) * 4, y + s * 0.34);
      break;
    case 1: // tally
      for (let i = 0; i < 2 + Math.floor(rand() * 3); i++) {
        ctx.moveTo(x + i * s * 0.16, y - s * 0.3);
        ctx.lineTo(x + i * s * 0.16 + (rand() - 0.5) * 4, y + s * 0.3);
      }
      break;
    case 2: // ladder
      ctx.moveTo(x - s * 0.12, y - s * 0.4);
      ctx.lineTo(x - s * 0.12, y + s * 0.4);
      ctx.moveTo(x + s * 0.12, y - s * 0.4);
      ctx.lineTo(x + s * 0.12, y + s * 0.4);
      for (let i = 0; i < 4; i++) {
        ctx.moveTo(x - s * 0.12, y - s * 0.3 + i * s * 0.2);
        ctx.lineTo(x + s * 0.12, y - s * 0.3 + i * s * 0.2 + (rand() - 0.5) * 3);
      }
      break;
    case 3: // spiral
      for (let t = 0; t < 11; t += 0.4) {
        const r = t * s * 0.028;
        const px = x + Math.cos(t) * r;
        const py = y + Math.sin(t) * r;
        if (t === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      break;
    case 4: // squiggle
      ctx.moveTo(x - s * 0.3, y);
      for (let i = 1; i <= 5; i++) ctx.lineTo(x - s * 0.3 + i * s * 0.12, y + (i % 2 ? -1 : 1) * s * 0.12);
      break;
    case 5: // letter-ish: stem and bowl
      ctx.moveTo(x, y - s * 0.32);
      ctx.lineTo(x + (rand() - 0.5) * 3, y + s * 0.32);
      ctx.bezierCurveTo(x + s * 0.34, y - s * 0.3, x + s * 0.34, y + s * 0.08, x + s * 0.02, y + s * 0.04);
      break;
    case 6: // arrow
      ctx.moveTo(x - s * 0.3, y);
      ctx.lineTo(x + s * 0.3, y);
      ctx.moveTo(x + s * 0.14, y - s * 0.14);
      ctx.lineTo(x + s * 0.3, y);
      ctx.lineTo(x + s * 0.14, y + s * 0.14);
      break;
    case 7: // circle with dot
      ctx.arc(x, y, s * 0.2, 0, Math.PI * (1.6 + rand() * 0.4));
      ctx.moveTo(x + 2, y);
      ctx.arc(x, y, 1.2, 0, 6.3);
      break;
    default: // zigzag column
      ctx.moveTo(x, y - s * 0.4);
      for (let i = 1; i <= 6; i++) ctx.lineTo(x + (i % 2 ? 1 : -1) * s * 0.1, y - s * 0.4 + i * s * 0.13);
  }
  ctx.stroke();
}

export function inkTexture(seed = 31): Texture {
  return cached(`tex:childInk:${seed}`, () => {
    const W = 512;
    const H = 1024;
    const { canvas, ctx } = makeCanvas(W, H);
    const rand = rng(seed);
    ctx.fillStyle = "#d0a894";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = 30 + rand() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rand() < 0.5 ? "rgba(150,100,80,0.07)" : "rgba(255,240,225,0.09)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const inks = ["#14232a", "#14232a", "#1b2f3a", "#1a5f68", "#a43a2b", "#1d3560"];
    // loose columns of writing
    const cols = 5;
    for (let c = 0; c < cols; c++) {
      const cx = ((c + 0.5 + (rand() - 0.5) * 0.4) / cols) * W;
      let y = rand() * 60;
      while (y < H) {
        ctx.strokeStyle = inks[Math.floor(rand() * inks.length)];
        ctx.globalAlpha = 0.86 + rand() * 0.14;
        ctx.lineWidth = 2.8 + rand() * 3;
        glyph(ctx, rand, cx + (rand() - 0.5) * 30, y, 56 + rand() * 40);
        y += 44 + rand() * 40;
      }
    }
    ctx.globalAlpha = 1;
    // a few long strokes and bands of dried colour
    for (let i = 0; i < 12; i++) {
      ctx.strokeStyle = i % 3 === 0 ? "rgba(164,58,43,0.65)" : "rgba(26,95,104,0.6)";
      ctx.lineWidth = 3 + rand() * 4;
      ctx.beginPath();
      const x = rand() * W;
      const y = rand() * H;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * 60, y + 40 + rand() * 60, x + (rand() - 0.5) * 30, y + 90 + rand() * 90);
      ctx.stroke();
    }
    // paper stickers
    const sticker = ["#cf6a4a", "#d9c58a", "#2f8a8a", "#e3d6b4"];
    for (let i = 0; i < 9; i++) {
      const sw = 36 + rand() * 40;
      const sh = 30 + rand() * 34;
      ctx.save();
      ctx.translate(rand() * W, rand() * H);
      ctx.rotate((rand() - 0.5) * 0.5);
      ctx.fillStyle = sticker[Math.floor(rand() * sticker.length)];
      ctx.strokeStyle = "rgba(40,28,20,0.55)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-sw / 2, -sh / 2, sw, sh, 5);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "rgba(20,30,40,0.85)";
      ctx.lineWidth = 2;
      glyph(ctx, rand, 0, 0, Math.min(sw, sh) * 1.3);
      ctx.restore();
    }
    return toTexture(canvas, { srgb: true, anisotropy: 8 });
  });
}

export function makeInkSkin(color = "#ffffff", seed = 31): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    map: inkTexture(seed),
    color: new Color(color),
    roughness: 0.68,
    sheen: 0.25,
    sheenColor: new Color(0.9, 0.7, 0.6),
    sheenRoughness: 0.6,
  });
}
