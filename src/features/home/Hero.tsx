"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { useTranslations } from "next-intl";
import { pointer } from "@/shared/lib/pointer";
import { clamp } from "@/shared/lib/math";
import { useUI } from "@/shared/state/store";
import { Fish } from "./Fish";
import { lantern, sizeLantern, tickLantern } from "./lantern";
import s from "./home.module.css";

const LanternScene = dynamic(() => import("./LanternScene"), { ssr: false });

/** The wordmark is the brand mark: Latin in every locale (the erosion needs Redaction). */
const LINES = ["Little", "Black", "Fish"] as const;

/** A touch that stays put this long becomes a hold; moving further first means it was a scroll. */
const HOLD_MS = 180;
const HOLD_SLOP = 10;
/** Set once someone has held the light, so the hint stops teaching it. */
const TAUGHT_KEY = "lbf:held-light";

function WordLines() {
  return (
    <>
      {LINES.map((l) => (
        <span key={l} className={s.wordLine} aria-hidden>
          {l}
        </span>
      ))}
    </>
  );
}

/**
 * Hero: the lantern wall. DOM layers (wordmark x2, tagline, fish, hand) sit over a single
 * WebGL canvas. ONE rAF loop here advances the shared `lantern` object and writes CSS
 * variables; the canvas, the wordmark mask and the fish all read from it. No React state
 * changes per frame.
 *
 * Touch has no cursor, so a press-and-hold carries the light instead: the thumb takes the
 * lantern, it swells, and page scrolling is blocked for that gesture only. A quick swipe
 * still scrolls.
 */
export function Hero({ onCue }: { onCue: () => void }) {
  const heroRef = useRef<HTMLElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const cleanRef = useRef<HTMLHeadingElement>(null);
  const erodedRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const hold = useRef({ timer: 0, down: false, on: false, sx: 0, sy: 0 });
  const reduced = useUI((st) => st.reducedMotion);
  const paused = useUI((st) => st.paused);
  const quality = useUI((st) => st.quality);
  const t = useTranslations("home.hero");
  const motionOn = useRef(true);
  const geo = useRef({ left: 0, docTop: 0, w: 0, h: 0 });
  const live = useRef({ paused, reduced, inView });

  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const contentOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const contentShift = useTransform(scrollYProgress, [0, 1], ["0%", "-6%"]);
  const canvasOpacity = useTransform(scrollYProgress, [0.05, 0.8], [1, 0]);

  useEffect(() => {
    motionOn.current = !reduced && !paused;
    live.current = { paused, reduced, inView };
  }, [paused, reduced, inView]);

  // Already held the light on an earlier visit: no hint. Set on the DOM, so no extra render.
  useEffect(() => {
    try {
      if (localStorage.getItem(TAUGHT_KEY)) hintRef.current?.setAttribute("data-gone", "true");
    } catch {}
  }, []);

  // Non-passive, so a held thumb can stop the page from scrolling under it.
  useEffect(() => {
    const el = heroRef.current;
    const h = hold.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      if (h.on) e.preventDefault();
    };
    const onContextMenu = (e: Event) => {
      if (h.down) e.preventDefault();
    };
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("contextmenu", onContextMenu);
      clearTimeout(h.timer);
    };
  }, []);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    io.observe(el);
    const measure = () => {
      const r = el.getBoundingClientRect();
      geo.current = { left: r.left, docTop: r.top + window.scrollY, w: r.width, h: r.height };
      sizeLantern(r.width, r.height);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  useEffect(() => {
    if (!inView) return;
    const el = heroRef.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    // Last values written, so unchanged frames cost no style work. The light's colour drifts
    // over seconds; refreshing it ~8x a second is indistinguishable and saves text repaints.
    let mask = "";
    let colour = "";
    let colourAt = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = (now - last) / 1000;
      last = now;
      // Cached geometry: no layout read in the frame loop.
      const g = geo.current;
      if (g.w < 2) return;
      const rect = { left: g.left, top: g.docTop - window.scrollY };
      const p = pointer;
      const fade = 1 - clamp((scrollYProgress.get() - 0.12) / 0.62);
      const st = live.current;
      tickLantern({
        dt,
        px: p.px - rect.left,
        py: p.py - rect.top,
        pointerLive: p.active && p.lastMove > 0,
        fine: p.fine,
        idleMs: now - p.lastMove,
        paused: st.paused,
        reduced: st.reduced,
        fade,
        held: hold.current.on,
      });
      // Write the light onto the two word layers only, not the hero: custom properties
      // inherit, so setting them on the section would restyle every descendant each frame.
      const clean = cleanRef.current;
      const eroded = erodedRef.current;
      const nextMask = `${lantern.x.toFixed(1)}|${lantern.y.toFixed(1)}|${lantern.radius.toFixed(1)}`;
      if (clean && nextMask !== mask) {
        mask = nextMask;
        clean.style.setProperty("--lx", `${lantern.x.toFixed(1)}px`);
        clean.style.setProperty("--ly", `${lantern.y.toFixed(1)}px`);
        clean.style.setProperty("--lr", `${lantern.radius.toFixed(1)}px`);
      }
      if (lantern.css !== colour && now - colourAt > 120) {
        colour = lantern.css;
        colourAt = now;
        clean?.style.setProperty("--lc", colour);
        eroded?.style.setProperty("--lc", colour);
      }
      const hand = handRef.current;
      if (hand) {
        hand.style.transform = `translate3d(${(p.px - rect.left).toFixed(1)}px, ${(p.py - rect.top).toFixed(1)}px, 0)`;
        hand.style.opacity = String(p.active ? (1 - lantern.wander) * fade : 0);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, scrollYProgress]);

  const onPointerDown = (e: React.PointerEvent) => {
    const p = pointer;
    p.px = e.clientX;
    p.py = e.clientY;
    p.active = true;
    p.lastMove = performance.now();
    p.fine = e.pointerType !== "touch";
    if (e.pointerType === "mouse" || (e.target as Element).closest("button, a")) return;

    const h = hold.current;
    clearTimeout(h.timer);
    h.down = true;
    h.sx = e.clientX;
    h.sy = e.clientY;
    h.timer = window.setTimeout(() => {
      if (!h.down) return;
      h.on = true;
      heroRef.current?.setAttribute("data-holding", "true");
      navigator.vibrate?.(8);
      hintRef.current?.setAttribute("data-gone", "true");
      try {
        localStorage.setItem(TAUGHT_KEY, "1");
      } catch {}
    }, HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const h = hold.current;
    if (!h.down || h.on) return;
    if (Math.hypot(e.clientX - h.sx, e.clientY - h.sy) > HOLD_SLOP) {
      clearTimeout(h.timer);
      h.down = false;
    }
  };

  const onPointerUp = () => {
    const h = hold.current;
    clearTimeout(h.timer);
    if (h.on) {
      // Let go: the light lingers where the thumb left it, then wanders off again.
      pointer.lastMove = performance.now();
      heroRef.current?.removeAttribute("data-holding");
    }
    h.down = false;
    h.on = false;
  };

  return (
    <section
      ref={heroRef}
      className={s.hero}
      aria-label={t("label")}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <motion.div className={s.heroCanvas} style={{ opacity: canvasOpacity }} aria-hidden>
        <LanternScene active={inView} highTier={quality === "high"} motionOn={motionOn} />
      </motion.div>

      <motion.div className={s.heroContent} style={{ opacity: contentOpacity, y: contentShift }}>
        {/* Eroded name, everywhere. */}
        <div ref={erodedRef} className={`${s.wordLayer} ${s.wordEroded}`} aria-hidden>
          <WordLines />
        </div>
        {/* Clean name, only where the light falls. */}
        <h1 ref={cleanRef} className={`${s.wordLayer} ${s.wordClean}`}>
          <WordLines />
          {/* Last, so .wordLine:first-child still matches "Little". */}
          <span className="sr-only">{t("name")}</span>
        </h1>

        <Fish active={inView} />

        {/* Touch only (CSS): teaches the hold until someone has used it once. */}
        <p ref={hintRef} className={s.holdHint} aria-hidden>
          <span className={s.holdHintInner}>
            <span className={s.holdRing} />
            {t("hold")}
          </span>
        </p>

        <div className={s.heroFoot}>
          <p className={s.tagline}>{t("tagline")}</p>
          <button type="button" className={s.cue} onClick={onCue}>
            <span>{t("cue")}</span>
            <span className={s.cueLine} aria-hidden />
          </button>
        </div>
      </motion.div>

      <div ref={handRef} className={s.hand} aria-hidden />
    </section>
  );
}
