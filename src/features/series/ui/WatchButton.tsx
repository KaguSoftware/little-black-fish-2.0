"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SITE } from "@/shared/content/site";
import { runtime } from "@/shared/lib/runtime";
import { useUI } from "@/shared/state/store";
import { HairlineLink } from "./lib/HairlineLink";
import { enterMotion } from "./lib/enter";

/**
 * "Watch the series" in WHAT I DID, on the text side under the narration. Shown when
 * fx.watch > 0.5. Links to the series row's episodes (SITE.seriesUrl without a row). A rAF watcher flips discrete state only on threshold crossings.
 */
export function WatchButton({ href }: { href: string | null }) {
  const t = useTranslations("series");
  const rm = useUI((s) => s.reducedMotion);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let raf = 0;
    let on = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const next = runtime.frame.fx.watch > 0.5;
      if (next !== on) {
        on = next;
        setShown(next);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const m = enterMotion(rm);
  return (
    <AnimatePresence>
      {shown ? (
        <motion.div
          key="watch"
          className="absolute left-[var(--gutter)] top-[9.5rem] md:left-auto md:right-[var(--gutter)] md:top-[calc(50%+9rem)]"
          style={{ fontSize: "var(--step-2)", width: "22ch", pointerEvents: "none" }}
          initial={m.initial}
          animate={m.animate}
          exit={m.exit}
        >
          <HairlineLink
            href={href || SITE.seriesUrl}
            className="pointer-events-auto display"
            style={{
              fontSize: "var(--step-2)",
              lineHeight: 1,
              color: "var(--ink)",
              textShadow: "0 0 24px oklch(0.06 0.01 var(--hue) / 0.8)",
            }}
          >
            {t("watch")}
          </HairlineLink>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
