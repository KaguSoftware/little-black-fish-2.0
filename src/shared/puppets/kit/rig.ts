import { Group, Material, Mesh, Object3D } from "three";
import type { TellerId } from "../../content/types";
import type { Puppet, PuppetFrameContext, RigHandles, RigLimits } from "../types";
import { EYE_LIMITS } from "./materials";

/**
 * Scaffolding for wave-2 builders: the standard rig hierarchy, a Puppet assembler with sane
 * limits, a safe disposer, and the per-frame mapping from controller context to the kit's
 * secondary-motion inputs (hair / cloth / fur).
 *
 *   object
 *    └ root                      (controller: position, yaw, hop, squash)
 *       ├ body   @ waistY        (controller: breath, sway, slump)
 *       │   └ head @ neckY       (controller: look-at yaw / pitch, twitch)
 *       │       ├ face           (mask group: GiantFace clones this; eye anchors live inside)
 *       │       └ jaw  @ hinge   (controller: rotation.x opens)
 *       ├ handL / handR          (controller: offsets in METRES from rest)
 *       └ footL / footR
 *
 * Hands and feet are children of root (not body) so their offsets are plain metres in the
 * figure's frame. You may re-parent anything you like; the controller only needs the handles.
 */

export interface ScaffoldOptions {
  /** Absolute heights above the floor, metres. */
  waistY: number;
  neckY: number;
  /** Face centre relative to the head pivot (default [0, 0.1, 0.1]). */
  face?: readonly [number, number, number];
  /** Jaw hinge relative to the head pivot (default [0, 0.03, 0.05]). */
  jaw?: readonly [number, number, number] | null;
  /** Hand rest positions relative to root: [x, y, z] for the LEFT hand (+x); right mirrors x. Null = no hands. */
  hands?: readonly [number, number, number] | null;
  /** Foot rest positions relative to root: [x, y, z] for the LEFT foot (+x); right mirrors x. Null = no feet. */
  feet?: readonly [number, number, number] | null;
}

export interface Scaffold {
  object: Group;
  root: Group;
  body: Group;
  head: Group;
  face: Group;
  jaw: Group | null;
  handL: Group | null;
  handR: Group | null;
  footL: Group | null;
  footR: Group | null;
  /** Add at the centre of each eye opening; the dive camera targets them. */
  eyeAnchorL: Group;
  eyeAnchorR: Group;
}

export function createScaffold(o: ScaffoldOptions): Scaffold {
  const object = new Group();
  const root = new Group();
  root.name = "root";
  object.add(root);
  const body = new Group();
  body.name = "body";
  body.position.y = o.waistY;
  root.add(body);
  const head = new Group();
  head.name = "head";
  head.position.y = o.neckY - o.waistY;
  body.add(head);
  const f = o.face ?? [0, 0.1, 0.1];
  const face = new Group();
  face.name = "face";
  face.position.set(f[0], f[1], f[2]);
  head.add(face);
  let jaw: Group | null = null;
  if (o.jaw !== null) {
    const j = o.jaw ?? [0, 0.03, 0.05];
    jaw = new Group();
    jaw.name = "jaw";
    jaw.position.set(j[0], j[1], j[2]);
    head.add(jaw);
  }
  const pair = (p: readonly [number, number, number] | null | undefined, name: string): [Group | null, Group | null] => {
    if (!p) return [null, null];
    const l = new Group();
    l.name = `${name}L`;
    l.position.set(p[0], p[1], p[2]);
    const r = new Group();
    r.name = `${name}R`;
    r.position.set(-p[0], p[1], p[2]);
    root.add(l, r);
    return [l, r];
  };
  const [handL, handR] = pair(o.hands, "hand");
  const [footL, footR] = pair(o.feet, "foot");
  const eyeAnchorL = new Group();
  eyeAnchorL.name = "eyeAnchorL";
  const eyeAnchorR = new Group();
  eyeAnchorR.name = "eyeAnchorR";
  return { object, root, body, head, face, jaw, handL, handR, footL, footR, eyeAnchorL, eyeAnchorR };
}

export interface AssembleOptions {
  id: TellerId;
  scaffold: Scaffold;
  height: number;
  waistY: number;
  /** Pupils / lids (e.g. from createEye) if the puppet has real eyes. */
  pupilL?: Object3D;
  pupilR?: Object3D;
  lidL?: Object3D;
  lidR?: Object3D;
  limits?: Partial<RigLimits>;
  /** Secondary motion, called after the controller each frame. */
  update?: (ctx: PuppetFrameContext) => void;
  /** Extra cleanup (kit handles' dispose(), shared materials ...). Geometries/materials in the tree are disposed for you. */
  dispose?: () => void;
}

export const DEFAULT_LIMITS: RigLimits = {
  headYaw: 0.6,
  headPitch: 0.35,
  pupil: { x: 0.005, y: 0.0035 },
  lidNeutral: EYE_LIMITS.lidNeutral,
  lidOpen: EYE_LIMITS.lidOpen,
  lidClosed: EYE_LIMITS.lidClosed,
  jawOpen: 0.45,
  gait: "biped",
  stride: 0.45,
};

export function assemblePuppet(a: AssembleOptions): Puppet {
  const s = a.scaffold;
  const rig: RigHandles = {
    root: s.root,
    body: s.body,
    head: s.head,
    jaw: s.jaw ?? undefined,
    handL: s.handL ?? undefined,
    handR: s.handR ?? undefined,
    footL: s.footL ?? undefined,
    footR: s.footR ?? undefined,
    pupilL: a.pupilL,
    pupilR: a.pupilR,
    lidL: a.lidL,
    lidR: a.lidR,
    eyeAnchorL: s.eyeAnchorL,
    eyeAnchorR: s.eyeAnchorR,
    face: s.face,
  };
  return {
    id: a.id,
    object: s.object,
    rig,
    limits: { ...DEFAULT_LIMITS, ...a.limits },
    height: a.height,
    waistY: a.waistY,
    update: a.update ?? (() => {}),
    dispose() {
      a.dispose?.();
      disposeTree(s.object);
    },
  };
}

/**
 * Dispose every geometry and material under `root` (once each). Textures are NOT disposed: the
 * ones from `opts.texture` and the kit's canvas textures are cached and shared across instances.
 * Safe to call twice.
 */
export function disposeTree(root: Object3D): void {
  const g = new Set<unknown>();
  const m = new Set<Material>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry && !g.has(mesh.geometry)) {
      g.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of list) {
      if (mat && !m.has(mat)) {
        m.add(mat);
        mat.dispose();
      }
    }
  });
}

/** Mutable bag of secondary-motion inputs; allocate once with `makeMotion()`, refill each frame. */
export interface SecondaryMotion {
  /** Hair sway / cloth hem sway amount. */
  sway: number;
  /** 0..1 walking. */
  walk: number;
  /** Gait phase. */
  phase: number;
  /** -1..1 lateral push (head turning). */
  wind: number;
  /** 0..1 extra billow (anger, surprise, float). */
  billow: number;
  /** Fur wind multiplier. */
  fur: number;
}

export const makeMotion = (): SecondaryMotion => ({ sway: 1, walk: 0, phase: 0, wind: 0, billow: 0, fur: 1 });

/**
 * Map the controller's frame context onto the kit's secondary-motion inputs.
 * `m` satisfies HairMotion, RobeMotion and the fur wind; pass it straight to their update().
 */
export function secondaryMotion(ctx: PuppetFrameContext, m: SecondaryMotion): SecondaryMotion {
  const mood = ctx.mood;
  m.sway = 0.55 + Math.min(1.1, mood.sway * 9) + ctx.anger * 0.3;
  m.walk = ctx.walk;
  m.phase = ctx.gaitPhase;
  m.wind = Math.max(-1, Math.min(1, ctx.lookYaw * 0.9));
  m.billow = Math.min(1, ctx.anger * 0.6 + ctx.surprise * 0.4 + mood.float * 3 + mood.spin * 2);
  m.fur = 0.6 + ctx.walk * 0.8 + ctx.anger * 0.5;
  return m;
}

