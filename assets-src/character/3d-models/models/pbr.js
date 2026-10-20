// PBR material toolkit: every surface gets colour, relief (normal map), and a packed
// roughness/metal map, so fabrics, metals and hair react to light like the references.
// Everything here exports cleanly to glTF (normalTexture, metallicRoughnessTexture,
// KHR_materials_sheen / clearcoat / anisotropy / iridescence).
import * as THREE from 'three';

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ---------- tileable value noise ----------
function hash2(ix, iy, seed) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177 | 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = t => t * t * (3 - 2 * t);
// x,y in [0,1), period = cells across (integer) -> tileable
export function vnoise(x, y, period, seed = 1) {
  const fx = x * period, fy = y * period;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fade(fx - ix), ty = fade(fy - iy);
  const m = v => ((v % period) + period) % period;
  const a = hash2(m(ix), m(iy), seed), b = hash2(m(ix + 1), m(iy), seed);
  const c = hash2(m(ix), m(iy + 1), seed), d = hash2(m(ix + 1), m(iy + 1), seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
export function fbm(x, y, period, oct = 4, seed = 1, gain = 0.5) {
  let s = 0, amp = 1, tot = 0, p = period;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x, y, p, seed + i * 17); tot += amp; amp *= gain; p *= 2; }
  return s / tot;
}
// ridged noise: sharp crease lines (crinkled linen, lame, cracks)
export function ridged(x, y, period, oct = 4, seed = 1) {
  let s = 0, amp = 1, tot = 0, p = period;
  for (let i = 0; i < oct; i++) { const n = vnoise(x, y, p, seed + i * 31); s += amp * (1 - Math.abs(2 * n - 1)) ** 2; tot += amp; amp *= 0.5; p *= 2; }
  return s / tot;
}

export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// per-pixel layer: fn(u, v, x, y) -> number 0..1 (grey) or [r,g,b] / [r,g,b,a] 0..255
export function pixels(w, h, fn) {
  const c = makeCanvas(w, h), g = c.getContext('2d');
  const id = g.createImageData(w, h), d = id.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fn(x / w, y / h, x, y), i = (y * w + x) * 4;
    if (typeof v === 'number') { const q = Math.max(0, Math.min(255, v * 255)); d[i] = d[i + 1] = d[i + 2] = q; d[i + 3] = 255; }
    else { d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = v[3] ?? 255; }
  }
  g.putImageData(id, 0, 0);
  return c;
}

// Sobel height -> tangent-space normal (OpenGL / glTF convention), wraps for tiling
export function heightToNormal(hc, strength = 2) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = src[i * 4] / 255;
  const out = makeCanvas(w, h), og = out.getContext('2d'), id = og.createImageData(w, h), d = id.data;
  const at = (x, y) => H[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
    const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  og.putImageData(id, 0, 0);
  return out;
}

function tex(c, srgb, o = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = o.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  if (o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
  t.anisotropy = 8;
  return t;
}

// One paint call draws matching layers so relief, shine and metal line up with the colour.
//   paint({ a, h, r, m }, w, h, rnd) — a: albedo ctx, h: height ctx (grey, 128 = flat),
//   r: roughness ctx (grey), m: metalness ctx (grey). Optional per-pixel passes too:
//   pixel(u, v) -> { a:[r,g,b], h:0..1, r:0..1, m:0..1 } (any subset) applied before paint.
export function surface(o) {
  const w = o.w ?? 1024, h = o.hgt ?? o.w ?? 1024, rnd = rng(o.seed ?? 1);
  const A = makeCanvas(w, h), Hc = makeCanvas(w, h), R = makeCanvas(w, h), M = makeCanvas(w, h);
  const a = A.getContext('2d'), hh = Hc.getContext('2d'), r = R.getContext('2d'), m = M.getContext('2d');
  a.fillStyle = o.base ?? '#808080'; a.fillRect(0, 0, w, h);
  hh.fillStyle = '#808080'; hh.fillRect(0, 0, w, h);
  const rv = Math.round((o.rough ?? 0.8) * 255), mv = Math.round((o.metal ?? 0) * 255);
  r.fillStyle = `rgb(${rv},${rv},${rv})`; r.fillRect(0, 0, w, h);
  m.fillStyle = `rgb(${mv},${mv},${mv})`; m.fillRect(0, 0, w, h);
  if (o.pixel) {
    const ia = a.getImageData(0, 0, w, h), ih = hh.getImageData(0, 0, w, h), ir = r.getImageData(0, 0, w, h), im = m.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const q = o.pixel(x / w, y / h, x, y); if (!q) continue;
      const i = (y * w + x) * 4;
      if (q.a) { ia.data[i] = q.a[0]; ia.data[i + 1] = q.a[1]; ia.data[i + 2] = q.a[2]; }
      if (q.h !== undefined) { const v = q.h * 255; ih.data[i] = ih.data[i + 1] = ih.data[i + 2] = v; }
      if (q.r !== undefined) { const v = q.r * 255; ir.data[i] = ir.data[i + 1] = ir.data[i + 2] = v; }
      if (q.m !== undefined) { const v = q.m * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; }
    }
    a.putImageData(ia, 0, 0); hh.putImageData(ih, 0, 0); r.putImageData(ir, 0, 0); m.putImageData(im, 0, 0);
  }
  if (o.paint) o.paint({ a, h: hh, r, m }, w, h, rnd);
  // pack: R = 255 (no AO), G = roughness, B = metalness (glTF metallicRoughness layout)
  const P = makeCanvas(w, h), pg = P.getContext('2d'), pd = pg.createImageData(w, h);
  const rd = r.getImageData(0, 0, w, h).data, md = m.getImageData(0, 0, w, h).data;
  for (let i = 0; i < w * h; i++) { pd.data[i * 4] = 255; pd.data[i * 4 + 1] = rd[i * 4]; pd.data[i * 4 + 2] = md[i * 4]; pd.data[i * 4 + 3] = 255; }
  pg.putImageData(pd, 0, 0);
  const rep = o.repeat;
  const res = {
    map: tex(A, true, { repeat: rep }),
    normalMap: tex(heightToNormal(Hc, o.nStrength ?? 3), false, { repeat: rep }),
    ormMap: tex(P, false, { repeat: rep }),
    canvases: { A, H: Hc, R, M },
  };
  return res;
}

// Material from a surface (or plain values). Physical so sheen/clearcoat/anisotropy are available.
export function pbr(o = {}) {
  const s = o.surf;
  const m = new THREE.MeshPhysicalMaterial({
    color: o.color ?? '#ffffff',
    map: s?.map ?? o.map ?? null,
    normalMap: s?.normalMap ?? o.normalMap ?? null,
    roughness: o.roughMul ?? (s ? 1 : (o.rough ?? 0.8)),
    metalness: o.metalMul ?? (s ? 1 : (o.metal ?? 0)),
    roughnessMap: s?.ormMap ?? null,
    metalnessMap: s?.ormMap ?? null,
    side: o.side ?? THREE.DoubleSide,
    envMapIntensity: o.env ?? 1,
  });
  if (m.normalMap) { const k = o.nScale ?? 1; m.normalScale.set(k, k); }
  if (o.sheen) { m.sheen = o.sheen; m.sheenColor = new THREE.Color(o.sheenColor ?? '#ffffff'); m.sheenRoughness = o.sheenRough ?? 0.5; }
  if (o.clearcoat) { m.clearcoat = o.clearcoat; m.clearcoatRoughness = o.clearcoatRough ?? 0.2; }
  if (o.aniso) { m.anisotropy = o.aniso; m.anisotropyRotation = o.anisoRot ?? Math.PI / 2; }
  if (o.irid) { m.iridescence = o.irid; m.iridescenceIOR = o.iridIOR ?? 1.6; m.iridescenceThicknessRange = o.iridRange ?? [200, 600]; }
  if (o.alphaMap || o.alphaTest) { m.alphaTest = o.alphaTest ?? 0.4; }
  if (o.transparent) { m.transparent = true; m.depthWrite = o.depthWrite ?? true; }
  if (o.specular !== undefined) m.specularIntensity = o.specular;
  if (o.ior) m.ior = o.ior;
  if (o.name) m.name = o.name;
  return m;
}

export const SRGB = (c) => tex(c, true);
export const LIN = (c) => tex(c, false);
