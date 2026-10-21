"use client";

import { useEffect, useRef } from "react";
import { useUI } from "@/shared/state/store";
import { clamp, noise1 } from "@/shared/lib/math";
import { FISH_EYE, FISH_NOSE, FISH_ROOT, FISH_STROKE, FISH_TAIL } from "@/shared/ui/FishMark";
import { lantern } from "./lantern";

/**
 * The little black fish: the studio mark (FishMark) swimming through the fog above the
 * lantern wall. Underneath runs a follow-the-leader spine with a travelling sine wave; every
 * frame the mark is laid along it as two rigid parts, the eye-shaped body and the tail
 * hinged at the crossing, so it yaws and beats its tail without losing its drawn shape.
 *
 * Behaviour: it lurks at the rim of the light, drifts after it, and when the lantern
 * comes close it darts away. Reduced motion: it rests, curved, and does not move.
 */

const N = 16; // spine points
const INK = "oklch(0.9 0.012 80)";

/**
 * The mark's outlines, sampled once into (u, v) pairs: u = 0 at the nose, 1 at the tail edge;
 * v is the lateral offset as a fraction of body length.
 */
const SPAN = FISH_TAIL - FISH_NOSE;
type Pt = [number, number];

function cubic(a: Pt, b: Pt, c: Pt, d: Pt, n: number, out: Pt[]) {
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const m = 1 - t;
    out.push([
      m * m * m * a[0] + 3 * m * m * t * b[0] + 3 * m * t * t * c[0] + t * t * t * d[0],
      m * m * m * a[1] + 3 * m * m * t * b[1] + 3 * m * t * t * c[1] + t * t * t * d[1],
    ]);
  }
}

function ring(r: number, n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [FISH_EYE.cx + Math.cos(a) * r, FISH_EYE.cy + Math.sin(a) * r] as Pt;
  });
}

function toUV(pts: Pt[]): Float32Array {
  const f = new Float32Array(pts.length * 2);
  pts.forEach(([x, y], i) => {
    f[i * 2] = (x - FISH_NOSE) / SPAN;
    f[i * 2 + 1] = (y - 24) / SPAN;
  });
  return f;
}

// Mirrors FISH_BODY and FISH_FIN in FishMark.
const BODY_UV = (() => {
  const o: Pt[] = [[FISH_NOSE, 24]];
  cubic([3.6, 24], [9.2, 10], [20.5, 3.8], [31, 3.8], 12, o);
  cubic([31, 3.8], [48, 3.8], [57.5, 13], [FISH_ROOT, 24], 14, o);
  cubic([FISH_ROOT, 24], [57.5, 35], [48, 44.2], [31, 44.2], 14, o);
  cubic([31, 44.2], [20.5, 44.2], [9.2, 38], [3.6, 24], 11, o);
  return toUV(o);
})();
const FIN_UV = toUV([[FISH_ROOT, 24], [FISH_TAIL, 7.8], [FISH_TAIL, 40.2]]);
const IRIS_UV = toUV(ring(FISH_EYE.iris, 36));
const PUPIL_UV = toUV(ring(FISH_EYE.pupil, 20));

interface Sim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  phase: number;
  dartUntil: number;
  seekOff: number;
  born: number;
  /** Leader spine (no wave) and displayed spine (leader + wave). */
  lx: Float32Array;
  ly: Float32Array;
  sx: Float32Array;
  sy: Float32Array;
  /** Unit vector from the tail root to the nose (the body's heading), and the tail's swing. */
  hx: number;
  hy: number;
  swing: number;
  placed: boolean;
}

function makeSim(): Sim {
  return {
    x: 0, y: 0, vx: 0, vy: 0, heading: Math.PI, phase: 0, dartUntil: 0, seekOff: 0, born: 0,
    lx: new Float32Array(N), ly: new Float32Array(N), sx: new Float32Array(N), sy: new Float32Array(N),
    hx: -1, hy: 0, swing: 0, placed: false,
  };
}

function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** The tail root along the body, as u, and as the nearest spine point. */
const ROOT_U = (FISH_ROOT - FISH_NOSE) / SPAN;
const ROOT_I = Math.round(ROOT_U * (N - 1));
const MAX_SWING = 0.6;

/**
 * Read the spine as the mark's two rigid parts: the eye-shaped body lies along nose -> root,
 * and the tail hinges at the root, swung by however far the rear of the spine has turned.
 */
function frame(sim: Sim) {
  const hx = sim.sx[0] - sim.sx[ROOT_I];
  const hy = sim.sy[0] - sim.sy[ROOT_I];
  const hl = Math.hypot(hx, hy) || 1;
  sim.hx = hx / hl;
  sim.hy = hy / hl;
  const tx = sim.sx[ROOT_I] - sim.sx[N - 1];
  const ty = sim.sy[ROOT_I] - sim.sy[N - 1];
  sim.swing = clamp(Math.atan2(sim.hx * ty - sim.hy * tx, sim.hx * tx + sim.hy * ty), -MAX_SWING, MAX_SWING);
}

/** Closed path through (u, v) points placed on the body, tail points swung about the root. */
function lay(sim: Sim, uv: Float32Array, L: number): string {
  const { hx, hy } = sim;
  const rx = sim.sx[0] - hx * ROOT_U * L;
  const ry = sim.sy[0] - hy * ROOT_U * L;
  const c = Math.cos(sim.swing);
  const sn = Math.sin(sim.swing);
  let d = "";
  for (let k = 0; k < uv.length; k += 2) {
    const u = uv[k];
    const v = uv[k + 1] * L;
    let x = sim.sx[0] - hx * u * L - hy * v;
    let y = sim.sy[0] - hy * u * L + hx * v;
    if (u > ROOT_U) {
      const dx = x - rx;
      const dy = y - ry;
      x = rx + dx * c - dy * sn;
      y = ry + dx * sn + dy * c;
    }
    d += `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d + "Z";
}

export function Fish({ active }: { active: boolean }) {
  const bodyRef = useRef<SVGPathElement>(null);
  const irisRef = useRef<SVGPathElement>(null);
  const pupilRef = useRef<SVGPathElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const sim = useRef<Sim>(makeSim());
  const reduced = useUI((s) => s.reducedMotion);
  const paused = useUI((s) => s.paused);
  const flags = useRef({ active, reduced, paused });
  const clockRef = useRef(0);

  useEffect(() => {
    flags.current = { active, reduced, paused };
  }, [active, reduced, paused]);

  // The loop only runs while the hero is on screen; the sim and its clock survive restarts.
  useEffect(() => {
    if (!active) return;
    const s = sim.current;
    let raf = 0;
    let last = performance.now();
    let clock = clockRef.current;
    let rested = false;
    let shown = "";
    const setOpacity = (svg: SVGSVGElement, v: number) => {
      const o = v.toFixed(3);
      if (o !== shown) svg.style.opacity = shown = o;
    };

    const draw = (L: number) => {
      const svg = svgRef.current;
      const body = bodyRef.current;
      const iris = irisRef.current;
      const pupil = pupilRef.current;
      if (!svg || !body || !iris || !pupil) return;
      frame(s);
      body.setAttribute("d", lay(s, FIN_UV, L) + lay(s, BODY_UV, L));
      iris.setAttribute("d", lay(s, IRIS_UV, L));
      pupil.setAttribute("d", lay(s, PUPIL_UV, L));
      const sw = ((FISH_STROKE * L) / SPAN).toFixed(2);
      if (svg.style.strokeWidth !== sw) svg.style.strokeWidth = sw;
    };

    const place = (L: number, w: number, h: number) => {
      s.x = w * 0.74;
      s.y = h * 0.66;
      s.heading = Math.PI * 0.92;
      const seg = L / (N - 1);
      for (let i = 0; i < N; i++) {
        s.lx[i] = s.sx[i] = s.x - Math.cos(s.heading) * seg * i;
        s.ly[i] = s.sy[i] = s.y - Math.sin(s.heading) * seg * i;
      }
      s.placed = true;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const f = flags.current;
      const svg = svgRef.current;
      if (!svg) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const w = lantern.w;
      const h = lantern.h;
      const minDim = Math.min(w, h);
      const L = clamp(minDim * 0.11, 64, 128);
      if (w <= 1) return;
      if (svg.getAttribute("viewBox") !== `0 0 ${w} ${h}`) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
      if (!s.placed) {
        place(L, w, h);
        s.born = now;
      }

      if (f.reduced) {
        // Resting, gently curved, drawn once.
        if (!rested) {
          for (let i = 0; i < N; i++) {
            const k = i / (N - 1);
            const seg = L / (N - 1);
            s.sx[i] = s.x - Math.cos(s.heading) * seg * i;
            s.sy[i] = s.y - Math.sin(s.heading) * seg * i + Math.sin(k * 2.6) * L * 0.07 * k;
          }
          draw(L);
          rested = true;
        }
        setOpacity(svg, clamp(lantern.fade * 1.4, 0, 1));
        return;
      }
      rested = false;
      if (f.paused) {
        if (svg.style.opacity === "0" || svg.style.opacity === "") {
          for (let i = 0; i < N; i++) {
            s.sx[i] = s.lx[i];
            s.sy[i] = s.ly[i];
          }
          draw(L);
        }
        setOpacity(svg, clamp(lantern.fade * 1.4, 0, 1));
        return;
      }

      clock += dt;
      clockRef.current = clock;
      const mouth = lantern.radius;
      const dx = s.x - lantern.x;
      const dy = s.y - lantern.y;
      const dist = Math.hypot(dx, dy) || 1;
      const darting = clock < s.dartUntil;

      // Lantern comes close: dart away from it.
      if (!darting && dist < mouth * 0.62 && lantern.fade > 0.3) {
        const sp = minDim * 1.35;
        s.vx = (dx / dist) * sp + noise1(clock * 3) * sp * 0.25;
        s.vy = (dy / dist) * sp + noise1(clock * 3 + 7) * sp * 0.25;
        s.dartUntil = clock + 1.4;
      }

      // Otherwise lurk at the rim of the light, slowly circling it, drifting after it.
      s.seekOff += dt * 0.32;
      const rim = mouth * (0.95 + 0.5 * Math.sin(s.seekOff * 0.9 + 1)) + minDim * 0.03;
      const gx = lantern.x + Math.cos(s.seekOff) * rim * 1.15 + noise1(clock * 0.4) * minDim * 0.08;
      const gy = lantern.y + Math.sin(s.seekOff * 0.83) * rim * 0.75 + noise1(clock * 0.37 + 5) * minDim * 0.06;
      const seek = darting ? 0 : 1;
      const ax = ((gx - s.x) * 1.5 - s.vx * 2.1) * seek - s.vx * 0.55 * (darting ? 1 : 0);
      const ay = ((gy - s.y) * 1.5 - s.vy * 2.1) * seek - s.vy * 0.55 * (darting ? 1 : 0);
      s.vx += ax * dt;
      s.vy += ay * dt;
      // keep a minimum swimming speed so it never hangs dead in the water
      const sp = Math.hypot(s.vx, s.vy);
      const minSp = minDim * 0.045;
      if (sp < minSp && sp > 1e-3) {
        s.vx *= minSp / sp;
        s.vy *= minSp / sp;
      }
      const maxSp = minDim * (darting ? 1.5 : 0.42);
      const sp2 = Math.hypot(s.vx, s.vy);
      if (sp2 > maxSp) {
        s.vx *= maxSp / sp2;
        s.vy *= maxSp / sp2;
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      // gentle containment: turn back from the edges
      const m = L * 0.5;
      if (s.x < -m) s.vx += 400 * dt;
      if (s.x > w + m) s.vx -= 400 * dt;
      if (s.y < -m) s.vy += 400 * dt;
      if (s.y > h + m) s.vy -= 400 * dt;

      const speed = Math.hypot(s.vx, s.vy);
      const want = Math.atan2(s.vy, s.vx);
      s.heading += angleDelta(s.heading, want) * (1 - Math.exp(-(darting ? 14 : 3.2) * dt));

      // tail beat: faster and wider when it moves fast
      const sNorm = clamp(speed / (minDim * 0.4), 0, 1.6);
      s.phase += dt * (3.4 + sNorm * 7.5);
      const amp = L * (0.05 + 0.09 * clamp(sNorm, 0, 1));

      // spine: head follows heading; the rest follow the leader, then a travelling wave is added
      const seg = L / (N - 1);
      s.lx[0] = s.x;
      s.ly[0] = s.y;
      for (let i = 1; i < N; i++) {
        let ddx = s.lx[i] - s.lx[i - 1];
        let ddy = s.ly[i] - s.ly[i - 1];
        const dl = Math.hypot(ddx, ddy) || 1;
        ddx = (ddx / dl) * seg;
        ddy = (ddy / dl) * seg;
        s.lx[i] = s.lx[i - 1] + ddx;
        s.ly[i] = s.ly[i - 1] + ddy;
      }
      // travelling lateral wave, perpendicular to the local direction
      s.sx[0] = s.lx[0];
      s.sy[0] = s.ly[0];
      for (let i = 1; i < N; i++) {
        const k = i / (N - 1);
        const wave = Math.sin(s.phase - k * 3.4) * amp * Math.pow(k, 1.3);
        const tx = s.lx[i - 1] - s.lx[i];
        const ty = s.ly[i - 1] - s.ly[i];
        const tl = Math.hypot(tx, ty) || 1;
        s.sx[i] = s.lx[i] + (-ty / tl) * wave;
        s.sy[i] = s.ly[i] + (tx / tl) * wave;
      }

      draw(L);
      const fadeIn = clamp((now - s.born) / 2200, 0, 1);
      setOpacity(svg, fadeIn * clamp(lantern.fade * 1.4, 0, 1));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      focusable="false"
      preserveAspectRatio="none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 0,
        overflow: "visible",
      }}
    >
      <g stroke={INK} strokeLinejoin="round" strokeLinecap="round">
        <path ref={bodyRef} fill="oklch(0.045 0.008 250)" />
        <path ref={irisRef} fill="none" />
      </g>
      <path ref={pupilRef} fill={INK} />
    </svg>
  );
}
