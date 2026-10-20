"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { SITE } from "@/shared/content/site";
import { runtime } from "@/shared/lib/runtime";
import { useUI } from "@/shared/state/store";
import { enterMotion } from "./lib/enter";

/**
 * "[SERIES TITLE]" at the bottom of chapter 00. The outer wrapper plays the enter recipe;
 * an inner layer is driven per frame by fx.closeUp so it fades out during the pullback.
 */
export function TitleCard() {
  const rm = useUI((s) => s.reducedMotion);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    let raf = 0;
    let lastO = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = runtime.frame.fx.closeUp;
      const o = Math.round(c * 1000) / 1000;
      if (o === lastO) return;
      lastO = o;
      el.style.opacity = String(o);
      el.style.visibility = o < 0.01 ? "hidden" : "visible";
      const reduced = useUI.getState().reducedMotion;
      el.style.transform = reduced ? "" : `translate3d(0, ${((1 - o) * -14).toFixed(2)}px, 0)`;
      el.style.filter = reduced || o > 0.98 ? "" : `blur(${((1 - o) * 4).toFixed(2)}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const m = enterMotion(rm, 0.5);
  return (
    <motion.div
      className="absolute inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] px-[var(--gutter)] md:bottom-[calc(6.5rem+env(safe-area-inset-bottom))]"
      initial={m.initial}
      animate={m.animate}
    >
      <div ref={inner}>
        <p
          className="display"
          style={{
            fontSize: "var(--step-4)",
            color: "var(--ink)",
            textShadow: "0 0 32px oklch(0.06 0.01 var(--hue) / 0.7)",
          }}
        >
          {SITE.seriesTitle}
        </p>
        <p
          className="mt-3 text-[length:var(--step--1)]"
          style={{ color: "var(--ink-dim)", textShadow: "0 0 14px oklch(0.06 0.01 var(--hue) / 0.9)" }}
        >
          Scroll, or just watch.
        </p>
      </div>
    </motion.div>
  );
}
