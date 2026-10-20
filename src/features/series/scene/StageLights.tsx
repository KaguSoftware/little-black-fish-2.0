"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, Object3D, type HemisphereLight, type SpotLight } from "three";
import { damp, noise1 } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { useUI } from "@/shared/state/store";
import { LightCone } from "./stage/LightCone";
import { StageFloor } from "./stage/StageFloor";
import { stageState } from "./stage/stageState";

// ── Tuning ─────────────────────────────────────────────────────────────────
/** Lights and pools follow the hero's stage x with this rate (1/s). */
const FOLLOW_RATE = 7;

/** Key: warm-neutral, above and slightly in front of the hero. Candela (physical units). */
const KEY_COLOR = 0xffe6cc;
const KEY_POS: readonly [number, number, number] = [0.8, 6.8, 3.2];
const KEY_INTENSITY = 120;
const KEY_ANGLE = 0.4;
const KEY_PENUMBRA = 0.9;
const KEY_AIM_Y = 0.9;
/** THE DAY dims the key a little and lets it pulse slowly, like a lamp losing power. */
const KEY_DAY_DIM = 0.3;
const KEY_DAY_FLICKER = 0.16;

/** Rim: accent coloured, from behind and above. */
const RIM_POS: readonly [number, number, number] = [0, 3.4, -4.4];
const RIM_BASE = 85;
const RIM_DAY = 170;
const RIM_ANGLE = 0.62;
const RIM_PENUMBRA = 1;
const RIM_AIM_Y = 1.15;

/** Barely-there fill so the blacks stay black. */
const HEMI_INTENSITY = 0.14;
const HEMI_SKY_ACCENT = 0.55;

const tmp = new Color();

export function StageLights() {
  const key = useRef<SpotLight>(null);
  const rim = useRef<SpotLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const keyTarget = useMemo(() => new Object3D(), []);
  const rimTarget = useMemo(() => new Object3D(), []);
  const t = useRef(0);

  useEffect(() => {
    if (key.current) key.current.target = keyTarget;
    if (rim.current) rim.current.target = rimTarget;
    stageState.init = false;
  }, [keyTarget, rimTarget]);

  // Priority -20: runs before every default-priority consumer of stageState.
  useFrame((_, delta) => {
    const f = runtime.frame;
    const ui = useUI.getState();
    const dt = Math.min(delta, 0.05);
    if (!ui.paused && !ui.reducedMotion) t.current += dt;

    if (!stageState.init) {
      stageState.x = f.hero.x;
      stageState.z = f.hero.z;
      stageState.init = true;
    } else {
      stageState.x = damp(stageState.x, f.hero.x, FOLLOW_RATE, dt);
      stageState.z = damp(stageState.z, f.hero.z, FOLLOW_RATE, dt);
    }
    const hx = stageState.x;
    const hz = stageState.z;
    const day = f.fx.day;

    const k = key.current;
    if (k) {
      k.position.set(hx + KEY_POS[0], KEY_POS[1], hz + KEY_POS[2]);
      keyTarget.position.set(hx, KEY_AIM_Y, hz);
      const flicker = ui.reducedMotion ? 0 : noise1(t.current * 0.9) * 0.6 + noise1(t.current * 0.37 + 4) * 0.4;
      k.intensity = KEY_INTENSITY * (1 - KEY_DAY_DIM * day + KEY_DAY_FLICKER * day * flicker);
    }
    const r = rim.current;
    if (r) {
      r.position.set(hx * 0.9 + RIM_POS[0], RIM_POS[1], hz + RIM_POS[2]);
      rimTarget.position.set(hx, RIM_AIM_Y, hz);
      r.color.setRGB(f.accent[0], f.accent[1], f.accent[2]);
      r.intensity = RIM_BASE + RIM_DAY * day;
    }
    const h = hemi.current;
    if (h) {
      h.color.setRGB(f.accent[0], f.accent[1], f.accent[2]).multiplyScalar(HEMI_SKY_ACCENT);
      h.groundColor.copy(tmp.setRGB(f.bg[0], f.bg[1], f.bg[2]));
      h.intensity = HEMI_INTENSITY;
    }
  }, -20);

  return (
    <group>
      <hemisphereLight ref={hemi} args={[0x223344, 0x050506, HEMI_INTENSITY]} />
      <spotLight
        ref={key}
        color={KEY_COLOR}
        intensity={KEY_INTENSITY}
        angle={KEY_ANGLE}
        penumbra={KEY_PENUMBRA}
        decay={2}
        distance={0}
        position={KEY_POS as unknown as [number, number, number]}
      />
      <primitive object={keyTarget} />
      <spotLight
        ref={rim}
        color="#ffffff"
        intensity={RIM_BASE}
        angle={RIM_ANGLE}
        penumbra={RIM_PENUMBRA}
        decay={2}
        distance={0}
        position={RIM_POS as unknown as [number, number, number]}
      />
      <primitive object={rimTarget} />
      <StageFloor />
      <LightCone />
    </group>
  );
}
