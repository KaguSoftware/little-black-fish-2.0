import { TELLERS } from "@/shared/content/characters";
import { mixLab, oklabCss, oklabToLinear, oklchToOklab } from "@/shared/lib/color";
import type { Lab, RGB } from "@/shared/lib/color";
import { clamp, lerp, noise1, smoothstep } from "@/shared/lib/math";

/**
 * The lantern: one mutable object that the hero's DOM driver advances every frame and
 * that the WebGL wall, the wordmark mask and the little black fish all read.
 * Never React state. Coordinates are hero-local CSS pixels (origin top-left).
 */

const LABS: Lab[] = TELLERS.map((t) => oklchToOklab(t.accent));
/** Seconds the light rests on one teller's colour before sliding to the next. */
const COLOUR_PERIOD = 8;

export const lantern = {
  /** Hero size in CSS px. */
  w: 1,
  h: 1,
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  /** Radius of the lit disc in CSS px (already includes breathing, flicker, scroll fade). */
  radius: 240,
  /** 0..1 how far the idle wander has taken over from the cursor. */
  wander: 1,
  /**
   * The visitor is carrying the light: a cursor over the hero, or a held thumb. Only then
   * does the wall lift the plate under it to the front. A tap or the idle wander never does.
   */
  engaged: false,
  /** 0..1 eased "held": a thumb pressing on the hero swells the light. */
  hold: 0,
  /** Ambient clock (seconds); frozen while motion is paused. */
  t: 0,
  /** 0..1 scroll fade (1 at rest, 0 once the hero has left). */
  fade: 1,
  /** Linear-light RGB of the current light colour. */
  rgb: [0.3, 0.5, 0.6] as RGB,
  /** CSS colour of the current light colour. */
  css: "oklab(0.7 -0.087 -0.05)",
  /** Index of the teller whose colour the light is closest to. */
  tellerIndex: 0,
  initialised: false,
  frameCount: 0,
};

export interface LanternTickInput {
  dt: number;
  /** Pointer in hero-local px. */
  px: number;
  py: number;
  /** Pointer is over the page and moved recently. */
  pointerLive: boolean;
  /** ms since the pointer last moved. */
  idleMs: number;
  /** The pointer is a mouse or pen (not a finger). */
  fine: boolean;
  /** A finger is pressing and holding the hero (touch only). */
  held: boolean;
  paused: boolean;
  reduced: boolean;
  fade: number;
}

const tmpLab: Lab = [0, 0, 0];
const entriesA = { lab: LABS[0], w: 1 };
const entriesB = { lab: LABS[1], w: 0 };
const pair = [entriesA, entriesB];

export function sizeLantern(w: number, h: number) {
  lantern.w = w;
  lantern.h = h;
  if (!lantern.initialised) {
    lantern.x = w * 0.62;
    lantern.y = h * 0.4;
    lantern.initialised = true;
  }
}

/** Slow Lissajous path the light walks when nobody is holding it. */
function wanderAt(t: number, out: { x: number; y: number }) {
  const { w, h } = lantern;
  const ax = w * 0.34;
  const ay = h * 0.27;
  out.x = w * 0.5 + ax * Math.sin(0.19 * t + 0.6) + ax * 0.38 * Math.sin(0.47 * t + 2.1);
  out.y = h * 0.44 + ay * Math.sin(0.27 * t) + ay * 0.25 * Math.sin(0.61 * t + 1.3);
}

const wp = { x: 0, y: 0 };

export function tickLantern(i: LanternTickInput) {
  const dt = Math.min(i.dt, 0.05);
  const L = lantern;
  if (!i.paused) L.t += dt;
  const t = L.t;
  const minDim = Math.min(L.w, L.h);

  // ── who holds the light ──
  // A held thumb keeps the light even when it stops moving.
  const wantsWander = !i.reduced && !i.held && (!i.pointerLive || i.idleMs > 2000);
  const targetW = wantsWander ? 1 : 0;
  // Slow hand-over to the wander path, quick grab back when the cursor returns.
  const kW = targetW > L.wander ? 0.7 : 5;
  L.wander += (targetW - L.wander) * (1 - Math.exp(-kW * dt));
  wanderAt(t, wp);
  const over = i.px >= 0 && i.py >= 0 && i.px <= L.w && i.py <= L.h;
  L.engaged = i.fade > 0.3 && (i.held || (i.fine && i.pointerLive && i.idleMs <= 2000 && over));

  let tx: number;
  let ty: number;
  if (i.reduced && !i.pointerLive) {
    tx = L.w * 0.6;
    ty = L.h * 0.42;
  } else {
    const hasPointer = i.pointerLive;
    const bx = hasPointer ? i.px : wp.x;
    const by = hasPointer ? i.py : wp.y;
    tx = lerp(bx, wp.x, L.wander);
    ty = lerp(by, wp.y, L.wander);
  }

  // ── a lantern swings on its pole: slightly underdamped spring ──
  const k = i.reduced ? 70 : 34;
  const c = i.reduced ? 16.7 : 6.6;
  const steps = 2;
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    L.vx += ((tx - L.x) * k - L.vx * c) * sdt;
    L.vy += ((ty - L.y) * k - L.vy * c) * sdt;
    L.x += L.vx * sdt;
    L.y += L.vy * sdt;
  }

  // ── radius: breathing + candle flicker ──
  const live = !i.paused && !i.reduced;
  const breathe = live ? Math.sin(t * 0.8) * 0.035 : 0;
  const flicker = live ? noise1(t * 9.5) * 0.022 + noise1(t * 23 + 4) * 0.01 : 0;
  // Held: swells quickly under the thumb, settles back slowly once it lets go.
  const kH = i.held ? 6 : 2.2;
  L.hold += ((i.held ? 1 : 0) - L.hold) * (1 - Math.exp(-kH * dt));
  L.fade = i.fade;
  L.radius = Math.max(
    0.0001,
    minDim * 0.34 * (1 + 0.5 * L.hold) * (1 + breathe + flicker) * clamp(i.fade, 0, 1),
  );

  // ── colour walks the six teller accents ──
  if (i.reduced) {
    L.tellerIndex = 0;
    tmpLab[0] = LABS[0][0];
    tmpLab[1] = LABS[0][1];
    tmpLab[2] = LABS[0][2];
  } else {
    const n = LABS.length;
    const raw = Number.isFinite(t) ? t / COLOUR_PERIOD : 0;
    const phase = ((raw % n) + n) % n;
    const a = Math.floor(phase) % n;
    const b = (a + 1) % n;
    const f = smoothstep(0.55, 1, phase - Math.floor(phase));
    entriesA.lab = LABS[a];
    entriesA.w = 1 - f;
    entriesB.lab = LABS[b];
    entriesB.w = f;
    const m = mixLab(pair);
    tmpLab[0] = m[0];
    tmpLab[1] = m[1];
    tmpLab[2] = m[2];
    L.tellerIndex = f > 0.5 ? b : a;
  }
  const rgb = oklabToLinear(tmpLab);
  L.rgb[0] = rgb[0];
  L.rgb[1] = rgb[1];
  L.rgb[2] = rgb[2];
  L.frameCount++;
  if (L.frameCount % 3 === 0) L.css = oklabCss(tmpLab);
}

