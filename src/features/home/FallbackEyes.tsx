"use client";

import { useEffect, useRef } from "react";
import { TELLERS } from "@/shared/content/characters";
import { oklchCss } from "@/shared/lib/color";
import { clamp, damp, noise1, smoothstep, TAU } from "@/shared/lib/math";
import { pointer } from "@/shared/lib/pointer";
import { useUI } from "@/shared/state/store";
import type { PupilPoint } from "./EyesScene";
import s from "./home.module.css";

/**
 * 2D stand-in for the Child's eyes: shown while the 3D puppet loads, or if it cannot be
 * framed. Two glinting eyes behind slits in a barely-lit plate; pupils follow the cursor,
 * lids blink and lift when the cursor comes near, six accent dots orbit in a tilted ring.
 */
const EYE_X = 185;
const ALMOND = "M-112 0 C-60 -62 60 -62 112 0 C60 44 -60 44 -112 0Z";

export function FallbackEyes({
  active,
  engaged,
  pupil,
}: {
  active: boolean;
  engaged: { current: boolean };
  pupil: { current: PupilPoint };
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const irisRefs = useRef<(SVGGElement | null)[]>([null, null]);
  const lidRefs = useRef<(SVGRectElement | null)[]>([null, null]);
  const lowRefs = useRef<(SVGRectElement | null)[]>([null, null]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const flags = useRef({ active, engaged });

  useEffect(() => {
    flags.current = { active, engaged };
  }, [active, engaged]);

  // Only loops while it is the visible stand-in; the reveal restarts from dark each time.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !active) return;
    let raf = 0;
    let last = performance.now();
    let gx = 0;
    let gy = 0;
    let surprise = 0;
    let open = 0.7;
    let nextBlink = last + 2200;
    let blinkT = -1;
    let reveal = 0;
    let t = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const f = flags.current;
      if (!f.active) {
        reveal = 0;
        return;
      }
      const ui = useUI.getState();
      const calm = ui.reducedMotion || ui.paused;
      if (!ui.paused) t += dt;
      reveal = damp(reveal, 1, 1.2, dt);
      svg.style.opacity = String(reveal);

      const r = svg.getBoundingClientRect();
      const p = pointer;
      const live = p.active && p.lastMove > 0 && now - p.lastMove < 4500;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const nx = (p.px - cx) / (window.innerWidth * 0.5);
      const ny = (p.py - cy) / (window.innerHeight * 0.5);
      let tx = 0;
      let ty = 0;
      if (live) {
        tx = clamp(nx * 1.5, -1, 1);
        ty = clamp(ny * 1.8, -1, 1);
      } else if (!calm) {
        tx = noise1(t * 0.33) * 0.8;
        ty = noise1(t * 0.27 + 11) * 0.5;
      }
      gx = damp(gx, tx, live ? 12 : 3.5, dt);
      gy = damp(gy, ty, live ? 12 : 3.5, dt);
      const near = Math.hypot(nx * (window.innerWidth / window.innerHeight), ny);
      const sT = f.engaged.current ? 1 : live ? 1 - smoothstep(0.35, 1.0, near) : 0;
      surprise = damp(surprise, sT, 5, dt);

      // blink
      if (!calm && blinkT < 0 && now > nextBlink) {
        blinkT = 0;
        nextBlink = now + 2200 + Math.random() * 3800;
      }
      let blink = 0;
      if (blinkT >= 0) {
        blinkT += dt;
        blink = Math.sin(clamp(blinkT / 0.17) * Math.PI);
        if (blinkT > 0.17) blinkT = -1;
      }
      const target = 0.62 + surprise * 0.38;
      open = damp(open, target, 8, dt);
      const o = open * (1 - blink);

      for (let i = 0; i < 2; i++) {
        const iris = irisRefs.current[i];
        const lid = lidRefs.current[i];
        const low = lowRefs.current[i];
        if (iris) iris.setAttribute("transform", `translate(${(gx * 34).toFixed(2)} ${(gy * 17).toFixed(2)})`);
        // top lid covers the eye from -70 down to a line that rises as the eye opens
        const topLine = -62 + (1 - o) * 62 * 0.92 + (1 - o) * 4;
        if (lid) {
          lid.setAttribute("y", "-80");
          lid.setAttribute("height", String(80 + topLine));
        }
        if (low) low.setAttribute("y", String(2 + 22 * o));
      }

      // orbit ring
      const ang0 = calm ? 0.6 : t * (0.2 + surprise * 0.18);
      for (let i = 0; i < TELLERS.length; i++) {
        const dot = dotRefs.current[i];
        if (!dot) continue;
        const a = ang0 + (i * TAU) / TELLERS.length;
        const lx = Math.cos(a);
        const depth = Math.sin(a); // + = in front
        const ly = depth * 0.46;
        const roll = -0.2;
        const x = (lx * Math.cos(roll) - ly * Math.sin(roll)) * 330;
        const y = (lx * Math.sin(roll) + ly * Math.cos(roll)) * 330 * 0.62;
        dot.setAttribute("cx", x.toFixed(1));
        dot.setAttribute("cy", y.toFixed(1));
        dot.setAttribute("r", (6 + depth * 2.4).toFixed(2));
        dot.setAttribute("opacity", String(0.55 + depth * 0.4));
      }

      // report the left pupil (puppet's left = viewer's right) for the iris transition
      const ir = irisRefs.current[1];
      if (ir) {
        const b = ir.getBoundingClientRect();
        pupil.current.x = b.left + b.width / 2;
        pupil.current.y = b.top + b.height / 2;
        pupil.current.valid = true;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pupil, active]);

  return (
    <svg
      ref={svgRef}
      className={s.fallbackEyes}
      viewBox="-500 -210 1000 420"
      aria-hidden
      focusable="false"
    >
      <defs>
        <radialGradient id="fe-plate" cx="0" cy="0" r="430" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.42 0.025 80)" />
          <stop offset="0.55" stopColor="oklch(0.2 0.015 80)" stopOpacity="0.7" />
          <stop offset="1" stopColor="oklch(0.1 0.01 215)" stopOpacity="0" />
        </radialGradient>
        <clipPath id="fe-almond">
          <path d={ALMOND} />
        </clipPath>
      </defs>
      {/* the paper mask, found by a little light */}
      <ellipse cx="0" cy="0" rx="430" ry="205" fill="url(#fe-plate)" />
      {[-1, 1].map((side, i) => (
        <g key={side} transform={`translate(${side * EYE_X} 0)`}>
          <path d={ALMOND} fill="oklch(0.05 0.01 250)" />
          <g clipPath="url(#fe-almond)">
            <rect x="-120" y="-70" width="240" height="140" fill="oklch(0.86 0.03 80)" />
            <g ref={(el) => void (irisRefs.current[i] = el)}>
              <circle r="42" fill="oklch(0.36 0.07 55)" />
              <circle r="24" fill="oklch(0.06 0.01 250)" />
              <circle cx="-11" cy="-13" r="7" fill="oklch(0.98 0.01 80)" />
              <circle cx="12" cy="10" r="2.6" fill="oklch(0.95 0.02 80)" opacity="0.7" />
            </g>
            <rect ref={(el) => void (lidRefs.current[i] = el)} x="-120" y="-80" width="240" height="40" fill="oklch(0.07 0.01 250)" />
            <rect ref={(el) => void (lowRefs.current[i] = el)} x="-120" y="20" width="240" height="60" fill="oklch(0.07 0.01 250)" />
          </g>
          <path d={ALMOND} fill="none" stroke="oklch(0.62 0.04 80)" strokeOpacity="0.5" strokeWidth="2" />
        </g>
      ))}
      {TELLERS.map((t, i) => (
        <circle key={t.id} ref={(el) => void (dotRefs.current[i] = el)} r="6" fill={oklchCss([Math.min(0.86, t.accent[0] + 0.1), t.accent[1], t.accent[2]])} />
      ))}
    </svg>
  );
}
