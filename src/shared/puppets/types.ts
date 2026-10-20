import type { Group, Object3D, Texture } from "three";
import type { MoodParams } from "../content/moods";
import type { TellerId } from "../content/types";

/**
 * The puppet contract. Every character (hand-built procedural puppet or a GLB via
 * glbAdapter) exposes the same rig handles, so ONE controller (`usePuppetRig`)
 * animates all of them: walk, turn, head look-at, pupils, lids, jaw, squash.
 *
 * Conventions (all builders MUST follow):
 * - Units are metres. Feet on y = 0. Faces +Z (toward the default camera). Height ≈ `height`.
 * - Rig handles are plain Object3Ds whose REST transform is captured by the controller
 *   at mount; the controller writes offsets relative to rest every frame. Builders must
 *   not animate rig handles themselves (do secondary motion on other nodes in `update`).
 * - `eyeAnchorL/R` sit at the centre of each eye opening on the mask surface (world dive target).
 * - Materials should respond to light (MeshStandard/Physical); the stage is dark and
 *   lit by a key spotlight + accent rim. Emissive only for deliberate glints.
 */
export interface RigHandles {
  /** Whole-body root (position/rotation/scale set by controller for walk, turn, hop, squash). */
  root: Object3D;
  /** Torso pivot at the waist; controller applies breath, sway and slump. */
  body: Object3D;
  /** Head pivot at the neck; controller applies look-at yaw/pitch and twitches. */
  head: Object3D;
  /** Jaw/mask-lower pivot; controller rotates +x to open. Optional. */
  jaw?: Object3D;
  handL?: Object3D;
  handR?: Object3D;
  footL?: Object3D;
  footR?: Object3D;
  /** Pupils (translated within limits.pupil to look around). */
  pupilL?: Object3D;
  pupilR?: Object3D;
  /** Upper lids (rotated about x between limits.lidClosed and limits.lidOpen). */
  lidL?: Object3D;
  lidR?: Object3D;
  eyeAnchorL: Object3D;
  eyeAnchorR: Object3D;
  /** The face/mask group, cloned for GiantFace and used for close-ups. */
  face: Object3D;
}

export interface RigLimits {
  /** Max head yaw / pitch in radians. */
  headYaw: number;
  headPitch: number;
  /** Max pupil offset in the pupil's PARENT local units. */
  pupil: { x: number; y: number };
  /** Lid rotation.x offsets from rest: neutral, wide open (surprised), closed (blink). */
  lidNeutral: number;
  lidOpen: number;
  lidClosed: number;
  /** Max jaw rotation.x offset in radians. */
  jawOpen: number;
  /** Gait: "biped" or "quadruped" (Creature). */
  gait: "biped" | "quadruped";
  /** Stride length in metres (for foot placement). */
  stride: number;
}

export interface PuppetFrameContext {
  time: number;
  dt: number;
  mood: MoodParams;
  /** 0..1 walking amount and the stride phase (radians). */
  walk: number;
  gaitPhase: number;
  /** 0..1 expression envelopes. */
  anger: number;
  surprise: number;
  talking: number;
  /** World-space pointer direction hints for secondary motion (e.g. snakes turning). */
  lookYaw: number;
  lookPitch: number;
  quality: "high" | "low";
  /** True when this puppet is the hero (side characters get cheaper secondary motion). */
  hero: boolean;
  /** Linear-RGB accent of the current teller blend (for glints / emissive eyes). */
  accent: readonly [number, number, number];
}

export interface Puppet {
  id: TellerId | "glb";
  object: Group;
  rig: RigHandles;
  limits: RigLimits;
  /** Standing height in metres. */
  height: number;
  /** Waist height (particle rings orbit here). */
  waistY: number;
  /** Secondary motion: hair sway, snakes, tassels, cloth, fur. Called every frame after the controller. */
  update(ctx: PuppetFrameContext): void;
  dispose(): void;
}

export interface BuildOptions {
  quality: "high" | "low";
  /** Load (cached) a texture from /public. Returns immediately; image streams in. */
  texture: (url: string, opts?: { srgb?: boolean; repeat?: [number, number] }) => Texture;
  /** Accent of this teller, linear RGB. */
  accent: readonly [number, number, number];
}

export type PuppetBuilder = (opts: BuildOptions) => Puppet | Promise<Puppet>;

/**
 * Per-frame inputs to the shared rig controller. Produced by the caller
 * (series Hero/Cast, home EyesCTA, PuppetLab) from runtime.frame / pointer.
 */
export interface RigInputs {
  /** Stage position (metres) and yaw (radians). */
  x: number;
  z: number;
  rotY: number;
  /** 0..1 walking amount and distance walked (metres) to phase the gait. */
  walk: number;
  stride: number;
  /** World-space point the head should look toward; null = straight ahead. */
  lookAt: import("three").Vector3 | null;
  /** Pupil direction -1..1 in screen-ish space (x right, y up). */
  pupils: { x: number; y: number };
  /** 0..1 envelopes. */
  surprise: number;
  anger: number;
  talking: number;
  /** 0..1: raise the right hand and wave (HELLO). */
  wave: number;
  mood: MoodParams;
  hero: boolean;
  /** When true the controller holds pose (MotionToggle / reduced-motion idle). */
  frozen: boolean;
  quality: "high" | "low";
  accent: readonly [number, number, number];
}
