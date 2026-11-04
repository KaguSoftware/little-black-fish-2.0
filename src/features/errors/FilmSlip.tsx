"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useUI } from "@/shared/state/store";
import s from "./errors.module.css";

export type FilmVariant = "missing" | "jammed" | "down";

interface FilmSlipProps {
  /** missing: the frame slips out of the gate. jammed: the projector caught. down: the reel stopped. */
  variant: FilmVariant;
  /** Giant numeral in the gate. Decorative (aria-hidden); the eyebrow carries the code for readers. */
  code: string;
  eyebrow: string;
  title: string;
  /** Spoken once on mount through an alert live region (error boundaries swap content silently). */
  announce?: string;
  /** Move focus to the title on mount (error boundaries replace the focused element). */
  focusTitle?: boolean;
  /** Optional strip of text above the gate (global-error has no Nav to provide a masthead). */
  masthead?: ReactNode;
  /** Draw the film grain here (the locale layout already draws it for the other pages). */
  grain?: boolean;
  /** Body copy. */
  children: ReactNode;
  /** Links/buttons. Mark the main one data-primary, quieter ones data-secondary. */
  actions: ReactNode;
  /** Small print under the actions (error reference). */
  note?: ReactNode;
}

/**
 * The film slips out of the gate. One composition for every error state: sprocket columns run
 * along both edges, a lit gate shows the giant numeral, and a black frame line rolls up through
 * the picture while the numeral degrades from clean Redaction to the eroded cut and heals again.
 * The pointer nudges the slip. Everything moves with compositor-only transforms/opacity.
 *
 * Calm (prefers-reduced-motion, the site's reducedMotion / paused): no movement at all, a static
 * composed frame with the sprocket holes in view. Off-screen or hidden tab: animations pause.
 */
export function FilmSlip({
  variant,
  code,
  eyebrow,
  title,
  announce,
  focusTitle,
  masthead,
  grain,
  children,
  actions,
  note,
}: FilmSlipProps) {
  const stageRef = useRef<HTMLElement>(null);
  const gateRef = useRef<HTMLDivElement>(null);
  const holesA = useRef<HTMLSpanElement>(null);
  const holesB = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const reducedStore = useUI((st) => st.reducedMotion);
  const pausedStore = useUI((st) => st.paused);
  // Read the media query directly too: global-error renders without the site's Providers.
  const [reducedMq, setReducedMq] = useState(false);
  const [visible, setVisible] = useState(true);
  const [tabHidden, setTabHidden] = useState(false);
  const [live, setLive] = useState("");

  const calm = reducedStore || pausedStore || reducedMq;
  const idle = !visible || tabHidden;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMq(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 });
    io.observe(el);
    const onVis = () => setTabHidden(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // The pointer nudges the slip: the picture follows a little, the sprocket columns lean the other
  // way. One damped rAF loop that sleeps as soon as it settles; writes only the `translate` property.
  useEffect(() => {
    const gate = gateRef.current;
    const a = holesA.current;
    const b = holesB.current;
    if (calm || !gate || !a || !b) return;
    let tx = 0;
    let ty = 0;
    let x = 0;
    let y = 0;
    let raf = 0;
    const apply = () => {
      gate.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
      const h = `0 ${(-y * 1.6).toFixed(2)}px`;
      a.style.translate = h;
      b.style.translate = h;
    };
    const loop = () => {
      x += (tx - x) * 0.09;
      y += (ty - y) * 0.09;
      apply();
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.04 ? requestAnimationFrame(loop) : 0;
    };
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2 * 14;
      ty = (e.clientY / window.innerHeight - 0.5) * 2 * 10;
      if (!raf) raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      gate.style.translate = "";
      a.style.translate = "";
      b.style.translate = "";
    };
  }, [calm]);

  useEffect(() => {
    if (focusTitle) titleRef.current?.focus({ preventScroll: true });
  }, [focusTitle]);

  useEffect(() => {
    // Fill the (already mounted) alert region a beat later so assistive tech announces it.
    if (!announce) return;
    const id = window.setTimeout(() => setLive(announce), 60);
    return () => window.clearTimeout(id);
  }, [announce]);

  const numeral = (
    <div className={s.plate}>
      <span className={s.num} dir="ltr">
        <span className={s.numClean}>{code}</span>
        <span className={s.numErode}>{code}</span>
      </span>
    </div>
  );

  return (
    <main
      id="main"
      ref={stageRef}
      className={s.stage}
      data-variant={variant}
      data-calm={calm || undefined}
      data-idle={idle || undefined}
      data-masthead={masthead ? "" : undefined}
    >
      <div className={`${s.strip} ${s.stripStart}`} aria-hidden="true">
        <span ref={holesA} className={s.holes} />
      </div>

      <div className={s.body}>
        {masthead ? <div className={s.masthead}>{masthead}</div> : null}

        <div className={s.gate} aria-hidden="true">
          <div ref={gateRef} className={s.nudge}>
            <div className={s.weave}>
              <div className={s.roll}>
                {numeral}
                <div className={s.bar} />
                {numeral}
              </div>
            </div>
          </div>
          <div className={s.lamp} />
          <div className={s.burn} />
          <div className={s.scratch} />
          <div className={s.vignette} />
        </div>

        <div className={s.copy}>
          <div className={s.copyHead}>
            <p className={s.eyebrow}>{eyebrow}</p>
            <h1 ref={titleRef} className={s.title} tabIndex={-1}>
              {title}
            </h1>
          </div>
          <div className={s.copyBody}>
            <div className={s.text}>{children}</div>
            <div className={s.actions}>{actions}</div>
            {note ? <p className={s.note}>{note}</p> : null}
          </div>
        </div>
      </div>

      <div className={`${s.strip} ${s.stripEnd}`} aria-hidden="true">
        <span ref={holesB} className={s.holes} />
      </div>

      {grain ? <div className={s.grain} aria-hidden="true" /> : null}
      <p className={s.srOnly} role="alert">
        {live}
      </p>
    </main>
  );
}
