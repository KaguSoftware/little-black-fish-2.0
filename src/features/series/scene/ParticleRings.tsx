"use client";


import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, PlaneGeometry, ShaderMaterial, Vector3,
} from "three";
import { runtime } from "@/shared/lib/runtime";
import { TAU, clamp, damp, hash1, noise1, smoothstep } from "@/shared/lib/math";
import { useSeries, useUI } from "@/shared/state/store";
import { GRID_Y, latticeTarget, rippleHeight, tickGrid } from "./particles/lattice";

/**
 * Three tilted rings of glowing dots orbiting the hero's waist. One InstancedMesh;
 * positions are computed on the CPU each frame straight into instanceMatrix (zero
 * allocations). Camera-facing quads are expanded in the vertex shader, depth-tested,
 * so dots really pass in front of and behind the character.
 *
 * Moods shape the outline (petals/sharpness/jitter/sag/hop/orbit); chapters push on it
 * (THE DAY shatters, WHAT I DID swells, MY MAKER settles dots onto the RippleGrid).
 */

// ── Tuning ──────────────────────────────────────────────────────────────────
const RINGS = 3;
const DOTS_HIGH = 28;
const DOTS_LOW = 16;

const DEG = Math.PI / 180;
const RING_RADIUS = [0.75, 0.88, 0.64];
/** rad/s at mood.orbitSpeed = 1. Opposite signs make the rings counter-rotate. */
const RING_SPEED = [0.5, -0.38, 0.72];
const RING_TILT_X = [18 * DEG, -24 * DEG, 8 * DEG];
const RING_TILT_Z = [6 * DEG, 10 * DEG, -14 * DEG];
/** Slow precession wobble of each tilt (radians, rad/s). */
const TILT_WOBBLE = 0.07;
const TILT_WOBBLE_RATE = 0.27;
const RING_Y = [0, 0.07, -0.06];
/** Breathing of ring radius (fraction, rad/s). */
const BREATH = 0.03;
const BREATH_RATE = 0.6;

/** Scroll twist: offset = sign * progress * mood.twist * TWIST_GAIN * mult. */
const TWIST_SIGN = [1, -1, 1];
const TWIST_MULT = [1, 1.25, 0.8];
const TWIST_GAIN = 2.2;
/** Petal pattern rotates at (1 - PETAL_LAG) of the dot orbit speed, so dots flow through petals. */
const PETAL_LAG = 0.6;

/** Quad half-size in metres (glow radius). Core is about a third of this. */
const BASE_SIZE = 0.074;
const BASE_BRIGHT = 1.15;
/** Rotating bright "head" along each ring; makes uniform dots read as motion. */
const HEAD_SPEED = [0.9, -0.7, 1.15];
const HEAD_FLOOR = 0.5;
const TWINKLE = 0.22;

/** Dots nearer than this to the camera fade out (avoids giant blobs in close-ups). */
const NEAR_FADE = [0.45, 1.4] as const;

/** Cursor push. */
const PUSH_RADIUS = 0.45;
const PUSH_STRENGTH = 0.38;
const PUSH_IN_RATE = 18;
const PUSH_OUT_RATE = 2.4;

/** Jitter drift rate: slow enough to read as dust in a light beam, never as noise. */
const DRIFT_RATE = 0.35;

/** Sag (gravity) and hop wave. */
const HOP_RATE = 2.2;

/** THE DAY shatter: a slow-motion burst (debris drifting apart), not a hit. */
const SHATTER_IN = 1.6;
const SHATTER_OUT = 2.0;
const SHATTER_RADIAL = 1.1;
const SHATTER_SCATTER = 1.4;
const SHATTER_SPIN = 2.4;
const SHATTER_JAG = 0.08;
const SHATTER_FALL = 0.35;

/** WHAT I DID. */
const SWELL_RADIUS = 0.6;
const SWELL_BRIGHT = 0.5;

/** Teller-switch flash. */
const FLASH_DECAY = 1.4;
const FLASH_BRIGHT = 0.35;
const FLASH_RADIUS = 0.1;

const VERT = /* glsl */ `
attribute vec3 aParams; // half-size (m), brightness, seed
varying vec2 vUv;
varying float vB;
void main() {
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xy += position.xy * 2.0 * aParams.x;
  vUv = position.xy * 2.0;
  vB = aParams.y;
  gl_Position = projectionMatrix * c;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
varying vec2 vUv;
varying float vB;
void main() {
  float d = length(vUv);
  if (d >= 1.0) discard;
  float glow = pow(1.0 - d, 2.6);
  float core = smoothstep(0.34, 0.0, d);
  vec3 hot = mix(uColor, vec3(1.0), 0.6);
  vec3 col = (uColor * glow * 1.1 + hot * core * 1.4) * vB;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// ── Ring outline ────────────────────────────────────────────────────────────
const HALF_PI = Math.PI / 2;
const TWO_OVER_PI = 2 / Math.PI;

/** Petal wave for an integer petal count n; sharp 0 = sine, 1 = jagged spikes. -1..1. */
function petalWave(n: number, ang: number, sharp: number): number {
  if (n < 0.5) return 0;
  const x = n * ang;
  const sine = Math.cos(x);
  if (sharp < 0.001) return sine;
  const tri = TWO_OVER_PI * Math.asin(Math.sin(x + HALF_PI));
  const spike = 2 * Math.pow(0.5 + 0.5 * tri, 2.2) - 1;
  const jag = tri + (spike - tri) * 0.6;
  return sine + (jag - sine) * sharp;
}

/** Fractional petal count blended between floor and ceil so mood switches stay smooth. */
function petals(p: number, ang: number, sharp: number): number {
  const lo = Math.floor(p);
  const f = p - lo;
  const a = petalWave(lo, ang, sharp);
  if (f < 0.001) return a;
  return a + (petalWave(lo + 1, ang, sharp) - a) * f;
}

const _o = new Vector3();
const _d = new Vector3();
const _n = new Vector3();

export function ParticleRings() {
  const quality = useUI((s) => s.quality);
  const C = quality === "low" ? DOTS_LOW : DOTS_HIGH;
  const total = RINGS * C;

  const sim = useRef({
    time: 0,
    hop: 0,
    flash: 0,
    shatter: 0,
    orbit: [0.4, 2.1, 4.2],
  });

  const built = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1);
    const params = new InstancedBufferAttribute(new Float32Array(total * 3), 3);
    params.setUsage(DynamicDrawUsage);
    geometry.setAttribute("aParams", params);
    const material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uColor: { value: new Vector3(0.3, 0.5, 0.6) } },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
    });
    const mesh = new InstancedMesh(geometry, material, total);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.visible = false;
    const arr = mesh.instanceMatrix.array as Float32Array;
    for (let i = 0; i < total; i++) {
      arr[i * 16] = 1;
      arr[i * 16 + 5] = 1;
      arr[i * 16 + 10] = 1;
      arr[i * 16 + 15] = 1;
    }

    // Per-dot persistent data.
    let seed = 0x9e3779b9;
    const rand = () => {
      seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x297a2d39) | 0;
      return ((seed ^ (seed >>> 13)) >>> 0) / 4294967296;
    };
    const rnd = new Float32Array(total * 4); // size, scatter, lattice delay, spin
    const dir = new Float32Array(total * 3);
    const lat = new Float32Array(total * 2);
    const off = new Float32Array(total * 3);
    const tmp = { x: 0, z: 0 };
    for (let k = 0; k < RINGS; k++) {
      for (let j = 0; j < C; j++) {
        const i = k * C + j;
        rnd[i * 4] = rand();
        rnd[i * 4 + 1] = rand();
        rnd[i * 4 + 2] = rand();
        rnd[i * 4 + 3] = rand() * 2 - 1;
        const z = rand() * 2 - 1;
        const a = rand() * TAU;
        const s = Math.sqrt(1 - z * z);
        dir[i * 3] = Math.cos(a) * s;
        dir[i * 3 + 1] = z * 0.8 + 0.1;
        dir[i * 3 + 2] = Math.sin(a) * s;
        // Interleave rings so neighbouring dots settle in the same radial band.
        latticeTarget(j * RINGS + k, total, tmp);
        lat[i * 2] = tmp.x;
        lat[i * 2 + 1] = tmp.z;
      }
    }
    return { geometry, material, mesh, params, rnd, dir, lat, off };
  }, [C, total]);

  useEffect(
    () => () => {
      built.geometry.dispose();
      built.material.dispose();
      built.mesh.dispose();
    },
    [built],
  );

  // Teller switch -> brightness flash.
  useEffect(() => {
    return useSeries.subscribe((s, prev) => {
      if (s.switchedAt !== prev.switchedAt && s.switchSource !== "init") sim.current.flash = 1;
    });
  }, []);

  useFrame((state) => {
    const { mesh, material, params, rnd, dir, lat, off } = built;
    const f = runtime.frame;
    const m = f.mood;
    const fx = f.fx;
    const reduced = useUI.getState().reducedMotion;
    const S = sim.current;
    const dt = f.dt; // 0 while paused
    tickGrid(f, reduced);
    S.time += dt;
    const time = S.time;
    S.flash *= Math.exp(-dt * FLASH_DECAY);
    S.shatter = damp(S.shatter, fx.day, fx.day > S.shatter ? SHATTER_IN : SHATTER_OUT, dt);
    S.hop += dt * HOP_RATE;
    const orbitMul = m.orbitSpeed * (reduced ? 0.4 : 1);
    for (let k = 0; k < RINGS; k++) S.orbit[k] += dt * RING_SPEED[k] * orbitMul;

    // Chapter-level visibility: hidden in the LOOK CLOSER close-up and during the eye dive.
    const gFade = (1 - smoothstep(0.35, 1, fx.closeUp)) * (1 - smoothstep(0, 0.6, fx.diveApproach));
    if (gFade < 0.004) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;

    // Centre: hero waist.
    const waist = runtime.hero.waist;
    const cx = f.hero.x;
    const cz = f.hero.z;
    const cy = waist.y > 0.2 ? waist.y : 0.95;

    // Cursor ray -> plane facing the camera through the waist.
    const cam = state.camera;
    const ptr = runtime.pointer;
    let havePtr = ptr.active && fx.closeUp < 0.6;
    let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0;
    if (havePtr) {
      const e = cam.matrixWorld.elements;
      _o.set(e[12], e[13], e[14]);
      _d.set(ptr.x, ptr.y, 0.5).unproject(cam).sub(_o).normalize();
      _n.set(-e[8], -e[9], -e[10]);
      const denom = _d.dot(_n);
      const t = denom > 1e-4 ? ((cx - _o.x) * _n.x + (cy - _o.y) * _n.y + (cz - _o.z) * _n.z) / denom : -1;
      if (t > 0) {
        px = _o.x + _d.x * t;
        py = _o.y + _d.y * t;
        pz = _o.z + _d.z * t;
        nx = _n.x;
        ny = _n.y;
        nz = _n.z;
      } else havePtr = false;
    }
    const camX = cam.position.x, camY = cam.position.y, camZ = cam.position.z;
    const flee = m.cursorFlee * (reduced ? 0.6 : 1);
    const pushK1 = 1 - Math.exp(-PUSH_IN_RATE * dt);
    const pushK2 = 1 - Math.exp(-PUSH_OUT_RATE * dt);

    // Mood-derived scalars.
    const petalsN = m.ringPetals;
    const petalAmp = m.ringPetalAmp;
    const sharp = clamp(m.ringSharpness);
    const jitter = reduced ? 0 : m.ringJitter;
    const drift = time * DRIFT_RATE;
    const sag = m.ringSag;
    const hopAmp = m.ringHop * (reduced ? 0.4 : 1);
    const se = S.shatter;
    const shatterMove = reduced ? 0 : se;
    const swell = fx.swell;
    const maker = fx.maker;
    const radiusMul = 1 + SWELL_RADIUS * swell + FLASH_RADIUS * S.flash + (reduced ? 0.35 * se : 0);
    const brightMul =
      gFade * (1 + SWELL_BRIGHT * swell + FLASH_BRIGHT * S.flash + 0.8 * se) * BASE_BRIGHT;
    const twistBase = f.progress * m.twist * TWIST_GAIN;

    const arr = mesh.instanceMatrix.array as Float32Array;
    const pa = params.array as Float32Array;

    for (let k = 0; k < RINGS; k++) {
      const orbit = S.orbit[k];
      const twist = TWIST_SIGN[k] * TWIST_MULT[k] * twistBase;
      const R = RING_RADIUS[k] * radiusMul * (1 + BREATH * Math.sin(time * BREATH_RATE + k * 2.1));
      const wob = reduced ? 0 : TILT_WOBBLE * Math.sin(time * TILT_WOBBLE_RATE + k * 1.7);
      const tx = RING_TILT_X[k] + wob;
      const tz = RING_TILT_Z[k] - wob * 0.6;
      const ctx = Math.cos(tx), stx = Math.sin(tx);
      const ctz = Math.cos(tz), stz = Math.sin(tz);
      const headAng = time * HEAD_SPEED[k] * (reduced ? 0.4 : 1);
      const baseY = cy + RING_Y[k];

      for (let j = 0; j < C; j++) {
        const i = k * C + j;
        const r0 = rnd[i * 4], r1 = rnd[i * 4 + 1], r2 = rnd[i * 4 + 2], r3 = rnd[i * 4 + 3];

        // Outline in the ring's own plane.
        const ang = (TAU * j) / C + k * 0.9 + orbit + twist;
        const w = petals(petalsN, ang - orbit * PETAL_LAG, sharp);
        const r = R * (1 + petalAmp * w);
        const lx = r * Math.cos(ang);
        const lz = r * Math.sin(ang);

        // Tilt about X then Z.
        const z1 = lz * ctx;
        const y1 = -lz * stx;
        let x = lx * ctz - y1 * stz;
        let y = lx * stz + y1 * ctz;
        let z = z1;

        // Hop (travelling wave) and sag (gravity, heavier on the far side).
        if (hopAmp > 0.0005) {
          const hw = Math.max(0, Math.sin(ang * 2 - S.hop));
          y += hopAmp * hw * hw;
        }
        if (sag > 0.0005) {
          const sw = clamp(0.5 - (0.5 * z) / R);
          y -= sag * (0.3 + 0.7 * sw * sw);
        }

        // Jitter: a slow per-dot drift, the same for every mood (only the amount differs).
        if (jitter > 0.0003) {
          x += jitter * noise1(drift + i * 5.7);
          y += jitter * noise1(drift + i * 5.7 + 11.1);
          z += jitter * noise1(drift + i * 5.7 + 22.2);
        }

        // THE DAY: radial shatter with scatter, spin and a frozen jagged offset.
        if (shatterMove > 0.002) {
          const dd = (0.6 + SHATTER_RADIAL * r1) * shatterMove;
          const sc = (0.4 + SHATTER_SCATTER * r2) * shatterMove;
          const jag = SHATTER_JAG * shatterMove;
          const jid = i * 9.13;
          x += x * dd + dir[i * 3] * sc + jag * hash1(jid);
          y += y * dd * 0.6 + dir[i * 3 + 1] * sc + jag * hash1(jid + 2.2) - SHATTER_FALL * shatterMove * shatterMove * r0;
          z += z * dd + dir[i * 3 + 2] * sc + jag * hash1(jid + 4.4);
          const a = r3 * SHATTER_SPIN * shatterMove;
          const ca = Math.cos(a), sa = Math.sin(a);
          const nxr = x * ca + z * sa;
          z = -x * sa + z * ca;
          x = nxr;
        }

        let wx = cx + x;
        let wy = baseY + y;
        let wz = cz + z;

        // Cursor repulsion on the camera-facing plane through the waist.
        let mdot = 0;
        if (maker > 0.001) mdot = smoothstep(0.08 + 0.3 * r2, 0.6 + 0.35 * r2, maker);
        const oi = i * 3;
        let tgx = 0, tgy = 0, tgz = 0;
        if (havePtr && mdot < 0.6) {
          const dx = wx - px, dy = wy - py, dz = wz - pz;
          const dn = dx * nx + dy * ny + dz * nz;
          const ax = dx - nx * dn, ay = dy - ny * dn, az = dz - nz * dn;
          const dist = Math.sqrt(ax * ax + ay * ay + az * az);
          if (dist < PUSH_RADIUS) {
            const s = 1 - dist / PUSH_RADIUS;
            const amt = (PUSH_STRENGTH * flee * s * s) / Math.max(dist, 1e-3);
            tgx = ax * amt;
            tgy = ay * amt;
            tgz = az * amt;
          }
        }
        const ox = off[oi], oy = off[oi + 1], oz = off[oi + 2];
        const kk = tgx * tgx + tgy * tgy + tgz * tgz > ox * ox + oy * oy + oz * oz ? pushK1 : pushK2;
        const nox = ox + (tgx - ox) * kk;
        const noy = oy + (tgy - oy) * kk;
        const noz = oz + (tgz - oz) * kk;
        off[oi] = nox;
        off[oi + 1] = noy;
        off[oi + 2] = noz;
        const pm = 1 - mdot;
        wx += nox * pm;
        wy += noy * pm;
        wz += noz * pm;

        // MY MAKER: descend and settle onto a RippleGrid lattice vertex.
        if (mdot > 0.0005) {
          const lxl = lat[i * 2], lzl = lat[i * 2 + 1];
          const tyw = GRID_Y + 0.018 + rippleHeight(lxl, lzl);
          wx += (cx + lxl - wx) * mdot;
          wz += (cz + lzl - wz) * mdot;
          wy += (tyw - wy) * mdot * mdot;
        }

        arr[i * 16 + 12] = wx;
        arr[i * 16 + 13] = wy;
        arr[i * 16 + 14] = wz;

        // Brightness and size.
        const head = 0.5 + 0.5 * Math.cos(ang - headAng);
        const headB = head * head * head;
        const tw = reduced ? 0 : Math.sin(time * 0.9 + r0 * TAU * 3);
        let b = (HEAD_FLOOR + (1 - HEAD_FLOOR) * headB) * (1 + TWINKLE * tw);
        if (shatterMove > 0.01) b *= 1 - 0.35 * shatterMove * (0.5 + 0.5 * hash1(i * 3.7));
        const dxc = wx - camX, dyc = wy - camY, dzc = wz - camZ;
        const nearD = Math.sqrt(dxc * dxc + dyc * dyc + dzc * dzc);
        const near = smoothstep(NEAR_FADE[0], NEAR_FADE[1], nearD);
        const settle = 1 - 0.85 * mdot * Math.sqrt(mdot);
        const arrive = 1 + 0.7 * Math.sin(Math.PI * mdot) ** 2;
        b *= brightMul * near * settle * arrive;

        const size =
          BASE_SIZE * (0.75 + 0.5 * r0) * (0.85 + 0.3 * headB) * (1 + 0.2 * swell) *
          (1 + 0.5 * shatterMove * r1) * (1 + 0.3 * S.flash) * (1 - 0.5 * mdot);
        pa[i * 3] = size;
        pa[i * 3 + 1] = b;
        pa[i * 3 + 2] = r0;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    params.needsUpdate = true;
    (material.uniforms.uColor.value as Vector3).set(f.accent[0], f.accent[1], f.accent[2]);
  });

  return <primitive object={built.mesh} />;
}
