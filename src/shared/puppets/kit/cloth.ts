import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  Uint32BufferAttribute,
  type Material,
  type MeshStandardMaterial,
} from "three";
import { addPatch } from "./shaderPatch";

/**
 * Cloth. `swayRobe` patches a material's vertex shader so the hem swings (amplitude
 * grows toward the bottom); `createLatheRobe` builds a folded robe/cloak from a profile.
 * Both are driven by uniforms only; update() allocates nothing.
 */

export interface SwayRobeOptions {
  /** Local y of the hem (bottom of the cloth). */
  hemY: number;
  /** Local y above which the cloth is rigid (waist/shoulders). */
  topY: number;
  /** Hem amplitude in metres (default 0.05). */
  amplitude?: number;
  /** Travelling-wave count around the circumference (default 3). */
  waves?: number;
  /** Wave speed (default 1.4). */
  speed?: number;
  /** Extra outward flare of the hem when walking/spinning (default 0.04). */
  flare?: number;
}

export interface RobeMotion {
  /** 0..1.5 idle sway amount (mood.sway-driven). Default 1. */
  sway?: number;
  /** 0..1 walking amount. */
  walk?: number;
  /** Gait phase (ctx.gaitPhase). */
  phase?: number;
  /** 0..1 extra billow (spin, anger, surprise). */
  billow?: number;
}

export interface RobeHandle {
  update(time: number, m?: RobeMotion): void;
}

const HEAD = /* glsl */ `
uniform float uTime;
uniform float uHemY;
uniform float uTopY;
uniform float uAmp;
uniform float uWaves;
uniform float uSpeed;
uniform float uFlare;
uniform float uSway;
uniform float uWalk;
uniform float uPhase;
uniform float uBillow;
`;

const POS = /* glsl */ `
{
  float rk = clamp((uTopY - position.y) / max(uTopY - uHemY, 0.001), 0.0, 1.0);
  rk = rk * rk;
  float ang = atan(position.x, position.z);
  float ph = ang * uWaves;
  float wob = sin(uTime * uSpeed + ph) * 0.6 + sin(uTime * uSpeed * 1.7 + ph * 1.9 + 1.3) * 0.4;
  vec2 rad = position.xz / max(length(position.xz), 0.0001);
  float amt = uAmp * rk;
  transformed.xz += rad * (wob * uSway + uBillow * 0.8) * amt;
  transformed.xz += rad * uFlare * uBillow * rk;
  float swing = sin(uPhase) * uWalk;
  transformed.z += swing * amt * 1.4 * cos(ang);
  transformed.x += cos(uPhase * 0.5 + ang) * uWalk * amt * 0.35;
  transformed.y += wob * 0.01 * rk * uSway;
}
`;

/** Patch `material` so its geometry's hem swings. Returns a handle to drive it per frame. */
export function swayRobe(material: Material, o: SwayRobeOptions): RobeHandle {
  const u = {
    uTime: { value: 0 },
    uHemY: { value: o.hemY },
    uTopY: { value: o.topY },
    uAmp: { value: o.amplitude ?? 0.05 },
    uWaves: { value: o.waves ?? 3 },
    uSpeed: { value: o.speed ?? 1.4 },
    uFlare: { value: o.flare ?? 0.04 },
    uSway: { value: 1 },
    uWalk: { value: 0 },
    uPhase: { value: 0 },
    uBillow: { value: 0 },
  };
  addPatch(material, { key: "swayRobe", uniforms: u, vertexHead: HEAD, vertexPosition: POS });
  return {
    update(time, m) {
      u.uTime.value = time;
      u.uSway.value = m?.sway ?? 1;
      u.uWalk.value = m?.walk ?? 0;
      u.uPhase.value = m?.phase ?? 0;
      u.uBillow.value = m?.billow ?? 0;
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Lathe robe
// ────────────────────────────────────────────────────────────────────────────

/** Profile points `[radius, y]`, ordered from the hem (bottom) up to the neck. */
export type RobeProfile = ReadonlyArray<readonly [radius: number, y: number]>;

export interface LatheRobeOptions {
  material: Material;
  /** Radial segments (default 56; low 32). */
  segments?: number;
  quality?: "high" | "low";
  /** Number of vertical folds around the circumference (default 9). */
  folds?: number;
  /** Fold depth as a fraction of radius at the hem (default 0.06). */
  foldDepth?: number;
  /** Sway at the hem, or false to keep it rigid. Defaults to hem..top of the profile. */
  sway?: Omit<SwayRobeOptions, "hemY" | "topY"> | false;
  /** UV repeat (u around, v up). */
  uvRepeat?: readonly [number, number];
  /** Close the top with a cap (so you can see no hole at the neck). */
  capTop?: boolean;
  seed?: number;
}

export interface LatheRobe extends RobeHandle {
  mesh: Mesh;
  dispose(): void;
}

/**
 * Smooth profile helper: a robe from hem to neck.
 * `shape` places control radii at fractions of the height (0 hem .. 1 neck).
 */
export function robeProfile(
  height: number,
  radii: { hem: number; knee?: number; waist: number; chest?: number; shoulder: number; neck: number },
  steps = 28,
): [number, number][] {
  const kn = radii.knee ?? (radii.hem + radii.waist) * 0.5;
  const ch = radii.chest ?? (radii.waist + radii.shoulder) * 0.5;
  const ctrl: [number, number][] = [
    [0, radii.hem],
    [0.32, kn],
    [0.55, radii.waist],
    [0.75, ch],
    [0.9, radii.shoulder],
    [1, radii.neck],
  ];
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    let k = 0;
    while (k < ctrl.length - 2 && t > ctrl[k + 1][0]) k++;
    const [t0, r0] = ctrl[k];
    const [t1, r1] = ctrl[k + 1];
    const u = (t - t0) / (t1 - t0);
    const s = u * u * (3 - 2 * u);
    out.push([r0 + (r1 - r0) * s, t * height]);
  }
  return out;
}

export function createLatheRobe(profile: RobeProfile, o: LatheRobeOptions): LatheRobe {
  const low = o.quality === "low";
  const segs = o.segments ?? (low ? 40 : 72);
  const rings = profile.length;
  const folds = o.folds ?? 9;
  const depth = o.foldDepth ?? 0.06;
  const [ur, vr] = o.uvRepeat ?? [1, 1];
  const yMin = profile[0][1];
  const yMax = profile[rings - 1][1];
  const cols = segs + 1;
  const pos = new Float32Array(rings * cols * 3);
  const uv = new Float32Array(rings * cols * 2);
  const seed = o.seed ?? 3;
  for (let r = 0; r < rings; r++) {
    const [rad, y] = profile[r];
    const v = (y - yMin) / Math.max(yMax - yMin, 1e-6);
    // folds fade out toward the shoulders
    const fa = depth * Math.pow(1 - v, 1.3);
    for (let c = 0; c < cols; c++) {
      const th = (c / segs) * Math.PI * 2;
      const fold = Math.sin(th * folds + seed + v * 1.4) * 0.65 + Math.sin(th * folds * 2.3 + seed * 2 + v * 2.7) * 0.35;
      const rr = rad * (1 + fa * fold);
      const i = r * cols + c;
      pos[i * 3] = Math.sin(th) * rr;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.cos(th) * rr;
      uv[i * 2] = (c / segs) * ur;
      uv[i * 2 + 1] = v * vr;
    }
  }
  const idx: number[] = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let c = 0; c < segs; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = a + cols;
      const e = d + 1;
      idx.push(a, b, d, b, e, d);
    }
  }
  if (o.capTop) {
    const centre = rings * cols;
    const arr = Array.from(pos);
    arr.push(0, yMax, 0);
    const top = (rings - 1) * cols;
    for (let c = 0; c < segs; c++) idx.push(centre, top + c, top + c + 1);
    const g = new BufferGeometry();
    const uvArr = Array.from(uv);
    uvArr.push(0.5, 1);
    g.setAttribute("position", new Float32BufferAttribute(arr, 3));
    g.setAttribute("uv", new Float32BufferAttribute(uvArr, 2));
    g.setIndex(new Uint32BufferAttribute(idx, 1));
    g.computeVertexNormals();
    fixSeam(g, rings, cols);
    return finish(g);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geo.setIndex(new Uint32BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  fixSeam(geo, rings, cols);
  return finish(geo);

  function finish(g: BufferGeometry): LatheRobe {
    // robe winds so normals face outward; shade both sides in case the camera sees the inside of the hem
    const mat = o.material as MeshStandardMaterial;
    if (mat.side === undefined || mat.side === 0) mat.side = 2;
    let handle: RobeHandle | null = null;
    if (o.sway !== false) {
      handle = swayRobe(o.material, { hemY: yMin, topY: yMin + (yMax - yMin) * 0.85, ...(o.sway ?? {}) });
    }
    const mesh = new Mesh(g, o.material);
    mesh.name = "robe";
    return {
      mesh,
      update(time, m) {
        handle?.update(time, m);
      },
      dispose() {
        g.dispose();
        o.material.dispose();
      },
    };
  }
}

/** Average normals across the u-seam so there is no visible crease. */
function fixSeam(g: BufferGeometry, rings: number, cols: number): void {
  const n = g.getAttribute("normal");
  for (let r = 0; r < rings; r++) {
    const a = r * cols;
    const b = r * cols + cols - 1;
    const x = n.getX(a) + n.getX(b);
    const y = n.getY(a) + n.getY(b);
    const z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
  n.needsUpdate = true;
}

// ────────────────────────────────────────────────────────────────────────────
// Tassel (pendulum)
// ────────────────────────────────────────────────────────────────────────────

export interface TasselDrive {
  /** Lateral (x) and forward (z) target angle in radians (e.g. from head yaw velocity / walk phase). */
  x?: number;
  z?: number;
}

export interface TasselHandle {
  /** Pivot at the top; hang children down -Y. */
  object: Group;
  /** Advance the pendulum. */
  update(dt: number, time: number, drive?: TasselDrive): void;
}

/** A damped pendulum group; put a tassel mesh below its origin. Its pivot is the origin. */
export function createTassel(opts: { length?: number; phase?: number; stiffness?: number } = {}): TasselHandle {
  const g = new Group();
  const len = opts.length ?? 0.12;
  const w2 = (opts.stiffness ?? 1) * (9.81 / Math.max(len, 0.02)) * 0.6;
  let ax = 0;
  let az = 0;
  let vx = 0;
  let vz = 0;
  const ph = opts.phase ?? 0;
  return {
    object: g,
    update(dt, time, drive) {
      if (dt <= 0) return;
      const h = Math.min(dt, 1 / 30);
      const tx = (drive?.x ?? 0) + Math.sin(time * 1.3 + ph) * 0.05;
      const tz = (drive?.z ?? 0) + Math.cos(time * 1.1 + ph * 1.7) * 0.04;
      vx += (w2 * (tx - ax) - 2.2 * vx) * h;
      vz += (w2 * (tz - az) - 2.2 * vz) * h;
      ax += vx * h;
      az += vz * h;
      g.rotation.z = ax;
      g.rotation.x = az;
    },
  };
}
