"use client";

import { useEffect } from "react";
import { useUI } from "../state/store";
import { pointer } from "../lib/pointer";

/**
 * Client-side environment: reduced-motion preference, quality tier, and a single
 * global pointer tracker that writes NDC + px into `pointer` (= `runtime.pointer`) (no React state).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const setReducedMotion = useUI((s) => s.setReducedMotion);
  const setQuality = useUI((s) => s.setQuality);
  const paused = useUI((s) => s.paused);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);

    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = window.innerWidth < 768;
    const weak = (navigator.hardwareConcurrency ?? 8) <= 4;
    setQuality(coarse || small || weak ? "low" : "high");

    const onMove = (e: PointerEvent) => {
      const p = pointer;
      p.px = e.clientX;
      p.py = e.clientY;
      p.x = (e.clientX / window.innerWidth) * 2 - 1;
      p.y = -((e.clientY / window.innerHeight) * 2 - 1);
      p.active = true;
      p.lastMove = performance.now();
      p.fine = e.pointerType !== "touch";
    };
    const onLeave = () => {
      pointer.active = false;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [setReducedMotion, setQuality]);

  useEffect(() => {
    document.documentElement.dataset.motion = paused ? "paused" : "on";
  }, [paused]);

  return <>{children}</>;
}
