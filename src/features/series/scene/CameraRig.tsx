"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, FogExp2, PerspectiveCamera, Vector3 } from "three";
import { clamp, damp, noise1 } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { useUI } from "@/shared/state/store";
import { Damper } from "./stage/smoothDamp";

// ── Tuning ─────────────────────────────────────────────────────────────────
/** Extra smoothing time (s) on top of the director's own smoothing. */
const SMOOTH_POS = 0.09;
const SMOOTH_TARGET = 0.07;
const SMOOTH_FOV = 0.08;
const SMOOTH_ROLL = 0.1;
/** Director output jumping further than this (m) in one frame is a cut (dive): snap, don't glide. */
const CUT_DISTANCE = 1.5;

/** Shake at mood.shake = 1 and day = 1. Metres / radians. */
const SHAKE_POS = 0.085;
const SHAKE_ROLL = 0.028;
/** Octave frequencies (Hz-ish) for the two noise layers and their weights. */
const SHAKE_F1 = 6.5;
const SHAKE_F2 = 17;
const SHAKE_W1 = 0.65;
const SHAKE_W2 = 0.35;

/** Handheld breathing (very small). */
const BREATH_POS = 0.006;
const BREATH_ROLL = 0.0014;
const BREATH_HZ = 0.32;

/** Pointer parallax, max camera offset in metres. */
const PARALLAX_X = 0.06;
const PARALLAX_Y = 0.036;
const PARALLAX_RATE = 3.2;

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
 * adds shake / breathing / pointer parallax, and owns scene background + fog.
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

    // ── Motion gating (reduced motion / paused fade shake out, never pop) ─
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
      st.pos.x = st.dPx.step(st.pos.x, raw.pos.x, SMOOTH_POS, dt);
      st.pos.y = st.dPy.step(st.pos.y, raw.pos.y, SMOOTH_POS, dt);
      st.pos.z = st.dPz.step(st.pos.z, raw.pos.z, SMOOTH_POS, dt);
      st.tgt.x = st.dTx.step(st.tgt.x, raw.target.x, SMOOTH_TARGET, dt);
      st.tgt.y = st.dTy.step(st.tgt.y, raw.target.y, SMOOTH_TARGET, dt);
      st.tgt.z = st.dTz.step(st.tgt.z, raw.target.z, SMOOTH_TARGET, dt);
      st.fov = st.dFov.step(st.fov, raw.fov, SMOOTH_FOV, dt);
      st.roll = st.dRoll.step(st.roll, raw.roll, SMOOTH_ROLL, dt);
    }
    st.lastRaw.copy(raw.pos);

    // ── Shake (noise, two octaves) + breathing ──────────────────────────
    const gain = st.motionGain;
    const fx = f.fx;
    const shakeAmt = f.mood.shake * (0.25 + 0.75 * fx.day) * (1 - fx.diveApproach) * gain;
    let shX = 0, shY = 0, shZ = 0, shR = 0;
    if (shakeAmt > 0.0005) {
      const t = st.t;
      shX = (noise1(t * SHAKE_F1) * SHAKE_W1 + noise1(t * SHAKE_F2 + 40.3) * SHAKE_W2) * SHAKE_POS * shakeAmt;
      shY = (noise1(t * SHAKE_F1 + 11.7) * SHAKE_W1 + noise1(t * SHAKE_F2 + 71.9) * SHAKE_W2) * SHAKE_POS * shakeAmt;
      shZ = (noise1(t * SHAKE_F1 + 23.1) * SHAKE_W1 + noise1(t * SHAKE_F2 + 93.4) * SHAKE_W2) * SHAKE_POS * 0.5 * shakeAmt;
      shR = (noise1(t * SHAKE_F1 + 37.9) * SHAKE_W1 + noise1(t * SHAKE_F2 + 5.2) * SHAKE_W2) * SHAKE_ROLL * shakeAmt;
    }
    const bt = st.t * BREATH_HZ * Math.PI * 2;
    const breathY = Math.sin(bt) * BREATH_POS * gain;
    const breathX = Math.sin(bt * 0.63 + 1.3) * BREATH_POS * 0.6 * gain;
    const breathR = Math.sin(bt * 0.8 + 2.1) * BREATH_ROLL * gain;

    // ── Pointer parallax (not in the close-up / dive) ───────────────────
    const ptr = runtime.pointer;
    const ptrOn = ptr.active && gain > 0 ? 1 : 0;
    st.px = damp(st.px, ptr.x * ptrOn, PARALLAX_RATE, dt);
    st.py = damp(st.py, ptr.y * ptrOn, PARALLAX_RATE, dt);
    const parGain = clamp(1 - fx.closeUp) * clamp(1 - fx.diveApproach) * gain;

    // ── Apply ───────────────────────────────────────────────────────────
    cam.position.copy(st.pos);
    cam.lookAt(st.tgt);
    st.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    st.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const offX = st.px * PARALLAX_X * parGain + shX + breathX;
    const offY = st.py * PARALLAX_Y * parGain + shY + breathY;
    cam.position.addScaledVector(st.right, offX).addScaledVector(st.up, offY);
    if (shZ !== 0) {
      // push along the view axis (negative z of the camera)
      st.right.set(0, 0, 1).applyQuaternion(cam.quaternion);
      cam.position.addScaledVector(st.right, shZ);
    }
    cam.rotateZ(st.roll + shR + breathR);

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
