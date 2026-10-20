"use client";


import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from "three";
import { runtime } from "@/shared/lib/runtime";
import { easeOutExpo } from "@/shared/lib/math";
import { useSeries, useUI } from "@/shared/state/store";

/**
 * On teller switch: an accent ring blooms slowly outward from the hero's waist. One flat
 * ring on the waist plane (occluded by the hero for real), one fainter screen-facing
 * ring so it reads from any camera angle. Colour is read live from frame.accent, so
 * it carries the new teller's blend.
 */

// ── Tuning ──────────────────────────────────────────────────────────────────
const DURATION = 2.2;
const R_START = 0.3;
const R_END = 6.0;
/** Ring half-width in metres at start -> end (thins as it travels). */
const WIDTH_START = 0.32;
const WIDTH_END = 0.035;
/** Peak intensities (HDR-ish; ACES compresses). */
const FLAT_INTENSITY = 1.2;
const FACING_INTENSITY = 0.45;
/** The facing ring is this fraction of the flat radius. */
const FACING_SCALE = 0.8;
/** Reduced motion: a soft stationary pulse instead. */
const REDUCED_DURATION = 0.7;
const REDUCED_RADIUS = 1.15;
const REDUCED_GROW = 0.25;
const REDUCED_INTENSITY = 0.9;

const HALF = R_END * 1.25;

const VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy * 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uR;
uniform float uW;
uniform float uA;
uniform float uHalf;
varying vec2 vP;
void main() {
  float len = length(vP) * uHalf;
  float d = len - uR;
  float ring = exp(-(d * d) / (uW * uW));
  // Soft wake trailing inside the ring.
  float wake = d < 0.0 ? exp(d * 2.2) * 0.16 : 0.0;
  float ang = atan(vP.y, vP.x);
  float shimmer = 0.82 + 0.18 * sin(ang * 7.0 + uR * 2.5);
  float a = (ring + wake) * shimmer * uA;
  if (a < 0.002) discard;
  vec3 col = mix(uColor, vec3(1.0), 0.25 * ring) * a;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function makeMaterial() {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uColor: { value: new Vector3(0.3, 0.5, 0.6) },
      uR: { value: R_START },
      uW: { value: WIDTH_START },
      uA: { value: 0 },
      uHalf: { value: HALF },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: AdditiveBlending,
  });
}

export function Shockwave() {
  const invalidate = useThree((s) => s.invalidate);
  const flat = useRef<Mesh>(null);
  const facing = useRef<Mesh>(null);
  const st = useRef({ active: false, t: 0 });

  const { geometry, flatMat, facingMat } = useMemo(
    () => ({ geometry: new PlaneGeometry(1, 1), flatMat: makeMaterial(), facingMat: makeMaterial() }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      flatMat.dispose();
      facingMat.dispose();
    },
    [geometry, flatMat, facingMat],
  );

  useEffect(() => {
    return useSeries.subscribe((s, prev) => {
      if (s.switchedAt === prev.switchedAt || s.switchSource === "init") return;
      if (useUI.getState().paused) return; // time is frozen; do not start a stuck ring
      st.current.active = true;
      st.current.t = 0;
      invalidate();
    });
  }, [invalidate]);

  useFrame((state) => {
    const a = flat.current;
    const b = facing.current;
    if (!a || !b) return;
    const s = st.current;
    if (!s.active) {
      a.visible = false;
      b.visible = false;
      return;
    }
    const f = runtime.frame;
    const reduced = useUI.getState().reducedMotion;
    s.t += f.dt;
    const dur = reduced ? REDUCED_DURATION : DURATION;
    const u = s.t / dur;
    if (u >= 1) {
      s.active = false;
      a.visible = false;
      b.visible = false;
      return;
    }

    let r: number;
    let w: number;
    let amp: number;
    if (reduced) {
      r = REDUCED_RADIUS + REDUCED_GROW * u;
      w = WIDTH_START * 1.4;
      amp = Math.sin(Math.PI * u) * REDUCED_INTENSITY;
    } else {
      const e = easeOutExpo(u);
      r = R_START + (R_END - R_START) * e;
      w = WIDTH_START + (WIDTH_END - WIDTH_START) * Math.pow(e, 0.6);
      // Soft rise, long fall: a slow bloom of light, not a punch.
      amp = Math.pow(1 - u, 1.7) * Math.min(1, u * 5);
    }

    const waist = runtime.hero.waist;
    const y = waist.y > 0.2 ? waist.y : 0.95;
    const col = f.accent;

    a.visible = true;
    a.position.set(f.hero.x, y, f.hero.z);
    a.rotation.set(-Math.PI / 2, 0, 0);
    a.scale.set(HALF * 2, HALF * 2, 1);
    const ua = flatMat.uniforms;
    ua.uR.value = r;
    ua.uW.value = w;
    ua.uA.value = amp * FLAT_INTENSITY;
    (ua.uColor.value as Vector3).set(col[0], col[1], col[2]);

    b.visible = true;
    b.position.set(f.hero.x, y, f.hero.z);
    b.quaternion.copy(state.camera.quaternion);
    b.scale.set(HALF * 2, HALF * 2, 1);
    const ub = facingMat.uniforms;
    ub.uR.value = r * FACING_SCALE;
    ub.uW.value = w * 0.7;
    ub.uA.value = amp * FACING_INTENSITY;
    (ub.uColor.value as Vector3).set(col[0], col[1], col[2]);
  });

  return (
    <>
      <mesh ref={flat} geometry={geometry} material={flatMat} visible={false} frustumCulled={false} renderOrder={5} />
      <mesh ref={facing} geometry={geometry} material={facingMat} visible={false} frustumCulled={false} renderOrder={5} />
    </>
  );
}
