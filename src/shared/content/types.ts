/**
 * Core content contracts. Everything visual is driven by data shaped like this,
 * so adding a teller means adding a config object, not code.
 */

export type TellerId =
  | "child"
  | "elder"
  | "snake-king"
  | "silver-one"
  | "masked-lady"
  | "creature";

export type ChapterId =
  | "look" // 00 LOOK CLOSER
  | "hello" // 01 HELLO
  | "world" // 02 MY WORLD
  | "day" // 03 THE DAY
  | "did" // 04 WHAT I DID
  | "others" // 05 THE OTHERS
  | "maker"; // 06 MY MAKER

export type MoodId =
  | "bored"
  | "angry"
  | "dreamy"
  | "bouncy"
  | "ceremonial"
  | "skittish";

/** OKLCH triple: lightness 0..1, chroma 0..~0.37, hue degrees. */
export type Oklch = readonly [l: number, c: number, h: number];

export type Vec3 = readonly [x: number, y: number, z: number];

/** Ids of the stills in `stills.ts` ("s01".."s27"). */
export type StillId = `s${string}`;

/**
 * How a teller sees the stage: their eye-line. These modify the base camera
 * framing of each chapter so the world literally looks different from their side.
 */
export interface Eyeline {
  /** Camera height relative to the base framing, metres (Elder looks down: +, Child looks up: -). */
  height: number;
  /** Multiplies the base camera distance. */
  distance: number;
  /** Dutch tilt in radians. */
  roll: number;
  /** Multiplies the base field of view. */
  fov: number;
  /** Extra orbit around the hero in radians (+ = camera swings to hero's left). */
  orbit: number;
  /** Where the camera aims, as a fraction of hero height (0 feet, 1 top of head). */
  aim: number;
}

export interface Framing {
  height?: number;
  distance?: number;
  roll?: number;
  fov?: number;
  orbit?: number;
  aim?: number;
}

/** A side character's mark in a teller's version of a scene. Positions are stage metres. */
export interface CastSpot {
  id: TellerId;
  /** x (left/right) and z (depth, negative = upstage/behind). */
  pos: readonly [x: number, z: number];
  /** Yaw in radians; omit to face the hero. */
  rotY?: number;
  scale?: number;
}

export interface Teller {
  id: TellerId;
  /** Placeholder display name until real content arrives, e.g. "[CHARACTER 1]". */
  name: string;
  /** Working role label shown under the name, e.g. "the Child". */
  role: string;
  mood: MoodId;
  accent: Oklch;
  /** Stage tint hue (degrees) per chapter; lightness/chroma come from the theme. */
  stageHue: Partial<Record<ChapterId, number>> & { default: number };
  /** PLACEHOLDER narration, one line per chapter, in their voice. Empty string = no line. */
  narration: Record<ChapterId, string>;
  /** Close-up expression set (used by the GLB adapter and as a hint for puppets). */
  eyes: "bored" | "angry";
  eyeline: Eyeline;
  /** Optional per-chapter framing overrides layered on top of eyeline. */
  framing?: Partial<Record<ChapterId, Framing>>;
  /** Optional per-chapter cast overrides; otherwise `defaultCast` places the others. */
  cast?: Partial<Record<ChapterId, CastSpot[]>>;
  /** Backdrop plate per chapter (only world/day/did/others are shown). */
  plates: Partial<Record<ChapterId, StillId>>;
  /** Portrait still + focal point for THE OTHERS / switcher chips (object-position %). */
  portrait: { still: StillId; focus: readonly [x: number, y: number] };
  /** Optional GLB that replaces the procedural puppet (mapped by glbAdapter). */
  model?: string;
  /** Reserved for future voice-over. */
  voice?: string;
}
