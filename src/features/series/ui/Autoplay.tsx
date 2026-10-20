"use client";

import { useEffect } from "react";
import { chapterHoldEnd, chapterHoldStart, TYPE_WINDOW } from "@/shared/content/chapters";
import { TELLER_IDS } from "@/shared/content/characters";
import type { ChapterId } from "@/shared/content/types";
import { clamp, easeInOutCubic } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { useSeries, useUI } from "@/shared/state/store";
import { cancelGlide, scrollToProgress, scrollToTop } from "./lib/lenis";

// Long enough to enjoy the opening eye close-up (and play with the pupils) before the page plays itself.
const IDLE_MS = 7000;
const STORY: ChapterId[] = ["hello", "world", "day", "did", "others"];
const linear = (t: number) => t;

/**
 * Self-playing story. After IDLE_MS with no wheel/touch/key/pointer input it glides through
 * each chapter (transition, type-out, dwell), and at THE OTHERS hands the story to the next
 * teller and replays from the top. Any input stops it for good. Never enters MY MAKER.
 * Disabled under reduced motion and while ambient motion is paused.
 */
export function Autoplay() {
  useEffect(() => {
    let idle: number | undefined;
    let abortRun: (() => void) | null = null;
    let disposed = false;
    const timers = new Set<number>();

    const allowed = () => {
      const ui = useUI.getState();
      return !ui.reducedMotion && !ui.paused && useSeries.getState().autoplay !== "off";
    };

    const armIdle = () => {
      window.clearTimeout(idle);
      if (!allowed() || abortRun) return;
      idle = window.setTimeout(() => {
        if (allowed()) void run();
      }, IDLE_MS);
    };

    const stopRun = () => {
      abortRun?.();
      abortRun = null;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
    };

    async function run() {
      let reject!: (e: Error) => void;
      const aborted = new Promise<never>((_, rej) => {
        reject = rej;
      });
      aborted.catch(() => {});
      abortRun = () => reject(new Error("autoplay aborted"));
      useSeries.getState().setAutoplay("playing");

      const until = <T,>(p: Promise<T>) => Promise.race([p, aborted]);
      const sleep = (ms: number) =>
        until(
          new Promise<void>((res) => {
            const id = window.setTimeout(() => {
              timers.delete(id);
              res();
            }, ms);
            timers.add(id);
          }),
        );
      const glide = (p: number, duration: number, easing = easeInOutCubic) =>
        until(
          new Promise<void>((res) => {
            // Safety net in case Lenis never reports completion (e.g. already at the target).
            const id = window.setTimeout(res, duration * 1000 + 1200);
            timers.add(id);
            scrollToProgress(p, { duration, easing, onComplete: res });
          }),
        );
      const glideTop = (duration: number) =>
        until(
          new Promise<void>((res) => {
            const id = window.setTimeout(res, duration * 1000 + 1200);
            timers.add(id);
            scrollToTop({ duration, easing: easeInOutCubic, onComplete: res });
          }),
        );

      try {
        for (;;) {
          if (runtime.rawProgress < 0.003) await sleep(2200); // chapter 00: let the title and hint land

          for (const c of STORY) {
            const hs = chapterHoldStart(c);
            const typed = hs + (chapterHoldEnd(c) - hs) * TYPE_WINDOW.end;
            if (runtime.rawProgress >= typed - 0.001) continue;
            if (runtime.rawProgress < hs - 0.001) {
              const dist = hs - runtime.rawProgress;
              await glide(hs, clamp(dist * 32, 1.8, 3.6)); // transition: pullback, dive, walk
            }
            await glide(typed, 2.8, linear); // the line types out at a readable pace
            await sleep(3200); // dwell
          }

          // THE OTHERS: hand the story to the next teller and replay from the top.
          const s = useSeries.getState();
          const i = TELLER_IDS.indexOf(s.teller);
          s.switchTeller(TELLER_IDS[(i + 1) % TELLER_IDS.length], "autoplay");
          await sleep(1400);
          await glideTop(3.4);
          await sleep(600);
        }
      } catch {
        /* aborted */
      } finally {
        abortRun = null;
      }
    }

    const onInput = (e: Event) => {
      const wasActive = useSeries.getState().autoplay !== "off";
      window.clearTimeout(idle);
      const running = abortRun !== null;
      stopRun();
      // Wheel / touch scrolling already takes over Lenis; other inputs must cancel the glide.
      if (running && e.type !== "wheel" && e.type !== "touchstart") cancelGlide();
      if (wasActive) useSeries.getState().setAutoplay("off");
    };

    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    for (const ev of events) window.addEventListener(ev, onInput, { passive: true });

    // Pause / reduced motion cancel a run; resuming re-arms the idle timer.
    const unsub = useUI.subscribe((s, prev) => {
      if (s.paused === prev.paused && s.reducedMotion === prev.reducedMotion) return;
      if (disposed) return;
      if (s.paused || s.reducedMotion) {
        window.clearTimeout(idle);
        if (abortRun) {
          stopRun();
          cancelGlide();
          if (useSeries.getState().autoplay === "playing") useSeries.getState().setAutoplay("waiting");
        }
      } else {
        armIdle();
      }
    });

    armIdle();

    return () => {
      disposed = true;
      window.clearTimeout(idle);
      stopRun();
      unsub();
      for (const ev of events) window.removeEventListener(ev, onInput);
    };
  }, []);

  return null;
}
