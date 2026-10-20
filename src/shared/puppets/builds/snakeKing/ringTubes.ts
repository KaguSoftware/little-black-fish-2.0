import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Float32BufferAttribute, Uint16BufferAttribute } from "three";

/**
 * Several elliptical-section tubes in ONE dynamic geometry (one draw call). Fill `P` (ring centres),
 * `RX` and `RY` (half-axes along the ring's side / up vectors) for a tube, call `build(i)`, then
 * `flush()` once. Frames are parallel-transported; from ring `horizFrom[i]` on, the side vector is
 * forced horizontal (so a cobra hood always opens toward the viewer). No per-frame allocation.
 */
export class RingTubes {
  readonly geometry = new BufferGeometry();
  readonly P: Float32Array;
  readonly RX: Float32Array;
  readonly RY: Float32Array;
  readonly horizFrom: Int32Array;
  private readonly pos: Float32Array;
  private readonly nor: Float32Array;
  private readonly posAttr: BufferAttribute;
  private readonly norAttr: BufferAttribute;
  private readonly T: Float32Array;
  private readonly cs: Float32Array;
  private readonly sn: Float32Array;

  constructor(
    readonly count: number,
    readonly rings: number,
    readonly sides: number,
    /** Texture v of ring k of tube i. */
    vOf: (tube: number, ring: number) => number,
    /** Texture u repeats around the tube. */
    uRepeat = 1,
  ) {
    const cols = sides + 1;
    const per = rings * cols;
    this.P = new Float32Array(count * rings * 3);
    this.RX = new Float32Array(count * rings);
    this.RY = new Float32Array(count * rings);
    this.horizFrom = new Int32Array(count).fill(1 << 20);
    this.pos = new Float32Array(count * per * 3);
    this.nor = new Float32Array(count * per * 3);
    this.T = new Float32Array(rings * 3);
    this.cs = new Float32Array(cols);
    this.sn = new Float32Array(cols);
    for (let j = 0; j < cols; j++) {
      this.cs[j] = Math.cos((j / sides) * Math.PI * 2);
      this.sn[j] = Math.sin((j / sides) * Math.PI * 2);
    }
    const uv = new Float32Array(count * per * 2);
    const idx: number[] = [];
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < rings; k++) {
        for (let j = 0; j < cols; j++) {
          const v = i * per + k * cols + j;
          uv[v * 2] = (j / sides) * uRepeat;
          uv[v * 2 + 1] = vOf(i, k);
        }
      }
      for (let k = 0; k < rings - 1; k++) {
        for (let j = 0; j < sides; j++) {
          const a = i * per + k * cols + j;
          const b = a + 1;
          const c = a + cols;
          const d = c + 1;
          idx.push(a, b, c, b, d, c);
        }
      }
    }
    this.posAttr = new BufferAttribute(this.pos, 3);
    this.norAttr = new BufferAttribute(this.nor, 3);
    this.posAttr.setUsage(DynamicDrawUsage);
    this.norAttr.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute("position", this.posAttr);
    this.geometry.setAttribute("normal", this.norAttr);
    this.geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    this.geometry.setIndex(new Uint16BufferAttribute(idx, 1));
  }

  /** Rebuild tube `i` from its P / RX / RY. */
  build(i: number): void {
    const { rings, sides, P, RX, RY, T, cs, sn, pos, nor } = this;
    const cols = sides + 1;
    const po = i * rings * 3;
    const ro = i * rings;
    const vo = i * rings * cols;
    for (let k = 0; k < rings; k++) {
      const a = po + Math.max(0, k - 1) * 3;
      const b = po + Math.min(rings - 1, k + 1) * 3;
      let tx = P[b] - P[a];
      let ty = P[b + 1] - P[a + 1];
      let tz = P[b + 2] - P[a + 2];
      const l = Math.hypot(tx, ty, tz) || 1;
      tx /= l;
      ty /= l;
      tz /= l;
      T[k * 3] = tx;
      T[k * 3 + 1] = ty;
      T[k * 3 + 2] = tz;
    }
    let sx = 0;
    let sy = 0;
    let sz = 0;
    const hf = this.horizFrom[i];
    for (let k = 0; k < rings; k++) {
      const tx = T[k * 3];
      const ty = T[k * 3 + 1];
      const tz = T[k * 3 + 2];
      if (k === 0) {
        // side = normalize(cross(T, ref))
        let ry = 0;
        let rz = 1;
        if (Math.abs(tz) > 0.9) {
          rz = 0;
          ry = 1;
        }
        sx = ty * rz - tz * ry;
        sy = -tx * rz;
        sz = tx * ry;
      } else {
        const d = sx * tx + sy * ty + sz * tz;
        sx -= tx * d;
        sy -= ty * d;
        sz -= tz * d;
      }
      if (k >= hf) {
        // horizontal side = cross(Y, T) = (tz, 0, -tx)
        const hl = Math.hypot(tz, tx);
        if (hl > 0.35) {
          let hx = tz / hl;
          let hz = -tx / hl;
          if (hx * sx + hz * sz < 0) {
            hx = -hx;
            hz = -hz;
          }
          sx = hx;
          sy = 0;
          sz = hz;
        }
      }
      let sl = Math.hypot(sx, sy, sz) || 1;
      sx /= sl;
      sy /= sl;
      sz /= sl;
      // re-orthogonalise against T (the override above ignores T's vertical part)
      const dd = sx * tx + sy * ty + sz * tz;
      sx -= tx * dd;
      sy -= ty * dd;
      sz -= tz * dd;
      sl = Math.hypot(sx, sy, sz) || 1;
      sx /= sl;
      sy /= sl;
      sz /= sl;
      // up = cross(T, side)
      const ux = ty * sz - tz * sy;
      const uy = tz * sx - tx * sz;
      const uz = tx * sy - ty * sx;
      const rx = RX[ro + k];
      const ry = RY[ro + k];
      const cx = P[po + k * 3];
      const cy = P[po + k * 3 + 1];
      const cz = P[po + k * 3 + 2];
      const irx = 1 / Math.max(rx, 1e-5);
      const iry = 1 / Math.max(ry, 1e-5);
      for (let j = 0; j < cols; j++) {
        const c = cs[j];
        const s = sn[j];
        let nx = sx * c * irx + ux * s * iry;
        let ny = sy * c * irx + uy * s * iry;
        let nz = sz * c * irx + uz * s * iry;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const v = (vo + k * cols + j) * 3;
        nor[v] = nx;
        nor[v + 1] = ny;
        nor[v + 2] = nz;
        pos[v] = cx + sx * c * rx + ux * s * ry;
        pos[v + 1] = cy + sy * c * rx + uy * s * ry;
        pos[v + 2] = cz + sz * c * rx + uz * s * ry;
      }
    }
  }

  flush(): void {
    this.posAttr.needsUpdate = true;
    this.norAttr.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
  }
}
