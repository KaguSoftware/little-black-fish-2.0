import { BufferGeometry, DoubleSide, Float32BufferAttribute, MeshPhysicalMaterial, Uint32BufferAttribute, type Texture } from "three";
import { addPatch } from "../../kit";
import { ellipsoid, flatUV, merge, smooth, tint } from "./geo";

/**
 * The carved ivory mask. A heightfield shell (cylinder wrap + nose, brow, cheeks, lips, chin),
 * UV-mapped into the frontal crop of the mask-face texture. The two almond eye openings are cut
 * in the fragment shader (alpha-to-coverage) at the exact UV spot where the texture paints the
 * eyes, so the real eyes behind show through. The black cap behind the mask and the blunt
 * fringe band are merged into the same mesh (they sample the black hair pixels of the texture),
 * which keeps the whole head front to ONE draw call.
 */

export const MASK = { halfW: 0.094, halfH: 0.1075 };
/** Face group origin in head space (the mask centre). */
export const FACE_AT = [0, 0.095, 0.1] as const;

// Crop of the 512px mask-face map that holds the mask (px, y down).
const TX = { cx: 272, cy: 238, rx: 128, ry: 148 };
const EYE_PX = { l: [203, 170], r: [337, 170] } as const;

const gauss = (x: number, s: number) => Math.exp(-(x * x) / (s * s));

/** Square -> disc, then shaped to the mask outline. Returns local x,y plus the disc coords. */
function outline(s: number, t: number) {
  const dx = s * Math.sqrt(1 - (t * t) / 2);
  const dy = t * Math.sqrt(1 - (s * s) / 2);
  const w = MASK.halfW * (1 - 0.3 * smooth(0.05, 1, -dy));
  return { x: dx * w, y: dy * MASK.halfH, dx, dy };
}

/** Surface height (z, metres, relative to the mask centre plane). */
export function maskZ(x: number, y: number): number {
  const R = 0.12;
  const ax = Math.min(Math.abs(x), 0.108);
  let z = Math.sqrt(R * R - ax * ax) - R;
  z -= 0.012 * (y / MASK.halfH) ** 2;
  z -= 0.03 * smooth(-0.035, -MASK.halfH, y);
  // nose: bridge ridge widening to the tip, flared alae
  const nose = 0.025 * smooth(0.078, -0.022, y) * (1 - smooth(-0.03, -0.056, y));
  const sx = 0.0068 + 0.006 * smooth(0.03, -0.03, y);
  z += nose * gauss(x, sx);
  z += 0.009 * gauss(Math.abs(x) - 0.015, 0.008) * gauss(y + 0.03, 0.01);
  // brow ridge and eye hollows
  z += 0.0065 * gauss(y - 0.066, 0.013) * (1 - Math.min(1, (x / 0.088) ** 4));
  const ey = 0.049;
  for (const sg of [-1, 1]) {
    z -= 0.0045 * gauss(x - sg * 0.05, 0.026) * gauss(y - ey, 0.016);
    z += 0.006 * gauss(x - sg * 0.056, 0.03) * gauss(y + 0.018, 0.026); // cheekbones
  }
  // lips and chin
  z += 0.0075 * gauss(x, 0.021) * gauss(y + 0.059, 0.0065);
  z += 0.0075 * gauss(x, 0.019) * gauss(y + 0.072, 0.0065);
  z -= 0.002 * gauss(x, 0.02) * gauss(y + 0.065, 0.003);
  z += 0.0105 * gauss(x, 0.026) * gauss(y + 0.095, 0.012);
  return z;
}

/** Centre of an eye opening on the mask surface (face-local). sign +1 = the character's left (+x). */
export function eyeAt(sign: 1 | -1): { x: number; y: number; z: number } {
  const px = sign > 0 ? EYE_PX.r : EYE_PX.l;
  const dx = (px[0] - TX.cx) / TX.rx;
  const dy = (TX.cy - px[1]) / TX.ry;
  const x = dx * MASK.halfW;
  const y = dy * MASK.halfH;
  return { x, y, z: maskZ(x, y) };
}

function maskGrid(n: number, m: number): BufferGeometry {
  const cols = n + 1;
  const pos = new Float32Array((n + 1) * (m + 1) * 3);
  const uv = new Float32Array((n + 1) * (m + 1) * 2);
  for (let j = 0; j <= m; j++) {
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * 2 - 1;
      const t = (j / m) * 2 - 1;
      const p = outline(s, t);
      const k = j * cols + i;
      pos[k * 3] = p.x;
      pos[k * 3 + 1] = p.y;
      pos[k * 3 + 2] = maskZ(p.x, p.y);
      uv[k * 2] = (TX.cx + p.dx * TX.rx) / 512;
      uv[k * 2 + 1] = 1 - (TX.cy - p.dy * TX.ry) / 512;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

/** Cap centre / radii in head space (the black head behind the mask, under the hair). */
export const CAP = { cy: 0.13, cz: -0.05, rx: 0.112, ry: 0.145, rz: 0.13 };

/** The blunt fringe: a thin shell over the forehead cap, textured with the reference's own fringe strands. */
function fringe(low: boolean): BufferGeometry {
  const I = low ? 16 : 30;
  const J = 6;
  const cols = I + 1;
  const pos = new Float32Array(cols * (J + 1) * 3);
  const uv = new Float32Array(cols * (J + 1) * 2);
  const phiMax = 1.1;
  for (let i = 0; i <= I; i++) {
    const phi = ((i / I) * 2 - 1) * phiMax;
    const yb = 0.157 + 0.03 * (phi / phiMax) ** 2;
    for (let j = 0; j <= J; j++) {
      const k = j / J;
      const y = 0.252 + (yb - 0.252) * k;
      const q = Math.max(-1, Math.min(1, (y - CAP.cy) / CAP.ry));
      const f = Math.sqrt(1 - q * q);
      const capFront = CAP.cz + CAP.rz * f + 0.007;
      const ly = Math.min(y - FACE_AT[1], MASK.halfH);
      const maskFront = FACE_AT[2] + maskZ(0, ly) + 0.016;
      const w = smooth(0.2, 0.256, y);
      const rz = maskFront * (1 - w) + capFront * w - CAP.cz;
      const rx = 0.099 * (1 - w) + (CAP.rx * f + 0.007) * w;
      const n = j * cols + i;
      pos[n * 3] = Math.sin(phi) * rx;
      pos[n * 3 + 1] = y - FACE_AT[1];
      pos[n * 3 + 2] = Math.cos(phi) * rz + CAP.cz - FACE_AT[2];
      uv[n * 2] = 0.3 + 0.47 * (i / I);
      uv[n * 2 + 1] = 0.985 - 0.115 * k;
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
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  g.computeVertexNormals();
  return g;
}

export function buildMaskGeometry(low: boolean): BufferGeometry {
  const mask = maskGrid(low ? 26 : 44, low ? 32 : 52);
  const cap = ellipsoid(CAP.rx, CAP.ry, CAP.rz, [0, CAP.cy - FACE_AT[1], CAP.cz - FACE_AT[2]], low ? [16, 12] : [28, 20]);
  flatUV(cap, 0.52, 0.975);
  // vertex colour dims the black hair pixels (the mask itself stays at 1)
  return merge([tint(mask, 1, 1, 1), tint(cap, 0.3, 0.3, 0.32), tint(fringe(low), 0.55, 0.55, 0.58)]);
}

const HOLE_FRAG = /* glsl */ `
{
  vec2 mp = vec2(vMapUv.x * 512.0, (1.0 - vMapUv.y) * 512.0);
  float hf = 9.0;
  vec2 cL = vec2(${EYE_PX.l[0]}.0, ${EYE_PX.l[1]}.0);
  vec2 cR = vec2(${EYE_PX.r[0]}.0, ${EYE_PX.r[1]}.0);
  for (int i = 0; i < 2; i++) {
    vec2 c = i == 0 ? cL : cR;
    float qx = (mp.x - c.x) / 33.0;
    float h = mp.y < c.y ? 12.5 : 8.5;
    float prof = pow(max(1.0 - qx * qx, 0.0001), 0.85);
    float f = max(abs(mp.y - c.y) / (h * prof), abs(qx));
    hf = min(hf, f);
  }
  diffuseColor.rgb *= mix(0.2, 1.0, smoothstep(1.0, 1.45, hf));
  diffuseColor.a *= smoothstep(0.88, 1.12, hf);
}
`;

export function makeMaskMaterial(map: Texture, low: boolean): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    map,
    color: "#ffffff",
    roughness: 0.5,
    metalness: 0.02,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    side: DoubleSide,
    vertexColors: true,
    alphaTest: 0.5,
    alphaToCoverage: !low,
  });
  m.color.setRGB(1.35, 1.3, 1.2);
  // three already declares vMapUv when a map is present, so only the body is patched.
  addPatch(m, { key: "ladyMaskHoles", fragmentColor: HOLE_FRAG });
  return m;
}
