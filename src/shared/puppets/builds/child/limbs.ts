import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Mesh, Uint16BufferAttribute, type Material } from "three";

/**
 * Deformable two-bone limbs. One BufferGeometry holds every limb of a puppet (so the whole set is a
 * single draw call). Each frame `set()` re-solves a 2-bone IK from a root (shoulder / hip) to a target
 * (wrist / ankle) and rewrites the tube positions and normals in place. No allocation per frame.
 *
 * The solved centre line is a quadratic Bezier that passes through the elbow / knee, so the bend reads
 * as a soft joint rather than a hinge. Limbs stretch a little when the target is out of reach (puppet
 * licence: a waving hand never detaches from its arm).
 */

export interface LimbSpec {
  /** Upper and lower segment lengths in metres. */
  l1: number;
  l2: number;
  /** Radius at t in 0..1 along the limb (root .. end). */
  radius: (t: number) => number;
  /** Texture window: u spans `uSpan` around the limb, v runs `vSpan` along it from `v0`. */
  uv?: { uSpan: number; v0: number; vSpan: number; u0?: number };
}

export interface LimbSet {
  mesh: Mesh;
  /**
   * Solve limb `i`. `pole` is the direction the joint bends toward (need not be unit or perpendicular).
   */
  set(
    i: number,
    rx: number, ry: number, rz: number,
    tx: number, ty: number, tz: number,
    px: number, py: number, pz: number,
  ): void;
  /** Call once after all `set()` calls of a frame. */
  commit(): void;
  dispose(): void;
}

export function createLimbSet(specs: readonly LimbSpec[], material: Material, o: { rings?: number; sides?: number } = {}): LimbSet {
  const rings = o.rings ?? 13;
  const sides = o.sides ?? 10;
  const cols = sides + 1;
  const perLimb = rings * cols;
  const total = perLimb * specs.length;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const idx: number[] = [];
  const radii = specs.map((s) => Float32Array.from({ length: rings }, (_, k) => s.radius(k / (rings - 1))));
  specs.forEach((s, li) => {
    const w = s.uv ?? { uSpan: 1, v0: 0, vSpan: 1 };
    for (let k = 0; k < rings; k++) {
      for (let j = 0; j < cols; j++) {
        const i = li * perLimb + k * cols + j;
        uv[i * 2] = (w.u0 ?? 0) + (j / sides) * w.uSpan;
        uv[i * 2 + 1] = w.v0 + (k / (rings - 1)) * w.vSpan;
      }
    }
    for (let k = 0; k < rings - 1; k++) {
      for (let j = 0; j < sides; j++) {
        const a = li * perLimb + k * cols + j;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        idx.push(a, b, c, b, d, c);
      }
    }
  });
  const geo = new BufferGeometry();
  const pAttr = new BufferAttribute(pos, 3);
  const nAttr = new BufferAttribute(nor, 3);
  pAttr.setUsage(DynamicDrawUsage);
  nAttr.setUsage(DynamicDrawUsage);
  geo.setAttribute("position", pAttr);
  geo.setAttribute("normal", nAttr);
  geo.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geo.setIndex(new Uint16BufferAttribute(idx, 1));
  const sinT = Float32Array.from({ length: cols }, (_, j) => Math.sin((j / sides) * Math.PI * 2));
  const cosT = Float32Array.from({ length: cols }, (_, j) => Math.cos((j / sides) * Math.PI * 2));

  const mesh = new Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.name = "limbs";

  function set(
    li: number,
    rx: number, ry: number, rz: number,
    tx: number, ty: number, tz: number,
    px: number, py: number, pz: number,
  ): void {
    const s = specs[li];
    let dx = tx - rx;
    let dy = ty - ry;
    let dz = tz - rz;
    const d0 = Math.hypot(dx, dy, dz) || 1e-4;
    const reach = s.l1 + s.l2;
    const k = Math.max(1, d0 / (reach * 0.996));
    const l1 = s.l1 * k;
    const l2 = s.l2 * k;
    const d = d0;
    dx /= d;
    dy /= d;
    dz /= d;
    // pole perpendicular to the limb direction
    const pd = px * dx + py * dy + pz * dz;
    let qx = px - dx * pd;
    let qy = py - dy * pd;
    let qz = pz - dz * pd;
    let ql = Math.hypot(qx, qy, qz);
    if (ql < 1e-5) {
      qx = 0; qy = 0; qz = 1;
      const pd2 = dz;
      qx -= dx * pd2; qy -= dy * pd2; qz -= dz * pd2;
      ql = Math.hypot(qx, qy, qz) || 1;
    }
    qx /= ql; qy /= ql; qz /= ql;
    const a = (d * d + l1 * l1 - l2 * l2) / (2 * d);
    const h = Math.sqrt(Math.max(l1 * l1 - a * a, 0));
    const ex = rx + dx * a + qx * h;
    const ey = ry + dy * a + qy * h;
    const ez = rz + dz * a + qz * h;
    // Bezier control so that B(0.5) = elbow
    const cx = 2 * ex - 0.5 * (rx + tx);
    const cy = 2 * ey - 0.5 * (ry + ty);
    const cz = 2 * ez - 0.5 * (rz + tz);
    // plane normal N = dir x q (constant for a planar curve)
    const nx = dy * qz - dz * qy;
    const ny = dz * qx - dx * qz;
    const nz = dx * qy - dy * qx;
    const base = li * perLimb;
    const rr = radii[li];
    for (let ring = 0; ring < rings; ring++) {
      const t = ring / (rings - 1);
      const it = 1 - t;
      const bx = it * it * rx + 2 * it * t * cx + t * t * tx;
      const by = it * it * ry + 2 * it * t * cy + t * t * ty;
      const bz = it * it * rz + 2 * it * t * cz + t * t * tz;
      let ux = 2 * it * (cx - rx) + 2 * t * (tx - cx);
      let uy = 2 * it * (cy - ry) + 2 * t * (ty - cy);
      let uz = 2 * it * (cz - rz) + 2 * t * (tz - cz);
      const ul = Math.hypot(ux, uy, uz) || 1;
      ux /= ul; uy /= ul; uz /= ul;
      // V = T x N
      const vx = uy * nz - uz * ny;
      const vy = uz * nx - ux * nz;
      const vz = ux * ny - uy * nx;
      const r = rr[ring];
      for (let j = 0; j < cols; j++) {
        const c = cosT[j];
        const sn = sinT[j];
        const ox = nx * c + vx * sn;
        const oy = ny * c + vy * sn;
        const oz = nz * c + vz * sn;
        const i = (base + ring * cols + j) * 3;
        pos[i] = bx + ox * r;
        pos[i + 1] = by + oy * r;
        pos[i + 2] = bz + oz * r;
        nor[i] = ox;
        nor[i + 1] = oy;
        nor[i + 2] = oz;
      }
    }
  }

  return {
    mesh,
    set,
    commit() {
      pAttr.needsUpdate = true;
      nAttr.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
    },
  };
}
