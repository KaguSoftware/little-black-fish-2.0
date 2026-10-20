"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, type Mesh, type MeshStandardMaterial, type ShaderMaterial } from "three";
import { runtime } from "@/shared/lib/runtime";
import { stageState } from "./stageState";

// ── Tuning ─────────────────────────────────────────────────────────────────
/** Floor disc radius; reaches under the cyclorama wall (radius 16). */
const FLOOR_RADIUS = 16.6;
const FLOOR_Y = -0.003;
/** Floor albedo = stage colour * this (keeps it a barely-lit near-black). */
const FLOOR_LIFT = 5.5;
const FLOOR_ROUGHNESS = 0.7;
const FLOOR_METALNESS = 0.12;

const POOL_RADIUS = 3.6; // metres, half-size of the light pool
const POOL_Y = 0.004;
const POOL_INTENSITY = 0.2;
const POOL_WARM = 0xffe4c8;
const POOL_ACCENT_MIX = 0.3;

const BLOB_SIZE = 1.1; // half-size
const BLOB_Y = 0.008;
const BLOB_OPACITY = 0.62;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const POOL_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float g = 1.0 - smoothstep(0.0, 1.0, d);
  g = pow(g, 2.1);
  gl_FragColor = vec4(uColor * g * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const BLOB_FRAG = /* glsl */ `
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float g = 1.0 - smoothstep(0.0, 1.0, d);
  g = pow(g, 1.5);
  gl_FragColor = vec4(0.0, 0.0, 0.0, g * uOpacity);
}
`;

const tmpAccent = new Color();

/** Big dark floor disc, a soft pool of light on it, and a blob shadow under the hero. */
export function StageFloor() {
  const floor = useRef<MeshStandardMaterial>(null);
  const pool = useRef<Mesh>(null);
  const poolMat = useRef<ShaderMaterial>(null);
  const blob = useRef<Mesh>(null);
  const blobMat = useRef<ShaderMaterial>(null);
  const warm = useMemo(() => new Color(POOL_WARM), []);
  const poolUniforms = useMemo(
    () => ({ uColor: { value: new Color() }, uIntensity: { value: POOL_INTENSITY } }),
    [],
  );
  const blobUniforms = useMemo(() => ({ uOpacity: { value: BLOB_OPACITY } }), []);

  useFrame(() => {
    const f = runtime.frame;
    if (floor.current) floor.current.color.setRGB(f.bg[0] * FLOOR_LIFT, f.bg[1] * FLOOR_LIFT, f.bg[2] * FLOOR_LIFT);

    const x = stageState.x;
    const z = stageState.z;
    if (pool.current && poolMat.current) {
      pool.current.position.set(x, POOL_Y, z);
      poolMat.current.uniforms.uColor.value
        .copy(warm)
        .lerp(tmpAccent.setRGB(f.accent[0], f.accent[1], f.accent[2]), POOL_ACCENT_MIX);
      poolMat.current.uniforms.uIntensity.value =
        POOL_INTENSITY * (1 - 0.45 * f.fx.maker) * (1 + 0.25 * f.fx.day);
    }
    if (blob.current && blobMat.current) {
      blob.current.position.set(x, BLOB_Y, z);
      // Wider and softer while walking, darker when the light is close overhead.
      const s = 1 + 0.18 * f.hero.walk;
      blob.current.scale.set(s, s, s);
      blobMat.current.uniforms.uOpacity.value = BLOB_OPACITY * (1 - 0.3 * f.hero.walk) * (1 - 0.5 * f.fx.maker);
    }
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, FLOOR_Y, 0]}>
        <circleGeometry args={[FLOOR_RADIUS, 96]} />
        <meshStandardMaterial
          ref={floor}
          color="#050506"
          roughness={FLOOR_ROUGHNESS}
          metalness={FLOOR_METALNESS}
        />
      </mesh>
      <mesh ref={pool} rotation-x={-Math.PI / 2} renderOrder={1} frustumCulled={false}>
        <planeGeometry args={[POOL_RADIUS * 2, POOL_RADIUS * 2]} />
        <shaderMaterial
          ref={poolMat}
          uniforms={poolUniforms}
          vertexShader={QUAD_VERT}
          fragmentShader={POOL_FRAG}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          fog={false}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh ref={blob} rotation-x={-Math.PI / 2} renderOrder={2} frustumCulled={false}>
        <planeGeometry args={[BLOB_SIZE * 2, BLOB_SIZE * 2]} />
        <shaderMaterial
          ref={blobMat}
          uniforms={blobUniforms}
          vertexShader={QUAD_VERT}
          fragmentShader={BLOB_FRAG}
          transparent
          depthWrite={false}
          fog={false}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
    </group>
  );
}
