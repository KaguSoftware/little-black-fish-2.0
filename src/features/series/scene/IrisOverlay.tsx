"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, Vector2, Vector3, type Mesh, type ShaderMaterial } from "three";
import { DIVE_SPLIT } from "@/shared/lib/director";
import { runtime } from "@/shared/lib/runtime";
import { useUI } from "@/shared/state/store";

// ── Tuning ─────────────────────────────────────────────────────────────────
/** Rim width as a fraction of screen height (the shader works in a -1..1 height, so x2). */
const RIM_WIDTH = 0.015;
/** Rim brightness (linear, before tone mapping). */
const RIM_GAIN = 1.7;
/** Fish-scale size as a fraction of screen height. */
const SCALE_SIZE = 0.022;
/** Strength of the scale shimmer on the rim (0 = none). Keep it subtle. */
const SHIMMER = 0.55;
/** Shimmer travel speed along the rim (rad/s). */
const SHIMMER_SPEED = 1.1;
/** The black is the stage colour darkened by this. */
const DEEP = 0.45;
/** Overlay is skipped at or above this iris value. */
const OPEN = 0.999;

const VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uIris;
uniform float uAspect;
uniform float uTime;
uniform float uFade;      // 1: plain fade to black (low tier / reduced motion)
uniform float uRimW;
uniform float uRimGain;
uniform float uScale;
uniform float uShimmer;
uniform float uSpeed;
uniform vec3 uAccent;
uniform vec3 uDeep;
uniform vec2 uCenter;     // iris centre in the same space as p (x scaled by aspect)
varying vec2 vP;

// Row-staggered overlapping arcs: reads as fish scales.
float scales(vec2 q) {
  float row = floor(q.y);
  q.x += 0.5 * mod(row, 2.0);
  vec2 f = vec2(fract(q.x) - 0.5, fract(q.y));
  float ring = abs(length(f) - 0.5);
  return 1.0 - smoothstep(0.0, 0.1, ring);
}

void main() {
  vec3 rgb;
  float alpha;
  if (uFade > 0.5) {
    alpha = 1.0 - uIris;
    rgb = uDeep * alpha;
  } else {
    vec2 p = vec2(vP.x * uAspect, vP.y) - uCenter; // screen height spans -1..1
    // Farthest screen corner from the (possibly off-centre) iris centre.
    float corner = length(vec2(uAspect + abs(uCenter.x), 1.0 + abs(uCenter.y)));
    float rMax = corner + 3.0 * uRimW;         // at iris = 1 the rim is past every corner
    float r = uIris * rMax;
    float d = length(p) - r;                   // < 0 inside the open circle

    float aa = 0.004;
    float mask = smoothstep(-aa, aa, d);       // 1 = black

    // Glow: tighter outside, spilling a little further inside.
    float w = d < 0.0 ? uRimW * 1.5 : uRimW * 0.8;
    float x = abs(d) / w;
    float glow = exp(-x * x) + 0.3 * exp(-abs(d) / (uRimW * 3.5));

    // Fish-scale shimmer travelling along the rim.
    float band = exp(-pow(abs(d) / (uRimW * 2.4), 2.0));
    float ang = atan(p.y, p.x);
    float travel = 0.5 + 0.5 * sin(ang * 5.0 - uTime * uSpeed);
    float pat = scales(p / uScale);
    float shimmer = 1.0 + uShimmer * pat * travel * band;

    // No rim dot when fully closed, none when fully open.
    float ramp = smoothstep(0.0, 0.05, uIris) * (1.0 - smoothstep(0.97, 0.999, uIris));

    rgb = uDeep * mask + uAccent * (glow * shimmer * uRimGain * ramp);
    alpha = mask;
  }
  gl_FragColor = vec4(rgb, alpha);
  #include <colorspace_fragment>
}
`;

/**
 * Screen-space iris rendered last. fx.iris: 0 = fully black, 1 = no overlay.
 * Low quality / reduced motion: plain fade (alpha = 1 - iris).
 */
const _eye = new Vector3();
const _closeAt = new Vector2();

export function IrisOverlay() {
  const mesh = useRef<Mesh>(null);
  const mat = useRef<ShaderMaterial>(null);
  const clock = useRef(0);
  const uniforms = useMemo(
    () => ({
      uIris: { value: 1 },
      uAspect: { value: 1.78 },
      uTime: { value: 0 },
      uFade: { value: 0 },
      uRimW: { value: RIM_WIDTH * 2 },
      uRimGain: { value: RIM_GAIN },
      uScale: { value: SCALE_SIZE * 2 },
      uShimmer: { value: SHIMMER },
      uSpeed: { value: SHIMMER_SPEED },
      uAccent: { value: new Color() },
      uDeep: { value: new Color() },
      uCenter: { value: new Vector2() },
    }),
    [],
  );

  useFrame((state, delta) => {
    const me = mesh.current;
    const m = mat.current;
    if (!me || !m) return;
    const f = runtime.frame;
    const iris = f.fx.iris;
    if (iris >= OPEN) {
      me.visible = false;
      return;
    }
    me.visible = true;
    const ui = useUI.getState();
    if (!ui.paused && !ui.reducedMotion) clock.current += Math.min(delta, 0.05);
    const u = m.uniforms;
    u.uIris.value = iris < 0 ? 0 : iris;
    u.uAspect.value = state.size.width / Math.max(1, state.size.height);
    u.uTime.value = clock.current;
    u.uFade.value = ui.reducedMotion || ui.quality === "low" ? 1 : 0;
    u.uAccent.value.setRGB(f.accent[0], f.accent[1], f.accent[2]);
    u.uDeep.value.setRGB(f.bg[0] * DEEP, f.bg[1] * DEEP, f.bg[2] * DEEP);

    // Closing: the iris shrinks onto the hero's LEFT pupil (we are diving into that eye).
    // Opening: it starts where it closed and drifts to the screen centre as it widens.
    const aspect = u.uAspect.value;
    const closing = f.r.segment.kind === "dive" && f.r.segT < DIVE_SPLIT;
    if (closing) {
      _eye.copy(runtime.hero.eyeL).project(state.camera);
      if (Number.isFinite(_eye.x) && _eye.z < 1) {
        // Ease toward the centre as the iris closes so the final pinhole lands on screen centre.
        const c = Math.min(1, Math.max(0, iris));
        _closeAt.set(Math.max(-aspect, Math.min(aspect, _eye.x * aspect)) * c, Math.max(-1, Math.min(1, _eye.y)) * c);
      }
      u.uCenter.value.copy(_closeAt);
    } else {
      // By the end of the approach the camera has centred the eye, so the new scene opens from the centre.
      u.uCenter.value.set(0, 0);
    }
  });

  return (
    <mesh ref={mesh} renderOrder={9999} frustumCulled={false} visible={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        premultipliedAlpha
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        fog={false}
      />
    </mesh>
  );
}
