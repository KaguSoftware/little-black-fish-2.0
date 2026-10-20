import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshPhysicalMaterial,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
  type ColorRepresentation,
  type Texture,
} from "three";
import { cached, makeCanvas, rng, toTexture } from "./canvas";
import { addPatch } from "./shaderPatch";

/**
 * Hair. Two tools, one draw call each:
 *  - createHairStrands: thousands of thin prism strands (GPU-instanced), curve + sway in the vertex shader.
 *  - createHairCurtain: long straight hair as layered alpha-tested fin cards (Silver One, Lady, Elder).
 * Both sway via uniforms only. `update()` allocates nothing.
 */

export interface HairMotion {
  /** 0..1.5 idle sway amount (usually mood-driven). Default 1. */
  sway?: number;
  /** 0..1 walking amount. */
  walk?: number;
  /** Gait phase in radians (ctx.gaitPhase) so hair swings with the steps. */
  phase?: number;
  /** -1..1 lateral wind / head-turn push. */
  wind?: number;
}

export interface HairHandle {
  object: Mesh;
  material: MeshPhysicalMaterial;
  update(time: number, m?: HairMotion): void;
  dispose(): void;
}

export interface HairRoot {
  pos: { x: number; y: number; z: number };
  /** Direction the strand leaves the scalp (unit-ish). */
  normal: { x: number; y: number; z: number };
}

// ────────────────────────────────────────────────────────────────────────────
// Strands
// ────────────────────────────────────────────────────────────────────────────

export interface HairStrandsOptions {
  /** Strand count at quality "high"; "low" uses ~40%. */
  count: number;
  /** Strand length in metres. */
  length: number;
  /** Root placement. `n` is the actual count used, so parametrise by i / n to stay even at low quality. */
  rootShape: (i: number, n: number) => HairRoot;
  color: ColorRepresentation;
  /** Colour toward the tips (default: lighter `color`). */
  tipColor?: ColorRepresentation;
  /** Strand radius in metres (default 0.003). Use 1500+ strands for a full head of hair. */
  thickness?: number;
  /** 0..1 helical curl / wave. */
  curl?: number;
  quality?: "high" | "low";
  /** 0..1: how much the hair is pulled down toward the tips (default 0.85). */
  gravity?: number;
  /** 0..1: how long strands keep leaving the scalp before falling (default 0.5). */
  stiffness?: number;
  /** 0..1 length variation. */
  lengthVariation?: number;
  roughness?: number;
  sheen?: number;
  seed?: number;
}

function strandGeometry(rings: number, sides: number): InstancedBufferGeometry {
  const g = new InstancedBufferGeometry();
  const verts = rings * sides;
  const pos = new Float32Array(verts * 3);
  for (let r = 0; r < rings; r++) {
    const t = r / (rings - 1);
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const i = (r * sides + s) * 3;
      pos[i] = Math.cos(a);
      pos[i + 1] = Math.sin(a);
      pos[i + 2] = t; // ring param rides in z
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < sides; s++) {
      const a = r * sides + s;
      const b = r * sides + ((s + 1) % sides);
      const c = (r + 1) * sides + s;
      const d = (r + 1) * sides + ((s + 1) % sides);
      idx.push(a, c, b, b, c, d);
    }
  }
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setIndex(new Uint16BufferAttribute(idx, 1));
  return g;
}

const STRAND_VERTEX_HEAD = /* glsl */ `
attribute vec3 aRoot;
attribute vec3 aNrm;
attribute vec4 aRand;
uniform float uTime;
uniform float uSway;
uniform float uWalk;
uniform float uPhase;
uniform float uWind;
uniform float uLen;
uniform float uRad;
uniform float uCurl;
uniform float uGrav;
uniform float uStiff;
varying float vHairT;
varying float vHairTone;

vec3 hairPt(float t, float L) {
  vec3 R = aRoot;
  vec3 down = vec3(0.0, -1.0, 0.0);
  vec3 N = normalize(aNrm);
  // comb crown hair over instead of arching it: upward normals lean sideways and down
  float cu = max(N.y, 0.0);
  float ca0 = aRand.y * 6.2831;
  N = normalize(N + vec3(cos(ca0), 0.0, sin(ca0)) * cu * cu * 0.8 + down * cu * 0.55);
  vec3 C = R + N * L * (0.28 + 0.45 * uStiff) + down * L * 0.06 * uGrav;
  vec3 E = R + N * L * (0.10 + 0.5 * (1.0 - uGrav) * (0.4 + uStiff)) + down * L * (0.35 + 0.6 * uGrav);
  float it = 1.0 - t;
  vec3 p = it * it * R + 2.0 * it * t * C + t * t * E;
  float w = t * t;
  float ph = aRand.y * 6.2831 + R.x * 6.0 + R.z * 4.0;
  p += vec3(sin(uTime * 1.3 + ph), 0.18 * sin(uTime * 2.1 + ph * 1.7), cos(uTime * 1.1 + ph * 0.8)) * (uSway * 0.07 * L * w);
  p.z += sin(uPhase + ph * 0.3) * uWalk * 0.06 * L * w;
  p.x += uWind * 0.10 * L * w * (0.6 + 0.4 * sin(uTime * 2.7 + ph));
  float ca = t * (5.0 + 9.0 * aRand.w) + aRand.y * 6.2831;
  float cr = (0.18 + uCurl) * L * 0.07 * smoothstep(0.0, 0.25, t);
  p += vec3(cos(ca), 0.35 * sin(ca), sin(ca)) * cr;
  return p;
}
`;

const STRAND_VERTEX_NORMAL = /* glsl */ `
float hT = position.z;
float hL = uLen * aRand.x;
vec3 hP0 = hairPt(hT, hL);
vec3 hPA = hairPt(max(hT - 0.03, 0.0), hL);
vec3 hPB = hairPt(min(hT + 0.03, 1.0), hL);
vec3 hTan = normalize(hPB - hPA + vec3(1e-5));
vec3 hRef = normalize(mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), smoothstep(0.5, 0.95, abs(hTan.y))));
vec3 hSide = normalize(cross(hTan, hRef));
vec3 hUp = cross(hSide, hTan);
vec3 hRad = hSide * position.x + hUp * position.y;
float hR = uRad * (1.0 - 0.8 * hT) * (0.75 + 0.5 * aRand.z);
vec3 hairPos = hP0 + hRad * hR;
objectNormal = hRad;
vHairT = hT;
vHairTone = aRand.z;
`;

const STRAND_FRAGMENT_HEAD = /* glsl */ `
varying float vHairT;
varying float vHairTone;
uniform vec3 uTipColor;
uniform float uRootDark;
`;

const STRAND_FRAGMENT_COLOR = /* glsl */ `
float rootAO = mix(uRootDark, 1.0, smoothstep(0.0, 0.45, vHairT));
diffuseColor.rgb = mix(diffuseColor.rgb, uTipColor, smoothstep(0.5, 1.0, vHairT) * 0.65) * (0.72 + 0.56 * vHairTone) * rootAO;
`;

export function createHairStrands(o: HairStrandsOptions): HairHandle {
  const low = o.quality === "low";
  const n = Math.max(1, Math.round(o.count * (low ? 0.4 : 1)));
  const rings = low ? 7 : 12;
  const sides = 3;
  const geo = strandGeometry(rings, sides);
  geo.instanceCount = n;

  const rand = rng(o.seed ?? 17);
  const lenVar = o.lengthVariation ?? 0.28;
  const roots = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const rnd = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const r = o.rootShape(i, n);
    roots[i * 3] = r.pos.x;
    roots[i * 3 + 1] = r.pos.y;
    roots[i * 3 + 2] = r.pos.z;
    const l = Math.hypot(r.normal.x, r.normal.y, r.normal.z) || 1;
    nrm[i * 3] = r.normal.x / l;
    nrm[i * 3 + 1] = r.normal.y / l;
    nrm[i * 3 + 2] = r.normal.z / l;
    rnd[i * 4] = 1 - lenVar + rand() * lenVar * 1.4; // length scale
    rnd[i * 4 + 1] = rand(); // phase
    rnd[i * 4 + 2] = rand(); // tone
    rnd[i * 4 + 3] = rand(); // curl variation
  }
  geo.setAttribute("aRoot", new InstancedBufferAttribute(roots, 3));
  geo.setAttribute("aNrm", new InstancedBufferAttribute(nrm, 3));
  geo.setAttribute("aRand", new InstancedBufferAttribute(rnd, 4));

  const base = new Color(o.color);
  const tip = o.tipColor ? new Color(o.tipColor) : base.clone().multiplyScalar(1.3);
  const material = new MeshPhysicalMaterial({
    color: base,
    roughness: o.roughness ?? 0.5,
    metalness: 0,
    sheen: o.sheen ?? 0.4,
    sheenRoughness: 0.45,
    sheenColor: base.clone().multiplyScalar(1.8),
  });
  const u = {
    uTime: { value: 0 },
    uSway: { value: 1 },
    uWalk: { value: 0 },
    uPhase: { value: 0 },
    uWind: { value: 0 },
    uLen: { value: o.length },
    uRad: { value: (o.thickness ?? 0.003) * (low ? 1.35 : 1) },
    uCurl: { value: o.curl ?? 0 },
    uGrav: { value: o.gravity ?? 0.85 },
    uStiff: { value: o.stiffness ?? 0.5 },
    uTipColor: { value: tip },
    uRootDark: { value: 0.22 },
  };
  addPatch(material, {
    key: "hairStrands",
    uniforms: u,
    vertexHead: STRAND_VERTEX_HEAD,
    vertexNormal: STRAND_VERTEX_NORMAL,
    vertexPosition: "transformed = hairPos;",
    fragmentHead: STRAND_FRAGMENT_HEAD,
    fragmentColor: STRAND_FRAGMENT_COLOR,
  });

  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.name = "hair-strands";

  return {
    object: mesh,
    material,
    update(time, m) {
      u.uTime.value = time;
      u.uSway.value = m?.sway ?? 1;
      u.uWalk.value = m?.walk ?? 0;
      u.uPhase.value = m?.phase ?? 0;
      u.uWind.value = m?.wind ?? 0;
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Curtain (fin cards)
// ────────────────────────────────────────────────────────────────────────────

/** Vertical strands with ragged tips and alpha-fringed edges. Grey: tinted by the material colour. */
export function hairCardTexture(seed = 5): Texture {
  return cached(`tex:hairCard:${seed}`, () => {
    const w = 256;
    const h = 512;
    const { canvas, ctx } = makeCanvas(w, h);
    const rand = rng(seed);
    ctx.clearRect(0, 0, w, h);
    // a smooth clumping signal across x
    const clump = new Float32Array(w);
    let c = rand();
    for (let x = 0; x < w; x++) {
      c += (rand() - 0.5) * 0.35;
      c = Math.min(1, Math.max(0, c));
      clump[x] = c;
    }
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, w - 1 - x) / (w * 0.5);
      // gaps appear more often near the edges and in low clumps
      if (rand() < 0.1 * (1 - edge) + 0.07 * (1 - clump[x])) continue;
      const end = h * (0.8 + rand() * 0.2) * (0.92 + clump[x] * 0.08);
      const g0 = 0.42 + clump[x] * 0.28 + rand() * 0.12;
      const grad = ctx.createLinearGradient(0, 0, 0, end);
      const lo = Math.round(255 * g0 * 0.55);
      const hi = Math.round(255 * Math.min(1, g0 * 1.25));
      grad.addColorStop(0, `rgb(${lo},${lo},${lo})`);
      grad.addColorStop(0.35, `rgb(${hi},${hi},${hi})`);
      grad.addColorStop(1, `rgb(${Math.round(255 * g0)},${Math.round(255 * g0)},${Math.round(255 * g0)})`);
      ctx.fillStyle = grad;
      const lw = 1 + (rand() < 0.4 ? 1 : 0);
      ctx.fillRect(x, 0, lw, end);
    }
    // a few flyaways
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 18; i++) {
      const x = rand() * w;
      ctx.strokeStyle = `rgba(200,200,200,${0.5 + rand() * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(x, rand() * h * 0.3);
      ctx.quadraticCurveTo(x + (rand() - 0.5) * 30, h * 0.6, x + (rand() - 0.5) * 50, h * (0.7 + rand() * 0.3));
      ctx.stroke();
    }
    const t = toTexture(canvas, { srgb: true, wrap: true });
    return t;
  });
}

export interface HairCurtainOptions {
  /** Ellipse (x and z radii, metres) on which the hair is rooted, at local y = 0 (hairline height). */
  radiusX: number;
  radiusZ: number;
  /** Ellipse centre in the parent's space (default 0,0,0). */
  center?: readonly [number, number, number];
  /** Angular span in radians. 0 = straight ahead (+Z), +π/2 = +X side, π = back. Eg [0.9, 2π-0.9] = back and sides. */
  arc: readonly [number, number];
  /** Hair length in metres, optionally varying with angle. */
  length: number | ((angle: number) => number);
  color: ColorRepresentation;
  tipColor?: ColorRepresentation;
  /** Cards along the arc (default from arc length). */
  cards?: number;
  /** Stacked layers, each pushed outward and slightly shorter (default 3; low quality 2). */
  layers?: number;
  /** Outward offset in metres at the tip (default 0.05). Ignored when `profile` is given. */
  flare?: number;
  /** CPU shape: outward offset (metres) at t (0 root .. 1 tip). Use to drape hair over shoulders. */
  profile?: (t: number, angle: number, layer: number) => number;
  /** Rows per card (default 10, low 6). */
  rows?: number;
  quality?: "high" | "low";
  seed?: number;
  roughness?: number;
}

const CURTAIN_VERTEX_HEAD = /* glsl */ `
attribute vec2 aHair;
uniform float uTime;
uniform float uSway;
uniform float uWalk;
uniform float uPhase;
uniform float uWind;
varying float vHT;
`;
const CURTAIN_VERTEX_POS = /* glsl */ `
float hw = aHair.x * aHair.x;
float hph = aHair.y;
transformed += vec3(sin(uTime * 1.1 + hph), 0.0, cos(uTime * 0.8 + hph * 1.3)) * (uSway * 0.04 * hw);
transformed.z += sin(uPhase + hph * 0.2) * uWalk * 0.06 * hw;
transformed.x += uWind * 0.09 * hw;
vHT = aHair.x;
`;
const CURTAIN_FRAGMENT_COLOR = /* glsl */ `
float cAO = mix(0.35, 1.0, smoothstep(0.0, 0.5, vHT));
diffuseColor.rgb = mix(diffuseColor.rgb, uTipColor, smoothstep(0.55, 1.0, vHT) * 0.55) * cAO;
`;

export function createHairCurtain(o: HairCurtainOptions): HairHandle {
  const low = o.quality === "low";
  const rand = rng(o.seed ?? 29);
  const [a0, a1] = o.arc;
  const span = a1 - a0;
  const cardsN = o.cards ?? Math.max(6, Math.ceil(Math.abs(span) * (low ? 11 : 16)));
  const layers = o.layers ?? (low ? 2 : 3);
  const rows = o.rows ?? (low ? 6 : 10);
  const cols = 3;
  const cx = o.center?.[0] ?? 0;
  const cy = o.center?.[1] ?? 0;
  const cz = o.center?.[2] ?? 0;
  const flare = o.flare ?? 0.05;
  const lenAt = typeof o.length === "function" ? o.length : () => o.length as number;
  const prof = o.profile ?? ((t: number) => flare * (1 - (1 - t) * (1 - t)));
  const total = cardsN * layers;
  const vCount = total * rows * cols;
  const pos = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const meta = new Float32Array(vCount * 2);
  const index = new Uint32Array(total * (rows - 1) * (cols - 1) * 6);
  let vi = 0;
  let ii = 0;
  const dA = (Math.abs(span) / cardsN) * 0.95; // half-width in angle (overlap)
  for (let l = 0; l < layers; l++) {
    for (let c = 0; c < cardsN; c++) {
      const a = a0 + ((c + (l % 2 ? 0.5 : 0) + rand() * 0.25) / cardsN) * span;
      const L = lenAt(a) * (1 - l * 0.045) * (0.93 + rand() * 0.1);
      const layerPush = 1 + l * 0.04;
      const phase = rand() * 6.28;
      const u0 = rand() * 0.5;
      const baseVert = vi;
      for (let r = 0; r < rows; r++) {
        const t = r / (rows - 1);
        for (let k = 0; k < cols; k++) {
          const ak = a + (k - 1) * dA;
          const sx = Math.sin(ak);
          const sz = Math.cos(ak);
          const nx = sx / o.radiusX;
          const nz = sz / o.radiusZ;
          const nl = Math.hypot(nx, nz) || 1;
          const out = prof(t, a, l) + l * 0.012;
          const x = cx + sx * o.radiusX * layerPush + (nx / nl) * out;
          const y = cy - t * L;
          const z = cz + sz * o.radiusZ * layerPush + (nz / nl) * out;
          pos[vi * 3] = x;
          pos[vi * 3 + 1] = y;
          pos[vi * 3 + 2] = z;
          uv[vi * 2] = u0 + (k / (cols - 1)) * 0.5;
          uv[vi * 2 + 1] = 1 - t;
          meta[vi * 2] = t;
          meta[vi * 2 + 1] = phase;
          vi++;
        }
      }
      for (let r = 0; r < rows - 1; r++) {
        for (let k = 0; k < cols - 1; k++) {
          const i0 = baseVert + r * cols + k;
          const i1 = i0 + 1;
          const i2 = i0 + cols;
          const i3 = i2 + 1;
          index[ii++] = i0;
          index[ii++] = i2;
          index[ii++] = i1;
          index[ii++] = i1;
          index[ii++] = i2;
          index[ii++] = i3;
        }
      }
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geo.setAttribute("aHair", new Float32BufferAttribute(meta, 2));
  geo.setIndex(new Uint32BufferAttribute(index, 1));
  geo.computeVertexNormals();

  const base = new Color(o.color);
  const tip = o.tipColor ? new Color(o.tipColor) : base.clone().lerp(new Color(1, 0.95, 0.9), 0.2);
  const material = new MeshPhysicalMaterial({
    color: base,
    map: hairCardTexture(o.seed ?? 5),
    alphaTest: 0.45,
    alphaToCoverage: !low,
    side: DoubleSide,
    roughness: o.roughness ?? 0.4,
    metalness: 0,
    sheen: 0.5,
    sheenRoughness: 0.4,
    sheenColor: base.clone().multiplyScalar(1.8),
  });
  const u = {
    uTime: { value: 0 },
    uSway: { value: 1 },
    uWalk: { value: 0 },
    uPhase: { value: 0 },
    uWind: { value: 0 },
    uTipColor: { value: tip },
  };
  addPatch(material, {
    key: "hairCurtain",
    uniforms: u,
    vertexHead: CURTAIN_VERTEX_HEAD,
    vertexPosition: CURTAIN_VERTEX_POS,
    fragmentHead: "varying float vHT;\nuniform vec3 uTipColor;",
    fragmentColor: CURTAIN_FRAGMENT_COLOR,
  });
  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.name = "hair-curtain";

  return {
    object: mesh,
    material,
    update(time, m) {
      u.uTime.value = time;
      u.uSway.value = m?.sway ?? 1;
      u.uWalk.value = m?.walk ?? 0;
      u.uPhase.value = m?.phase ?? 0;
      u.uWind.value = m?.wind ?? 0;
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
