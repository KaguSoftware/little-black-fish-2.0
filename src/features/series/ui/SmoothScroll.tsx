"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { runtime } from "@/shared/lib/runtime";
import { clamp } from "@/shared/lib/math";
import { useIris, useSeries, useUI } from "@/shared/state/store";
import { setLenis } from "./lib/lenis";

/**
 * Lenis on the window, driven from our own rAF loop (autoRaf off). Story progress is
 * scrollY / (#story-spacer height - viewport), clamped 0..1, then smoothed by a spring
 * (stiffness ~42, damping ~13.5) into runtime.progress. runtime.rawProgress is unsmoothed.
 * Also opens the iris once the scene is ready when we arrived through a waitForReady transition.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prevRestoration = history.scrollRestoration;
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    const rm0 = useUI.getState().reducedMotion;
    const lenis = new Lenis({
      autoRaf: false,
      smoothWheel: !rm0,
      syncTouch: false,
      lerp: 0.075,
      wheelMultiplier: 0.8,
    });
    setLenis(lenis);
    lenis.scrollTo(0, { immediate: true, force: true });
    runtime.rawProgress = 0;
    runtime.progress = 0;

    // Reduced motion: native scroll (no wheel smoothing), reacts to live changes.
    const unsubUI = useUI.subscribe((s, prev) => {
      if (s.reducedMotion !== prev.reducedMotion) {
        (lenis.options as unknown as { smoothWheel: boolean }).smoothWheel = !s.reducedMotion;
      }
    });

    // Scroll range of the story.
    let range = 1;
    const measure = () => {
      const el = document.getElementById("story-spacer");
      range = el ? Math.max(1, el.offsetHeight - window.innerHeight) : 1;
    };
    measure();
    window.addEventListener("resize", measure);
    const spacer = document.getElementById("story-spacer");
    const ro = spacer ? new ResizeObserver(measure) : null;
    if (spacer) ro?.observe(spacer);

    // Spring-smoothed progress + Lenis frame.
    let x = 0;
    let v = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick);
      lenis.raf(ms);
      const dt = Math.min(0.05, Math.max(0.0001, (ms - last) / 1000));
      last = ms;

      const raw = clamp(window.scrollY / range);
      runtime.rawProgress = raw;

      const rm = useUI.getState().reducedMotion;
      // Near-critically damped and soft: scroll steps become one long camera move.
      const k = rm ? 520 : 42;
      const c = rm ? 46 : 13.5;
      const steps = Math.ceil(dt / (1 / 120));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        v += (k * (raw - x) - c * v) * h;
        x += v * h;
      }
      if (Math.abs(raw - x) < 1e-5 && Math.abs(v) < 1e-4) {
        x = raw;
        v = 0;
      }
      runtime.progress = x;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      unsubUI();
      window.removeEventListener("resize", measure);
      ro?.disconnect();
      lenis.destroy();
      setLenis(null);
      history.scrollRestoration = prevRestoration;
    };
  }, []);

  // Iris: open once the hero is ready (fallback 2.5 s), if the transition is waiting for us.
  useEffect(() => {
    let done = false;
    const waiting = () => {
      const i = useIris.getState();
      return i.waitForReady && (i.phase === "closed" || i.phase === "closing");
    };
    const finish = () => {
      if (done) return;
      done = true;
      unsub();
      clearTimeout(timer);
      if (waiting()) useIris.getState().open();
    };
    const check = () => {
      if (!done && useSeries.getState().sceneReady && waiting()) finish();
    };
    const unsub = useSeries.subscribe(check);
    const unsubIris = useIris.subscribe(check);
    const timer = window.setTimeout(finish, 2500);
    check();
    return () => {
      done = true;
      unsub();
      unsubIris();
      clearTimeout(timer);
    };
  }, []);

  return <>{children}</>;
}
