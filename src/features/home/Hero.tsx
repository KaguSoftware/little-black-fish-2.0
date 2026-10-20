"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { SITE } from "@/shared/content/site";
import { pointer } from "@/shared/lib/pointer";
import { clamp } from "@/shared/lib/math";
import { useUI } from "@/shared/state/store";
import { Fish } from "./Fish";
import { lantern, sizeLantern, tickLantern } from "./lantern";
import s from "./home.module.css";

const LanternScene = dynamic(() => import("./LanternScene"), { ssr: false });

const LINES = ["Little", "Black", "Fish"] as const;

function WordLines() {
  return (
    <>
      {LINES.map((l) => (
        <span key={l} className={s.wordLine}>
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
 */
export function Hero({ onCue }: { onCue: () => void }) {
  const heroRef = useRef<HTMLElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const cleanRef = useRef<HTMLHeadingElement>(null);
  const erodedRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  const reduced = useUI((st) => st.reducedMotion);
  const paused = useUI((st) => st.paused);
  const quality = useUI((st) => st.quality);
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
        idleMs: now - p.lastMove,
        paused: st.paused,
        reduced: st.reduced,
        fade,
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
  };

  return (
    <section
      ref={heroRef}
      className={s.hero}
      aria-label="Little Black Fish"
      onPointerDown={onPointerDown}
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
        </h1>

        <Fish active={inView} />

        <div className={s.heroFoot}>
          <p className={s.tagline}>{SITE.tagline}</p>
          <button type="button" className={s.cue} onClick={onCue}>
            <span>Into the dark</span>
            <span className={s.cueLine} aria-hidden />
          </button>
        </div>
      </motion.div>

      <div ref={handRef} className={s.hand} aria-hidden />
    </section>
  );
}
