"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
} from "three";
import { STILL_BY_ID, stillCard, stillHero } from "@/shared/content/stills";
import type { StillId } from "@/shared/content/types";
import { TELLER_BY_ID } from "@/shared/content/characters";
import { AdaptiveDpr } from "@/shared/lib/AdaptiveDpr";
import { oklchToLinear } from "@/shared/lib/color";
import { easeOutQuint, hash1 } from "@/shared/lib/math";
import { lantern } from "./lantern";

/**
 * The lantern wall. A drifting field of tall stills in fog. Every plate is rendered as
 * near-black, accent-toned halftone; inside the lantern's disc (a SCREEN-SPACE circle,
 * so it matches the DOM wordmark mask exactly) the dots swell, merge and resolve into
 * the full-colour still. Dust floats in the beam; a soft haze lives around the light.
 */

const FOV = 38;
const PLATE_ASPECT = 0.62; // width / height of every tall plate
const DEPTHS = [4.4, 5.8, 7.3, 9, 10.8, 12.8];

/** Ordered for variety (neighbouring plates are different tellers) and for first impressions. */
const WALL_ORDER: StillId[] = [
  "s09", "s04", "s16", "s12", "s08", "s02", "s15", "s13", "s20",
  "s18", "s06", "s19", "s27", "s01", "s17", "s24", "s10", "s21",
];

interface Shared {
  uLant: { value: Vector2 };
  uRad: { value: number };
  uLightCol: { value: Vector3 };
  uTime: { value: number };
  uPx: { value: number };
}

const PLATE_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const PLATE_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec4 uCrop;
  uniform vec2 uLant;
  uniform float uRad;
  uniform vec3 uLightCol;
  uniform vec3 uTeller;
  uniform float uReveal;
  uniform float uCell;
  uniform float uFog;
  uniform float uTime;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vec3 tex = texture2D(uTex, uCrop.xy + vUv * uCrop.zw).rgb;
    float lum = dot(tex, vec3(0.2126, 0.7152, 0.0722));

    // Distance to the lantern in the drawing buffer (same circle the DOM mask uses).
    float d = distance(gl_FragCoord.xy, uLant);
    float rad = max(uRad, 1.0);
    // Nearer plates catch a little more of the light than the distant ones.
    float reach = mix(1.12, 0.82, clamp((vDepth - 4.0) / 9.0, 0.0, 1.0));
    float lit = 1.0 - smoothstep(rad * 0.1 * reach, rad * reach, d);
    lit = lit * lit * (3.0 - 2.0 * lit);

    // Halftone grid at 45 degrees, in screen pixels.
    vec2 p = gl_FragCoord.xy / uCell;
    float c = 0.7071;
    vec2 rp = vec2(c * p.x - c * p.y, c * p.x + c * p.y);
    vec2 cell = fract(rp) - 0.5;
    float dd = length(cell);

    float t = clamp(lit * 1.45, 0.0, 1.0);
    float baseR = sqrt(clamp(lum * 1.3, 0.0, 1.0)) * 0.48;
    float dotR = mix(baseR, 0.86, t * t);
    float aa = max(fwidth(dd), 0.02);
    float dotMask = 1.0 - smoothstep(dotR - aa, dotR + aa, dd);

    // Unlit: teller-toned ink. Lit: the still itself, graded toward the light and its own teller.
    // Outside the light the wall must stay near-black: a faint teller-toned ink, brightest in highlights.
    vec3 ink = uTeller * (0.05 + 0.5 * lum * lum) * 0.8;
    float mx = max(max(uLightCol.r, uLightCol.g), max(uLightCol.b, 0.001));
    vec3 tint = mix(vec3(1.0), uLightCol / mx, 0.38);
    vec3 graded = tex * tint * 1.08;
    graded = mix(graded, graded * (0.55 + 1.5 * uTeller), 0.3 * lit);
    vec3 dotCol = mix(ink, graded, smoothstep(0.25, 0.95, t));
    vec3 col = dotCol * dotMask + vec3(0.003, 0.0035, 0.005) * (1.0 - dotMask);

    // A little of the light's own colour on the edge of the disc.
    col += uLightCol * 0.05 * lit * (1.0 - dotMask * 0.5);

    // Fog swallows distant plates, even the lit part.
    float fogF = 1.0 - exp(-uFog * vDepth);
    vec3 fogCol = vec3(0.004, 0.0048, 0.0075) + uLightCol * 0.012 * lit;
    col = mix(col, fogCol, fogF * 0.82);

    // Soft plate edges so the stills float as panels of light.
    float edge = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x)
               * smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
    float alpha = edge * uReveal;
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }
`;

const MOTE_VERT = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uPx;
  varying float vPhase;
  varying float vDepth;
  void main() {
    vec3 p = position;
    p.y = mod(position.y + uTime * (0.05 + aSeed.x * 0.09) + 3.6, 7.2) - 3.6;
    p.x += sin(uTime * (0.12 + aSeed.y * 0.2) + aSeed.z * 6.283) * 0.35;
    p.z += cos(uTime * 0.1 + aSeed.w * 6.283) * 0.3;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDepth = -mv.z;
    vPhase = aSeed.w;
    gl_PointSize = (0.014 + aSeed.x * 0.03) * uPx / max(vDepth, 0.5);
    gl_Position = projectionMatrix * mv;
  }
`;

const MOTE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 uLant;
  uniform float uRad;
  uniform vec3 uLightCol;
  uniform float uTime;
  varying float vPhase;
  varying float vDepth;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float r = length(q);
    float a = 1.0 - smoothstep(0.0, 0.5, r);
    a *= a;
    float d = distance(gl_FragCoord.xy, uLant);
    float beam = 1.0 - smoothstep(max(uRad, 1.0) * 0.15, max(uRad, 1.0) * 1.12, d);
    float tw = 0.55 + 0.45 * sin(uTime * (1.2 + vPhase * 2.0) + vPhase * 40.0);
    float fog = exp(-vDepth * 0.07);
    vec3 col = uLightCol * 1.6 * a * beam * tw * fog;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const HAZE_VERT = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const HAZE_FRAG = /* glsl */ `
  precision highp float;
  uniform vec2 uLant;
  uniform float uRad;
  uniform vec3 uLightCol;
  uniform float uTime;
  uniform vec2 uRes;

  float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    vec2 v = gl_FragCoord.xy - uLant;
    float d = length(v);
    float rad = max(uRad, 1.0);
    float core = exp(-pow(d / (rad * 0.95), 2.0));
    // Past ~2.3 radii the glow is below one 8-bit step: skip the noise and the blend.
    if (core < 0.005) discard;
    vec2 uv = gl_FragCoord.xy / uRes.y;
    float fb = vnoise(uv * 2.6 + vec2(uTime * 0.03, -uTime * 0.02)) * 0.6
             + vnoise(uv * 5.8 - vec2(uTime * 0.05, 0.0)) * 0.4;
    float ang = atan(v.y, v.x);
    float rays = 0.55 + 0.45 * vnoise(vec2(cos(ang), sin(ang)) * 2.6 + vec2(uTime * 0.05, d * 0.0015));
    float a = core * (0.45 + 0.9 * fb) * rays;
    vec3 col = uLightCol * a * 0.13;
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

interface PlateSpec {
  id: StillId;
  lane: number;
  depth: number;
  u0: number; // screen-fraction x
  yFrac: number; // vertical offset, fraction of visible height
  hFrac: number; // height as fraction of visible height at its depth
  speed: number; // screen-fractions / second (negative = leftward)
  seed: number;
  teller: ReturnType<typeof oklchToLinear>;
  /** Nearer plates get the 1280w texture, the rest 960w (the halftone and fog hide the rest). */
  large: boolean;
}

const WRAP = 1.9;

function buildSpecs(count: number, highTier: boolean): PlateSpec[] {
  const ids = WALL_ORDER.slice(0, count);
  const lanes = DEPTHS.length;
  return ids.map((id, i) => {
    const lane = i % lanes;
    const inLane = Math.floor(i / lanes);
    const laneCount = Math.ceil((ids.length - lane) / lanes);
    const depth = DEPTHS[lane] + hash1(i * 3.1) * 0.5;
    const u0 = ((inLane + ((lane * 0.381966) % 1)) / laneCount) * WRAP - WRAP / 2;
    const still = STILL_BY_ID[id];
    return {
      id,
      lane,
      depth,
      u0,
      yFrac: hash1(i * 7.7) * 0.16,
      hFrac: 0.62 + (hash1(i * 5.3) * 0.5 + 0.5) * 0.4,
      speed: -0.0125 * (DEPTHS[0] / depth) * (0.85 + (hash1(i * 2.2) * 0.5 + 0.5) * 0.3),
      seed: i * 1.618,
      teller: oklchToLinear(TELLER_BY_ID[still.tellers[0]].accent),
      large: highTier && lane < 2,
    };
  });
}

/** Per-frame plate placement + uniforms. Module-level and allocation-free. */
function stepPlate(
  mesh: Mesh,
  material: ShaderMaterial,
  spec: PlateSpec,
  shared: Shared,
  reveal: { target: number; v: number },
  imgAspect: number,
  cam: PerspectiveCamera,
  size: { width: number; height: number },
  dpr: number,
  dt: number,
) {
  const aspect = size.width / size.height;
  const visH = 2 * spec.depth * Math.tan((cam.fov * Math.PI) / 360);
  const visW = visH * aspect;
  let hWorld = visH * spec.hFrac;
  hWorld = Math.min(hWorld, (visW * 0.5) / PLATE_ASPECT);

  // Drift: u wraps through a field wider than the screen. Ambient time is frozen when paused.
  const t = shared.uTime.value;
  const u = ((((spec.u0 + spec.speed * t + WRAP / 2) % WRAP) + WRAP) % WRAP) - WRAP / 2;
  const bob = Math.sin(t * 0.21 + spec.seed) * 0.012;

  mesh.position.set(u * visW, (spec.yFrac + bob) * visH, -spec.depth);
  mesh.scale.set(hWorld, hWorld, 1);
  mesh.rotation.y = -u * 0.1;

  // Slow pan across the wide still behind the tall crop.
  const crop = material.uniforms.uCrop.value as Vector4;
  const cw = Math.min(1, PLATE_ASPECT / imgAspect);
  const focus = 0.5 + 0.4 * Math.sin(t * 0.045 + spec.seed * 2.0);
  crop.x = (1 - cw) * focus;

  material.uniforms.uCell.value = (3.2 + 17 / spec.depth) * dpr;

  if (reveal.v < reveal.target) {
    reveal.v = Math.min(reveal.target, reveal.v + dt / 1.6);
    material.uniforms.uReveal.value = easeOutQuint(reveal.v);
  }
}

function Plate({ spec, order, shared, highTier }: {
  spec: PlateSpec; order: number; shared: Shared; highTier: boolean;
}) {
  const meshRef = useRef<Mesh>(null);
  const reveal = useRef({ target: 0, v: 0 });

  const material = useMemo(() => {
    const m = new ShaderMaterial({
      vertexShader: PLATE_VERT,
      fragmentShader: PLATE_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTex: { value: null as Texture | null },
        uCrop: { value: new Vector4(0, 0, 1, 1) },
        uLant: shared.uLant,
        uRad: shared.uRad,
        uLightCol: shared.uLightCol,
        uTime: shared.uTime,
        uTeller: { value: new Vector3(spec.teller[0], spec.teller[1], spec.teller[2]) },
        uReveal: { value: 0 },
        uCell: { value: 6 },
        uFog: { value: 0.09 },
      },
    });
    return m;
  }, [spec, shared]);

  const geometry = useMemo(() => new PlaneGeometry(PLATE_ASPECT, 1), []);
  const aspectRef = useRef(16 / 9);

  // Progressive load: plates arrive one after another so the first paint is never blocked.
  useEffect(() => {
    let cancelled = false;
    const loader = new TextureLoader();
    const urls = [stillHero(spec.id, spec.large ? 1280 : 960), stillCard(spec.id, 1200, "webp")];
    const timer = window.setTimeout(() => {
      const tryLoad = (n: number) => {
        loader.load(
          urls[n],
          (tex) => {
            if (cancelled) {
              tex.dispose();
              return;
            }
            tex.colorSpace = SRGBColorSpace;
            tex.minFilter = LinearMipmapLinearFilter;
            tex.magFilter = LinearFilter;
            const img = tex.image as { width: number; height: number };
            aspectRef.current = img.width / img.height;
            const a = aspectRef.current;
            const cw = Math.min(1, PLATE_ASPECT / a);
            const ch = Math.min(1, a / PLATE_ASPECT);
            material.uniforms.uCrop.value.set(0, (1 - ch) * 0.5, cw, ch);
            material.uniforms.uTex.value = tex;
            reveal.current.target = 1;
          },
          undefined,
          () => {
            if (!cancelled && n + 1 < urls.length) tryLoad(n + 1);
          },
        );
      };
      tryLoad(0);
    }, 120 + order * (highTier ? 260 : 340));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const tex = material.uniforms.uTex.value as Texture | null;
      tex?.dispose();
    };
  }, [spec, order, highTier, material]);

  useEffect(
    () => () => {
      material.dispose();
      geometry.dispose();
    },
    [material, geometry],
  );

  useFrame((state, dt) => {
    const mesh = meshRef.current;
    if (mesh) stepPlate(mesh, material, spec, shared, reveal.current, aspectRef.current, state.camera as PerspectiveCamera, state.size, state.viewport.dpr, dt);
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} frustumCulled={false} />;
}

function Motes({ shared, count }: { shared: Shared; count: number }) {
  const { geometry, material } = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const r = (k: number) => hash1(i * 12.9898 + k * 78.233) * 0.5 + 0.5;
      pos[i * 3] = (r(1) - 0.5) * 13;
      pos[i * 3 + 1] = (r(2) - 0.5) * 7.2;
      pos[i * 3 + 2] = -(1.2 + r(3) * 9);
      seed[i * 4] = r(4);
      seed[i * 4 + 1] = r(5);
      seed[i * 4 + 2] = r(6);
      seed[i * 4 + 3] = r(7);
    }
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new BufferAttribute(seed, 4));
    const m = new ShaderMaterial({
      vertexShader: MOTE_VERT,
      fragmentShader: MOTE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uLant: shared.uLant,
        uRad: shared.uRad,
        uLightCol: shared.uLightCol,
        uTime: shared.uTime,
        uPx: shared.uPx,
      },
    });
    return { geometry: g, material: m };
  }, [count, shared]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const ref = useRef<Points>(null);
  return <points ref={ref} geometry={geometry} material={material} frustumCulled={false} renderOrder={5} />;
}

function Haze({ shared }: { shared: Shared }) {
  const { geometry, material, res } = useMemo(() => {
    const res = new Vector2(1, 1);
    const g = new PlaneGeometry(2, 2);
    const m = new ShaderMaterial({
      vertexShader: HAZE_VERT,
      fragmentShader: HAZE_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uLant: shared.uLant,
        uRad: shared.uRad,
        uLightCol: shared.uLightCol,
        uTime: shared.uTime,
        uRes: { value: res },
      },
    });
    return { geometry: g, material: m, res };
  }, [shared]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    setRes(res, state.size.width * state.viewport.dpr, state.size.height * state.viewport.dpr);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={10} />;
}

function setRes(res: Vector2, w: number, h: number) {
  res.set(w, h);
}

/** Feed the shared uniforms from the lantern and lean the camera toward the light. */
function stepWall(
  shared: Shared,
  g: { x: number; y: number },
  motion: boolean,
  cam: PerspectiveCamera,
  h: number,
  dpr: number,
  dt: number,
) {
  // The lantern lives in hero CSS px; the shaders want drawing-buffer px with y up.
  shared.uLant.value.set(lantern.x * dpr, (h - lantern.y) * dpr);
  shared.uRad.value = lantern.radius * dpr;
  shared.uLightCol.value.set(lantern.rgb[0], lantern.rgb[1], lantern.rgb[2]);
  shared.uTime.value = lantern.t;
  shared.uPx.value = (h * dpr) / (2 * Math.tan((cam.fov * Math.PI) / 360));

  // Parallax: the camera leans toward the light a little, so near plates slide over far ones.
  const nx = lantern.w > 1 ? lantern.x / lantern.w - 0.5 : 0;
  const ny = lantern.h > 1 ? lantern.y / lantern.h - 0.5 : 0;
  const gx = motion ? nx * 1.1 + Math.sin(lantern.t * 0.11) * 0.12 : 0;
  const gy = motion ? -ny * 0.6 + Math.sin(lantern.t * 0.083 + 1) * 0.07 : 0;
  const e = 1 - Math.exp(-2.2 * dt);
  g.x += (gx - g.x) * e;
  g.y += (gy - g.y) * e;
  cam.position.set(g.x, g.y, 0);
  cam.lookAt(g.x * 0.35, g.y * 0.35, -8);
}

function Wall({ highTier, motionOn }: { highTier: boolean; motionOn: { current: boolean } }) {
  const count = highTier ? 12 : 7;
  const specs = useMemo(() => buildSpecs(count, highTier), [count, highTier]);
  const shared = useMemo<Shared>(
    () => ({
      uLant: { value: new Vector2(0, 0) },
      uRad: { value: 200 },
      uLightCol: { value: new Vector3(0.3, 0.5, 0.6) },
      uTime: { value: 0 },
      uPx: { value: 1400 },
    }),
    [],
  );
  const camGoal = useRef({ x: 0, y: 0 });

  useFrame((state, dt) => {
    stepWall(shared, camGoal.current, motionOn.current, state.camera as PerspectiveCamera, state.size.height, state.viewport.dpr, dt);
  });

  return (
    <>
      {specs.map((s, i) => (
        <Plate key={s.id} spec={s} order={i} shared={shared} highTier={highTier} />
      ))}
      <Motes shared={shared} count={highTier ? 160 : 60} />
      <Haze shared={shared} />
    </>
  );
}

export interface LanternSceneProps {
  /** Render loop on/off (off when scrolled away). */
  active: boolean;
  highTier: boolean;
  /** Ambient camera sway allowed (false under reduced motion). */
  motionOn: { current: boolean };
}

export default function LanternScene({ active, highTier, motionOn }: LanternSceneProps) {
  return (
    <Canvas
      flat
      dpr={[1, highTier ? 1.5 : 1.25]}
      frameloop={active ? "always" : "never"}
      camera={{ fov: FOV, near: 0.1, far: 40, position: [0, 0, 0] }}
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      onCreated={({ gl }) => gl.setClearColor(new Color(0.004, 0.0048, 0.0075), 1)}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      {/* The halftone grid is laid out in drawing-buffer px, so a lower ratio only softens the dots. */}
      <AdaptiveDpr min={1} max={highTier ? 1.5 : 1.25} />
      <Wall highTier={highTier} motionOn={motionOn} />
    </Canvas>
  );
}
