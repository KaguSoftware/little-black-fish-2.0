"use client";

import Lenis from "lenis";
import { useCallback, useEffect, useRef } from "react";
import type { ProjectCard } from "@/shared/data/cards";
import { useUI } from "@/shared/state/store";
import { EyesCTA } from "./EyesCTA";
import { Footer } from "./Footer";
import { Hero } from "./Hero";
import { OtherWork } from "./OtherWork";
import { REEL_COUNT, ReelStrip } from "./ReelStrip";
import s from "./home.module.css";

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Home: Lantern.
 *   Hero (lantern wall + wordmark that heals + the little black fish)
 *   EyesCTA ("Look closer", the iris closes into the Snake King's pupil)
 *   ReelStrip (projector gate)
 *   OtherWork (three asymmetric teasers)
 *   Footer (the name, clean; email to copy)
 *
 * Own Lenis instance (native scroll under reduced motion). While nobody touches the page it
 * also plays itself: after a long dwell it drifts down through the eyes and the reel; the
 * first wheel, touch, key or press stops that for good.
 */
export function HomePage({ projects }: { projects: ProjectCard[] }) {
  const reduced = useUI((st) => st.reducedMotion);
  const paused = useUI((st) => st.paused);
  const lenisRef = useRef<Lenis | null>(null);
  const userActed = useRef(false);

  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.95, autoRaf: true });
    lenisRef.current = lenis;
    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [reduced]);

  const scrollToY = useCallback((y: number, duration: number) => {
    const lenis = lenisRef.current;
    if (lenis) lenis.scrollTo(y, { duration, easing: easeOutExpo });
    else window.scrollTo({ top: y, behavior: "auto" });
  }, []);

  const scrollToId = useCallback(
    (id: string, duration = 2.4) => {
      const el = document.getElementById(id);
      if (!el) return;
      scrollToY(el.getBoundingClientRect().top + window.scrollY, duration);
    },
    [scrollToY],
  );

  // Any real input ends the self-playing tour for good.
  useEffect(() => {
    const stop = () => {
      userActed.current = true;
    };
    const evs = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    evs.forEach((e) => window.addEventListener(e, stop, { passive: true }));
    return () => evs.forEach((e) => window.removeEventListener(e, stop));
  }, []);

  useEffect(() => {
    if (reduced || paused) return;
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (!userActed.current) fn();
        }, ms),
      );
    };
    const reelY = (frame: number) => {
      const el = document.getElementById("reel");
      if (!el) return 0;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const span = el.offsetHeight - window.innerHeight;
      return top + (frame / (REEL_COUNT - 1)) * span;
    };

    let t = 15000;
    at(t, () => scrollToId("eyes", 3));
    t += 12500;
    at(t, () => scrollToId("reel", 3.2));
    t += 6200;
    for (let i = 1; i < REEL_COUNT; i++) {
      const frame = i;
      at(t, () => scrollToY(reelY(frame), 1.3));
      t += 2400;
    }
    t += 1200;
    at(t, () => scrollToId("work", 2.8));

    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [reduced, paused, scrollToId, scrollToY]);

  return (
    <>
      <main id="main" className={s.page}>
        <Hero onCue={() => scrollToId("eyes", 2.2)} />
        <EyesCTA />
        <ReelStrip />
        <OtherWork projects={projects} />
      </main>
      <Footer />
    </>
  );
}
