import {
  BackSide,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Texture,
} from "three";
import { addPatch, cached, fieldToCanvas, makeCanvas, noiseField, toTexture } from "../../kit";

/**
 * The Child's paper mask: a flat rectangle of paper (the photographed mask, rectified), gently bowed,
 * with a folded paper nose ridge and TWO REAL EYE HOLES cut through it (alpha-tested). The eyes sit
 * just behind the paper and bulge through the holes; a thin paper rim gives each hole its thickness.
 *
 * Geometry is built in mask space (metres, centred, +Z toward the viewer); the texture window below is
 * where the mask sits inside `textures/child/paper-mask.webp` (512 px).
 */

/** Window of the 512 px photo that the plane shows. */
const WIN = { x0: 84, x1: 426, y0: 4, y1: 508 };
export const PX = 0.000465; // metres per source pixel
export const MASK_W = (WIN.x1 - WIN.x0) * PX;
export const MASK_H = (WIN.y1 - WIN.y0) * PX;
const CX = 255; // mask centre column in the photo
const CY = (WIN.y0 + WIN.y1) / 2;

/** Eye-hole centres in the photo (the painted eyes), px. Left/right are the character's. */
const EYE_Y = 248;
const EYE_DX = 87;
/** Eye-hole half extents in metres. */
export const HOLE_RX = 0.0178;
export const HOLE_RY = 0.0083;

/** Almond outline of an eye hole, local (x, y) in metres for t in [0, 1) around the loop. */
function almond(t: number): [number, number] {
  const a = t * Math.PI * 2;
  const x = Math.cos(a) * HOLE_RX;
  const f = 1 - (x / HOLE_RX) ** 2;
  const h = Math.sin(a) >= 0 ? HOLE_RY * f : HOLE_RY * 0.72 * f;
  return [x, Math.abs(Math.sin(a)) < 1e-6 ? 0 : Math.sign(Math.sin(a)) * h];
}

export const EYE_X = EYE_DX * PX; // 0.0506
export const EYE_PLANE_Y = (CY - EYE_Y) * PX;

/** Mask bow: paper curls away from the viewer toward its side edges. */
export const bowZ = (x: number, y: number): number => -1.5 * x * x - 0.65 * y * y;

/** Outline of the paper inside the photo (px), traced from the reference, then eroded by a stroke. */
const OUTLINE: ReadonlyArray<readonly [number, number]> = [
  [93, 12], [253, 9], [414, 22], [418, 130], [419, 250], [414, 300], [390, 392], [361, 500],
  [250, 507], [130, 493], [116, 380], [105, 255], [98, 130],
];

function maskAlpha(): Texture {
  return cached("tex:childMaskAlpha", () => {
    const S = 1024;
    const k = S / 512;
    const { canvas, ctx } = makeCanvas(S);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    OUTLINE.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
    ctx.closePath();
    ctx.fill();
    // erode the rim so no hair / background fringe from the photo shows
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 7 * k;
    ctx.lineJoin = "round";
    ctx.stroke();
    // eye holes
    ctx.fillStyle = "#000";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const [ax, ay] = almond(i / 64);
        const px = (CX + sx * EYE_DX + ax / PX) * k;
        const py = (EYE_Y - ay / PX) * k;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
    const t = toTexture(canvas, { srgb: false, wrap: false, anisotropy: 4 });
    return t;
  });
}

function fibreBump(): Texture {
  return cached("tex:childMaskBump", () => {
    const size = 512;
    const f = noiseField(size, 44, 64, 4, 0.55);
    const t = toTexture(fieldToCanvas(f, size), { srgb: false });
    t.wrapS = t.wrapT = RepeatWrapping;
    return t;
  });
}

export interface MaskBuild {
  front: Mesh;
  back: Mesh;
  /** Eye-hole rims, in mask space (merge into a head-space trim mesh). */
  rimGeometry: BufferGeometry;
  dispose(): void;
}

export function createMask(photo: Texture, quality: "high" | "low"): MaskBuild {
  const segX = quality === "low" ? 24 : 44;
  const segY = quality === "low" ? 32 : 60;
  const geo = new PlaneGeometry(MASK_W, MASK_H, segX, segY);
  const p = geo.getAttribute("position");
  const uv = geo.getAttribute("uv");
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const tx = CX + x / PX; // photo px
    const ty = CY - y / PX;
    // folded nose ridge, rising toward the nostril
    const ridge = smooth(185, 300, ty) * (1 - smooth(332, 362, ty));
    const wx = 0.0085 + 0.006 * ridge;
    const nose = 0.01 * ridge * Math.exp(-((x / wx) * (x / wx)));
    // a soft brow crease
    const brow = -0.0013 * Math.exp(-(((ty - 205) / 9) ** 2));
    p.setZ(i, bowZ(x, y) + nose + brow);
    uv.setXY(i, tx / 512, 1 - ty / 512);
  }
  geo.computeVertexNormals();

  const alpha = maskAlpha();
  const bump = fibreBump().clone();
  bump.repeat.set(2.2, 3.2);
  bump.needsUpdate = true;
  const frontMat = new MeshStandardMaterial({
    map: photo,
    color: "#ffffff",
    alphaMap: alpha,
    alphaTest: 0.5,
    bumpMap: bump,
    bumpScale: 0.6,
    roughness: 0.88,
    metalness: 0,
  });
  frontMat.color.setRGB(1.35, 1.3, 1.25);
  // crisp up the soft 512 px photo: unsharp mask + a fine paper grain, in the fragment shader
  addPatch(frontMat, {
    key: "childMaskSharpen",
    uniforms: { uGrain: { value: bump } },
    fragmentHead: "uniform sampler2D uGrain;",
    fragmentColor: `
      {
        vec2 px = vec2(1.0 / 512.0);
        vec3 c0 = texture2D(map, vMapUv).rgb;
        vec3 bl = (texture2D(map, vMapUv + vec2(px.x, 0.0) * 1.6).rgb + texture2D(map, vMapUv - vec2(px.x, 0.0) * 1.6).rgb
                 + texture2D(map, vMapUv + vec2(0.0, px.y) * 1.6).rgb + texture2D(map, vMapUv - vec2(0.0, px.y) * 1.6).rgb) * 0.25;
        diffuseColor.rgb = max(diffuseColor.rgb + (c0 - bl) * 1.6, vec3(0.0));
        float g = texture2D(uGrain, vMapUv * 9.0).r;
        diffuseColor.rgb *= 0.8 + 0.4 * g;
      }`,
  });
  const backMat = new MeshStandardMaterial({
    color: "#241d18",
    alphaMap: alpha,
    alphaTest: 0.5,
    bumpMap: bump,
    bumpScale: 0.6,
    roughness: 0.95,
    side: BackSide,
  });
  const front = new Mesh(geo, frontMat);
  front.name = "mask-front";
  const back = new Mesh(geo, backMat);
  back.name = "mask-back";

  // hole rims: a thin paper edge following the almond outline, a few mm deep
  const N = 40;
  const pos: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const sx of [-1, 1]) {
    const x0 = sx * EYE_X;
    for (let i = 0; i <= N; i++) {
      const [ax, ay] = almond(i / N);
      const x = x0 + ax * 0.998;
      const y = EYE_PLANE_Y + ay * 0.998;
      const z = bowZ(x, y);
      pos.push(x, y, z + 0.0006, x, y, z - 0.0034);
    }
    for (let i = 0; i < N; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    base += (N + 1) * 2;
  }
  const rimGeometry = new BufferGeometry();
  rimGeometry.setAttribute("position", new Float32BufferAttribute(pos, 3));
  rimGeometry.setIndex(idx);
  rimGeometry.computeVertexNormals();
  const uvs = new Float32Array((pos.length / 3) * 2);
  rimGeometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  return {
    front,
    back,
    rimGeometry,
    dispose() {
      geo.dispose();
      rimGeometry.dispose();
      frontMat.dispose();
      backMat.dispose();
      bump.dispose();
    },
  };
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Strip a geometry down to position/normal/uv so it can be merged with others. */
export function plain(g: BufferGeometry): BufferGeometry {
  const out = new BufferGeometry();
  out.setAttribute("position", g.getAttribute("position"));
  out.setAttribute("normal", g.getAttribute("normal"));
  out.setAttribute("uv", g.getAttribute("uv") ?? new Float32BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
  out.setIndex(g.getIndex());
  return out;
}
