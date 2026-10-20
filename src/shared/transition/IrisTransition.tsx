"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { animate } from "motion/react";
import { useIris, useUI } from "../state/store";

const CLOSE_MS = 650;
const OPEN_MS = 800;
const FADE_MS = 250;
const SAFETY_MS = 3000;
const EASE_IN_QUART: [number, number, number, number] = [0.5, 0, 0.75, 0];
const EASE_OUT_QUINT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const RIM_PX = 26;

/**
 * Both layers are masked by the same moving circle. --r is written every frame from
 * rAF/animate (no React renders). The veil is opaque OUTSIDE the circle; the rim is a
 * glow band hugging the circle's edge; the scales are a faint fish-scale pattern that
 * only shows in a thin band just outside the rim.
 */
const CSS = `
.lbf-iris{position:fixed;inset:0;z-index:90;overflow:hidden;--x:50vw;--y:50vh;--r:0px;--rim:oklch(0.7 0.1 210)}
.lbf-iris[data-phase="idle"]{display:none}
.lbf-iris>div{position:absolute;inset:0}
.lbf-iris-veil{background:var(--stage-deep);
-webkit-mask-image:radial-gradient(circle at var(--x) var(--y),transparent var(--r),#000 calc(var(--r) + 1.5px));
mask-image:radial-gradient(circle at var(--x) var(--y),transparent var(--r),#000 calc(var(--r) + 1.5px))}
.lbf-iris-rim{background:radial-gradient(circle at var(--x) var(--y),
transparent calc(var(--r) - ${RIM_PX}px),
color-mix(in oklch,var(--rim) 22%,transparent) calc(var(--r) - 5px),
color-mix(in oklch,var(--rim) 90%,white) calc(var(--r) - .5px),
color-mix(in oklch,var(--rim) 55%,transparent) calc(var(--r) + 3px),
transparent calc(var(--r) + 14px))}
.lbf-iris-scales{opacity:.2;
background-image:radial-gradient(circle at 50% 100%,transparent 58%,var(--rim) 60%,var(--rim) 66%,transparent 68%),
radial-gradient(circle at 50% 100%,transparent 58%,var(--rim) 60%,var(--rim) 66%,transparent 68%);
background-size:22px 15px,22px 15px;background-position:0 0,11px 7.5px;
-webkit-mask-image:radial-gradient(circle at var(--x) var(--y),transparent var(--r),#000 calc(var(--r) + 8px),transparent calc(var(--r) + 64px));
mask-image:radial-gradient(circle at var(--x) var(--y),transparent var(--r),#000 calc(var(--r) + 8px),transparent calc(var(--r) + 64px))}
.lbf-iris[data-mode="fade"] .lbf-iris-rim,.lbf-iris[data-mode="fade"] .lbf-iris-scales{display:none}
.lbf-iris[data-mode="fade"] .lbf-iris-veil{-webkit-mask-image:none;mask-image:none}
`;

function farthestCorner(x: number, y: number) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
}

function samePath(href: string) {
  try {
    const u = new URL(href, window.location.href);
    return u.origin === window.location.origin && u.pathname === window.location.pathname;
  } catch {
    return false;
  }
}

export function IrisTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const phase = useIris((s) => s.phase);
  const rim = useIris((s) => s.rim);
  const reduced = useUI((s) => s.reducedMotion);

  const root = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const scales = useRef<HTMLDivElement>(null);
  const startPath = useRef<string>("");
  const pushed = useRef(false);

  const setCircle = (x: number, y: number, r: number) => {
    const el = root.current;
    if (!el) return;
    el.style.setProperty("--x", `${x}px`);
    el.style.setProperty("--y", `${y}px`);
    el.style.setProperty("--r", `${r}px`);
    // Slow drift of the scale pattern so the rim shimmers as it travels.
    if (scales.current) scales.current.style.backgroundPosition = `${r * 0.06}px 0, ${r * 0.06 + 11}px 7.5px`;
  };

  // Drive the animation for the current phase. Layout effect so the first frame is styled before paint.
  useLayoutEffect(() => {
    const el = root.current;
    const vl = veil.current;
    if (!el || !vl) return;
    const { origin } = useIris.getState();
    const mode = reduced ? "fade" : "iris";
    el.dataset.mode = mode;

    if (phase === "closing") {
      startPath.current = window.location.pathname;
      pushed.current = false;
      if (reduced) {
        vl.style.opacity = "0";
        const a = animate(0, 1, {
          duration: FADE_MS / 1000,
          ease: "linear",
          onUpdate: (v) => (vl.style.opacity = String(v)),
          onComplete: () => useIris.getState().setPhase("closed"),
        });
        return () => a.stop();
      }
      vl.style.opacity = "1";
      const max = farthestCorner(origin.x, origin.y) + RIM_PX + 16;
      setCircle(origin.x, origin.y, max);
      const a = animate(max, -2, {
        duration: CLOSE_MS / 1000,
        ease: EASE_IN_QUART,
        onUpdate: (r) => setCircle(origin.x, origin.y, r),
        onComplete: () => useIris.getState().setPhase("closed"),
      });
      return () => a.stop();
    }

    if (phase === "closed") {
      vl.style.opacity = "1";
      setCircle(origin.x, origin.y, -2);
      return;
    }

    if (phase === "opening") {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      if (reduced) {
        const a = animate(1, 0, {
          duration: FADE_MS / 1000,
          ease: "linear",
          onUpdate: (v) => (vl.style.opacity = String(v)),
          onComplete: () => useIris.getState().setPhase("idle"),
        });
        return () => a.stop();
      }
      vl.style.opacity = "1";
      const max = farthestCorner(cx, cy) + RIM_PX + 16;
      setCircle(cx, cy, -2);
      const a = animate(-2, max, {
        duration: OPEN_MS / 1000,
        ease: EASE_OUT_QUINT,
        onUpdate: (r) => setCircle(cx, cy, r),
        onComplete: () => useIris.getState().setPhase("idle"),
      });
      return () => a.stop();
    }
  }, [phase, reduced]);

  // Once closed: navigate, then open when the destination is ready.
  useEffect(() => {
    if (phase !== "closed") return;
    const { href, waitForReady } = useIris.getState();
    const timers: number[] = [];
    let raf = 0;

    const openAfterFrames = () => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => useIris.getState().open());
      });
    };

    if (href && !pushed.current) {
      pushed.current = true;
      if (samePath(href)) {
        // Nothing to load: just reopen.
        openAfterFrames();
      } else {
        router.push(href);
      }
    }
    // Safety: never leave the visitor behind a black screen.
    timers.push(window.setTimeout(() => useIris.getState().open(), SAFETY_MS + (waitForReady ? 0 : 1500)));
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [phase, router]);

  // Route changed while closed and the destination does not manage its own reveal.
  useEffect(() => {
    if (phase !== "closed") return;
    const { waitForReady } = useIris.getState();
    if (waitForReady || pathname === startPath.current) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => useIris.getState().open());
    });
    return () => cancelAnimationFrame(raf);
  }, [phase, pathname]);

  return (
    <div
      ref={root}
      className="lbf-iris"
      data-phase={phase}
      aria-hidden="true"
      style={{ pointerEvents: phase === "idle" ? "none" : "auto", ["--rim" as string]: rim }}
    >
      <style>{CSS}</style>
      <div ref={veil} className="lbf-iris-veil" />
      <div ref={scales} className="lbf-iris-scales" />
      <div className="lbf-iris-rim" />
    </div>
  );
}
