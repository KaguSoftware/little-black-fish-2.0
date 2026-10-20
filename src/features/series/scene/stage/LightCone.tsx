"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, DoubleSide, type Group, type ShaderMaterial } from "three";
import { runtime } from "@/shared/lib/runtime";
import { useUI } from "@/shared/state/store";
import { GLSL_HASH, GLSL_NOISE3 } from "./glsl";
import { stageState } from "./stageState";

// ── Tuning ─────────────────────────────────────────────────────────────────
const CONE_TOP_Y = 8.6;
const CONE_TOP_RADIUS = 0.14;
const CONE_BASE_RADIUS = 2.0;
/** Cone sits slightly upstage of the hero so the beam reads against the dark. */
const CONE_Z = -0.55;
const CONE_INTENSITY = 0.2;
/** Warm-neutral light colour (sRGB hex) and how much of the accent bleeds into the beam. */
const CONE_WARM = 0xffe9d2;
const CONE_ACCENT_MIX = 0.22;

const VERT = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec3 vWorld;
varying float vH;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  vH = uv.y;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uLow;
varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec3 vWorld;
varying float vH;
${GLSL_HASH}
${GLSL_NOISE3}
void main() {
  float facing = abs(dot(normalize(vNormalV), normalize(vViewDir)));
  float edge = pow(facing, 1.7);                           // soft silhouette
  float vert = pow(vH, 1.25) * smoothstep(0.0, 0.14, vH);  // bright at source, melts into the floor
  float dust = 1.0;
  if (uLow < 0.5) {
    vec3 q = vWorld * vec3(1.9, 1.1, 1.9) + vec3(0.0, -uTime * 0.07, uTime * 0.03);
    float n = vnoise3(q) * 0.65 + vnoise3(q * 2.3 + 7.1) * 0.35;
    // Round, soft motes: one per cell, jittered inside it, drifting slowly downward.
    vec3 g = vWorld * 9.0 + vec3(0.0, uTime * 0.25, 0.0);
    vec3 cell = floor(g);
    vec3 jit = vec3(hash13(cell), hash13(cell + 17.3), hash13(cell + 41.9));
    float d = length(fract(g) - (0.25 + 0.5 * jit));
    float alive = step(0.82, hash13(cell + 93.1));
    float twinkle = 0.5 + 0.5 * sin(uTime * (0.6 + jit.x * 1.4) + jit.y * 6.2831);
    float sparkle = alive * twinkle * (1.0 - smoothstep(0.0, 0.09, d));
    dust = 0.62 + 0.75 * n + sparkle * 1.1;
  }
  float a = edge * vert * dust * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/** Fake volumetric light: open additive cone above the hero. */
export function LightCone() {
  const group = useRef<Group>(null);
  const mat = useRef<ShaderMaterial>(null);
  const warm = useMemo(() => new Color(CONE_WARM), []);
  const uniforms = useMemo(
    () => ({
      uColor: { value: new Color() },
      uIntensity: { value: CONE_INTENSITY },
      uTime: { value: 0 },
      uLow: { value: 0 },
    }),
    [],
  );
  const clock = useRef(0);

  useFrame((_, delta) => {
    const g = group.current;
    const m = mat.current;
    if (!g || !m) return;
    const f = runtime.frame;
    const ui = useUI.getState();
    if (!ui.paused && !ui.reducedMotion) clock.current += Math.min(delta, 0.05);

    g.position.set(stageState.x, 0, stageState.z + CONE_Z);
    const u = m.uniforms;
    u.uColor.value.copy(warm).lerp(tmpAccent.setRGB(f.accent[0], f.accent[1], f.accent[2]), CONE_ACCENT_MIX);
    u.uTime.value = clock.current;
    // The camera stands inside the cone in the close-up, so it fills the screen: cheap noise there.
    u.uLow.value = ui.quality === "low" || f.fx.closeUp > 0.3 ? 1 : 0;
    const closeDim = 1 - 0.35 * f.fx.closeUp;
    u.uIntensity.value =
      CONE_INTENSITY * (0.85 + 0.35 * f.fx.day) * (1 - 0.55 * f.fx.maker) * closeDim;
  });

  const height = CONE_TOP_Y;
  return (
    <group ref={group}>
      <mesh position={[0, height / 2, 0]} frustumCulled={false} renderOrder={3}>
        <cylinderGeometry args={[CONE_TOP_RADIUS, CONE_BASE_RADIUS, height, 40, 1, true]} />
        <shaderMaterial
          ref={mat}
          uniforms={uniforms}
          vertexShader={VERT}
          fragmentShader={FRAG}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={DoubleSide}
          fog={false}
        />
      </mesh>
    </group>
  );
}

const tmpAccent = new Color();
