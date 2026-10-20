"use client";

import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { Box3, Group, Mesh, Object3D, Vector3, type Material, type Texture } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { Puppet, RigHandles } from "../types";

/**
 * Wrap a loaded GLB scene as a Puppet by mapping node names onto the rig handles, so the
 * ONE controller (usePuppetRig) animates it exactly like a procedural build. Proves any real
 * model can replace a puppet by setting `model` on a teller.
 *
 * Default mapping is the cartoon stand-in:
 *   Head_Rotate -> head, Down_Head -> jaw (re-pivoted at the mouth hinge), Mardomak_L/R -> pupils,
 *   Pelk_L/R_Up -> lids ("Bored" set; the "Angry" set Pelk_L/R_Up_1 mirrors them),
 *   Moch_L/R -> hands, Shoe_L/R -> feet, Kamar_bala -> body, Up_Head -> face.
 * `rig.root` is a new wrapper group (so squash / hop act on the whole figure about its feet).
 * Expression: `setAngry(bool)` toggles ONLY the lid meshes; the pupils live under the "Bored"
 * group, so that group is never hidden.
 */

export interface GlbMapping {
  /** Informational: the model's own root node (the wrapper group is the rig root). */
  root: string;
  body: string;
  head: string;
  jaw?: string;
  handL?: string;
  handR?: string;
  footL?: string;
  footR?: string;
  pupilL?: string;
  pupilR?: string;
  lidL?: string;
  lidR?: string;
  /** Angry-set lids; default `${lidL}_1`. */
  lidAltL?: string;
  lidAltR?: string;
  /** The face node (default `Up_Head`). */
  face?: string;
  /** Jaw hinge in MODEL coordinates (rotation about x happens here). */
  jawPivot?: readonly [number, number, number];
  /** Pull floating hands toward the body: x scaled by `inward`, y lowered by `drop` (model units). */
  handRest?: { inward: number; drop: number };
  /** Pupil travel in model units (default 0.12 x / 0.07 y). */
  pupilRange?: { x: number; y: number };
}

export const CARTOON_MAPPING: GlbMapping = {
  root: "Root",
  body: "Kamar_bala",
  head: "Head_Rotate",
  jaw: "Down_Head",
  handL: "Moch_L",
  handR: "Moch_R",
  footL: "Shoe_L",
  footR: "Shoe_R",
  pupilL: "Mardomak_L",
  pupilR: "Mardomak_R",
  lidL: "Pelk_L_Up",
  lidR: "Pelk_R_Up",
  lidAltL: "Pelk_L_Up_1",
  lidAltR: "Pelk_R_Up_1",
  face: "Up_Head",
  // mouth hinge, measured on the stand-in: teeth span y 2.5..2.85, back of the mouth at z ~ -0.6
  jawPivot: [0, 2.85, -0.6],
  handRest: { inward: 0.62, drop: 1.3 },
  pupilRange: { x: 0.12, y: 0.07 },
};

export interface GlbPuppetOptions {
  /** Dispose geometries/materials/textures in dispose(). Only when the scene was loaded just for this puppet. */
  ownsResources?: boolean;
}

export type GlbPuppet = Puppet & {
  /** Swap the lid set (angry brows vs bored lids). Pupils are never hidden. */
  setAngry(angry: boolean): void;
};

const _box = new Box3();
const _v = new Vector3();

function sanitiseMaterials(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      const ud = m.userData as { __glbClean?: boolean };
      if (ud.__glbClean) continue;
      ud.__glbClean = true;
      const em = (m as Material & { emissive?: { setRGB(r: number, g: number, b: number): void } }).emissive;
      em?.setRGB(0, 0, 0);
    }
  });
}

export function puppetFromGlb(
  scene: Group,
  mapping: GlbMapping = CARTOON_MAPPING,
  height = 1.8,
  opts: GlbPuppetOptions = {},
): GlbPuppet {
  const model = cloneSkinned(scene) as Group;
  sanitiseMaterials(model);
  const find = (n?: string) => (n ? model.getObjectByName(n) ?? undefined : undefined);

  // Hands float far out in a T-pose; bring them in before measuring.
  if (mapping.handRest) {
    for (const name of [mapping.handL, mapping.handR]) {
      const h = find(name);
      if (h) {
        h.position.x *= mapping.handRest.inward;
        h.position.y -= mapping.handRest.drop;
      }
    }
  }

  const object = new Group();
  object.name = "puppet-glb";
  const root = new Group();
  object.add(root);
  const holder = new Group();
  root.add(holder);
  holder.add(model);

  // Normalise: bbox -> `height` metres, feet on y = 0, centred on x / z.
  model.updateMatrixWorld(true);
  _box.setFromObject(model);
  const rawH = Math.max(_box.max.y - _box.min.y, 1e-6);
  const scale = height / rawH;
  const cx = (_box.min.x + _box.max.x) / 2;
  const cz = (_box.min.z + _box.max.z) / 2;
  holder.scale.setScalar(scale);
  holder.position.set(-cx * scale, -_box.min.y * scale, -cz * scale);
  object.updateMatrixWorld(true);

  const body = find(mapping.body) ?? holder;
  const head = find(mapping.head) ?? body;
  let jaw: Object3D | undefined = find(mapping.jaw);
  const handL = find(mapping.handL);
  const handR = find(mapping.handR);
  const footL = find(mapping.footL);
  const footR = find(mapping.footR);
  const pupilL = find(mapping.pupilL);
  const pupilR = find(mapping.pupilR);
  const lidL = find(mapping.lidL);
  const lidR = find(mapping.lidR);
  const lidAltL = find(mapping.lidAltL ?? (mapping.lidL ? `${mapping.lidL}_1` : undefined));
  const lidAltR = find(mapping.lidAltR ?? (mapping.lidR ? `${mapping.lidR}_1` : undefined));
  const face = find(mapping.face ?? "Up_Head") ?? head;

  // Re-pivot the jaw at the mouth hinge so rotating it opens the mouth instead of swinging the whole face.
  if (jaw && mapping.jawPivot) {
    const [px, py, pz] = mapping.jawPivot;
    const pivot = new Group();
    pivot.name = "jaw-pivot";
    _v.set(px, py, pz);
    holder.localToWorld(_v);
    const hp = jaw.parent ?? head;
    hp.worldToLocal(_v);
    pivot.position.copy(_v);
    hp.add(pivot);
    pivot.updateMatrixWorld(true);
    pivot.attach(jaw);
    jaw = pivot;
  }

  // Eye anchors: at the FRONT of each pupil, parented to the pupil's parent (so they don't slide with it).
  const makeAnchor = (pupil: Object3D | undefined, fallback: Object3D): Object3D => {
    const a = new Object3D();
    a.name = "eye-anchor";
    if (pupil && pupil.parent) {
      _box.setFromObject(pupil);
      _box.getCenter(_v);
      _v.z = _box.max.z;
      pupil.parent.worldToLocal(_v);
      a.position.copy(_v);
      pupil.parent.add(a);
    } else {
      fallback.add(a);
    }
    return a;
  };
  const eyeAnchorL = makeAnchor(pupilL, face);
  const eyeAnchorR = makeAnchor(pupilR, face);

  // Pupil travel from model units into the pupil's parent-local units.
  const range = mapping.pupilRange ?? { x: 0.12, y: 0.07 };
  let unit = 1;
  const pp = pupilL?.parent;
  if (pp) {
    pp.getWorldScale(_v);
    unit = Math.max(_v.y / scale, 1e-6);
  }
  const pupilLimit = { x: range.x / unit, y: range.y / unit };

  // Remember lid rests so the alternate (angry) set can mirror the controller's rotation.
  const lidRestL = lidL ? lidL.rotation.x : 0;
  const lidRestR = lidR ? lidR.rotation.x : 0;
  const altRestL = lidAltL ? lidAltL.rotation.x : 0;
  const altRestR = lidAltR ? lidAltR.rotation.x : 0;
  const pupLScaleY = pupilL ? pupilL.scale.y : 1;
  const pupRScaleY = pupilR ? pupilR.scale.y : 1;
  const LID_CLOSED = 1.0;

  let angryBase = false;
  let angryNow = false;
  const applyLids = (angry: boolean) => {
    angryNow = angry;
    if (lidL) lidL.visible = !angry || !lidAltL;
    if (lidR) lidR.visible = !angry || !lidAltR;
    if (lidAltL) lidAltL.visible = angry;
    if (lidAltR) lidAltR.visible = angry;
  };
  applyLids(false);

  const bodyWorldY = (() => {
    body.getWorldPosition(_v);
    return _v.y;
  })();

  const rig: RigHandles = {
    root,
    body,
    head,
    jaw,
    handL,
    handR,
    footL,
    footR,
    pupilL,
    pupilR,
    lidL,
    lidR,
    eyeAnchorL,
    eyeAnchorR,
    face,
  };

  const puppet: GlbPuppet = {
    id: "glb",
    object,
    rig,
    limits: {
      headYaw: 0.7,
      headPitch: 0.4,
      pupil: pupilLimit,
      lidNeutral: 0,
      lidOpen: -0.6,
      lidClosed: LID_CLOSED,
      jawOpen: 0.45,
      gait: "biped",
      stride: 0.5,
    },
    height,
    waistY: bodyWorldY > 0.05 ? bodyWorldY : height * 0.5,
    setAngry(angry) {
      angryBase = angry;
      applyLids(angry);
    },
    update(ctx) {
      // Expression follows anger with hysteresis; falls back to the teller's base set.
      if (!angryNow && ctx.anger > 0.55) applyLids(true);
      else if (angryNow && !angryBase && ctx.anger < 0.35) applyLids(false);
      // The alternate lid set mirrors the controller's rotation on the primary lids.
      if (lidAltL && lidL) lidAltL.rotation.x = altRestL + (lidL.rotation.x - lidRestL);
      if (lidAltR && lidR) lidAltR.rotation.x = altRestR + (lidR.rotation.x - lidRestR);
      // Blink reads clearly on this model by squashing the pupils with the lid closure.
      if (lidL) {
        const c = Math.min(1, Math.max(0, (lidL.rotation.x - lidRestL) / LID_CLOSED));
        const s = 1 - 0.88 * c;
        if (pupilL) pupilL.scale.y = pupLScaleY * s;
        if (pupilR) pupilR.scale.y = pupRScaleY * s;
      }
    },
    dispose() {
      if (!opts.ownsResources) return;
      const seenG = new Set<unknown>();
      const seenM = new Set<Material>();
      const seenT = new Set<Texture>();
      model.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        if (!seenG.has(m.geometry)) {
          seenG.add(m.geometry);
          m.geometry.dispose();
        }
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (seenM.has(mat)) continue;
          seenM.add(mat);
          for (const v of Object.values(mat)) {
            if (v && (v as Texture).isTexture && !seenT.has(v as Texture)) {
              seenT.add(v as Texture);
              (v as Texture).dispose();
            }
          }
          mat.dispose();
        }
      });
    },
  };
  return puppet;
}

// ── loading ────────────────────────────────────────────────────────────────

const sceneCache = new Map<string, Promise<Group>>();

/** Load a (meshopt-compressed) GLB outside React. Cached per url; the result is shared and read-only. */
export function loadGlbScene(url: string): Promise<Group> {
  let p = sceneCache.get(url);
  if (!p) {
    p = (async () => {
      const [{ GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
        import("three/examples/jsm/loaders/GLTFLoader.js"),
        import("three/examples/jsm/libs/meshopt_decoder.module.js"),
      ]);
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      const gltf = await loader.loadAsync(url);
      return gltf.scene;
    })();
    sceneCache.set(url, p);
  }
  return p;
}

export function preloadGlb(url: string): void {
  void loadGlbScene(url).catch(() => sceneCache.delete(url));
}

/**
 * Suspending hook: loads `url` with drei's useGLTF (meshopt decoding included) and returns
 * a Puppet wrapping it. Render under <Suspense>; the GLTF cache is shared, so dispose() is a no-op.
 */
export function useGlbPuppet(url: string, mapping: GlbMapping = CARTOON_MAPPING, height = 1.8): GlbPuppet {
  const gltf = useGLTF(url);
  const puppet = useMemo(() => puppetFromGlb(gltf.scene, mapping, height), [gltf.scene, mapping, height]);
  useEffect(() => () => puppet.dispose(), [puppet]);
  return puppet;
}
