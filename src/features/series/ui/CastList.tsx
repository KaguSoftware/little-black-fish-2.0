"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { TELLERS, TELLER_IDS, tellerPortrait } from "@/shared/content/characters";
import type { MoodId, TellerId } from "@/shared/content/types";
import { useSeries, useUI } from "@/shared/state/store";
import { listVariants, tellerAccentCss } from "./lib/enter";
import { scrollToTop } from "./lib/lenis";

/** One-line mood descriptors (placeholder voice notes; replace with the studio's). */
const DESCRIPTOR: Record<MoodId, string> = {
  bouncy: "Bright, restless, cannot stand still",
  bored: "Slow, heavy, has seen it all",
  angry: "Sharp, loud, fists closed",
  dreamy: "Floating, mirror-bright",
  ceremonial: "Measured, every word placed",
  skittish: "Wary, quick to flinch",
};

/**
 * THE OTHERS: the six tellers as a staggered list on the text side. Reaching the chapter
 * requests every teller's assets (the lazy-load trigger). Hover/focus pre-tints the scene,
 * click switches teller and replays the story from the top in that voice.
 */
export function CastList() {
  const chapter = useSeries((s) => s.chapter);
  const teller = useSeries((s) => s.teller);
  const rm = useUI((s) => s.reducedMotion);
  const visible = chapter === "others";

  useEffect(() => {
    if (!visible) return;
    useSeries.getState().request(TELLER_IDS);
    return () => useSeries.getState().setHoverTeller(null);
  }, [visible]);

  const v = listVariants(rm, 0.07, 0.25);

  const choose = (id: TellerId) => {
    const s = useSeries.getState();
    s.switchTeller(id, "cast");
    s.setHoverTeller(null);
    scrollToTop();
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.ul
          key="cast"
          aria-label="The other tellers"
          className="pointer-events-none absolute bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-[var(--gutter)] grid w-[calc(100%-2*var(--gutter))] grid-cols-2 gap-x-4 gap-y-3 md:bottom-[calc(6.25rem+env(safe-area-inset-bottom))] md:w-[min(34rem,46vw)] md:gap-x-6 md:gap-y-3"
          variants={v.parent}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {TELLERS.map((t, i) => {
            const now = t.id === teller;
            const accent = tellerAccentCss(t.accent);
            return (
              <motion.li key={t.id} variants={v.item} className={i % 2 === 1 ? "translate-y-5 md:translate-y-7" : ""}>
                <button
                  type="button"
                  onClick={() => choose(t.id)}
                  onPointerEnter={() => {
                    useSeries.getState().request([t.id]);
                    useSeries.getState().setHoverTeller(t.id);
                  }}
                  onPointerLeave={() => useSeries.getState().setHoverTeller(null)}
                  onFocus={() => {
                    useSeries.getState().request([t.id]);
                    useSeries.getState().setHoverTeller(t.id);
                  }}
                  onBlur={() => useSeries.getState().setHoverTeller(null)}
                  aria-current={now ? "true" : undefined}
                  aria-label={
                    now ? `${t.name}, ${t.role}, telling now` : `Hear it from ${t.name}, ${t.role}`
                  }
                  className="group pointer-events-auto flex w-full items-center gap-3 rounded-md p-1 text-left active:scale-[0.98] md:gap-4"
                >
                  <span
                    className="relative block h-[4.25rem] w-[3.25rem] shrink-0 md:h-[5.5rem] md:w-[4.25rem]"
                    style={{ background: `color-mix(in oklab, ${accent} 30%, var(--stage-deep))`, borderRadius: "0.4rem" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tellerPortrait(t.id)}
                      alt=""
                      width={300}
                      height={400}
                      loading="lazy"
                      draggable={false}
                      onError={(e) => {
                        e.currentTarget.style.visibility = "hidden";
                      }}
                      className={`size-full object-cover ${
                        now ? "" : "opacity-80 saturate-[0.75] group-hover:opacity-100 group-hover:saturate-100 group-focus-visible:opacity-100"
                      }`}
                      style={{ borderRadius: "0.4rem" }}
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -inset-[3px] border-2 transition-opacity duration-150"
                      style={{ borderColor: accent, borderRadius: "0.55rem", opacity: now ? 1 : 0 }}
                    />
                  </span>
                  <span className="min-w-0" style={{ textShadow: "0 0 16px oklch(0.06 0.01 var(--hue) / 0.95)" }}>
                    <span className="display block text-[length:var(--step-1)]" style={{ color: "var(--ink)" }}>
                      {t.name}
                    </span>
                    <span className="block text-[0.8rem] leading-snug" style={{ color: "var(--ink-dim)" }}>
                      {t.role}
                    </span>
                    <span className="mt-0.5 hidden text-[0.8rem] leading-snug lg:block" style={{ color: "var(--ink-dim)" }}>
                      {DESCRIPTOR[t.mood]}
                    </span>
                    {now ? (
                      <span className="mt-1 block text-[0.78rem] font-medium" style={{ color: accent }}>
                        Telling now
                      </span>
                    ) : null}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </motion.ul>
      ) : null}
    </AnimatePresence>
  );
}
