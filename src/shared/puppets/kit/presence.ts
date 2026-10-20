import { Plane, Vector3, type Material, type Mesh, type Object3D } from "three";

/**
 * Helpers shared by Hero and Cast for "rising from / sinking into the stage floor" and
 * for dimming upstage characters. Neither allocates after setup.
 */

function eachMaterial(root: Object3D, fn: (m: Material) => void): void {
  const seen = new Set<Material>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      if (!seen.has(m)) {
        seen.add(m);
        fn(m);
      }
    }
  });
}

export interface FloorClip {
  /** 0 = fully below the floor (hidden), 1 = fully risen (no clipping). */
  set(presence: number): void;
  dispose(): void;
}

const UP = new Vector3(0, 1, 0);

/**
 * Attach a world-space clipping plane at y = 0 to every material in `root`, so the
 * puppet can sink into / rise out of the floor with the part below y = 0 cut off.
 * Requires `gl.localClippingEnabled = true` (Hero/Cast set it).
 * Custom ShaderMaterials without the clipping chunks are left alone.
 */
export function attachFloorClip(root: Object3D): FloorClip {
  const plane = new Plane(UP.clone(), 1000);
  const mats: Material[] = [];
  eachMaterial(root, (m) => {
    const sm = m as Material & { isShaderMaterial?: boolean; clipping?: boolean };
    if (sm.isShaderMaterial && !sm.clipping) return;
    m.clippingPlanes = [plane];
    m.needsUpdate = true;
    mats.push(m);
  });
  return {
    set(presence) {
      plane.constant = presence >= 0.999 ? 1000 : 0;
    },
    dispose() {
      for (const m of mats) m.clippingPlanes = null;
    },
  };
}

/** Multiply every material colour by `factor` once (upstage figures sit in fog). Idempotent per object. */
export function dimMaterials(root: Object3D, factor: number): void {
  eachMaterial(root, (m) => {
    const ud = m.userData as { __dimmed?: boolean };
    if (ud.__dimmed) return;
    ud.__dimmed = true;
    const c = (m as Material & { color?: { multiplyScalar(k: number): unknown } }).color;
    c?.multiplyScalar(factor);
  });
}

/** Traverse all materials of an object. */
export function forEachMaterial(root: Object3D, fn: (m: Material) => void): void {
  eachMaterial(root, fn);
}
