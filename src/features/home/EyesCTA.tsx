"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { TELLER_BY_ID } from "@/shared/content/characters";
import { SITE } from "@/shared/content/site";
import { oklchCss } from "@/shared/lib/color";
import { useTellerPuppet } from "@/shared/puppets/rig/useTellerPuppet";
import { useIris, useUI } from "@/shared/state/store";
import { navigateWithIris } from "@/shared/transition/navigate";
import type { PupilPoint } from "./EyesScene";
import { FallbackEyes } from "./FallbackEyes";
import s from "./home.module.css";

const EyesScene = dynamic(() => import("./EyesScene"), { ssr: false });

const SERIES_HREF = "/projects/series";
const CHILD_RIM = oklchCss(TELLER_BY_ID.child.accent);

/**
 * The CTA. The screen goes to black; the Child's paper mask fades up out of the dark, lit
 * only around the eyes. The pupils follow the cursor, lids lift as you come near, six
 * accent dots circle the eyes. Clicking the eyes or "Look closer" closes the page transition
 * iris INTO the left pupil, and the series opens on the same eyes.
 */
export function EyesCTA() {
  const ref = useRef<HTMLElement>(null);
  const router = useRouter();
  const quality = useUI((st) => st.quality);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [usable, setUsable] = useState(false);
  const [engagedUi, setEngagedUi] = useState(false);
  const engaged = useRef(false);
  const pupil = useRef<PupilPoint>({ x: 0, y: 0, valid: false });

  // Build the puppet only once the section is within a screen of the viewport.
  const puppet = useTellerPuppet(near ? "child" : null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ioNear = new IntersectionObserver(([e]) => setNear((v) => v || e.isIntersecting), { rootMargin: "100% 0px 100% 0px" });
    const ioView = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 });
    const ioReveal = new IntersectionObserver(([e]) => setRevealed(e.intersectionRatio > 0.45), { threshold: [0, 0.45, 0.7] });
    ioNear.observe(el);
    ioView.observe(el);
    ioReveal.observe(el);
    return () => {
      ioNear.disconnect();
      ioView.disconnect();
      ioReveal.disconnect();
    };
  }, []);

  useEffect(() => {
    if (near) router.prefetch(SERIES_HREF);
  }, [near, router]);

  const setEngaged = useCallback((v: boolean) => {
    engaged.current = v;
    setEngagedUi(v);
  }, []);

  const reportPupil = useCallback((x: number, y: number) => {
    const p = pupil.current;
    p.x = x;
    p.y = y;
    p.valid = true;
  }, []);

  const go = useCallback((e?: { clientX: number; clientY: number }) => {
    if (useIris.getState().phase !== "idle") return;
    const p = pupil.current;
    const origin = p.valid
      ? { x: p.x, y: p.y }
      : e
        ? { x: e.clientX, y: e.clientY }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    navigateWithIris(SERIES_HREF, origin, { rim: CHILD_RIM, waitForReady: true });
  }, []);

  const sceneLive = !!puppet && usable;

  return (
    <section
      id="eyes"
      ref={ref}
      className={s.eyes}
      data-engaged={engagedUi ? "true" : "false"}
      data-live={sceneLive ? "true" : "false"}
      aria-labelledby="eyes-title"
    >
      <div className={s.eyesStage} aria-hidden>
        {near && puppet && (
          <div className={s.eyesCanvas} data-live={sceneLive ? "true" : "false"}>
            <EyesScene
              puppet={puppet}
              active={inView}
              revealed={revealed}
              highTier={quality === "high"}
              engaged={engaged}
              onPupil={reportPupil}
              onUsable={setUsable}
            />
          </div>
        )}
        <div className={s.eyesFallback} data-hidden={sceneLive ? "true" : "false"}>
          <FallbackEyes active={inView && revealed && !sceneLive} engaged={engaged} pupil={pupil} />
        </div>
        <div className={s.eyesVignette} />
      </div>

      <h2 id="eyes-title" className={s.eyesTitle} aria-label={SITE.seriesTitle}>
        <span className={s.titleEroded} aria-hidden>
          {SITE.seriesTitle}
        </span>
        <span className={s.titleClean} aria-hidden>
          {SITE.seriesTitle}
        </span>
      </h2>

      {/* Mouse/touch only: the eyes themselves are a target. Keyboard users have the link below. */}
      <div
        className={s.eyesHit}
        aria-hidden
        onPointerEnter={() => setEngaged(true)}
        onPointerLeave={() => setEngaged(false)}
        onClick={(e) => go(e)}
      />

      <a
        href={SERIES_HREF}
        className={s.look}
        onPointerEnter={() => setEngaged(true)}
        onPointerLeave={() => setEngaged(false)}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          go(e.detail === 0 ? undefined : e);
        }}
      >
        <span className={s.lookText}>Look closer</span>
        <span className={s.lookLine} aria-hidden />
      </a>
    </section>
  );
}
