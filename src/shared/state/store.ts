"use client";

import { create } from "zustand";
import type { ChapterId, TellerId } from "../content/types";
import { FIRST_TELLER } from "../content/characters";

/**
 * React-facing state: only DISCRETE things live here (who is telling, which chapter
 * the DOM should show, preferences). Per-frame continuous values (scroll progress,
 * pointer, blended colours, camera) live in `lib/runtime.ts` so nothing re-renders
 * every frame.
 */

// ── Global UI ──────────────────────────────────────────────────────────────
export type Quality = "high" | "low";

interface UIState {
  reducedMotion: boolean;
  /** Ambient motion paused by the user (MotionToggle). */
  paused: boolean;
  quality: Quality;
  /** Nav visibility (the series page hides it until THE OTHERS). */
  navHidden: boolean;
  setReducedMotion: (v: boolean) => void;
  setPaused: (v: boolean) => void;
  togglePaused: () => void;
  setQuality: (q: Quality) => void;
  setNavHidden: (v: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  reducedMotion: false,
  paused: false,
  quality: "high",
  navHidden: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setPaused: (paused) => set({ paused }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setQuality: (quality) => set({ quality }),
  setNavHidden: (navHidden) => set({ navHidden }),
}));

// ── Series ─────────────────────────────────────────────────────────────────
export type SwitchSource = "switcher" | "cast" | "autoplay" | "init";
export type AutoplayState = "waiting" | "playing" | "off";

interface SeriesState {
  /** The teller the story is being told by (target of the blend). */
  teller: TellerId;
  /** performance.now() of the last switch; Shockwave / Narration react to changes. */
  switchedAt: number;
  switchSource: SwitchSource;
  /** Teller under the pointer in THE OTHERS (pre-tints the scene). */
  hoverTeller: TellerId | null;
  /** Discrete chapter for DOM (updated by the director only when it changes). */
  chapter: ChapterId;
  /** Tellers whose assets (puppet code + textures + plates) have been requested. */
  requested: Partial<Record<TellerId, true>>;
  /** Tellers whose puppet is built and ready to render. */
  ready: Partial<Record<TellerId, true>>;
  autoplay: AutoplayState;
  /** Set by the page once the first frame with the hero is ready (iris can open). */
  sceneReady: boolean;

  switchTeller: (id: TellerId, source?: SwitchSource) => void;
  setHoverTeller: (id: TellerId | null) => void;
  setChapter: (c: ChapterId) => void;
  request: (ids: TellerId[]) => void;
  markReady: (id: TellerId) => void;
  setAutoplay: (a: AutoplayState) => void;
  setSceneReady: (v: boolean) => void;
}

export const useSeries = create<SeriesState>((set, get) => ({
  teller: FIRST_TELLER,
  switchedAt: 0,
  switchSource: "init",
  hoverTeller: null,
  chapter: "look",
  requested: { [FIRST_TELLER]: true },
  ready: {},
  autoplay: "waiting",
  sceneReady: false,

  switchTeller: (id, source = "switcher") => {
    if (get().teller === id) return;
    set((s) => ({
      teller: id,
      switchedAt: performance.now(),
      switchSource: source,
      requested: { ...s.requested, [id]: true },
    }));
  },
  setHoverTeller: (hoverTeller) => set({ hoverTeller }),
  setChapter: (chapter) => {
    if (get().chapter !== chapter) set({ chapter });
  },
  request: (ids) =>
    set((s) => {
      const next = { ...s.requested };
      let changed = false;
      for (const id of ids)
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      return changed ? { requested: next } : s;
    }),
  markReady: (id) => set((s) => (s.ready[id] ? s : { ready: { ...s.ready, [id]: true } })),
  setAutoplay: (autoplay) => set({ autoplay }),
  setSceneReady: (sceneReady) => set({ sceneReady }),
}));

// ── Iris page transition ───────────────────────────────────────────────────
export type IrisPhase = "idle" | "closing" | "closed" | "opening";

interface IrisState {
  phase: IrisPhase;
  /** Viewport px where the iris closes to / opens from. */
  origin: { x: number; y: number };
  href: string | null;
  /** CSS colour of the glowing rim. */
  rim: string;
  /** Destination page should open the iris itself (call `open()`) when ready; otherwise it opens on route change. */
  waitForReady: boolean;
  close: (href: string, origin: { x: number; y: number }, opts?: { rim?: string; waitForReady?: boolean }) => void;
  setPhase: (p: IrisPhase) => void;
  /** Called by the destination page when its first meaningful frame is ready. */
  open: () => void;
}

export const useIris = create<IrisState>((set, get) => ({
  phase: "idle",
  origin: { x: 0, y: 0 },
  href: null,
  rim: "oklch(0.7 0.1 210)",
  waitForReady: false,
  close: (href, origin, opts) =>
    set({ phase: "closing", href, origin, rim: opts?.rim ?? get().rim, waitForReady: !!opts?.waitForReady }),
  setPhase: (phase) => set({ phase }),
  open: () => {
    const p = get().phase;
    if (p === "closed" || p === "closing") set({ phase: "opening" });
  },
}));
