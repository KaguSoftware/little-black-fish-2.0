import { Vector3 } from "three";
import type { ChapterId, StillId, Teller, TellerId } from "../content/types";
import { CHAPTER_BY_ID, TYPE_WINDOW, resolveProgress } from "../content/chapters";
import { TELLERS, TELLER_BY_ID, TELLER_IDS } from "../content/characters";
import { MOODS, blendMoods } from "../content/moods";
import { mixLab, oklabCss, oklabToLinear, oklchToOklab, stageOklch, type Lab } from "./color";
import {
  TAU, bell, clamp, easeInCubic, easeInOutCubic, easeOutQuint, lerp, smootherstep, smoothstep,
} from "./math";
import { runtime, type FrameParams } from "./runtime";

/**
 * The director: turns (progress, teller weights, time) into one FrameParams that
 * every visual reads. Pure-ish (writes into runtime.frame to avoid allocations).
 *
 * Switching teller never resets the story position: we only change per-teller
 * weights, which approach their targets exponentially (~0.9 s to settle). Every
 * blended quantity is a weighted mean of each teller's own evaluation, so any
 * interruption mid-blend stays continuous.
 */

/** Stage x for each chapter's hold mark. */
export const HERO_X = 1.15;
/** Nominal puppet height in metres (puppets are built to this). */
export const HERO_H = 1.8;
/** Blend rate: exp(-K * 0.9s) ≈ 0.01 → settled in ~0.9 s. */
const BLEND_K = 5.1;
/** Dive: fraction of the dive segment spent approaching the eye (the rest is the iris opening). */
export const DIVE_SPLIT = 0.55;

interface Base {
  distance: number;
  height: number;
  fov: number;
  /** Orbit toward the open side of the stage (multiplied by chapter side). */
  orbit: number;
}

const BASE: Record<Exclude<ChapterId, "look">, Base> = {
  hello: { distance: 4.4, height: 1.25, fov: 38, orbit: 0 },
  world: { distance: 5.4, height: 1.35, fov: 42, orbit: 0.16 },
  day: { distance: 4.1, height: 1.05, fov: 46, orbit: 0.1 },
  did: { distance: 4.9, height: 1.45, fov: 40, orbit: 0.2 },
  others: { distance: 5.8, height: 1.5, fov: 40, orbit: 0.12 },
  maker: { distance: 7.5, height: 3.4, fov: 44, orbit: 0 },
};

export const heroXFor = (c: ChapterId) => CHAPTER_BY_ID[c].side * HERO_X;

const plateVisibility: Record<ChapterId, number> = {
  look: 0, hello: 0, world: 1, day: 1, did: 1, others: 0.35, maker: 0,
};

const _v = new Vector3();
const _eyesMid = new Vector3();

interface Cam {
  pos: Vector3;
  target: Vector3;
  fov: number;
  roll: number;
}

function framing(t: Teller, chapter: ChapterId, heroX: number, out: Cam): Cam {
  const eye = t.eyeline;
  const ov = t.framing?.[chapter] ?? {};
  if (chapter === "look") {
    // Extreme close-up: the eyes fill the screen.
    _eyesMid.copy(runtime.hero.eyeL).add(runtime.hero.eyeR).multiplyScalar(0.5);
    _eyesMid.x += heroX - runtime.frame.hero.x; // anchors follow the hero; correct if hero moved
    out.target.copy(_eyesMid);
    out.pos.set(_eyesMid.x, _eyesMid.y + eye.height * 0.05, _eyesMid.z + 0.55 * eye.distance);
    out.fov = 26;
    out.roll = eye.roll * 0.5;
    return out;
  }
  const b = BASE[chapter];
  const side = CHAPTER_BY_ID[chapter].side;
  const d = b.distance * eye.distance * (ov.distance ?? 1);
  const h = Math.max(0.15, b.height + eye.height + (ov.height ?? 0));
  const orbit = (ov.orbit ?? b.orbit * side + eye.orbit);
  const aimY = HERO_H * (ov.aim ?? eye.aim) * (chapter === "maker" ? 0.3 : 1);
  out.target.set(heroX * 0.42, aimY, 0);
  out.pos.set(out.target.x + Math.sin(orbit) * d, h, Math.cos(orbit) * d);
  out.fov = b.fov * eye.fov * (ov.fov ?? 1);
  out.roll = eye.roll + (ov.roll ?? 0);
  return out;
}

const camA: Cam = { pos: new Vector3(), target: new Vector3(), fov: 40, roll: 0 };
const camB: Cam = { pos: new Vector3(), target: new Vector3(), fov: 40, roll: 0 };
const camAcc: Cam = { pos: new Vector3(), target: new Vector3(), fov: 0, roll: 0 };

export interface DirectorInput {
  dt: number;
  time: number;
  target: TellerId;
  hover: TellerId | null;
  reducedMotion: boolean;
  /** Low quality tier uses the simpler dive (crossfade to black, then iris). */
  lowTier: boolean;
}

export function computeFrame(input: DirectorInput): FrameParams {
  const f = runtime.frame;
  const { dt, time, target } = input;
  f.time = time;
  f.dt = dt;
  f.progress = runtime.progress;
  f.teller = target;

  // ── Teller weights ───────────────────────────────────────────────────────
  const k = 1 - Math.exp(-BLEND_K * dt);
  let wsum = 0;
  let wmax = 0;
  for (const id of TELLER_IDS) {
    const goal = id === target ? 1 : 0;
    let w = f.weights[id] + (goal - f.weights[id]) * k;
    if (w < 1e-4) w = 0;
    if (w > 0.9999) w = 1;
    f.weights[id] = w;
    wsum += w;
    if (w > wmax) wmax = w;
  }
  f.settled = wmax / (wsum || 1);
  const active = TELLERS.filter((t) => f.weights[t.id] > 0);

  // ── Story position ───────────────────────────────────────────────────────
  const r = resolveProgress(f.progress);
  f.r = r;
  const seg = r.segment;
  const s = r.segT;

  // ── Hero mark & walk ─────────────────────────────────────────────────────
  const prevX = f.hero.x;
  if (seg.kind === "walk") {
    const xa = heroXFor(seg.from!);
    const xb = heroXFor(seg.chapter);
    const e = smootherstep(s);
    f.hero.x = lerp(xa, xb, e);
    const dir = Math.sign(xb - xa) || 1;
    f.hero.rotY = TAU * easeInOutCubic(s) * dir;
    f.hero.walk = bell(s, 0.5);
    f.hero.stride = Math.abs(xb - xa) * e + s * 1.2;
  } else if (seg.kind === "dive") {
    f.hero.x = s < DIVE_SPLIT ? heroXFor("hello") : heroXFor("world");
    f.hero.rotY = 0;
    f.hero.walk = 0;
  } else {
    f.hero.x = heroXFor(r.chapter);
    f.hero.rotY = 0;
    f.hero.walk = 0;
  }
  f.hero.z = 0;
  if (Math.abs(f.hero.x - prevX) > 0.5) {
    // A cut (dive): keep anchors in sync so the close-up framing doesn't drift.
    runtime.hero.eyeL.x += f.hero.x - prevX;
    runtime.hero.eyeR.x += f.hero.x - prevX;
  }
  const destSide = CHAPTER_BY_ID[r.chapter].side;
  f.textSide = (destSide === 0 ? 0 : -destSide) as -1 | 0 | 1;

  // ── Camera: weighted over tellers, interpolated over transitions ─────────
  camAcc.pos.set(0, 0, 0);
  camAcc.target.set(0, 0, 0);
  camAcc.fov = 0;
  camAcc.roll = 0;
  for (const t of active) {
    const w = f.weights[t.id] / wsum;
    if (seg.kind === "hold") {
      framing(t, r.chapter, f.hero.x, camA);
    } else if (seg.kind === "pullback" || seg.kind === "walk") {
      framing(t, seg.from!, seg.kind === "walk" ? f.hero.x : heroXFor(seg.from!), camA);
      framing(t, seg.chapter, seg.kind === "walk" ? f.hero.x : heroXFor(seg.chapter), camB);
      const e = seg.kind === "pullback" ? easeInOutCubic(s) : smootherstep(s);
      camA.pos.lerp(camB.pos, e);
      camA.target.lerp(camB.target, e);
      camA.fov = lerp(camA.fov, camB.fov, e);
      camA.roll = lerp(camA.roll, camB.roll, e);
    } else {
      // dive
      if (s < DIVE_SPLIT && !input.reducedMotion && !input.lowTier) {
        framing(t, "hello", heroXFor("hello"), camA);
        const a = easeInCubic(s / DIVE_SPLIT);
        _v.copy(runtime.hero.eyeL);
        camA.target.lerp(_v, Math.min(1, a * 1.4));
        _v.z += 0.035; // stop just in front of the pupil
        camA.pos.lerp(_v, a);
        camA.fov = lerp(camA.fov, 14, a);
        camA.roll = lerp(camA.roll, 0, a);
      } else if (s < DIVE_SPLIT) {
        framing(t, "hello", heroXFor("hello"), camA);
      } else {
        framing(t, "world", heroXFor("world"), camA);
        // A slow settle as the iris opens.
        const o = 1 - easeOutQuint((s - DIVE_SPLIT) / (1 - DIVE_SPLIT));
        camA.pos.z += o * 0.8;
      }
    }
    camAcc.pos.addScaledVector(camA.pos, w);
    camAcc.target.addScaledVector(camA.target, w);
    camAcc.fov += camA.fov * w;
    camAcc.roll += camA.roll * w;
  }
  f.camera.pos.copy(camAcc.pos);
  f.camera.target.copy(camAcc.target);
  f.camera.fov = camAcc.fov;
  f.camera.roll = camAcc.roll;

  // ── Mood & colour ────────────────────────────────────────────────────────
  f.mood = blendMoods(active.map((t) => ({ mood: MOODS[t.mood], w: f.weights[t.id] })));
  const hoverW = input.hover && input.hover !== target && r.chapter === "others" ? 0.28 : 0;
  const accEntries: { lab: Lab; w: number }[] = active.map((t) => ({
    lab: oklchToOklab(t.accent),
    w: f.weights[t.id] * (1 - hoverW),
  }));
  if (hoverW > 0) accEntries.push({ lab: oklchToOklab(TELLER_BY_ID[input.hover!].accent), w: hoverW });
  f.accentLab = mixLab(accEntries);
  f.accent = oklabToLinear(f.accentLab);
  f.accentCss = oklabCss(f.accentLab);

  const bgLab = mixLab(
    active.map((t) => {
      const hue = t.stageHue[r.chapter] ?? t.stageHue.default;
      return { lab: oklchToOklab(stageOklch(hue)), w: f.weights[t.id] };
    }),
  );
  f.bg = oklabToLinear(bgLab);
  f.bgCss = oklabCss(bgLab);

  // ── Plates ───────────────────────────────────────────────────────────────
  const dominant = target;
  const plateOf = (id: TellerId, c: ChapterId): StillId | null => TELLER_BY_ID[id].plates[c] ?? null;
  if (f.settled < 0.995) {
    let second: TellerId = dominant;
    let sw = -1;
    for (const t of active) if (t.id !== dominant && f.weights[t.id] > sw) { sw = f.weights[t.id]; second = t.id; }
    f.plate.a = plateOf(second, r.chapter);
    f.plate.b = plateOf(dominant, r.chapter);
    f.plate.mix = f.weights[dominant] / wsum;
    f.plate.opacity = plateVisibility[r.chapter] * (seg.kind === "hold" ? 1 : seg.kind === "walk" ? 1 : s >= DIVE_SPLIT ? 1 : 0);
  } else if (seg.kind === "walk") {
    f.plate.a = plateOf(dominant, seg.from!);
    f.plate.b = plateOf(dominant, seg.chapter);
    f.plate.mix = smootherstep(s);
    f.plate.opacity = lerp(plateVisibility[seg.from!], plateVisibility[seg.chapter], smootherstep(s));
  } else {
    f.plate.a = plateOf(dominant, r.chapter);
    f.plate.b = f.plate.a;
    f.plate.mix = 1;
    f.plate.opacity =
      seg.kind === "dive" ? (s >= DIVE_SPLIT ? plateVisibility.world : 0) : plateVisibility[r.chapter] * smoothstep(0, 0.12, r.holdT || 1);
  }

  // ── Effect envelopes ─────────────────────────────────────────────────────
  const fx = f.fx;
  const hold = seg.kind === "hold";
  fx.closeUp = r.chapter === "look" ? 1 : seg.kind === "pullback" ? 1 - easeInOutCubic(s) : 0;

  if (seg.kind === "dive") {
    if (s < DIVE_SPLIT) {
      fx.diveApproach = input.reducedMotion || input.lowTier ? 0 : easeInCubic(s / DIVE_SPLIT);
      fx.iris = 1 - smoothstep(0.72, 1, s / DIVE_SPLIT);
    } else {
      fx.diveApproach = 0;
      fx.iris = easeOutQuint((s - DIVE_SPLIT) / (1 - DIVE_SPLIT));
    }
  } else {
    fx.diveApproach = 0;
    fx.iris = 1;
  }

  fx.day =
    hold && r.chapter === "day"
      ? smoothstep(0.0, 0.22, r.holdT) * (1 - smoothstep(0.82, 1, r.holdT))
      : seg.kind === "walk" && seg.chapter === "day"
        ? 0.15 * s
        : seg.kind === "walk" && seg.from === "day"
          ? 0.15 * (1 - s)
          : 0;
  fx.swell =
    hold && r.chapter === "did"
      ? smoothstep(0.05, 0.5, r.holdT)
      : seg.kind === "walk" && seg.from === "did"
        ? 1 - smootherstep(s)
        : 0;
  fx.watch = hold && r.chapter === "did" ? smoothstep(0.5, 0.6, r.holdT) * (1 - smoothstep(0.94, 1, r.holdT)) : 0;
  fx.maker =
    r.chapter === "maker"
      ? seg.kind === "walk" ? 0.55 * smootherstep(s) : 0.55 + 0.45 * smoothstep(0, 0.25, r.holdT)
      : 0;
  const line = TELLER_BY_ID[target].narration[r.chapter];
  fx.talking = hold && line && r.holdT > TYPE_WINDOW.start && r.holdT < TYPE_WINDOW.end ? 1 : 0;
  fx.wordSpread = hold ? r.holdT : seg.kind === "walk" ? 0 : 0;
  fx.wordOpacity = hold ? bell(r.holdT, 0.45) : 0;

  f.redaction = lerp(f.mood.redaction, 100, fx.day);

  return f;
}

export const clampProgress = clamp;
