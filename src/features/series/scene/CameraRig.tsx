"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, FogExp2, PerspectiveCamera, Vector3 } from "three";
import { clamp, damp, lerp, smootherstep } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { useUI } from "@/shared/state/store";
import { Damper } from "./stage/smoothDamp";

// ── Tuning ─────────────────────────────────────────────────────────────────
// The camera is a crane / dolly, never handheld: heavy smoothing, no shake, no roll noise.
/** Extra smoothing time (s) on top of the director's own smoothing. */
const SMOOTH_POS = 0.38;
const SMOOTH_TARGET = 0.3;
const SMOOTH_FOV = 0.45;
const SMOOTH_ROLL = 0.6;
/** Close-up and eye dive need the camera glued to the eyes: lighter smoothing there. */
const SMOOTH_CLOSE = 0.1;
/** Director output jumping further than this (m) in one frame is a cut (dive): snap, don't glide. */
const CUT_DISTANCE = 1.5;

/** THE DAY: tension through a slow push-in along the view axis (m), not shake. */
const DAY_PUSH = 0.42;

/** Slow crane drift, a long period so it reads as a living frame, never as a wobble. */
const DRIFT_POS = 0.014;
const DRIFT_HZ = 0.06;

/** Pointer parallax, max camera offset in metres. */
const PARALLAX_X = 0.035;
const PARALLAX_Y = 0.02;
const PARALLAX_RATE = 1.1;

/** Fade rate when motion gets switched on/off (reduced motion / pause). */
const MOTION_GAIN_RATE = 4;

/** Scene fog: density = FOG_BASE * mood.fog, fog colour = stage colour. */
const FOG_BASE = 0.045;

/**
 * Portrait screens: keep horizontal field of view from collapsing by widening the
 * vertical fov below this aspect.
 */
const PORTRAIT_ASPECT = 1.1;
const PORTRAIT_POWER = 0.5;

const MAX_DT = 1 / 20;

interface RigState {
  init: boolean;
  t: number;
  motionGain: number;
  px: number;
  py: number;
  pos: Vector3;
  tgt: Vector3;
  lastRaw: Vector3;
  fov: number;
  roll: number;
  dPx: Damper;
  dPy: Damper;
  dPz: Damper;
  dTx: Damper;
  dTy: Damper;
  dTz: Damper;
  dFov: Damper;
  dRoll: Damper;
  right: Vector3;
  up: Vector3;
}

function createState(): RigState {
  return {
    init: false,
    t: 0,
    motionGain: 1,
    px: 0,
    py: 0,
    pos: new Vector3(),
    tgt: new Vector3(),
    lastRaw: new Vector3(),
    fov: 30,
    roll: 0,
    dPx: new Damper(),
    dPy: new Damper(),
    dPz: new Damper(),
    dTx: new Damper(),
    dTy: new Damper(),
    dTz: new Damper(),
    dFov: new Damper(),
    dRoll: new Damper(),
    right: new Vector3(),
    up: new Vector3(),
  };
}

/**
 * Applies runtime.frame.camera to the default camera (after the director, priority -50),
 * adds a slow drift / THE DAY push-in / pointer parallax, and owns scene background + fog.
 */
export function CameraRig() {
  const scene = useThree((s) => s.scene);
  const st = useMemo(createState, []);
  const bg = useMemo(() => new Color(), []);
  const fog = useMemo(() => new FogExp2(0x000000, FOG_BASE), []);

  useEffect(() => {
    const prevBg = scene.background;
    const prevFog = scene.fog;
    scene.background = bg;
    scene.fog = fog;
    st.init = false; // re-snap after a remount
    return () => {
      if (scene.background === bg) scene.background = prevBg;
      if (scene.fog === fog) scene.fog = prevFog;
    };
  }, [scene, bg, fog, st]);

  useFrame((state, delta) => {
    const f = runtime.frame;
    const cam = state.camera as PerspectiveCamera;
    const ui = useUI.getState();
    const dt = Math.min(delta, MAX_DT);

    // ── Stage colour + fog ──────────────────────────────────────────────
    bg.setRGB(f.bg[0], f.bg[1], f.bg[2]);
    fog.color.setRGB(f.bg[0], f.bg[1], f.bg[2]);
    fog.density = FOG_BASE * f.mood.fog;

    // ── Motion gating (reduced motion / paused fade drift out, never pop) ─
    const calm = ui.reducedMotion || ui.paused;
    st.motionGain = damp(st.motionGain, calm ? 0 : 1, MOTION_GAIN_RATE, dt);
    if (st.motionGain < 0.001) st.motionGain = 0;
    st.t += dt;

    // ── Smooth the director's camera ────────────────────────────────────
    const raw = f.camera;
    if (!st.init || raw.pos.distanceToSquared(st.lastRaw) > CUT_DISTANCE * CUT_DISTANCE) {
      st.pos.copy(raw.pos);
      st.tgt.copy(raw.target);
      st.fov = raw.fov;
      st.roll = raw.roll;
      st.dPx.reset(); st.dPy.reset(); st.dPz.reset();
      st.dTx.reset(); st.dTy.reset(); st.dTz.reset();
      st.dFov.reset(); st.dRoll.reset();
      st.init = true;
    } else {
      const close = Math.max(f.fx.closeUp, f.fx.diveApproach);
      const sp = lerp(SMOOTH_POS, SMOOTH_CLOSE, close);
      const stg = lerp(SMOOTH_TARGET, SMOOTH_CLOSE, close);
      const sf = lerp(SMOOTH_FOV, SMOOTH_CLOSE, close);
      st.pos.x = st.dPx.step(st.pos.x, raw.pos.x, sp, dt);
      st.pos.y = st.dPy.step(st.pos.y, raw.pos.y, sp, dt);
      st.pos.z = st.dPz.step(st.pos.z, raw.pos.z, sp, dt);
      st.tgt.x = st.dTx.step(st.tgt.x, raw.target.x, stg, dt);
      st.tgt.y = st.dTy.step(st.tgt.y, raw.target.y, stg, dt);
      st.tgt.z = st.dTz.step(st.tgt.z, raw.target.z, stg, dt);
      st.fov = st.dFov.step(st.fov, raw.fov, sf, dt);
      st.roll = st.dRoll.step(st.roll, raw.roll, SMOOTH_ROLL, dt);
    }
    st.lastRaw.copy(raw.pos);

    // ── Slow drift + THE DAY push-in ────────────────────────────────────
    const gain = st.motionGain;
    const fx = f.fx;
    const still = clamp(1 - fx.closeUp) * clamp(1 - fx.diveApproach);
    const dt2 = st.t * DRIFT_HZ * Math.PI * 2;
    const driftX = Math.sin(dt2) * DRIFT_POS * gain * still;
    const driftY = Math.sin(dt2 * 0.71 + 1.3) * DRIFT_POS * 0.6 * gain * still;
    const push = smootherstep(fx.day) * DAY_PUSH * gain;

    // ── Pointer parallax (not in the close-up / dive) ───────────────────
    const ptr = runtime.pointer;
    const ptrOn = ptr.active && gain > 0 ? 1 : 0;
    st.px = damp(st.px, ptr.x * ptrOn, PARALLAX_RATE, dt);
    st.py = damp(st.py, ptr.y * ptrOn, PARALLAX_RATE, dt);
    const parGain = still * gain;

    // ── Apply ───────────────────────────────────────────────────────────
    cam.position.copy(st.pos);
    cam.lookAt(st.tgt);
    st.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    st.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const offX = st.px * PARALLAX_X * parGain + driftX;
    const offY = st.py * PARALLAX_Y * parGain + driftY;
    cam.position.addScaledVector(st.right, offX).addScaledVector(st.up, offY);
    if (push > 0) {
      // dolly in along the view axis (negative z of the camera)
      st.right.set(0, 0, -1).applyQuaternion(cam.quaternion);
      cam.position.addScaledVector(st.right, push);
    }
    cam.rotateZ(st.roll);

    // Portrait compensation, then projection only when fov actually changed.
    const aspect = state.size.width / Math.max(1, state.size.height);
    let fov = st.fov;
    if (aspect < PORTRAIT_ASPECT) {
      const k = Math.pow(PORTRAIT_ASPECT / Math.max(0.3, aspect), PORTRAIT_POWER);
      fov = 2 * Math.atan(Math.tan((fov * Math.PI) / 360) * k) * (180 / Math.PI);
    }
    if (Math.abs(cam.fov - fov) > 1e-3) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }, -50);

  return null;
}
