"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { AdditiveBlending, BackSide, Color, type Mesh, type ShaderMaterial, type Texture, Vector2 } from "three";
import { stillPlate } from "@/shared/content/stills";
import type { StillId } from "@/shared/content/types";
import { damp, noise1 } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { useSeries, useUI } from "@/shared/state/store";
import { GLSL_HASH } from "./stage/glsl";
import { PlateLibrary } from "./stage/plateLibrary";

// ── Tuning ─────────────────────────────────────────────────────────────────
const RADIUS = 16;
const HEIGHT = 14;
/** Mesh arc (degrees) of the cyclorama, centred upstage (-z). */
const MESH_ARC_DEG = 140;
/** Arc (degrees) the plate image is mapped across; cover-fit into this region. */
const PLATE_ARC_DEG = 100;
/** World y of the cylinder centre (the plate's vertical centre). */
const CENTER_Y = 2.2;

/** Spotlight pool on the wall: half-extents in metres (arc length, height). */
const POOL_RX = 8.5;
const POOL_RY = 5.2;
/** Lift of the pool centre above the hero's line of sight (m). */
const POOL_LIFT = 1.6;
const POOL_FOLLOW = 5;
/** Height of the hero point the pool is projected from (m). */
const HERO_LOOK_Y = 1.3;

/** Overall plate brightness and baseline vignette floor. */
const PLATE_GAIN = 1.0;
/** Fraction of the original colour mixed into the duotone. */
const ORIGINAL_MIX = 0.35;
const GRAIN = 0.26;
const GRAIN_FPS = 24;
const BREATH_AMP = 0.06;
const BREATH_HZ = 0.055;
/** Camera-driven UV parallax per metre of camera offset (x, y). */
const PARALLAX_X = 0.0028;
const PARALLAX_Y = 0.0035;
/** Vertical focus (uv, 0 = bottom) used when a portrait plate is cover-fit. */
const PORTRAIT_FOCUS = 0.68;
/** Below this overall opacity the cyclorama isn't drawn at all. */
const MIN_VISIBLE = 0.002;

const ARC = (PLATE_ARC_DEG * Math.PI) / 180;
const REGION_ASPECT = (RADIUS * ARC) / HEIGHT;
const MESH_ARC = (MESH_ARC_DEG * Math.PI) / 180;

const VERT = /* glsl */ `
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uTexA;
uniform sampler2D uTexB;
uniform float uHasA;
uniform float uHasB;
uniform float uAspA;
uniform float uAspB;
uniform float uFocA;
uniform float uFocB;
uniform float uMix;
uniform float uOpacity;
uniform vec3 uBg;
uniform vec3 uAccent;
uniform vec2 uPool;       // x: pool centre angle (rad), y: pool centre world y
uniform vec2 uPoolR;      // metres
uniform vec2 uPara;
uniform float uArc;
uniform float uRadius;
uniform float uHeight;
uniform float uCenterY;
uniform float uRegion;
uniform float uGrainT;
uniform float uBreath;
uniform float uDay;
uniform float uFlicker;
uniform float uLow;
uniform float uOrig;
uniform float uGain;
uniform float uGrain;
varying vec3 vLocal;
${GLSL_HASH}

vec2 coverUV(vec2 w, float asp, float foc) {
  vec2 s = asp > uRegion ? vec2(uRegion / asp, 1.0) : vec2(1.0, asp / uRegion);
  s *= 0.97; // slight overscan so parallax never exposes an edge
  vec2 c = vec2(0.5);
  if (asp < uRegion) c.y = clamp(foc, s.y * 0.5, 1.0 - s.y * 0.5);
  return (w - 0.5) * s + c;
}

void main() {
  float phi = atan(vLocal.x, -vLocal.z);
  float yW = vLocal.y + uCenterY;
  vec2 w = vec2(phi / uArc + 0.5, vLocal.y / uHeight + 0.5);

  float wa = (1.0 - uMix) * uHasA;
  float wb = uMix * uHasB;
  float ws = wa + wb;
  if (ws < 0.001 || uOpacity < 0.001) discard;

  vec3 ca = uHasA > 0.5 ? texture2D(uTexA, coverUV(w + uPara, uAspA, uFocA)).rgb : vec3(0.0);
  vec3 cb = uHasB > 0.5 ? texture2D(uTexB, coverUV(w + uPara, uAspB, uFocB)).rgb : vec3(0.0);
  vec3 col = (ca * wa + cb * wb) / ws;

  // Treatment: luminance -> duotone (stage -> accent), keep some of the original colour.
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float lg = smoothstep(0.015, 0.92, pow(max(lum, 0.0), 0.4545));
  vec3 duo = mix(uBg * 1.5, uAccent * 1.25, lg);
  vec3 treated = mix(duo, col, uOrig);

  // THE DAY: red-shifted, contrasty, flickering.
  treated = mix(treated, treated * vec3(1.45, 0.62, 0.55), uDay);
  treated = max((treated - 0.1) * (1.0 + 0.45 * uDay) + 0.1, 0.0);
  // Bright skies must not blow out: soft-compress highlights, and darken the whole plate on THE DAY.
  treated = treated / (1.0 + max(treated - 0.55, 0.0) * 1.6);
  treated *= 1.0 - 0.35 * uDay;

  // Spotlight vignette: bright pool behind the hero, black at the edges, top and bottom.
  vec2 dd = vec2((phi - uPool.x) * uRadius / uPoolR.x, (yW - uPool.y) / uPoolR.y);
  float pool = 1.0 - smoothstep(0.0, 1.0, length(dd));
  pool = pow(pool, 1.35);
  float tb = smoothstep(0.0, 2.4, yW) * (1.0 - smoothstep(6.5, 10.0, yW));
  float edge = smoothstep(0.0, 0.05, w.x) * (1.0 - smoothstep(0.95, 1.0, w.x));
  float vig = (0.035 + 0.965 * pool) * tb * edge;

  float exposure = uBreath * (1.0 - uDay * 0.25 * uFlicker);
  vec3 outc = treated * vig * exposure * uOpacity * min(ws, 1.0) * uGain;

  if (uLow < 0.5) {
    float g = hash12(gl_FragCoord.xy + uGrainT * 61.7) - 0.5;
    outc *= 1.0 + g * uGrain;
    outc += vec3(g) * 0.004 * pool * uOpacity;
  }

  gl_FragColor = vec4(max(outc, 0.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

interface Slot {
  id: StillId | null;
  url: string | null;
  tex: Texture | null;
  aspect: number;
}

const makeSlot = (): Slot => ({ id: null, url: null, tex: null, aspect: 16 / 9 });

/**
 * Curved cyclorama behind the stage. Shows the current teller's plate stills as
 * duotone, spot-vignetted light that emerges from black.
 */
export function Backdrop() {
  const gl = useThree((s) => s.gl);
  const mat = useRef<ShaderMaterial>(null);
  const mesh = useRef<Mesh>(null);
  const slotA = useMemo(makeSlot, []);
  const slotB = useMemo(makeSlot, []);
  const lib = useRef<PlateLibrary | null>(null);
  const pool = useMemo(() => ({ phi: 0, y: 2.5, init: false }), []);
  const clock = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTexA: { value: null as Texture | null },
      uTexB: { value: null as Texture | null },
      uHasA: { value: 0 },
      uHasB: { value: 0 },
      uAspA: { value: 16 / 9 },
      uAspB: { value: 16 / 9 },
      uFocA: { value: PORTRAIT_FOCUS },
      uFocB: { value: PORTRAIT_FOCUS },
      uMix: { value: 0 },
      uOpacity: { value: 0 },
      uBg: { value: new Color() },
      uAccent: { value: new Color() },
      uPool: { value: new Vector2(0, 2.5) },
      uPoolR: { value: new Vector2(POOL_RX, POOL_RY) },
      uPara: { value: new Vector2() },
      uArc: { value: ARC },
      uRadius: { value: RADIUS },
      uHeight: { value: HEIGHT },
      uCenterY: { value: CENTER_Y },
      uRegion: { value: REGION_ASPECT },
      uGrainT: { value: 0 },
      uBreath: { value: 1 },
      uDay: { value: 0 },
      uFlicker: { value: 0 },
      uLow: { value: 0 },
      uOrig: { value: ORIGINAL_MIX },
      uGain: { value: PLATE_GAIN },
      uGrain: { value: GRAIN },
    }),
    [],
  );

  // Texture library: prefetch only the teller telling now and the one under the pointer.
  // Every other plate loads when a slot first asks for it (see updateSlot), so reaching
  // THE OTHERS no longer decodes and uploads every teller's plates at once.
  useEffect(() => {
    const l = new PlateLibrary(gl);
    lib.current = l;
    l.requestForTellers({ [useSeries.getState().teller]: true });
    const unsub = useSeries.subscribe((s, prev) => {
      if (s.teller !== prev.teller) l.requestForTellers({ [s.teller]: true });
      if (s.hoverTeller && s.hoverTeller !== prev.hoverTeller) l.requestForTellers({ [s.hoverTeller]: true });
    });
    return () => {
      unsub();
      lib.current = null;
      slotA.tex = slotB.tex = null;
      slotA.id = slotB.id = null;
      slotA.url = slotB.url = null;
      uniforms.uTexA.value = null;
      uniforms.uTexB.value = null;
      l.dispose();
    };
  }, [gl, slotA, slotB, uniforms]);

  useFrame((state, delta) => {
    const m = mat.current;
    const me = mesh.current;
    const l = lib.current;
    if (!m || !me || !l) return;
    const f = runtime.frame;
    const ui = useUI.getState();
    const dt = Math.min(delta, 0.05);
    const live = !ui.paused && !ui.reducedMotion;
    if (live) clock.current += dt;
    const u = m.uniforms;

    // ── Plate slots: keep showing the previous texture until the new one has loaded ──
    updateSlot(slotA, f.plate.a, l);
    updateSlot(slotB, f.plate.b, l);
    if (u.uTexA.value !== slotA.tex) u.uTexA.value = slotA.tex;
    if (u.uTexB.value !== slotB.tex) u.uTexB.value = slotB.tex;
    u.uHasA.value = f.plate.a && slotA.tex ? 1 : 0;
    u.uHasB.value = f.plate.b && slotB.tex ? 1 : 0;
    u.uAspA.value = slotA.aspect;
    u.uAspB.value = slotB.aspect;
    u.uMix.value = f.plate.mix;

    const visible = f.plate.opacity * (1 - f.fx.maker);
    u.uOpacity.value = visible;
    me.visible = visible > MIN_VISIBLE && (u.uHasA.value > 0 || u.uHasB.value > 0);
    if (!me.visible) return;

    // ── Colours ──
    u.uBg.value.setRGB(f.bg[0], f.bg[1], f.bg[2]);
    u.uAccent.value.setRGB(f.accent[0], f.accent[1], f.accent[2]);

    // ── Spotlight pool: where the camera -> hero ray meets the wall ──
    const cam = state.camera.position;
    const hx = f.hero.x;
    const hz = f.hero.z;
    const dx = hx - cam.x;
    const dz = hz - cam.z;
    const dy = HERO_LOOK_Y - cam.y;
    const a = dx * dx + dz * dz;
    let phi = Math.atan2(hx, 8);
    let yc = 2.4;
    if (a > 1e-6) {
      const b = 2 * (cam.x * dx + cam.z * dz);
      const c = cam.x * cam.x + cam.z * cam.z - RADIUS * RADIUS;
      const disc = b * b - 4 * a * c;
      if (disc > 0) {
        const t = (-b + Math.sqrt(disc)) / (2 * a);
        if (t > 0) {
          const px = cam.x + t * dx;
          const pz = cam.z + t * dz;
          phi = Math.atan2(px, -pz);
          yc = cam.y + t * dy + POOL_LIFT;
        }
      }
    }
    const half = MESH_ARC / 2;
    phi = Math.max(-half, Math.min(half, phi));
    if (!pool.init) {
      pool.phi = phi;
      pool.y = yc;
      pool.init = true;
    } else {
      pool.phi = damp(pool.phi, phi, POOL_FOLLOW, dt);
      pool.y = damp(pool.y, yc, POOL_FOLLOW, dt);
    }
    u.uPool.value.set(pool.phi, pool.y);

    // ── Parallax from camera position ──
    u.uPara.value.set(-cam.x * PARALLAX_X, -(cam.y - 1.4) * PARALLAX_Y);

    // ── Time-based: grain steps, breathing, THE DAY flicker ──
    const t = clock.current;
    u.uGrainT.value = Math.floor(t * GRAIN_FPS) % 997;
    u.uBreath.value = 1 + (live ? Math.sin(t * BREATH_HZ * Math.PI * 2) * BREATH_AMP : 0);
    u.uDay.value = f.fx.day;
    u.uFlicker.value = live ? Math.max(0, noise1(t * 14) * 0.6 + noise1(t * 31 + 9) * 0.4 + 0.25) : 0;
    u.uLow.value = ui.quality === "low" ? 1 : 0;
  });

  return (
    <mesh ref={mesh} position={[0, CENTER_Y, 0]} renderOrder={-10} frustumCulled={false} visible={false}>
      <cylinderGeometry
        args={[RADIUS, RADIUS, HEIGHT, 96, 1, true, Math.PI - MESH_ARC / 2, MESH_ARC]}
      />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={VERT}
        fragmentShader={FRAG}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        side={BackSide}
        fog={false}
      />
    </mesh>
  );
}

function updateSlot(slot: Slot, id: StillId | null, lib: PlateLibrary) {
  if (id !== slot.id) {
    slot.id = id;
    slot.url = id ? stillPlate(id) : null;
    if (slot.url) lib.request(slot.url);
  }
  if (!slot.url) return; // no plate wanted: keep the old texture so it can fade out
  const e = lib.get(slot.url);
  if (e && e.tex !== slot.tex) {
    slot.tex = e.tex;
    slot.aspect = e.aspect;
  }
}
