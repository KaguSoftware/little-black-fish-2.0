"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  ShaderMaterial,
  SpotLight,
  PointLight,
  Vector3,
} from "three";
import { MOODS } from "@/shared/content/moods";
import type { Oklch } from "@/shared/content/types";
import { AdaptiveDpr } from "@/shared/lib/AdaptiveDpr";
import { oklchToLinear } from "@/shared/lib/color";
import { clamp, damp, noise1, smoothstep, TAU } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { usePuppetRig } from "@/shared/puppets/rig/usePuppetRig";
import type { Puppet, RigInputs } from "@/shared/puppets/types";
import { useUI } from "@/shared/state/store";

export interface PupilPoint {
  x: number;
  y: number;
  valid: boolean;
}

const RING_TILT = 1.02;
const RING_ROLL = -0.34;
/** How much of the section's height the standing figure fills (feet to crown). */
const FIGURE_FRAC = 0.54;
/** Fraction of the figure's width allowed on a narrow (portrait) screen. */
const FIGURE_WIDTH = 0.7;
/** The figure sits a little below centre so the title keeps clear of the head. */
const FIGURE_DROP = 0.03;

const DOT_VERT = /* glsl */ `
  attribute vec3 aColor;
  uniform float uSize;
  uniform float uPx;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * uPx / max(-mv.z, 0.05);
    gl_Position = projectionMatrix * mv;
  }
`;
const DOT_FRAG = /* glsl */ `
  precision highp float;
  uniform float uGain;
  varying vec3 vColor;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.32, r);
    float halo = pow(1.0 - smoothstep(0.0, 1.0, r), 2.4);
    vec3 c = vColor * (halo * 0.9 + core * 1.8) * uGain;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

interface RigProps {
  puppet: Puppet;
  revealed: boolean;
  engaged: { current: boolean };
  /** Viewport px of the left pupil, every frame. */
  onPupil: (x: number, y: number) => void;
  onUsable: (ok: boolean) => void;
  /** Rim light / puppet accent (the eyes teller's accent). */
  accent: Oklch;
  /** One orbiting dot per visible voice, in roster order. Never empty. */
  ring: readonly Oklch[];
}

interface RigState {
  usable: boolean | null;
  cx: number; cy: number; cz: number; camD: number;
  gx: number; gy: number; surprise: number; reveal: number; delay: number; started: boolean; ang: number;
}

interface RigObjects {
  spot: SpotLight;
  rim: PointLight;
  dots: Points;
}

interface RigLive {
  revealed: boolean;
  engaged: { current: boolean };
  onPupil: (x: number, y: number) => void;
  onUsable: (ok: boolean) => void;
}

function makeInputs(accent: readonly [number, number, number]): RigInputs {
  return {
    x: 0, z: 0, rotY: 0, walk: 0, stride: 0,
    lookAt: new Vector3(0, 1.4, 3),
    pupils: { x: 0, y: 0 },
    surprise: 0, anger: 0, talking: 0, wave: 0,
    mood: MOODS.ceremonial,
    hero: true,
    frozen: false,
    quality: "high",
    accent: [accent[0], accent[1], accent[2]],
  };
}

function makeRigObjects(accent: readonly [number, number, number], ring: readonly Oklch[]): RigObjects {
  const ACCENT = accent;
  const spot = new SpotLight(new Color(1.0, 0.92, 0.8), 0, 0, 0.3, 1, 2);
  const rim = new PointLight(new Color(ACCENT[0], ACCENT[1], ACCENT[2]), 0, 0, 2);
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(ring.length * 3), 3));
  const col = new Float32Array(ring.length * 3);
  ring.forEach((a, i) => {
    const c = oklchToLinear([Math.min(0.86, a[0] + 0.12), a[1], a[2]]);
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
  });
  g.setAttribute("aColor", new BufferAttribute(col, 3));
  const m = new ShaderMaterial({
    vertexShader: DOT_VERT,
    fragmentShader: DOT_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: { uSize: { value: 0.1 }, uPx: { value: 1000 }, uGain: { value: 0 } },
  });
  const dots = new Points(g, m);
  dots.frustumCulled = false;
  return { spot, rim, dots };
}

const vL = new Vector3();
const vR = new Vector3();
const vC = new Vector3();
const vP = new Vector3();
const vE = new Vector3();

function stepRig(
  cam: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  size: { width: number; height: number },
  dpr: number,
  time: number,
  dt: number,
  puppet: Puppet,
  objs: RigObjects,
  st: RigState,
  inputs: RigInputs,
  L: RigLive,
) {
  const { spot, rim, dots } = objs;
  const S = st;
  const ui = useUI.getState();

  puppet.object.updateWorldMatrix(true, true);
  puppet.rig.eyeAnchorL.getWorldPosition(vL);
  puppet.rig.eyeAnchorR.getWorldPosition(vR);
  const eyeDist = vL.distanceTo(vR);
  const ok = eyeDist > 0.004 && Number.isFinite(eyeDist);
  if (S.usable !== ok) {
    S.usable = ok;
    L.onUsable(ok);
  }
  if (!ok) return;

  vC.copy(vL).add(vR).multiplyScalar(0.5);
  const aspect = size.width / size.height;
  const tanHalf = Math.tan((cam.fov * Math.PI) / 360);
  // Frame the whole standing figure: tall enough for FIGURE_FRAC of the height, and never wider
  // than FIGURE_WIDTH of a narrow screen.
  const h = puppet.height;
  const camD = Math.max(h / FIGURE_FRAC / (2 * tanHalf), (h * 0.5) / FIGURE_WIDTH / (aspect * 2 * tanHalf));
  const viewH = 2 * camD * tanHalf;
  const targetY = h * 0.5 + FIGURE_DROP * viewH;
  if (!S.started) {
    S.cx = vC.x;
    S.cy = targetY;
    S.cz = vC.z;
    S.camD = camD;
    S.started = true;
  } else {
    S.cx = damp(S.cx, vC.x, 4, dt);
    S.cy = damp(S.cy, targetY, 4, dt);
    S.cz = damp(S.cz, vC.z, 4, dt);
    S.camD = damp(S.camD, camD, 4, dt);
  }
  const breathe = ui.reducedMotion || ui.paused ? 0 : Math.sin(time * 0.31) * 0.012;
  const d = S.camD * (1 + breathe);
  cam.position.set(S.cx, S.cy, S.cz + d);
  cam.lookAt(S.cx, S.cy, S.cz);
  cam.updateMatrixWorld();

  // ── cursor / idle gaze ──
  const rect = canvas.getBoundingClientRect();
  const p = runtime.pointer;
  const nx = rect.width > 0 ? ((p.px - rect.left) / rect.width) * 2 - 1 : 0;
  const ny = rect.height > 0 ? -(((p.py - rect.top) / rect.height) * 2 - 1) : 0;
  const live = p.active && p.lastMove > 0 && performance.now() - p.lastMove < 4500;
  vE.copy(vC).project(cam);
  const dx = nx - vE.x;
  const dy = ny - vE.y;
  let tx: number;
  let ty: number;
  if (live) {
    tx = clamp(dx * 1.7, -1, 1);
    ty = clamp(dy * 2.0, -1, 1);
  } else if (ui.reducedMotion || ui.paused) {
    tx = 0;
    ty = 0;
  } else {
    // The eyes look around on their own: slow drifts with the odd quick glance.
    tx = noise1(time * 0.33) * 0.8 + (noise1(Math.floor(time * 0.5) * 7.3) > 0.55 ? 0.3 : 0);
    ty = noise1(time * 0.27 + 11) * 0.5;
  }
  S.gx = damp(S.gx, tx, live ? 12 : 3.5, dt);
  S.gy = damp(S.gy, ty, live ? 12 : 3.5, dt);
  const near = Math.hypot(dx * aspect, dy);
  const sTarget = L.engaged.current ? 1 : live ? 1 - smoothstep(0.32, 0.9, near) : 0;
  S.surprise = damp(S.surprise, sTarget, 5, dt);

  const inp = inputs;
  inp.pupils.x = S.gx;
  inp.pupils.y = S.gy;
  inp.surprise = S.surprise;
  inp.frozen = ui.paused;
  inp.quality = ui.quality;
  // The head's look target scales with the eyes, so the turn feels the same as it did in the close-up.
  const dEye = eyeDist / 0.3 / aspect / (2 * tanHalf);
  inp.lookAt!.set(vC.x + S.gx * dEye * 0.55, vC.y + S.gy * dEye * 0.38, vC.z + dEye);

  // ── where the left pupil is on screen (for the iris) ──
  (puppet.rig.pupilL ?? puppet.rig.eyeAnchorL).getWorldPosition(vP);
  vP.project(cam);
  if (rect.width > 0) {
    L.onPupil(rect.left + (vP.x * 0.5 + 0.5) * rect.width, rect.top + (-vP.y * 0.5 + 0.5) * rect.height);
  }

  // ── light fades up in the dark ──
  if (L.revealed) {
    S.delay += dt;
    if (S.delay > 0.35) S.reveal = damp(S.reveal, 1, 1.1, dt);
  }
  const rv = S.reveal * S.reveal;
  const lightDist = d * 1.08;
  const midY = h * 0.5;
  spot.position.set(S.cx, midY + d * 0.42, S.cz + d * 0.98);
  spot.target.position.set(S.cx, midY, S.cz);
  spot.target.updateMatrixWorld();
  spot.angle = clamp(Math.atan((h * 0.62) / lightDist), 0.1, 0.8);
  spot.penumbra = 1;
  spot.intensity = 7 * lightDist * lightDist * rv;
  rim.position.set(S.cx + h * 0.45, midY + h * 0.2, S.cz + h * 0.5);
  rim.intensity = 6 * h * 0.4 * h * 0.4 * rv;

  // ── six accent dots orbit in a slow tilted ring ──
  const R = eyeDist * 1.08;
  const speed = ui.reducedMotion || ui.paused ? 0 : 0.2 + S.surprise * 0.18;
  const posAttr = dots.geometry.getAttribute("position") as BufferAttribute;
  const n = Math.max(1, posAttr.count);
  S.ang += dt * speed;
  const ang0 = S.ang;
  const cT = Math.cos(RING_TILT);
  const sT = Math.sin(RING_TILT);
  const cR = Math.cos(RING_ROLL);
  const sR = Math.sin(RING_ROLL);
  for (let i = 0; i < n; i++) {
    const a = ang0 + (i * TAU) / n;
    const lx = Math.cos(a);
    const ly = Math.sin(a) * cT;
    const lz = Math.sin(a) * sT;
    posAttr.setXYZ(i, vC.x + (lx * cR - ly * sR) * R, vC.y + (lx * sR + ly * cR) * R * 0.92, vC.z + lz * R * 0.9 + eyeDist * 0.06);
  }
  posAttr.needsUpdate = true;
  const mat = dots.material as ShaderMaterial;
  mat.uniforms.uSize.value = eyeDist * 0.09;
  mat.uniforms.uPx.value = (size.height * dpr) / (2 * tanHalf);
  mat.uniforms.uGain.value = rv;
}

function Rig({ puppet, revealed, engaged, onPupil, onUsable, accent, ring }: RigProps) {
  const accentLin = useMemo(() => oklchToLinear(accent), [accent]);
  const inputs = useRef<RigInputs>(makeInputs(accentLin));
  inputs.current.accent = accentLin;
  const st = useRef<RigState>({
    usable: null,
    cx: 0, cy: 0, cz: 0, camD: 1,
    gx: 0, gy: 0, surprise: 0, reveal: 0, delay: 0, started: false, ang: 0.6,
  });
  const live = useRef<RigLive>({ revealed, engaged, onPupil, onUsable });
  const objs = useMemo(() => makeRigObjects(accentLin, ring), [accentLin, ring]);
  usePuppetRig(puppet, () => inputs.current);

  useEffect(() => {
    live.current = { revealed, engaged, onPupil, onUsable };
    if (!revealed) {
      st.current.reveal = 0;
      st.current.delay = 0;
    }
  }, [revealed, engaged, onPupil, onUsable]);

  useEffect(
    () => () => {
      objs.dots.geometry.dispose();
      (objs.dots.material as ShaderMaterial).dispose();
      objs.spot.dispose();
    },
    [objs],
  );

  useFrame((state, dt) => {
    stepRig(state.camera as PerspectiveCamera, state.gl.domElement, state.size, state.viewport.dpr, state.clock.elapsedTime, dt, puppet, objs, st.current, inputs.current, live.current);
  });

  return (
    <>
      <hemisphereLight args={[new Color(0.5, 0.58, 0.7), new Color(0.05, 0.04, 0.04), 0.05]} />
      <primitive object={objs.spot} />
      <primitive object={objs.spot.target} />
      <primitive object={objs.rim} />
      <primitive object={puppet.object} />
      <primitive object={objs.dots} />
    </>
  );
}

export interface EyesSceneProps extends RigProps {
  active: boolean;
  highTier: boolean;
}

export default function EyesScene({ active, highTier, ...rig }: EyesSceneProps) {
  return (
    <Canvas
      dpr={[1, highTier ? 1.5 : 1.25]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: 22, near: 0.02, far: 60, position: [0, 1.5, 3] }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(new Color(0.0035, 0.004, 0.0065), 1)}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <AdaptiveDpr min={1} max={highTier ? 1.5 : 1.25} />
      <Rig {...rig} />
    </Canvas>
  );
}
