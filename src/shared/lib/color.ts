import type { Oklch } from "../content/types";

export type Lab = [L: number, a: number, b: number];
export type RGB = [r: number, g: number, b: number];

const DEG = Math.PI / 180;

export function oklchToOklab([l, c, h]: Oklch): Lab {
  return [l, c * Math.cos(h * DEG), c * Math.sin(h * DEG)];
}

/** OKLab -> linear-light sRGB (what three.js materials/uniforms expect). Clamped to gamut. */
export function oklabToLinear([L, a, b]: Lab): RGB {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const c = (x: number) => Math.min(1, Math.max(0, x));
  return [
    c(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    c(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    c(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export const oklchToLinear = (c: Oklch): RGB => oklabToLinear(oklchToOklab(c));

export const oklabCss = ([L, a, b]: Lab, alpha = 1) =>
  alpha >= 1
    ? `oklab(${L.toFixed(4)} ${a.toFixed(4)} ${b.toFixed(4)})`
    : `oklab(${L.toFixed(4)} ${a.toFixed(4)} ${b.toFixed(4)} / ${alpha})`;

export const oklchCss = ([l, c, h]: Oklch, alpha = 1) =>
  alpha >= 1 ? `oklch(${l} ${c} ${h})` : `oklch(${l} ${c} ${h} / ${alpha})`;

/** Weighted mean in OKLab. Weights are normalised. */
export function mixLab(entries: readonly { lab: Lab; w: number }[]): Lab {
  let t = 0;
  const out: Lab = [0, 0, 0];
  for (const e of entries) t += e.w;
  if (t <= 0) return [...entries[0].lab];
  for (const e of entries) {
    const w = e.w / t;
    out[0] += e.lab[0] * w;
    out[1] += e.lab[1] * w;
    out[2] += e.lab[2] * w;
  }
  return out;
}

/** Stage background for a hue: the theatrical black, tinted. */
export const stageOklch = (hue: number, l = 0.12, c = 0.014): Oklch => [l, c, hue];
