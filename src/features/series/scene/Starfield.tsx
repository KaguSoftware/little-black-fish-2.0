"use client";


import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Vector2, Vector3 } from "three";
import { runtime } from "@/shared/lib/runtime";
import { damp } from "@/shared/lib/math";
import { useUI } from "@/shared/state/store";

/**
 * Slow starfield on a big shell behind everything. Parallax comes from the camera
 * moving (stars are only partially pinned to it, per-star depth layer) plus a faint
 * pointer shift. Tinted slightly toward the accent.
 */

// ── Tuning ──────────────────────────────────────────────────────────────────
const COUNT_HIGH = 1500;
const COUNT_LOW = 500;
const SHELL_MIN = 40;
const SHELL_MAX = 90;
/** Fraction of camera translation the nearest/farthest layers cancel (higher = less parallax). */
const PIN_MIN = 0.82;
const PIN_MAX = 0.97;
/** Pointer parallax in view-space metres at layer 1. */
const POINTER_SHIFT = 2.2;
const POINTER_DAMP = 2.5;
/** Drift in rad/s at mood.drift = 1. */
const DRIFT_Y = 0.006;
const DRIFT_X = 0.0018;
const REDUCED_DRIFT = 0.3;
/** Star size range in CSS px (scaled by dpr). */
const SIZE_MIN = 1.1;
const SIZE_MAX = 2.9;
/** Brightness range. */
const BRIGHT_MIN = 0.12;
const BRIGHT_MAX = 0.75;
/** How strongly stars lean toward the accent colour (0..1). */
const ACCENT_TINT = 0.28;
const TWINKLE_DEPTH = 0.35;
const TWINKLE_SPEED = 1.4;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const VERT = /* glsl */ `
uniform vec3 uCam;
uniform vec2 uPtr;
uniform float uTime;
uniform float uTwinkle;
uniform float uPx;
attribute vec4 aStar; // layer(0..1), size(0..1), brightness(0..1), seed
varying float vB;
void main() {
  float layer = aStar.x;
  vec3 w = (modelMatrix * vec4(position, 1.0)).xyz;
  float pin = mix(${PIN_MIN.toFixed(3)}, ${PIN_MAX.toFixed(3)}, layer);
  w -= uCam * pin;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  mv.xy += uPtr * ${POINTER_SHIFT.toFixed(2)} * (1.0 - layer * 0.6);
  float tw = 1.0 - uTwinkle * ${TWINKLE_DEPTH.toFixed(2)} * (0.5 + 0.5 * sin(uTime * ${TWINKLE_SPEED.toFixed(2)} * (0.5 + aStar.w) + aStar.w * 91.0));
  vB = mix(${BRIGHT_MIN.toFixed(2)}, ${BRIGHT_MAX.toFixed(2)}, aStar.z) * tw;
  gl_PointSize = mix(${SIZE_MIN.toFixed(2)}, ${SIZE_MAX.toFixed(2)}, aStar.y) * uPx * (0.85 + 0.15 * tw);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vB;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.6);
  gl_FragColor = vec4(uColor * a * vB, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function Starfield() {
  const quality = useUI((s) => s.quality);
  const count = quality === "low" ? COUNT_LOW : COUNT_HIGH;
  const ref = useRef<Points>(null);
  const acc = useRef({ time: 0, px: 0, py: 0 });

  const { geometry, material } = useMemo(() => {
    const rnd = mulberry32(0x5eed1e);
    const pos = new Float32Array(count * 3);
    const star = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      // Uniform direction on a sphere.
      const z = rnd() * 2 - 1;
      const a = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      const layer = rnd();
      const r = SHELL_MIN + (SHELL_MAX - SHELL_MIN) * (layer * 0.7 + rnd() * 0.3);
      pos[i * 3] = Math.cos(a) * s * r;
      pos[i * 3 + 1] = z * r;
      pos[i * 3 + 2] = Math.sin(a) * s * r;
      star[i * 4] = layer;
      // Most stars are small and dim; a few are bright.
      star[i * 4 + 1] = rnd() ** 2.4;
      star[i * 4 + 2] = rnd() ** 1.8;
      star[i * 4 + 3] = rnd();
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("aStar", new Float32BufferAttribute(star, 4));
    const m = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uCam: { value: new Vector3() },
        uPtr: { value: new Vector2() },
        uTime: { value: 0 },
        uTwinkle: { value: 1 },
        uPx: { value: 1 },
        uColor: { value: new Vector3(0.7, 0.75, 0.9) },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, [count]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const f = runtime.frame;
    const ui = useUI.getState();
    const reduced = ui.reducedMotion;
    const a = acc.current;
    const dt = f.dt; // 0 while paused
    a.time += dt;

    const cam = state.camera;
    // The shell rides with the camera so it never clips; parallax is applied in the shader.
    mesh.position.copy(cam.position);
    const drift = f.mood.drift * (reduced ? REDUCED_DRIFT : 1);
    mesh.rotation.y += dt * DRIFT_Y * drift;
    mesh.rotation.x += dt * DRIFT_X * drift;

    // Smoothed pointer (frozen while paused, tiny under reduced motion).
    if (dt > 0) {
      const gain = reduced ? 0.25 : 1;
      a.px = damp(a.px, runtime.pointer.x * gain, POINTER_DAMP, dt);
      a.py = damp(a.py, runtime.pointer.y * gain, POINTER_DAMP, dt);
    }

    const u = material.uniforms;
    (u.uCam.value as Vector3).copy(cam.position);
    (u.uPtr.value as Vector2).set(-a.px, -a.py);
    u.uTime.value = a.time;
    u.uTwinkle.value = reduced ? 0 : 1;
    u.uPx.value = state.gl.getPixelRatio();
    (u.uColor.value as Vector3).set(
      0.72 + (f.accent[0] * 1.2 - 0.72) * ACCENT_TINT,
      0.76 + (f.accent[1] * 1.2 - 0.76) * ACCENT_TINT,
      0.92 + (f.accent[2] * 1.2 - 0.92) * ACCENT_TINT,
    );
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={-10} />;
}
