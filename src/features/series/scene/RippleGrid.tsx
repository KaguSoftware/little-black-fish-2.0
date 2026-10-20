"use client";


import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial, Vector3 } from "three";
import { runtime } from "@/shared/lib/runtime";
import { smoothstep } from "@/shared/lib/math";
import { useUI } from "@/shared/state/store";
import {
  GRID_Y, RIPPLE_GLSL, gridCount, gridHalfExtent, gridState, latticeCoord, tickGrid,
} from "./particles/lattice";

/**
 * MY MAKER floor: a dot lattice that ripples from the mood. Dreamy = calm concentric
 * tide, angry = choppy interference. Fades in with fx.maker; kept dim and slow so the
 * DOM cards that scroll over it stay readable.
 */

// ── Tuning ──────────────────────────────────────────────────────────────────
/** Max overall opacity at fx.maker = 1. */
const MAX_OPACITY = 0.5;
/** Dot size in metres (before perspective). */
const DOT_SIZE = 0.05;
const MIN_PX = 1.1;
const MAX_PX = 7;
/** Distance fade into fog: exp(-d * FOG_DENSITY * mood.fog). */
const FOG_DENSITY = 0.045;
/** Radial edge fade starts at this fraction of the half-extent. */
const EDGE_START = 0.5;
/** Dim base brightness in troughs vs crests. */
const TROUGH_GLOW = 0.28;
const CREST_GLOW = 1.0;

const VERT = /* glsl */ `
uniform float uPhase;
uniform float uChop;
uniform float uAmp;
uniform float uPxScale;
uniform float uHalf;
uniform float uFog;
attribute float aRand;
varying float vGlow;
varying float vFade;
${RIPPLE_GLSL}
void main() {
  vec3 p = position;
  float h = ripple(p.xz, uPhase, uChop, uAmp);
  p.y = h;
  float hn = clamp(h / max(uAmp, 1e-4) * 0.5 + 0.5, 0.0, 1.0);
  float tw = 0.85 + 0.15 * sin(uPhase * 0.8 + aRand * 40.0);
  vGlow = mix(${TROUGH_GLOW.toFixed(3)}, ${CREST_GLOW.toFixed(3)}, hn) * tw;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  float rad = length(p.xz) / uHalf;
  vFade = exp(-dist * uFog) * (1.0 - smoothstep(${EDGE_START.toFixed(2)}, 1.0, rad));
  float size = ${DOT_SIZE.toFixed(3)} * (0.75 + 0.5 * aRand) * (0.8 + 0.5 * hn);
  gl_PointSize = clamp(size * uPxScale / max(dist, 0.1), ${MIN_PX.toFixed(2)}, ${MAX_PX.toFixed(2)});
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vGlow;
varying float vFade;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q) * 2.0;
  if (d > 1.0) discard;
  float a = pow(1.0 - d, 1.8);
  float core = smoothstep(0.35, 0.0, d);
  vec3 col = uColor * (a * 0.8) + mix(uColor, vec3(1.0), 0.5) * core * 0.5;
  gl_FragColor = vec4(col * vGlow * vFade * uOpacity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export function RippleGrid() {
  const quality = useUI((s) => s.quality);
  const n = gridCount(quality);
  const ref = useRef<Points>(null);

  const { geometry, material } = useMemo(() => {
    const count = n * n;
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    let i = 0;
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        pos[i * 3] = latticeCoord(ix, n);
        pos[i * 3 + 1] = 0;
        pos[i * 3 + 2] = latticeCoord(iz, n);
        // Deterministic per-vertex hash.
        const s = Math.sin(ix * 127.1 + iz * 311.7) * 43758.5453;
        rnd[i] = s - Math.floor(s);
        i++;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("aRand", new Float32BufferAttribute(rnd, 1));
    const m = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uPhase: { value: 0 },
        uChop: { value: 0 },
        uAmp: { value: 0.05 },
        uPxScale: { value: 600 },
        uHalf: { value: gridHalfExtent(n) },
        uFog: { value: FOG_DENSITY },
        uColor: { value: new Vector3(0.3, 0.5, 0.6) },
        uOpacity: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, [n]);

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
    const vis = smoothstep(0.02, 0.85, f.fx.maker);
    // Also hide when the iris/dive is mid-flight.
    const opacity = vis * MAX_OPACITY;
    mesh.visible = opacity > 0.002;
    if (!mesh.visible) return;

    tickGrid(f, ui.reducedMotion);
    mesh.position.set(f.hero.x, GRID_Y, f.hero.z);

    const u = material.uniforms;
    u.uPhase.value = gridState.phase;
    u.uChop.value = gridState.chop;
    u.uAmp.value = gridState.amp;
    u.uFog.value = FOG_DENSITY * f.mood.fog;
    u.uOpacity.value = opacity;
    const fovRad = (f.camera.fov * Math.PI) / 180;
    u.uPxScale.value = state.gl.domElement.height / (2 * Math.tan(fovRad / 2));
    (u.uColor.value as Vector3).set(f.accent[0], f.accent[1], f.accent[2]);
  });

  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} visible={false} renderOrder={1} />;
}
