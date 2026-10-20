"use client";

import { AnimatePresence, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { CHAPTER_BY_ID } from "@/shared/content/chapters";
import { runtime } from "@/shared/lib/runtime";
import { useSeries, useUI } from "@/shared/state/store";
import { localDigits } from "./lib/i18n";

/** Quiet "02 · My world" label with a thin progress hairline across the story. */
export function ChapterIndicator() {
  const t = useTranslations("series");
  const locale = useLocale();
  const chapter = useSeries((s) => s.chapter);
  const rm = useUI((s) => s.reducedMotion);
  const bar = useRef<HTMLSpanElement>(null);
  const meta = CHAPTER_BY_ID[chapter];

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    let raf = 0;
    let last = -1;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const p = Math.round(runtime.progress * 2000) / 2000;
      if (p === last) return;
      last = p;
      el.style.transform = `scaleX(${p})`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="absolute start-[var(--gutter)] top-[4.75rem] w-[min(11rem,42vw)] md:top-[5.25rem]"
      style={{ color: "var(--ink-dim)", textShadow: "0 0 12px oklch(0.06 0.01 var(--hue) / 0.9)" }}
    >
      <div className="relative h-[1.4em] overflow-hidden" style={{ fontFamily: "var(--font-display-10)", fontSize: "0.95rem" }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.p
            key={chapter}
            className="whitespace-nowrap"
            initial={rm ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: rm ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] } }}
            exit={rm ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -6, transition: { duration: 0.2 } }}
          >
            {t("chapterLabel", { number: localDigits(meta.number, locale), title: t(`chapters.${chapter}.title`) })}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="relative mt-1.5 h-px w-full" aria-hidden="true" style={{ background: "var(--hairline)" }}>
        <span ref={bar} className="absolute inset-0 origin-left rtl:origin-right" style={{ background: "var(--accent)", transform: "scaleX(0)" }} />
      </div>
    </div>
  );
}
