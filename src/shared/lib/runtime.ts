import { Vector3 } from "three";
import type { ChapterId, StillId, TellerId } from "../content/types";
import type { MoodParams } from "../content/moods";
import { MOODS } from "../content/moods";
import type { Lab, RGB } from "./color";
import type { Resolved } from "../content/chapters";
import { resolveProgress } from "../content/chapters";
import { TELLER_IDS, FIRST_TELLER } from "../content/characters";

/**
 * Mutable per-frame state shared by the 3D scene and DOM rAF loops.
 * Written by: SmoothScroll (progress), PointerTracker (pointer), SeriesDirector (frame),
 * Character (hero anchors). Read by everything else. Never put this in React state.
 */

export interface CameraParams {
  pos: Vector3;
  target: Vector3;
  fov: number;
  roll: number;
}

export interface FrameParams {
  time: number;
  dt: number;
  /** Smoothed story progress 0..1. */
  progress: number;
  r: Resolved;

  /** Current target teller and per-teller blend weights (sum ~1). */
  teller: TellerId;
  weights: Record<TellerId, number>;
  /** max weight; 1 when no switch is in flight. */
  settled: number;

  mood: MoodParams;
  accent: RGB; // linear
  accentLab: Lab;
  accentCss: string;
  bg: RGB; // linear
  bgCss: string;

  camera: CameraParams;

  hero: {
    /** Stage position (x, z) the hero stands at. */
    x: number;
    z: number;
    /** Yaw in radians (full turns during walks). */
    rotY: number;
    /** 0..1 how much the hero is walking right now. */
    walk: number;
    /** Distance walked along the current walk segment (metres), drives gait phase. */
    stride: number;
  };
  /** -1 left, 0 centre, 1 right: where narration text sits (opposite the hero). */
  textSide: -1 | 0 | 1;

  /** Backdrop plate crossfade: a -> b by mix; opacity is overall plate visibility. */
  plate: { a: StillId | null; b: StillId | null; mix: number; opacity: number };

  /** Chapter-driven effect envelopes, all 0..1. */
  fx: {
    /** LOOK CLOSER close-up amount (1 at look hold, 0 after pullback). */
    closeUp: number;
    /** Dive: camera approach into left eye. */
    diveApproach: number;
    /** Dive: iris opening for the next scene. 1 = fully open (no overlay). */
    iris: number;
    /** THE DAY intensity: ring shatter, shake, jaw snaps, giant face. */
    day: number;
    /** WHAT I DID: rings swell. */
    swell: number;
    /** WHAT I DID: "Watch the series" button visible. */
    watch: number;
    /** MY MAKER: particles melt into the ripple grid; plates off. */
    maker: number;
    /** Narration currently typing (jaw chatter). */
    talking: number;
    /** Chapter word letter-spacing spread. */
    wordSpread: number;
    /** Chapter word opacity. */
    wordOpacity: number;
  };

  /** Display-type degradation cut for this frame (0,10,35,70,100 interpolated). */
  redaction: number;
}

const zeroWeights = () =>
  Object.fromEntries(TELLER_IDS.map((id) => [id, id === FIRST_TELLER ? 1 : 0])) as Record<TellerId, number>;

export const runtime = {
  /** Raw (unsmoothed) story progress from scroll. */
  rawProgress: 0,
  /** Spring-smoothed story progress. */
  progress: 0,
  /** Pointer in NDC (-1..1, y up) and viewport px. */
  pointer: { x: 0, y: 0, px: 0, py: 0, active: false, lastMove: 0 },
  /** Hero anchors in world space, written by Character each frame. */
  hero: {
    eyeL: new Vector3(0, 1.6, 0.1),
    eyeR: new Vector3(0, 1.6, 0.1),
    head: new Vector3(0, 1.6, 0),
    waist: new Vector3(0, 0.95, 0),
    /** Projected eye positions in NDC for "cursor near eyes" checks. */
    eyesNdc: { x: 0, y: 0, radius: 0.1 },
  },
  frame: {
    time: 0,
    dt: 0,
    progress: 0,
    r: resolveProgress(0),
    teller: FIRST_TELLER,
    weights: zeroWeights(),
    settled: 1,
    mood: MOODS.bouncy,
    accent: [0.3, 0.5, 0.6],
    accentLab: [0.7, 0, 0],
    accentCss: "oklch(0.7 0.1 210)",
    bg: [0.01, 0.01, 0.012],
    bgCss: "oklch(0.12 0.014 215)",
    camera: { pos: new Vector3(0, 1.6, 0.6), target: new Vector3(0, 1.6, 0), fov: 30, roll: 0 },
    hero: { x: 0, z: 0, rotY: 0, walk: 0, stride: 0 },
    textSide: 0,
    plate: { a: null, b: null, mix: 0, opacity: 0 },
    fx: {
      closeUp: 1, diveApproach: 0, iris: 1, day: 0, swell: 0, watch: 0, maker: 0,
      talking: 0, wordSpread: 0, wordOpacity: 0,
    },
    redaction: 10,
  } as FrameParams,
};

export type ChapterOf = ChapterId;
