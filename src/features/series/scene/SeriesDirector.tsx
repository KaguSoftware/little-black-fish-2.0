"use client";

import { useFrame } from "@react-three/fiber";
import { computeFrame } from "@/shared/lib/director";
import { useSeries, useUI } from "@/shared/state/store";

/**
 * Runs FIRST every frame (priority -100; negative priorities don't take over
 * rendering in R3F). Computes runtime.frame from progress + teller weights, and
 * pushes discrete changes (chapter, nav visibility) to React state.
 */
export function SeriesDirector() {
  useFrame((state, delta) => {
    const s = useSeries.getState();
    const ui = useUI.getState();
    const dt = Math.min(delta, 1 / 20);
    const f = computeFrame({
      dt: ui.paused ? 0 : dt,
      time: state.clock.elapsedTime,
      target: s.teller,
      hover: s.hoverTeller,
      reducedMotion: ui.reducedMotion,
      lowTier: ui.quality === "low",
    });
    s.setChapter(f.r.chapter);
    const hideNav = f.r.chapterIndex < 5;
    if (ui.navHidden !== hideNav) ui.setNavHidden(hideNav);
    // Expose the blended accent + stage to CSS for DOM overlays.
    const root = document.documentElement.style;
    root.setProperty("--accent", f.accentCss);
    root.setProperty("--stage", f.bgCss);
  }, -100);
  return null;
}
