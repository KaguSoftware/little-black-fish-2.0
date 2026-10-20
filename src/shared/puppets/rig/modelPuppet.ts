"use client";

import { Box3, Group, Matrix4, Object3D, Quaternion, Vector3, type Material, type Mesh } from "three";
import type { TellerId } from "../../content/types";
import type { Puppet, RigHandles } from "../types";

/**
 * Wrap a character GLB from `scripts/optimize-characters.mjs` as a Puppet. Those files carry
 * translation-only pivots at the joints (Rig_Body @ waist, Rig_Head @ neck, Rig_Face, Rig_ArmL/R @
 * shoulders, Rig_LegL/R @ hips) plus marker nodes (Rig_WristL/R, Rig_AnkleL/R, Rig_EyeL/R).
 *
 * The models are rigid, so hands and feet can't move on their own. The controller's hand/foot
 * handles become invisible TARGETS (children of root, metres, like the procedural scaffold), and
 * every frame each arm / leg pivot is rotated so its wrist / ankle points at its target. The limb
 * swings from the shoulder or hip and nothing comes apart, including a raised wave.
 * A hand that grips a staff (Rig_Root extras.propHand) follows its target only partly, so the staff
 * stays roughly planted, and the handles are swapped so the controller's wave uses the free hand.
 *
 * The cached scene is shared: geometry and textures are reused, materials are cloned per instance
 * (Cast dims them and Hero/Cast attach clipping planes, which must not leak between instances).
 */

interface Limb {
  pivot: Object3D;
  /** Rest wrist/ankle offset from the pivot, in the pivot's parent space, normalised. */
  rest: Vector3;
  target: Object3D;
  /** Rest target position (root space) and how much of the target's offset the limb follows. */
  home: Vector3;
  follow: number;
}

/** Share of the hand's motion the gripping arm follows. */
const GRIP_FOLLOW = 0.3;

const _m = new Matrix4();
const _v = new Vector3();
const _q = new Quaternion();
const _box = new Box3();

export function puppetFromModel(scene: Group, id: TellerId): Puppet {
  const model = scene.clone(true);
  const materials = new Map<Material, Material>();
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const swap = (m: Material) => {
      let c = materials.get(m);
      if (!c) {
        c = m.clone();
        materials.set(m, c);
      }
      return c;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });

  const node = (name: string) => model.getObjectByName(name) ?? undefined;
  const need = (name: string) => {
    const n = node(name);
    if (!n) throw new Error(`[model] ${id}: missing ${name} (re-run scripts/optimize-characters.mjs)`);
    return n;
  };

  const object = new Group();
  object.name = `puppet-${id}`;
  const root = new Group();
  root.name = "root";
  object.add(root);
  root.add(model);
  object.updateMatrixWorld(true);

  const body = need("Rig_Body");
  const head = need("Rig_Head");
  const face = need("Rig_Face");
  const eyeAnchorL = need("Rig_EyeL");
  const eyeAnchorR = need("Rig_EyeR");

  // Targets live in root space at the rest wrist / ankle (root, Rig_Root and the model are identity).
  const propHand = (node("Rig_Root")?.userData as { propHand?: "L" | "R" } | undefined)?.propHand;
  const limb = (pivotName: string, markerName: string, follow = 1): Limb | null => {
    const pivot = node(pivotName);
    const marker = node(markerName);
    if (!pivot || !marker) return null;
    const target = new Object3D();
    target.name = `${pivotName}-target`;
    marker.getWorldPosition(target.position);
    root.add(target);
    return { pivot, rest: marker.position.clone().normalize(), target, home: target.position.clone(), follow };
  };
  const armL = limb("Rig_ArmL", "Rig_WristL", propHand === "L" ? GRIP_FOLLOW : 1);
  const armR = limb("Rig_ArmR", "Rig_WristR", propHand === "R" ? GRIP_FOLLOW : 1);
  const [waveArm, otherArm] = propHand === "R" ? [armL, armR] : [armR, armL];
  const legL = limb("Rig_LegL", "Rig_AnkleL");
  const legR = limb("Rig_LegR", "Rig_AnkleR");

  /** Point the limb's rest direction at its target. `parent` is body for arms, Rig_Root for legs. */
  const aim = (l: Limb | null, parent: Object3D | null) => {
    if (!l) return;
    _v.copy(l.target.position).sub(l.home).multiplyScalar(l.follow).add(l.home);
    if (parent) {
      parent.updateMatrix();
      _v.applyMatrix4(_m.copy(parent.matrix).invert());
    }
    _v.sub(l.pivot.position);
    if (_v.lengthSq() < 1e-8) return;
    _q.setFromUnitVectors(l.rest, _v.normalize());
    l.pivot.quaternion.copy(_q);
  };

  _box.setFromObject(model);
  const height = _box.max.y - _box.min.y;
  body.getWorldPosition(_v);
  const waistY = _v.y;
  const quadruped = !legL && !legR;

  const rig: RigHandles = {
    root,
    body,
    head,
    handL: otherArm?.target,
    handR: waveArm?.target,
    footL: legL?.target,
    footR: legR?.target,
    eyeAnchorL,
    eyeAnchorR,
    face,
  };

  return {
    id,
    object,
    rig,
    limits: {
      headYaw: quadruped ? 0.45 : 0.55,
      headPitch: 0.3,
      pupil: { x: 0, y: 0 },
      lidNeutral: 0,
      lidOpen: 0,
      lidClosed: 0,
      jawOpen: 0,
      gait: quadruped ? "quadruped" : "biped",
      stride: quadruped ? 0.6 : 0.5,
    },
    height,
    waistY,
    update() {
      aim(armL, body);
      aim(armR, body);
      aim(legL, null);
      aim(legR, null);
    },
    dispose() {
      for (const m of materials.values()) m.dispose();
    },
  };
}
