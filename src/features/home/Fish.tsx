"use client";

import { useEffect, useRef } from "react";
import { useUI } from "@/shared/state/store";
import { clamp, noise1 } from "@/shared/lib/math";
import { lantern } from "./lantern";

/**
 * The little black fish. A single pure-black silhouette that swims through the fog above
 * the lantern wall. Its body is a follow-the-leader spine with a travelling sine wave, so
 * the tail sways fluidly; the outline is rebuilt every frame as one smoothed SVG path.
 *
 * Behaviour: it lurks at the rim of the light, drifts after it, and when the lantern
 * comes close it darts away. Reduced motion: it rests, curved, and does not move.
 */

const N = 16; // spine points
const MAX_POINTS = N * 2 + 1;

/** Half-width profile along the body, 0 = nose, 1 = tail tip. */
function profile(t: number): number {
  if (t < 0.3) return Math.pow(Math.sin((t / 0.3) * Math.PI * 0.5), 0.62);
  if (t < 0.72) {
    const k = (t - 0.3) / 0.42;
    return 1 - (1 - 0.15) * (0.5 - 0.5 * Math.cos(k * Math.PI));
  }
  const k = (t - 0.72) / 0.28;
  return 0.15 + 0.7 * Math.pow(k, 1.35);
}

const PROFILE = Array.from({ length: N }, (_, i) => profile(i / (N - 1)));

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
  px: Float32Array;
  py: Float32Array;
  placed: boolean;
}

function makeSim(): Sim {
  return {
    x: 0, y: 0, vx: 0, vy: 0, heading: Math.PI, phase: 0, dartUntil: 0, seekOff: 0, born: 0,
    lx: new Float32Array(N), ly: new Float32Array(N), sx: new Float32Array(N), sy: new Float32Array(N),
    px: new Float32Array(MAX_POINTS), py: new Float32Array(MAX_POINTS), placed: false,
  };
}

function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rebuild the silhouette. L = body length in px. Writes outline points into sim.px/py. */
function outline(sim: Sim, L: number): number {
  const hw = L * 0.115;
  let n = 0;
  // left side: nose -> tail
  for (let i = 0; i < N; i++) {
    const i0 = Math.max(0, i - 1);
    const i1 = Math.min(N - 1, i + 1);
    let tx = sim.sx[i0] - sim.sx[i1];
    let ty = sim.sy[i0] - sim.sy[i1];
    const l = Math.hypot(tx, ty) || 1;
    tx /= l;
    ty /= l;
    // tangent points nose-ward (i0 is nearer the head); normal = perpendicular
    const nx = -ty;
    const ny = tx;
    const w = hw * PROFILE[i];
    sim.px[i] = sim.sx[i] + nx * w;
    sim.py[i] = sim.sy[i] + ny * w;
    if (i > 0) {
      sim.px[2 * N - i] = sim.sx[i] - nx * w;
      sim.py[2 * N - i] = sim.sy[i] - ny * w;
    }
    if (i === N - 1) {
      // fork notch between the two tail tips, pulled toward the body
      sim.px[N] = sim.sx[i] + tx * L * 0.06;
      sim.py[N] = sim.sy[i] + ty * L * 0.06;
    }
  }
  n = 2 * N;
  return n;
}

/** Closed, smoothed path through the outline points (midpoint quadratic smoothing). */
function pathFrom(sim: Sim, n: number): string {
  const p = (i: number) => (i + n) % n;
  const mx = (a: number, b: number) => (sim.px[a] + sim.px[b]) / 2;
  const my = (a: number, b: number) => (sim.py[a] + sim.py[b]) / 2;
  let d = `M${mx(0, 1).toFixed(1)} ${my(0, 1).toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const a = p(i);
    const b = p(i + 1);
    d += `Q${sim.px[a].toFixed(1)} ${sim.py[a].toFixed(1)} ${mx(a, b).toFixed(1)} ${my(a, b).toFixed(1)}`;
  }
  return d + "Z";
}

export function Fish({ active }: { active: boolean }) {
  const bodyRef = useRef<SVGPathElement>(null);
  const eyeL = useRef<SVGCircleElement>(null);
  const eyeR = useRef<SVGCircleElement>(null);
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
      const body = bodyRef.current;
      if (!body) return;
      const n = outline(s, L);
      body.setAttribute("d", pathFrom(s, n));
      // eyes sit on the head, one each side
      const i = 2;
      const i0 = 1;
      const i1 = 3;
      let tx = s.sx[i0] - s.sx[i1];
      let ty = s.sy[i0] - s.sy[i1];
      const l = Math.hypot(tx, ty) || 1;
      tx /= l;
      ty /= l;
      const off = L * 0.115 * PROFILE[i] * 0.62;
      const e1 = eyeL.current;
      const e2 = eyeR.current;
      if (e1 && e2) {
        e1.setAttribute("cx", (s.sx[i] - ty * off).toFixed(1));
        e1.setAttribute("cy", (s.sy[i] + tx * off).toFixed(1));
        e2.setAttribute("cx", (s.sx[i] + ty * off).toFixed(1));
        e2.setAttribute("cy", (s.sy[i] - tx * off).toFixed(1));
      }
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
      const L = clamp(minDim * 0.14, 78, 160);
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
      <path ref={bodyRef} fill="oklch(0.045 0.008 250)" />
      <circle ref={eyeL} r={1.7} fill="oklch(0.62 0.05 80)" opacity={0.7} />
      <circle ref={eyeR} r={1.7} fill="oklch(0.62 0.05 80)" opacity={0.7} />
    </svg>
  );
}
