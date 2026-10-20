import { BufferGeometry, Float32BufferAttribute, SphereGeometry, Uint32BufferAttribute } from "three";
import { merge, tint } from "./geo";

/** Long tasselled earring: two beaten beads and a cream silk tassel (one geometry, vertex colours). Pivot at the top. */
export const EARRING_LEN = 0.3;

function tassel(top: number, bottom: number, low: boolean): BufferGeometry {
  const rings = low ? 8 : 14;
  const segs = low ? 14 : 24;
  const cols = segs + 1;
  const pos: number[] = [];
  const uv: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    const y = top + (bottom - top) * t;
    // neck ring, then a full skirt that flares and ends in a blunt cut
    const base = t < 0.12 ? 0.007 + 0.006 * (t / 0.12) : 0.0135 + 0.0075 * Math.sin(Math.min(1, (t - 0.12) / 0.5) * Math.PI * 0.5);
    for (let c = 0; c < cols; c++) {
      const a = (c / segs) * Math.PI * 2;
      const strand = 1 + (t > 0.14 ? 0.07 * Math.sin(a * 11 + t * 3) : 0);
      pos.push(Math.sin(a) * base * strand, y, Math.cos(a) * base * strand);
      uv.push(c / segs, 1 - t);
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rings; r++) {
    for (let c = 0; c < segs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  // blunt bottom cap
  const centre = (rings + 1) * cols;
  pos.push(0, bottom, 0);
  uv.push(0.5, 0);
  for (let c = 0; c < segs; c++) idx.push(centre, rings * cols + c, rings * cols + c + 1);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

export function earringGeometry(low: boolean): BufferGeometry {
  const b1 = new SphereGeometry(0.0115, 14, 10);
  b1.translate(0, -0.014, 0);
  const b2 = new SphereGeometry(0.01, 14, 10);
  b2.translate(0, -0.04, 0);
  const cap = new SphereGeometry(0.0065, 8, 6);
  cap.translate(0, -0.059, 0);
  const t = tassel(-0.062, -EARRING_LEN, low);
  return merge([tint(b1, 0.55, 0.42, 0.22), tint(b2, 0.55, 0.42, 0.22), tint(cap, 0.5, 0.4, 0.2), tint(t, 0.78, 0.68, 0.5)]);
}
