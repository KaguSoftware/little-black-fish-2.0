import type { IUniform, Material } from "three";

/**
 * Tiny layering system on top of `onBeforeCompile` so several kit effects
 * (robe sway + weave + ...) can patch the same MeshStandard/Physical material,
 * and so each distinct GLSL variant gets its own program cache key.
 *
 * Injection points (all appended AFTER the named three.js chunk):
 *  - vertexHead      after `#include <common>` (declare attributes/uniforms/varyings/functions)
 *  - vertexNormal    after `#include <beginnormal_vertex>` (modify `objectNormal`)
 *  - vertexPosition  after `#include <begin_vertex>` (modify `transformed`)
 *  - fragmentHead    after `#include <common>`
 *  - fragmentColor   after `#include <color_fragment>` (modify `diffuseColor`, may `discard`)
 *
 * Uniform objects are shared by reference: mutate `uniforms.foo.value` per frame.
 */
export interface ShaderPatch {
  /** Unique id of the GLSL variant (uniform VALUES do not matter, code does). */
  key: string;
  uniforms?: Record<string, IUniform>;
  vertexHead?: string;
  vertexNormal?: string;
  vertexPosition?: string;
  fragmentHead?: string;
  fragmentColor?: string;
}

interface ShaderLike {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, IUniform>;
}

/** Kept out of material.userData: Material.clone() JSON-copies userData, which must never see textures. */
const PATCHES = new WeakMap<Material, ShaderPatch[]>();

export function addPatch(mat: Material, patch: ShaderPatch): void {
  let list = PATCHES.get(mat);
  if (!list) {
    list = [];
    PATCHES.set(mat, list);
    const patches = list;
    mat.onBeforeCompile = (shader: ShaderLike) => {
      for (const p of patches) {
        if (p.uniforms) Object.assign(shader.uniforms, p.uniforms);
        let v = shader.vertexShader;
        let f = shader.fragmentShader;
        if (p.vertexHead) v = v.replace("#include <common>", `#include <common>\n${p.vertexHead}`);
        if (p.vertexNormal) v = v.replace("#include <beginnormal_vertex>", `#include <beginnormal_vertex>\n${p.vertexNormal}`);
        if (p.vertexPosition) v = v.replace("#include <begin_vertex>", `#include <begin_vertex>\n${p.vertexPosition}`);
        if (p.fragmentHead) f = f.replace("#include <common>", `#include <common>\n${p.fragmentHead}`);
        if (p.fragmentColor) f = f.replace("#include <color_fragment>", `#include <color_fragment>\n${p.fragmentColor}`);
        shader.vertexShader = v;
        shader.fragmentShader = f;
      }
    };
    mat.customProgramCacheKey = () => patches.map((p) => p.key).join("|");
  }
  list.push(patch);
  mat.needsUpdate = true;
}

/** GLSL: cheap 3D hash, 0..1. */
export const GLSL_HASH = /* glsl */ `
float kitHash31(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
`;
