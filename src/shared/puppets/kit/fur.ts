import {
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  MeshStandardMaterial,
  type BufferGeometry,
  type ColorRepresentation,
} from "three";
import { addPatch, GLSL_HASH } from "./shaderPatch";

/**
 * Fur by shell texturing: the base geometry is drawn `shells` times in ONE draw call
 * (instanced), each shell pushed out along the normal and alpha-cut by a procedural
 * strand pattern so silhouettes get fuzzy. Gravity droop and wind are in the vertex shader.
 *
 * Strands are 3D cells hashed from the object-space position, so any geometry works
 * (no UVs needed). `density` is cells per metre in object space.
 */

export interface FurOptions {
  /** Shell count. Default 16 on "high", 8 on "low". */
  shells?: number;
  quality?: "high" | "low";
  /** Fur length in metres. */
  length: number;
  color: ColorRepresentation;
  /** Colour at the tips (default: lighter `color`). */
  tipColor?: ColorRepresentation;
  /** Colour of the skin under the fur (default: darker `color`). */
  rootColor?: ColorRepresentation;
  /** Strand cells per metre (default 220). */
  density?: number;
  /** 0..1 amount the fur droops (default 0.35). */
  gravity?: number;
  /** 0..1 base wind amplitude (default 0.4). */
  wind?: number;
  roughness?: number;
}

export interface FurHandle {
  /** Position/scale this exactly like the mesh whose geometry you passed in. */
  object: Mesh;
  material: MeshStandardMaterial;
  /** `wind` 0..1.5 multiplies the base wind (e.g. walk speed, anger). */
  update(time: number, wind?: number): void;
  dispose(): void;
}

const VERTEX_HEAD = /* glsl */ `
attribute float aShell;
uniform float uFurLen;
uniform float uFurTime;
uniform float uFurWind;
uniform float uFurGrav;
varying float vShell;
varying vec3 vFurPos;
`;

const VERTEX_POS = /* glsl */ `
vShell = aShell;
vFurPos = position;
{
  vec3 fn = normalize(normal);
  float fs = aShell;
  transformed += fn * (uFurLen * fs);
  transformed.y -= uFurGrav * uFurLen * fs * fs;
  float fw = uFurWind * uFurLen * fs * fs;
  transformed.x += sin(uFurTime * 0.9 + position.y * 7.0 + position.z * 3.0) * fw * 0.45;
  transformed.z += cos(uFurTime * 1.15 + position.x * 6.0 + position.y * 2.0) * fw * 0.3;
}
`;

const FRAGMENT_HEAD = /* glsl */ `
varying float vShell;
varying vec3 vFurPos;
uniform float uFurDensity;
uniform vec3 uFurRoot;
uniform vec3 uFurTip;
${GLSL_HASH}
// one jittered strand per cell; returns the strand's reach (0 = no strand covers this point)
float furStrand(vec3 p, float shell, out float tone) {
  vec3 cell = floor(p);
  vec3 f = fract(p);
  float h = kitHash31(cell);
  vec3 jit = vec3(kitHash31(cell + 3.1), kitHash31(cell + 7.7), kitHash31(cell + 11.3)) * 0.5 + 0.25;
  tone = kitHash31(cell + 19.9);
  float reach = 0.3 + 0.7 * h;
  float rad = mix(0.62, 0.14, clamp(shell / reach, 0.0, 1.0));
  return (shell <= reach && length(f - jit) < rad) ? reach : 0.0;
}
const mat3 kitFurRot = mat3(
  0.8432, 0.4503, -0.2935,
  -0.2935, 0.8432, 0.4503,
  0.4503, -0.2935, 0.8432
);
`;

const FRAGMENT_COLOR = /* glsl */ `
{
  vec3 fc = vFurPos * uFurDensity;
  float t1;
  float t2;
  float s1 = furStrand(fc, vShell, t1);
  float s2 = furStrand(kitFurRot * fc * 1.37 + 17.0, vShell, t2);
  if (vShell > 0.001 && s1 + s2 <= 0.0) discard;
  float tone = s1 >= s2 ? t1 : t2;
  float ao = mix(0.2, 1.0, smoothstep(0.0, 0.6, vShell));
  vec3 fur = mix(uFurRoot, diffuseColor.rgb, smoothstep(0.0, 0.3, vShell));
  fur = mix(fur, uFurTip, smoothstep(0.55, 1.0, vShell) * 0.7);
  diffuseColor.rgb = fur * ao * (0.78 + 0.44 * tone);
}
`;

export function createFurShells(geometry: BufferGeometry, o: FurOptions): FurHandle {
  const low = o.quality === "low";
  const shells = Math.max(2, o.shells ?? (low ? 8 : 16));
  const ig = new InstancedBufferGeometry();
  // Share vertex buffers with the source geometry; only the shell index is new.
  for (const name of Object.keys(geometry.attributes)) ig.setAttribute(name, geometry.getAttribute(name));
  if (geometry.index) ig.setIndex(geometry.index);
  if (!geometry.getAttribute("normal")) {
    // Fur needs normals; compute on a private copy rather than mutating the caller's geometry.
    const c = geometry.clone();
    c.computeVertexNormals();
    ig.setAttribute("normal", c.getAttribute("normal"));
  }
  const sh = new Float32Array(shells);
  for (let i = 0; i < shells; i++) sh[i] = i / (shells - 1);
  ig.setAttribute("aShell", new InstancedBufferAttribute(sh, 1));
  ig.instanceCount = shells;

  const base = new Color(o.color);
  const tip = o.tipColor ? new Color(o.tipColor) : base.clone().lerp(new Color(1, 0.97, 0.92), 0.3);
  const root = o.rootColor ? new Color(o.rootColor) : base.clone().multiplyScalar(0.45);
  const material = new MeshStandardMaterial({ color: base, roughness: o.roughness ?? 0.95, metalness: 0 });
  const baseWind = o.wind ?? 0.4;
  const u = {
    uFurLen: { value: o.length },
    uFurTime: { value: 0 },
    uFurWind: { value: baseWind },
    uFurGrav: { value: o.gravity ?? 0.35 },
    uFurDensity: { value: (o.density ?? 220) * (low ? 0.7 : 1) },
    uFurRoot: { value: root },
    uFurTip: { value: tip },
  };
  addPatch(material, {
    key: "furShells",
    uniforms: u,
    vertexHead: VERTEX_HEAD,
    vertexPosition: VERTEX_POS,
    fragmentHead: FRAGMENT_HEAD,
    fragmentColor: FRAGMENT_COLOR,
  });

  const mesh = new Mesh(ig, material);
  mesh.frustumCulled = false;
  mesh.name = "fur-shells";

  return {
    object: mesh,
    material,
    update(time, wind = 1) {
      u.uFurTime.value = time;
      u.uFurWind.value = baseWind * wind;
    },
    dispose() {
      ig.dispose();
      material.dispose();
    },
  };
}
