import type { FrameParams } from "@/shared/lib/runtime";
import type { Quality } from "@/shared/state/store";

/**
 * Shared floor-lattice math. RippleGrid (GPU) and ParticleRings (CPU, for dots that
 * settle onto lattice points in MY MAKER) must agree on exactly three things:
 *   1. where lattice vertices are        (latticeCoord / gridCount / GRID_SPACING)
 *   2. what the ripple height is there   (rippleHeight  <->  RIPPLE_GLSL)
 *   3. the ripple's running phase        (gridState, advanced once per frame)
 * Keep rippleHeight and RIPPLE_GLSL in lockstep if you edit either.
 */

// ── Tuning ──────────────────────────────────────────────────────────────────
export const GRID_SPACING = 0.22;
/** Height of the lattice plane above the floor. */
export const GRID_Y = 0.01;
/** Odd counts so a vertex sits directly under the hero. */
export const GRID_COUNT_HIGH = 71;
export const GRID_COUNT_LOW = 41;
/** Resting ripple amplitude (metres). Kept small so DOM cards stay readable over it. */
export const RIPPLE_BASE_AMP = 0.045;
/** Extra amplitude per unit of mood.ringHop / mood.ringSag / chop. */
export const RIPPLE_HOP_GAIN = 0.32;
export const RIPPLE_SAG_GAIN = 0.12;
export const RIPPLE_CHOP_GAIN = 0.035;
/** Base wave phase speed (rad/s) before mood.gridSpeed. */
export const RIPPLE_PHASE_RATE = 0.9;

export const gridCount = (q: Quality) => (q === "low" ? GRID_COUNT_LOW : GRID_COUNT_HIGH);
export const gridHalfExtent = (n: number) => ((n - 1) / 2) * GRID_SPACING;

/** Local (hero-relative) coordinate of lattice index i (0..n-1). */
export const latticeCoord = (i: number, n: number) => (i - (n - 1) / 2) * GRID_SPACING;

/** Snap a hero-relative coordinate to the nearest lattice line. */
export const snapLattice = (v: number) => Math.round(v / GRID_SPACING) * GRID_SPACING;

const GOLDEN = 2.399963229728653;
/**
 * Lattice target (hero-relative x, z) for particle index g of `total`.
 * Phyllotaxis spiral snapped to the grid, so the settled dots read as a loose
 * constellation of lattice vertices around the hero.
 */
export function latticeTarget(g: number, total: number, out: { x: number; z: number }) {
  const rho = 0.6 + 3.3 * Math.sqrt((g + 0.5) / total);
  const a = g * GOLDEN;
  out.x = snapLattice(Math.cos(a) * rho);
  out.z = snapLattice(Math.sin(a) * rho);
}

// ── Ripple state (advanced once per frame by whoever ticks first) ───────────
export const gridState = {
  phase: 0,
  chop: 0,
  amp: RIPPLE_BASE_AMP,
  lastTime: -1,
};

export function tickGrid(f: FrameParams, reduced: boolean) {
  if (f.time === gridState.lastTime) return;
  gridState.lastTime = f.time;
  const m = f.mood;
  gridState.phase += f.dt * RIPPLE_PHASE_RATE * m.gridSpeed * (reduced ? 0.45 : 1);
  gridState.chop = m.gridChop;
  gridState.amp =
    (RIPPLE_BASE_AMP + m.ringHop * RIPPLE_HOP_GAIN + m.ringSag * RIPPLE_SAG_GAIN + m.gridChop * RIPPLE_CHOP_GAIN) *
    (reduced ? 0.6 : 1);
}

/** CPU mirror of RIPPLE_GLSL `ripple()`. p is hero-relative (x, z). */
export function rippleHeight(x: number, z: number): number {
  const ph = gridState.phase;
  const r = Math.sqrt(x * x + z * z);
  const tide = Math.sin(r * 1.7 - ph) * 0.6 + Math.sin(r * 0.9 - ph * 0.55 + 1.3) * 0.4;
  const c =
    (Math.sin(x * 2.1 + ph * 1.3 + Math.sin(z * 1.3 + ph * 0.7)) * Math.sin(z * 2.4 - ph * 1.1 + x * 0.6) +
      0.5 * Math.sin((x + z) * 3.3 + ph * 2.1)) *
    0.7;
  const env = 0.35 + 0.65 * Math.exp(-r * 0.1);
  const k = gridState.chop;
  return gridState.amp * env * (tide + (c - tide) * k);
}

/** GLSL twin of rippleHeight. Returns height in metres for hero-relative p. */
export const RIPPLE_GLSL = /* glsl */ `
float ripple(vec2 p, float ph, float chop, float amp) {
  float r = length(p);
  float tide = sin(r * 1.7 - ph) * 0.6 + sin(r * 0.9 - ph * 0.55 + 1.3) * 0.4;
  float c = (sin(p.x * 2.1 + ph * 1.3 + sin(p.y * 1.3 + ph * 0.7)) * sin(p.y * 2.4 - ph * 1.1 + p.x * 0.6)
           + 0.5 * sin((p.x + p.y) * 3.3 + ph * 2.1)) * 0.7;
  float env = 0.35 + 0.65 * exp(-r * 0.1);
  return amp * env * mix(tide, c, chop);
}
`;
