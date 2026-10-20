"use client";

import { AnimatePresence, motion, useScroll } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { TELLER_BY_ID, tellerPortrait } from "@/shared/content/characters";
import { STILL_BY_ID, stillCard } from "@/shared/content/stills";
import type { StillId } from "@/shared/content/types";
import { oklchCss } from "@/shared/lib/color";
import { clamp, damp, hash1, smoothstep, smootherstep } from "@/shared/lib/math";
import { useUI } from "@/shared/state/store";
import s from "./home.module.css";

/** One frame per teller voice. */
export const REEL_FRAMES: StillId[] = ["s09", "s08", "s04", "s15", "s12", "s23"];
export const REEL_COUNT = REEL_FRAMES.length;
/** Scroll distance per frame, in viewport heights. */
export const REEL_VH_PER_FRAME = 0.55;

/** Two-digit frame count; Persian digits on fa. */
const pad2 = (n: number, locale: string) =>
  n.toLocaleString(locale === "fa" ? "fa-IR" : "en-US", { minimumIntegerDigits: 2, useGrouping: false });

const FPS = 12;
const STEP = 1000 / FPS;

/**
 * Projector gate. A pinned film strip advances one frame per scroll beat: it holds in the
 * gate, then glides to the next frame, damped and redrawn every display frame. The
 * projector texture on top (weave, lamp flicker, the odd scratch) stays stepped at 12 fps,
 * jolting a little harder while the strip moves. Only the frame in the gate is lit; the
 * rest of the strip is the dim film either side of it.
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
  const t = useTranslations("home.reel");
  const locale = useLocale();
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
    let lastNow = 0;
    let lastTick = -1;
    let display = scrollYProgress.get() * (REEL_COUNT - 1);
    let speed = 0;
    let lastFrameIdx = -1;

    const gatePos = (pos: number) => {
      // Hold on the frame for the first part of the beat, then glide to the next.
      const i = Math.floor(pos);
      const f = pos - i;
      return i + smootherstep((f - 0.3) / 0.7);
    };

    // Strip position and gate light: every display frame, so the slide itself is smooth.
    const renderStrip = () => {
      const track = trackRef.current;
      if (!track) return;
      track.style.transform = `translate3d(${(-display * frameWRef.current).toFixed(2)}px,0,0)`;
      // light falls on the frame in the gate; the strip either side stays dim
      const refs = frameRefs.current;
      for (let i = 0; i < refs.length; i++) {
        const el = refs[i];
        if (!el) continue;
        const lit = 1 - smoothstep(0.15, 1.05, Math.abs(i - display));
        el.style.opacity = (0.16 + 0.84 * lit).toFixed(3);
      }
      const idx = clamp(Math.round(display), 0, REEL_COUNT - 1);
      if (idx !== lastFrameIdx) {
        lastFrameIdx = idx;
        setIndex(idx);
      }
    };

    // Projector texture: weave, lamp flicker and scratches, stepped at 12 fps.
    const renderFilm = (tickNo: number, still: boolean) => {
      const weave = weaveRef.current;
      if (weave) {
        if (still) {
          weave.style.transform = "none";
        } else {
          // the gate jolts a touch harder while the strip is moving through it
          const amp = 1 + Math.min(speed * 0.6, 1.2);
          const wx = hash1(tickNo * 1.7) * 2.2 * amp;
          const wy = hash1(tickNo * 2.9 + 3) * 1.6 * amp;
          const wr = hash1(tickNo * 4.1 + 9) * 0.07;
          weave.style.transform = `translate3d(${wx.toFixed(2)}px,${wy.toFixed(2)}px,0) rotate(${wr.toFixed(3)}deg)`;
        }
      }
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
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = lastNow ? Math.min((now - lastNow) / 1000, 0.05) : 1 / 60;
      lastNow = now;
      const { calm: c, paused: pz } = flags.current;
      const pos = clamp(scrollYProgress.get() * (REEL_COUNT - 1), 0, REEL_COUNT - 1);
      const still = c || pz;
      const prev = display;
      display = damp(display, still ? pos : gatePos(pos), still ? 8 : 11, dt);
      if (Math.abs(display - prev) > 1e-4 || lastFrameIdx < 0) renderStrip();
      speed = damp(speed, Math.abs(display - prev) / dt, 10, dt);

      const tick = Math.floor(now / STEP);
      if (tick === lastTick) return;
      lastTick = tick;
      renderFilm(tick, still);
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
      aria-label={t("label")}
    >
      <div className={s.reelPin} style={{ ["--gate" as string]: accent }}>
        <h2 className={s.reelTitle}>{t("title")}</h2>

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

        <div className={s.reelProgress} aria-hidden>
          <div className={s.reelProgressTrack}>
            <motion.div className={s.reelProgressFill} style={{ scaleX: scrollYProgress }} />
            {REEL_FRAMES.map((id, i) => (
              <span
                key={id}
                className={s.reelProgressTick}
                data-passed={i <= index || undefined}
                style={{ left: `${(i / (REEL_COUNT - 1)) * 100}%` }}
              />
            ))}
          </div>
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
                {t("caption", { name: teller.name, role: teller.role })}
              </span>
              <span className={s.reelCount} aria-hidden>
                {pad2(index + 1, locale)} / {pad2(REEL_COUNT, locale)}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
