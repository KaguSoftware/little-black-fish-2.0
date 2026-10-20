"use client";

import { AnimatePresence, motion, useScroll } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TELLER_BY_ID, tellerPortrait } from "@/shared/content/characters";
import { STILL_BY_ID, stillCard } from "@/shared/content/stills";
import type { StillId } from "@/shared/content/types";
import { oklchCss } from "@/shared/lib/color";
import { clamp, easeOutQuint, hash1, smoothstep } from "@/shared/lib/math";
import { useUI } from "@/shared/state/store";
import s from "./home.module.css";

/** One frame per teller voice, then a few more of the world. */
export const REEL_FRAMES: StillId[] = [
  "s09", "s08", "s04", "s15", "s12", "s23", "s13", "s20", "s18", "s06",
];
export const REEL_COUNT = REEL_FRAMES.length;
/** Scroll distance per frame, in viewport heights. */
export const REEL_VH_PER_FRAME = 0.55;

const FPS = 12;
const STEP = 1000 / FPS;

/**
 * Projector gate. A pinned film strip advances one frame per scroll beat. The strip is
 * PULLED down a frame in a quick claw motion and then held (the gate), the whole picture
 * updating at 12 fps with a little weave, flicker and the odd scratch. Only the frame in
 * the gate is lit; the rest of the strip is the dim film either side of it.
 * Reduced motion: the strip glides smoothly, with no weave, flicker or scratches.
 */
export function ReelStrip() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const weaveRef = useRef<HTMLDivElement>(null);
  const flickerRef = useRef<HTMLDivElement>(null);
  const scratchRef = useRef<HTMLDivElement>(null);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const reduced = useUI((st) => st.reducedMotion);
  const paused = useUI((st) => st.paused);
  const calm = reduced;
  const flags = useRef({ calm, paused });
  const frameWRef = useRef(600);

  useEffect(() => {
    flags.current = { calm, paused };
  }, [calm, paused]);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin: "20% 0px 20% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const first = trackRef.current?.firstElementChild as HTMLElement | null;
    if (!first) return;
    const ro = new ResizeObserver(() => {
      frameWRef.current = first.offsetWidth || 600;
    });
    ro.observe(first);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    let lastTick = 0;
    let smooth = scrollYProgress.get() * (REEL_COUNT - 1);
    let lastFrameIdx = -1;

    const gatePos = (pos: number) => {
      // Hold on the frame, then a quick claw pull to the next in the last 35% of the beat.
      const i = Math.floor(pos);
      const f = pos - i;
      const pull = easeOutQuint(clamp((f - 0.62) / 0.38));
      return i + pull;
    };

    const render = (display: number, tickNo: number, still: boolean) => {
      const track = trackRef.current;
      const weave = weaveRef.current;
      if (!track || !weave) return;
      const root = sectionRef.current;
      if (!root) return;
      const frameW = frameWRef.current;
      track.style.transform = `translate3d(${(-display * frameW).toFixed(1)}px,0,0)`;
      // weave: the whole picture wobbles by a hair on every tick
      if (still) {
        weave.style.transform = "none";
      } else {
        const wx = hash1(tickNo * 1.7) * 2.2;
        const wy = hash1(tickNo * 2.9 + 3) * 1.6;
        const wr = hash1(tickNo * 4.1 + 9) * 0.07;
        weave.style.transform = `translate3d(${wx.toFixed(2)}px,${wy.toFixed(2)}px,0) rotate(${wr.toFixed(3)}deg)`;
      }
      // flicker: lamp brightness, the odd dip
      const fl = flickerRef.current;
      if (fl) {
        const dip = hash1(tickNo * 6.3) > 0.86 ? 0.3 : 0.08;
        fl.style.opacity = still ? "0" : String((0.5 + 0.5 * hash1(tickNo * 3.3 + 1)) * dip);
      }
      const sc = scratchRef.current;
      if (sc) {
        const show = !still && hash1(tickNo * 8.8) > 0.55;
        sc.style.opacity = show ? "0.22" : "0";
        if (show) sc.style.left = `${((hash1(tickNo * 5.5) * 0.5 + 0.5) * 100).toFixed(1)}%`;
      }
      // light falls on the frame in the gate; the strip either side stays dim
      const refs = frameRefs.current;
      for (let i = 0; i < refs.length; i++) {
        const el = refs[i];
        if (!el) continue;
        const dd = Math.abs(i - display);
        const lit = 1 - smoothstep(0.15, 1.05, dd);
        el.style.opacity = String((0.16 + 0.84 * lit).toFixed(3));
      }
      const idx = clamp(Math.round(display), 0, REEL_COUNT - 1);
      if (idx !== lastFrameIdx) {
        lastFrameIdx = idx;
        setIndex(idx);
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const { calm: c, paused: pz } = flags.current;
      const target = scrollYProgress.get() * (REEL_COUNT - 1);
      if (c || pz) {
        // smooth, unstepped
        smooth += (target - smooth) * 0.14;
        render(smooth, 0, true);
        return;
      }
      if (now - lastTick < STEP) return;
      lastTick = now;
      const tick = Math.floor(now / STEP);
      // The gate pulls from the scroll-derived position, but the picture only changes at 12 fps.
      const display = gatePos(clamp(target, 0, REEL_COUNT - 1));
      render(display, tick, false);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [inView, scrollYProgress]);

  const still = STILL_BY_ID[REEL_FRAMES[index]];
  const teller = TELLER_BY_ID[still.tellers[0]];
  const accent = oklchCss(teller.accent);

  return (
    <section
      id="reel"
      ref={sectionRef}
      className={s.reel}
      style={{ height: `calc(100svh + ${(REEL_COUNT - 1) * REEL_VH_PER_FRAME * 100}svh)` }}
      aria-label="Six voices, one story"
    >
      <div className={s.reelPin} style={{ ["--gate" as string]: accent }}>
        <h2 className={s.reelTitle}>Six voices. One story.</h2>

        <div className={s.reelWindow}>
          <div ref={weaveRef} className={s.reelWeave}>
            <div ref={trackRef} className={s.reelTrack}>
              {REEL_FRAMES.map((id, i) => {
                const st = STILL_BY_ID[id];
                return (
                  <div key={id} className={s.reelCell}>
                    <div className={s.reelNo} aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div
                      className={s.reelFrame}
                      ref={(el) => void (frameRefs.current[i] = el)}
                      style={{ opacity: i === 0 ? 1 : 0.16 }}
                    >
                      <picture>
                        <source
                          type="image/avif"
                          srcSet={`${stillCard(id, 640, "avif")} 640w, ${stillCard(id, 1200, "avif")} 1200w`}
                          sizes="(max-width: 800px) 82vw, 56vw"
                        />
                        <img
                          src={stillCard(id, 1200, "webp")}
                          srcSet={`${stillCard(id, 640, "webp")} 640w, ${stillCard(id, 1200, "webp")} 1200w`}
                          sizes="(max-width: 800px) 82vw, 56vw"
                          alt={st.alt}
                          loading={i < 3 ? "eager" : "lazy"}
                          decoding="async"
                          draggable={false}
                        />
                      </picture>
                    </div>
                    <div className={s.reelNo} aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div ref={flickerRef} className={s.reelFlicker} aria-hidden />
          <div ref={scratchRef} className={s.reelScratch} aria-hidden />
          <div className={s.reelGate} aria-hidden />
        </div>

        <div className={s.reelCaption} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              className={s.reelCaptionRow}
              initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -4, filter: "blur(2px)", transition: { duration: 0.16 } }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={s.reelFace}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tellerPortrait(teller.id)} alt="" width={40} height={53} loading="lazy" decoding="async" />
              </span>
              <span className={s.reelName}>
                {teller.name}, {teller.role}
              </span>
              <span className={s.reelCount} aria-hidden>
                {String(index + 1).padStart(2, "0")} / {String(REEL_COUNT).padStart(2, "0")}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
