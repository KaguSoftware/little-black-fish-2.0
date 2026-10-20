import {
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  NoColorSpace,
  RepeatWrapping,
  Vector3,
} from "three";
import { cached, makeCanvas } from "../../kit";
import { RingTubes } from "./ringTubes";

/**
 * A nest of black cobras that drape the Snake King. All snakes share ONE dynamic geometry
 * (one draw call). Each snake has a REST path (coiled on the robe, head cocked up) and a
 * REARED path; `rear` 0..1 blends toward it (head rises, neck bows, hood flares).
 * Slither is a travelling wave along the surface-tangent side of the body. update() allocates nothing.
 */

export interface CobraSpec {
  /** Rest path from TAIL to HEAD, in the nest's local space. */
  rest: Vector3[];
  /** Reared path (same ends); omitted = rest lifted by `lift` and pushed out by `out` near the head. */
  reared?: Vector3[];
  lift?: number;
  out?: number;
  /** Thickest body radius in metres. */
  radius: number;
  /** How much of the global rear this snake responds to (0..1). */
  gain: number;
  phase: number;
  /** Slither amplitude multiplier. */
  slither?: number;
  /** Resting hood flare 0..1. */
  hood?: number;
}

export interface NestDrive {
  rear: number;
  slither: number;
  speed: number;
  flare: number;
  /** Head turn toward the viewer's pointer, radians. */
  look: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const bellAt = (x: number, c: number, w: number) => Math.exp(-((x - c) * (x - c)) / (w * w));

/** Diamond scale bump, shared and cached (never disposed by builders). */
export function scalesTexture() {
  return cached("tex:cobraScales", () => {
    const size = 128;
    const { canvas, ctx } = makeCanvas(size);
    ctx.fillStyle = "#303030";
    ctx.fillRect(0, 0, size, size);
    const cols = 8;
    const rows = 16;
    const cw = size / cols;
    const rh = size / rows;
    for (let r = -1; r <= rows; r++) {
      for (let c = -1; c <= cols; c++) {
        const cx = (c + (r % 2 ? 0.5 : 0)) * cw + cw / 2;
        const cy = r * rh + rh / 2;
        const g = ctx.createRadialGradient(cx, cy - rh * 0.1, 0, cx, cy, rh * 1.05);
        g.addColorStop(0, "#f0f0f0");
        g.addColorStop(0.6, "#9a9a9a");
        g.addColorStop(1, "#303030");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(cx, cy - rh * 0.95);
        ctx.lineTo(cx + cw * 0.55, cy);
        ctx.lineTo(cx, cy + rh * 0.95);
        ctx.lineTo(cx - cw * 0.55, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
    const t = new CanvasTexture(canvas);
    t.colorSpace = NoColorSpace;
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = 4;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    return t;
  });
}

export function makeCobraMaterial(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: new Color("#14171a"),
    roughness: 0.34,
    metalness: 0.15,
    bumpMap: scalesTexture(),
    bumpScale: 0.9,
    sheen: 0.8,
    sheenRoughness: 0.35,
    sheenColor: new Color("#6d8f86"),
    clearcoat: 0.45,
    clearcoatRoughness: 0.3,
    envMapIntensity: 1.25,
  });
}

export interface CobraNest {
  object: Group;
  update(time: number, d: NestDrive): void;
  dispose(): void;
}

export function createCobraNest(specs: CobraSpec[], quality: "high" | "low", material: MeshPhysicalMaterial): CobraNest {
  const low = quality === "low";
  const rings = low ? 30 : 50;
  const sides = low ? 6 : 9;
  const n = specs.length;

  // ring positions along the arc: dense toward the head so the head and hood have enough rings
  const sOf = new Float32Array(rings);
  for (let k = 0; k < rings; k++) sOf[k] = 1 - Math.pow(1 - k / (rings - 1), 1.55);

  const lengths = new Float32Array(n);
  const rest: Float32Array[] = [];
  const reared: Float32Array[] = [];
  const lat: Float32Array[] = [];
  const baseR: Float32Array[] = [];
  const dist: Float32Array[] = [];

  const tmp = new Vector3();
  for (let i = 0; i < n; i++) {
    const sp = specs[i];
    const c0 = new CatmullRomCurve3(sp.rest, false, "centripetal");
    const L = c0.getLength();
    lengths[i] = L;
    const R = new Float32Array(rings * 3);
    for (let k = 0; k < rings; k++) {
      c0.getPointAt(sOf[k], tmp);
      R[k * 3] = tmp.x;
      R[k * 3 + 1] = tmp.y;
      R[k * 3 + 2] = tmp.z;
    }
    const Rr = new Float32Array(rings * 3);
    if (sp.reared) {
      const c1 = new CatmullRomCurve3(sp.reared, false, "centripetal");
      for (let k = 0; k < rings; k++) {
        c1.getPointAt(sOf[k], tmp);
        Rr[k * 3] = tmp.x;
        Rr[k * 3 + 1] = tmp.y;
        Rr[k * 3 + 2] = tmp.z;
      }
    } else {
      const lift = sp.lift ?? 0.18;
      const out = sp.out ?? 0.1;
      for (let k = 0; k < rings; k++) {
        const w = smooth(0.45, 1, sOf[k]);
        const w2 = w * w;
        const x = R[k * 3];
        const z = R[k * 3 + 2];
        const l = Math.hypot(x, z) || 1;
        Rr[k * 3] = x + (x / l) * out * w2;
        Rr[k * 3 + 1] = R[k * 3 + 1] + lift * w2;
        Rr[k * 3 + 2] = z + (z / l) * out * w2;
      }
    }
    // surface-tangent side vector for the slither wave
    const La = new Float32Array(rings * 3);
    for (let k = 0; k < rings; k++) {
      const a = Math.max(0, k - 1) * 3;
      const b = Math.min(rings - 1, k + 1) * 3;
      const tx = R[b] - R[a];
      const ty = R[b + 1] - R[a + 1];
      const tz = R[b + 2] - R[a + 2];
      const x = R[k * 3];
      const z = R[k * 3 + 2];
      let nx = x;
      let nz = z;
      const nl = Math.hypot(nx, nz);
      if (nl < 1e-4) {
        nx = 0;
        nz = 1;
      } else {
        nx /= nl;
        nz /= nl;
      }
      // side = T x N
      let sx = ty * nz;
      let sy = tz * nx - tx * nz;
      let sz = -ty * nx;
      const sl = Math.hypot(sx, sy, sz) || 1;
      sx /= sl;
      sy /= sl;
      sz /= sl;
      La[k * 3] = sx;
      La[k * 3 + 1] = sy;
      La[k * 3 + 2] = sz;
    }
    // body radius profile + distance from the head tip (metres)
    const Bd = new Float32Array(rings);
    const Dd = new Float32Array(rings);
    for (let k = 0; k < rings; k++) {
      const s = sOf[k];
      Bd[k] = sp.radius * (0.1 + 0.9 * smooth(0, 0.24, s));
      Dd[k] = (1 - s) * L;
    }
    rest.push(R);
    reared.push(Rr);
    lat.push(La);
    baseR.push(Bd);
    dist.push(Dd);
  }

  const tubes = new RingTubes(n, rings, sides, (i, k) => (sOf[k] * lengths[i]) / (specs[i].radius * 2.4), 3);
  for (let i = 0; i < n; i++) {
    // keep the hood opening horizontal from the neck up
    let from = rings;
    for (let k = 0; k < rings; k++) {
      if (dist[i][k] < 0.3 * (specs[i].radius / 0.024)) {
        from = k;
        break;
      }
    }
    tubes.horizFrom[i] = from;
  }

  const mesh = new Mesh(tubes.geometry, material);
  mesh.frustumCulled = false;
  mesh.name = "cobras";
  const object = new Group();
  object.name = "cobra-nest";
  object.add(mesh);

  function update(time: number, d: NestDrive): void {
    const { P, RX, RY } = tubes;
    for (let i = 0; i < n; i++) {
      const sp = specs[i];
      const R = rest[i];
      const Rr = reared[i];
      const La = lat[i];
      const Bd = baseR[i];
      const Dd = dist[i];
      const rear = Math.min(1, Math.max(0, d.rear * sp.gain));
      const t = time * d.speed + sp.phase;
      const amp = sp.radius * 0.9 * (sp.slither ?? 1) * d.slither;
      const sc = sp.radius / 0.024;
      const po = i * rings * 3;
      const ro = i * rings;
      const hoodAmt = Math.min(1, (sp.hood ?? 0.1) + rear * 0.9 + d.flare * 0.5);
      for (let k = 0; k < rings; k++) {
        const s = sOf[k];
        const w = rear * smooth(0.28, 0.95, s);
        const wave = Math.sin(6.4 * s * (lengths[i] * 0.9) - t * 2.4) * amp * (0.2 + 0.8 * smooth(0, 0.6, s)) * (1 - 0.65 * w);
        const lk = d.look * 0.07 * smooth(0.8, 1, s) * (0.5 + rear);
        P[po + k * 3] = R[k * 3] + (Rr[k * 3] - R[k * 3]) * w + La[k * 3] * wave + lk;
        P[po + k * 3 + 1] = R[k * 3 + 1] + (Rr[k * 3 + 1] - R[k * 3 + 1]) * w + La[k * 3 + 1] * wave;
        P[po + k * 3 + 2] = R[k * 3 + 2] + (Rr[k * 3 + 2] - R[k * 3 + 2]) * w + La[k * 3 + 2] * wave;
        // cross-section: tail taper, neck, hood, head
        const dm = Dd[k] / sc;
        let rx = Bd[k];
        let ry = Bd[k];
        const neck = 1 - 0.2 * bellAt(dm, 0.2, 0.06);
        rx *= neck;
        ry *= neck;
        const hood = bellAt(dm, 0.115, 0.05) * hoodAmt;
        rx += sp.radius * 2.8 * hood * (dm < 0.2 ? 1 : 0);
        ry += sp.radius * 0.35 * hood * (dm < 0.2 ? 1 : 0);
        if (dm < 0.075) {
          const q = dm / 0.075;
          const e = Math.sqrt(Math.max(0, 1 - (1 - q) * (1 - q)));
          rx = Math.max(sp.radius * 1.12 * e, 0.0004);
          ry = Math.max(sp.radius * 0.78 * e, 0.0004);
        }
        RX[ro + k] = rx;
        RY[ro + k] = ry;
      }
      tubes.build(i);
    }
    tubes.flush();
  }
  update(0, { rear: 0, slither: 1, speed: 1, flare: 0, look: 0 });

  return {
    object,
    update,
    dispose() {
      tubes.dispose();
    },
  };
}
