import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
  Vector3,
  type ColorRepresentation,
  type Material,
} from "three";

/**
 * Tube-along-a-curve toolkit: static tubes with a radius profile (staffs, horns, tails),
 * and animated snakes (CPU-updated tube, travelling-wave slither, rear-up, cobra hood).
 * All per-frame code is scalar math on preallocated arrays.
 */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ────────────────────────────────────────────────────────────────────────────
// Static tube
// ────────────────────────────────────────────────────────────────────────────

export interface TubeOptions {
  /** Radius at arc-length fraction s in 0..1. */
  radius: (s: number) => number;
  tubular?: number;
  radial?: number;
  /** Texture v repeats along the length. */
  uvRepeat?: number;
  capEnds?: boolean;
}

/** Tube with a per-position radius and parallel-transport frames (no twisting). */
export function buildTubeGeometry(curve: CatmullRomCurve3, o: TubeOptions): BufferGeometry {
  const N = o.tubular ?? 48;
  const S = o.radial ?? 8;
  const pts = curve.getSpacedPoints(N);
  const cols = S + 1;
  const pos = new Float32Array((N + 1) * cols * 3);
  const nor = new Float32Array((N + 1) * cols * 3);
  const uv = new Float32Array((N + 1) * cols * 2);
  const T = new Vector3();
  const side = new Vector3();
  const up = new Vector3();
  const prev = new Vector3(0, 1, 0);
  const rep = o.uvRepeat ?? curve.getLength() / 0.1;
  for (let k = 0; k <= N; k++) {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(N, k + 1)];
    T.subVectors(b, a).normalize();
    if (k === 0) {
      side.crossVectors(T, Math.abs(T.y) > 0.95 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)).normalize();
    } else {
      side.copy(prev).addScaledVector(T, -prev.dot(T)).normalize();
    }
    prev.copy(side);
    up.crossVectors(T, side);
    const r = o.radius(k / N);
    for (let j = 0; j < cols; j++) {
      const th = (j / S) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const i = (k * cols + j) * 3;
      const nx = side.x * c + up.x * s;
      const ny = side.y * c + up.y * s;
      const nz = side.z * c + up.z * s;
      nor[i] = nx;
      nor[i + 1] = ny;
      nor[i + 2] = nz;
      pos[i] = pts[k].x + nx * r;
      pos[i + 1] = pts[k].y + ny * r;
      pos[i + 2] = pts[k].z + nz * r;
      uv[(k * cols + j) * 2] = j / S;
      uv[(k * cols + j) * 2 + 1] = (k / N) * rep;
    }
  }
  const idx: number[] = [];
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < S; j++) {
      const a = k * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  g.setIndex(new Uint32BufferAttribute(idx, 1));
  return g;
}

// ────────────────────────────────────────────────────────────────────────────
// Staff
// ────────────────────────────────────────────────────────────────────────────

export interface StaffOptions {
  /** Total length in metres (default 1.7). */
  length?: number;
  /** Thickest radius (default 0.016). */
  radius?: number;
  material: Material;
  /** Material for the ferrule and rings (default: `material`). */
  trimMaterial?: Material;
  /** Lateral wobble in metres along the shaft (default 0.012). */
  crooked?: number;
  /** Number of knots along the shaft (default 3). */
  knots?: number;
  /** Bend of the top section in metres (a shepherd's crook). 0 = straight. */
  crook?: number;
  seed?: number;
}

export interface StaffHandle {
  object: Group;
  /** Object3D at the very top, +Y along the shaft. Attach a head / ornament here. */
  top: Object3D;
  /** Where a hand should grip (about 62% up). */
  grip: Object3D;
  dispose(): void;
}

/** A tapered, slightly crooked staff with knots and a ferrule. Origin at the foot, +Y up. */
export function createStaff(o: StaffOptions): StaffHandle {
  const L = o.length ?? 1.7;
  const R = o.radius ?? 0.016;
  const wob = o.crooked ?? 0.012;
  const knots = o.knots ?? 3;
  const crook = o.crook ?? 0;
  const seed = o.seed ?? 1;
  const ctrl: Vector3[] = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.sin(t * 5.1 + seed) * wob * (1 - t * 0.3) + crook * smooth(0.82, 1, t) * smooth(0.82, 1, t);
    const z = Math.cos(t * 4.3 + seed * 2) * wob * 0.7;
    ctrl.push(new Vector3(x, t * L - crook * 0.15 * smooth(0.82, 1, t), z));
  }
  const curve = new CatmullRomCurve3(ctrl);
  const geo = buildTubeGeometry(curve, {
    tubular: 40,
    radial: 8,
    uvRepeat: L / 0.15,
    radius: (s) => {
      let r = R * (1.12 - 0.3 * s);
      for (let i = 1; i <= knots; i++) {
        const c = i / (knots + 1);
        r += R * 0.55 * Math.exp(-Math.pow((s - c) / 0.018, 2));
      }
      return r;
    },
  });
  const object = new Group();
  object.name = "staff";
  const shaft = new Mesh(geo, o.material);
  object.add(shaft);
  const extra: BufferGeometry[] = [];
  const trim = o.trimMaterial ?? o.material;
  const ferruleGeo = new SphereGeometry(R * 1.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
  ferruleGeo.rotateX(Math.PI);
  extra.push(ferruleGeo);
  const ferrule = new Mesh(ferruleGeo, trim);
  ferrule.position.copy(curve.getPointAt(0)).y += R * 0.4;
  object.add(ferrule);
  const top = new Object3D();
  top.position.copy(curve.getPointAt(1));
  const tangent = curve.getTangentAt(1);
  top.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), tangent);
  object.add(top);
  const grip = new Object3D();
  grip.position.copy(curve.getPointAt(0.62));
  object.add(grip);
  return {
    object,
    top,
    grip,
    dispose() {
      geo.dispose();
      extra.forEach((g) => g.dispose());
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Snake
// ────────────────────────────────────────────────────────────────────────────

export interface SnakeOptions {
  /** Rest path from the TAIL (index 0) to the HEAD (end). */
  path: CatmullRomCurve3;
  /** Thickest body radius in metres. */
  radius: number;
  /** Head size relative to the default (default 1). */
  headScale?: number;
  material: Material;
  /** Eye glow colour (default venom green). */
  eyeColor?: ColorRepresentation;
  /** Cobra hood (default true). */
  hood?: boolean;
  quality?: "high" | "low";
  /** Texture v repeats along the body (default length / (3 radius)). */
  uvRepeat?: number;
  /** Phase offset so a bundle of snakes does not move in sync. */
  phase?: number;
}

export interface SnakeParams {
  /** 0..1.5 lateral wave amplitude. Default 1. */
  slither?: number;
  /** Wave speed multiplier. Default 1. */
  speed?: number;
  /** 0..1 rear up (anger). */
  rear?: number;
  /** 0..1 extra hood flare. */
  flare?: number;
  /** 0..1 mouth open. */
  open?: number;
  /** Head aim offsets in radians (world look). */
  lookYaw?: number;
  lookPitch?: number;
}

export interface SnakeHandle {
  object: Group;
  /** Head pivot; follows the end of the spine each update. */
  head: Object3D;
  update(time: number, p?: SnakeParams): void;
  /** Disposes geometry and the materials created here. Does NOT dispose `options.material`. */
  dispose(): void;
}

const REAR_UP = 1.5;
const REAR_FWD = 1.2;
const TAU = Math.PI * 2;

export function createSnake(o: SnakeOptions): SnakeHandle {
  const low = o.quality === "low";
  const N = low ? 26 : 42;
  const S = low ? 6 : 8;
  const cols = S + 1;
  const R = o.radius;
  const hs = o.headScale ?? 1;
  const phase0 = o.phase ?? 0;
  const length = o.path.getLength();

  const rest = o.path.getSpacedPoints(N);
  // rest segment vectors
  const seg = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    seg[k * 3] = rest[k + 1].x - rest[k].x;
    seg[k * 3 + 1] = rest[k + 1].y - rest[k].y;
    seg[k * 3 + 2] = rest[k + 1].z - rest[k].z;
  }
  const radii = new Float32Array(N + 1);
  for (let k = 0; k <= N; k++) {
    const s = k / N;
    radii[k] = R * (0.1 + 0.9 * smooth(0, 0.3, s)) * (1 - 0.24 * smooth(0.78, 0.97, s));
  }

  // scratch
  const P = new Float32Array((N + 1) * 3);
  const Tn = new Float32Array((N + 1) * 3);
  const posArr = new Float32Array((N + 1) * cols * 3);
  const norArr = new Float32Array((N + 1) * cols * 3);
  const uvArr = new Float32Array((N + 1) * cols * 2);
  const rep = o.uvRepeat ?? length / (R * 3);
  for (let k = 0; k <= N; k++) for (let j = 0; j < cols; j++) {
    uvArr[(k * cols + j) * 2] = j / S;
    uvArr[(k * cols + j) * 2 + 1] = (k / N) * rep;
  }
  const idx: number[] = [];
  for (let k = 0; k < N; k++) {
    for (let j = 0; j < S; j++) {
      const a = k * cols + j;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new BufferGeometry();
  // BufferAttribute (not Float32BufferAttribute) keeps a reference to our arrays so per-frame writes show up.
  const posAttr = new BufferAttribute(posArr, 3);
  const norAttr = new BufferAttribute(norArr, 3);
  posAttr.setUsage(DynamicDrawUsage);
  norAttr.setUsage(DynamicDrawUsage);
  geo.setAttribute("position", posAttr);
  geo.setAttribute("normal", norAttr);
  geo.setAttribute("uv", new Float32BufferAttribute(uvArr, 2));
  geo.setIndex(new Uint16BufferAttribute(idx, 1));

  const object = new Group();
  object.name = "snake";
  const body = new Mesh(geo, o.material);
  body.frustumCulled = false;
  object.add(body);

  // head
  const head = new Group();
  object.add(head);
  const headInner = new Group();
  head.add(headInner);
  const owned: { dispose(): void }[] = [];
  const hr = R * 1.15 * hs;
  const skullGeo = new SphereGeometry(1, 16, 10);
  owned.push(skullGeo);
  const skull = new Mesh(skullGeo, o.material);
  skull.scale.set(hr * 1.0, hr * 0.62, hr * 1.7);
  skull.position.set(0, 0, hr * 0.9);
  headInner.add(skull);
  const jawPivot = new Group();
  jawPivot.position.set(0, -hr * 0.18, hr * 0.15);
  headInner.add(jawPivot);
  const jaw = new Mesh(skullGeo, o.material);
  jaw.scale.set(hr * 0.78, hr * 0.3, hr * 1.5);
  jaw.position.set(0, -hr * 0.12, hr * 0.78);
  jawPivot.add(jaw);
  const eyeMat = new MeshStandardMaterial({
    color: new Color("#10140c"),
    emissive: new Color(o.eyeColor ?? "#9cff5a"),
    emissiveIntensity: 2.2,
    roughness: 0.3,
  });
  owned.push(eyeMat);
  const eyeGeo = new SphereGeometry(hr * 0.17, 8, 6);
  owned.push(eyeGeo);
  for (const sx of [-1, 1]) {
    const eye = new Mesh(eyeGeo, eyeMat);
    eye.position.set(sx * hr * 0.58, hr * 0.2, hr * 1.35);
    headInner.add(eye);
  }
  let hood: Mesh | null = null;
  if (o.hood !== false) {
    const hoodMat = (o.material as MeshStandardMaterial).clone();
    hoodMat.side = DoubleSide;
    owned.push(hoodMat);
    hood = new Mesh(skullGeo, hoodMat);
    hood.position.set(0, -hr * 0.2, -hr * 0.45);
    hood.scale.set(0.01, 0.01, 0.01);
    headInner.add(hood);
  }

  // scratch for frame building
  const basis = new Matrix4();
  const bx = new Vector3();
  const by = new Vector3();
  const bz = new Vector3();

  function update(time: number, p?: SnakeParams): void {
    const slither = p?.slither ?? 1;
    const speed = p?.speed ?? 1;
    const rear = Math.min(1, Math.max(0, p?.rear ?? 0));
    const t = time * speed + phase0;

    // 1. march along rest segments, pitching the rear part up
    let x = rest[0].x;
    let y = rest[0].y;
    let z = rest[0].z;
    P[0] = x;
    P[1] = y;
    P[2] = z;
    for (let k = 0; k < N; k++) {
      const s = (k + 0.5) / N;
      let dx = seg[k * 3];
      let dy = seg[k * 3 + 1];
      let dz = seg[k * 3 + 2];
      const th = rear * (REAR_UP * smooth(0.1, 0.6, s) - REAR_FWD * smooth(0.8, 1.0, s));
      if (th !== 0) {
        // axis a = normalize(cross(d, up)), fallback cross(d, z)
        let ax = -dz;
        let ay = 0;
        let az = dx;
        let al = Math.hypot(ax, az);
        if (al < 0.25 * Math.hypot(dx, dy, dz)) {
          ax = dy;
          ay = -dx;
          az = 0;
          al = Math.hypot(ax, ay);
        }
        if (al > 1e-6) {
          ax /= al;
          ay /= al;
          az /= al;
          const c = Math.cos(th);
          const sn = Math.sin(th);
          // a x d
          const cx = ay * dz - az * dy;
          const cy = az * dx - ax * dz;
          const cz = ax * dy - ay * dx;
          dx = dx * c + cx * sn;
          dy = dy * c + cy * sn;
          dz = dz * c + cz * sn;
        }
      }
      x += dx;
      y += dy;
      z += dz;
      P[(k + 1) * 3] = x;
      P[(k + 1) * 3 + 1] = y;
      P[(k + 1) * 3 + 2] = z;
    }

    // 2. tangents of the marched spine
    for (let k = 0; k <= N; k++) {
      const a = Math.max(0, k - 1) * 3;
      const b = Math.min(N, k + 1) * 3;
      let tx = P[b] - P[a];
      let ty = P[b + 1] - P[a + 1];
      let tz = P[b + 2] - P[a + 2];
      const l = Math.hypot(tx, ty, tz) || 1;
      tx /= l;
      ty /= l;
      tz /= l;
      Tn[k * 3] = tx;
      Tn[k * 3 + 1] = ty;
      Tn[k * 3 + 2] = tz;
    }

    // 3. slither: lateral travelling wave (horizontal side of the tangent)
    if (slither > 0.001) {
      const amp = R * 2.0 * slither;
      for (let k = 1; k <= N; k++) {
        const s = k / N;
        const env = (0.18 + 0.82 * smooth(0, 0.7, s)) * (1 - 0.75 * rear * smooth(0.25, 1, s));
        const w = Math.sin(TAU * 1.25 * s - t * 2.6);
        let sx = -Tn[k * 3 + 2];
        let sz = Tn[k * 3];
        const sl = Math.hypot(sx, sz);
        if (sl < 0.2) {
          sx = 1;
          sz = 0;
        } else {
          sx /= sl;
          sz /= sl;
        }
        const off = w * amp * env;
        P[k * 3] += sx * off;
        P[k * 3 + 2] += sz * off;
        P[k * 3 + 1] += Math.sin(TAU * 2.1 * s - t * 3.1) * R * 0.25 * slither * env;
      }
      // recompute tangents after offsets
      for (let k = 0; k <= N; k++) {
        const a = Math.max(0, k - 1) * 3;
        const b = Math.min(N, k + 1) * 3;
        const tx = P[b] - P[a];
        const ty = P[b + 1] - P[a + 1];
        const tz = P[b + 2] - P[a + 2];
        const l = Math.hypot(tx, ty, tz) || 1;
        Tn[k * 3] = tx / l;
        Tn[k * 3 + 1] = ty / l;
        Tn[k * 3 + 2] = tz / l;
      }
    }

    // 4. parallel-transport frames and ring vertices
    let sdx = 0;
    let sdy = 0;
    let sdz = 0;
    let udx = 0;
    let udy = 0;
    let udz = 0;
    for (let k = 0; k <= N; k++) {
      const tx = Tn[k * 3];
      const ty = Tn[k * 3 + 1];
      const tz = Tn[k * 3 + 2];
      if (k === 0) {
        // side = normalize(cross(T, ref))
        const rz = 0;
        let rx = 0;
        let ry = 1;
        if (Math.abs(ty) > 0.95) {
          rx = 1;
          ry = 0;
        }
        sdx = ty * rz - tz * ry;
        sdy = tz * rx - tx * rz;
        sdz = tx * ry - ty * rx;
      } else {
        const d = sdx * tx + sdy * ty + sdz * tz;
        sdx -= tx * d;
        sdy -= ty * d;
        sdz -= tz * d;
      }
      const sl = Math.hypot(sdx, sdy, sdz) || 1;
      sdx /= sl;
      sdy /= sl;
      sdz /= sl;
      // up = cross(T, side)
      udx = ty * sdz - tz * sdy;
      udy = tz * sdx - tx * sdz;
      udz = tx * sdy - ty * sdx;
      const r = radii[k];
      for (let j = 0; j < cols; j++) {
        const th = (j / S) * TAU;
        const c = Math.cos(th);
        const sn = Math.sin(th);
        const nx = sdx * c + udx * sn;
        const ny = sdy * c + udy * sn;
        const nz = sdz * c + udz * sn;
        const i = (k * cols + j) * 3;
        norArr[i] = nx;
        norArr[i + 1] = ny;
        norArr[i + 2] = nz;
        posArr[i] = P[k * 3] + nx * r;
        posArr[i + 1] = P[k * 3 + 1] + ny * r;
        posArr[i + 2] = P[k * 3 + 2] + nz * r;
      }
      if (k === N) {
        bx.set(sdx, sdy, sdz);
        by.set(udx, udy, udz);
        bz.set(tx, ty, tz);
      }
    }
    posAttr.needsUpdate = true;
    norAttr.needsUpdate = true;

    // 5. head
    head.position.set(P[N * 3], P[N * 3 + 1], P[N * 3 + 2]);
    basis.makeBasis(bx, by, bz);
    head.quaternion.setFromRotationMatrix(basis);
    const flare = Math.min(1, 0.18 + rear * 0.85 + (p?.flare ?? 0));
    headInner.rotation.y = (p?.lookYaw ?? 0) + Math.sin(t * 0.9 + 1.3) * 0.12 * (0.4 + rear);
    headInner.rotation.x = (p?.lookPitch ?? 0) + Math.sin(t * 0.7) * 0.06 + rear * 0.1;
    jawPivot.rotation.x = (p?.open ?? 0) * 0.55;
    if (hood) {
      const h = flare * hr;
      hood.scale.set(h * 3.6, h * 4.4, Math.max(0.0001, hr * 0.16));
    }
  }

  update(0);

  return {
    object,
    head,
    update,
    dispose() {
      geo.dispose();
      owned.forEach((d) => d.dispose());
    },
  };
}

/** Convenience: a gently coiling rest path from `base` going up and around, for snakes draped on a robe or staff. */
export function coilPath(opts: {
  base: Vector3;
  length: number;
  turns?: number;
  radius?: number;
  rise?: number;
  /** Direction the coil advances (default +Y). */
  axis?: Vector3;
  phase?: number;
  points?: number;
}): CatmullRomCurve3 {
  const turns = opts.turns ?? 1.5;
  const rad = opts.radius ?? 0.08;
  const n = opts.points ?? 12;
  const axis = (opts.axis ?? new Vector3(0, 1, 0)).clone().normalize();
  const ref = Math.abs(axis.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const u = new Vector3().crossVectors(axis, ref).normalize();
  const v = new Vector3().crossVectors(axis, u).normalize();
  const rise = opts.rise ?? opts.length * 0.6;
  const pts: Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = (opts.phase ?? 0) + t * turns * TAU;
    pts.push(
      opts.base
        .clone()
        .addScaledVector(axis, t * rise)
        .addScaledVector(u, Math.cos(a) * rad)
        .addScaledVector(v, Math.sin(a) * rad),
    );
  }
  return new CatmullRomCurve3(pts);
}
