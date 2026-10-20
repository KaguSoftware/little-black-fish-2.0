import type { MoodId } from "./types";

/**
 * A mood is a vector of numbers so that moods can be blended smoothly when the
 * teller switches (0.9 s weight crossfade). Every system that moves reads these.
 *
 * Letter modes are one-hot weights (droop, jitter, wave, hop, settle, flinch) so a
 * blend of two moods produces a blend of both letter motions during the switch.
 */
export interface MoodParams {
  // ── Particle rings ────────────────────────────────────────────────
  /** Number of petals in the ring outline (0 = circle). Blended values are rounded per ring with a crossfade. */
  ringPetals: number;
  /** Petal amplitude as a fraction of radius. */
  ringPetalAmp: number;
  /** 0 = smooth sine petals, 1 = sharp/jagged triangle petals. */
  ringSharpness: number;
  /** Random per-dot positional noise (metres). */
  ringJitter: number;
  /** Gravity droop: the ring sags on its far side (metres). */
  ringSag: number;
  /** Dots hop vertically in a travelling wave (metres). */
  ringHop: number;
  /** Orbit speed multiplier (1 = base). */
  orbitSpeed: number;
  /** How strongly the three rings counter-twist with scroll (radians across the story). */
  twist: number;
  /** Cursor repulsion strength multiplier. */
  cursorFlee: number;

  // ── Character ─────────────────────────────────────────────────────
  /** Side-to-side body sway amplitude (radians). */
  sway: number;
  /** Sway frequency (Hz). */
  swayHz: number;
  /** Idle hop height (metres) with squash and stretch. */
  hop: number;
  /** Squash and stretch amount (0..0.3). */
  squash: number;
  /** Levitation height (metres) for floating moods. */
  float: number;
  /** Slow idle spin (radians/sec). */
  spin: number;
  /** Random head twitch strength (0..1). */
  twitch: number;
  /** Head droop (radians, positive = looking down). */
  slump: number;
  /** Walk cadence multiplier. */
  gait: number;

  // ── Camera / world ───────────────────────────────────────────────
  /** Camera shake strength (0..1). Forced to 0 under reduced motion. */
  shake: number;
  /** Ripple grid: 0 = calm tide from centre, 1 = choppy chaos. */
  gridChop: number;
  /** Ripple grid speed multiplier. */
  gridSpeed: number;
  /** Starfield drift multiplier. */
  drift: number;
  /** Fog density multiplier. */
  fog: number;

  // ── Type ─────────────────────────────────────────────────────────
  /** One-hot-ish weights of letter motion modes; blended during switches. */
  letters: LetterWeights;
  /** Redaction degradation cut for display type in calm chapters (0, 10, 35, 70, 100). */
  redaction: number;
}

export interface LetterWeights {
  droop: number;
  jitter: number;
  wave: number;
  hop: number;
  settle: number;
  flinch: number;
}

const L = (w: Partial<LetterWeights>): LetterWeights => ({
  droop: 0,
  jitter: 0,
  wave: 0,
  hop: 0,
  settle: 0,
  flinch: 0,
  ...w,
});

export const MOODS: Record<MoodId, MoodParams> = {
  /** Elder. Particles sag and drift, slow sway, letters droop. */
  bored: {
    ringPetals: 0, ringPetalAmp: 0, ringSharpness: 0, ringJitter: 0.01, ringSag: 0.22, ringHop: 0,
    orbitSpeed: 0.35, twist: 1.2, cursorFlee: 0.6,
    sway: 0.05, swayHz: 0.18, hop: 0, squash: 0, float: 0, spin: 0, twitch: 0, slump: 0.18, gait: 0.6,
    shake: 0, gridChop: 0.1, gridSpeed: 0.4, drift: 0.4, fog: 1.2,
    letters: L({ droop: 1 }), redaction: 35,
  },
  /** Snake King. Jagged rings, a coiled stillness, jaw snaps, letters fractured. */
  angry: {
    ringPetals: 7, ringPetalAmp: 0.2, ringSharpness: 1, ringJitter: 0.012, ringSag: 0, ringHop: 0,
    orbitSpeed: 0.9, twist: 2.6, cursorFlee: 1.0,
    sway: 0.02, swayHz: 0.3, hop: 0, squash: 0, float: 0, spin: 0, twitch: 0.08, slump: -0.06, gait: 1.0,
    shake: 0, gridChop: 0.55, gridSpeed: 0.8, drift: 0.8, fog: 0.9,
    letters: L({ jitter: 1 }), redaction: 70,
  },
  /** Silver One. Slow tides, floating and spinning, letters float in waves, grid ripples outward. */
  dreamy: {
    ringPetals: 3, ringPetalAmp: 0.12, ringSharpness: 0, ringJitter: 0, ringSag: 0, ringHop: 0,
    orbitSpeed: 0.55, twist: 2.4, cursorFlee: 0.8,
    sway: 0.05, swayHz: 0.1, hop: 0, squash: 0, float: 0.1, spin: 0.035, twitch: 0, slump: -0.04, gait: 0.7,
    shake: 0, gridChop: 0, gridSpeed: 0.7, drift: 0.7, fog: 1.4,
    letters: L({ wave: 1 }), redaction: 10,
  },
  /** Child. Particles lift in a light wave, the character sways openly, letters rise. */
  bouncy: {
    ringPetals: 5, ringPetalAmp: 0.08, ringSharpness: 0.2, ringJitter: 0.004, ringSag: 0, ringHop: 0.06,
    orbitSpeed: 0.8, twist: 2.0, cursorFlee: 0.8,
    sway: 0.035, swayHz: 0.35, hop: 0, squash: 0, float: 0, spin: 0, twitch: 0, slump: -0.02, gait: 1.0,
    shake: 0, gridChop: 0.25, gridSpeed: 0.8, drift: 0.8, fog: 1,
    letters: L({ hop: 1 }), redaction: 10,
  },
  /** Masked Lady. Rosette 8-petal rings, measured rotation, letters settle with ceremonial stagger. */
  ceremonial: {
    ringPetals: 8, ringPetalAmp: 0.1, ringSharpness: 0.45, ringJitter: 0, ringSag: 0, ringHop: 0,
    orbitSpeed: 0.5, twist: 1.6, cursorFlee: 0.5,
    sway: 0.015, swayHz: 0.25, hop: 0, squash: 0, float: 0, spin: 0, twitch: 0, slump: 0, gait: 0.8,
    shake: 0, gridChop: 0.05, gridSpeed: 0.5, drift: 0.5, fog: 1.1,
    letters: L({ settle: 1 }), redaction: 0,
  },
  /** Creature. Dots shy from the cursor, wary glances, letters lean away. */
  skittish: {
    ringPetals: 2, ringPetalAmp: 0.06, ringSharpness: 0.1, ringJitter: 0.008, ringSag: 0.04, ringHop: 0.02,
    orbitSpeed: 0.7, twist: 1.8, cursorFlee: 1.5,
    sway: 0.03, swayHz: 0.3, hop: 0, squash: 0, float: 0, spin: 0, twitch: 0.2, slump: 0.05, gait: 0.9,
    shake: 0, gridChop: 0.35, gridSpeed: 0.7, drift: 0.7, fog: 1,
    letters: L({ flinch: 1 }), redaction: 10,
  },
};

type NumericKeys = Exclude<keyof MoodParams, "letters">;
const NUMERIC_KEYS = Object.keys(MOODS.bored).filter((k) => k !== "letters") as NumericKeys[];
const LETTER_KEYS = Object.keys(MOODS.bored.letters) as (keyof LetterWeights)[];

/** Weighted blend of mood vectors. Weights need not sum to 1 (they are normalised). */
export function blendMoods(entries: readonly { mood: MoodParams; w: number }[]): MoodParams {
  let total = 0;
  for (const e of entries) total += e.w;
  if (total <= 0) return { ...entries[0].mood, letters: { ...entries[0].mood.letters } };
  const out = { letters: L({}) } as MoodParams;
  for (const k of NUMERIC_KEYS) (out as unknown as Record<string, number>)[k] = 0;
  for (const e of entries) {
    const w = e.w / total;
    for (const k of NUMERIC_KEYS) (out as unknown as Record<string, number>)[k] += e.mood[k] * w;
    for (const k of LETTER_KEYS) out.letters[k] += e.mood.letters[k] * w;
  }
  return out;
}
