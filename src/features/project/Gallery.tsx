"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { LayoutGroup, motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/shared/data/localize";
import { useUI } from "@/shared/state/store";

type Img = { src: string; srcSet?: string };

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** Desktop share of the viewport each variant spans (for `sizes`). Mirrors .pj-fig[data-v] below. */
const VW = [58, 34, 66, 42, 58, 50, 42];
const CAP = "104rem";

/**
 * A gallery hung in the dark. The first image is the lead (full width, eager); the rest
 * fall into an uneven rhythm of spans and offsets. Each one is projected in as it enters
 * the view (a wipe plus the light coming up). Pressing an image enlarges it in place to
 * the full width (no modal); pressing again returns it.
 */
export function Gallery({ images, title, interlude }: { images: Img[]; title: string; interlude?: ReactNode }) {
  const t = useTranslations("project");
  const locale = useLocale();
  const rtl = locale === "fa";
  const num = (n: number) => formatNumber(n, locale);
  const reduced = useUI((s) => s.reducedMotion);
  const [open, setOpen] = useState<number | null>(null);
  const figs = useRef<(HTMLElement | null)[]>([]);
  const total = images.length;
  const [lead, ...rest] = images;

  const hidden = rtl ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)";
  const reveal = reduced
    ? { initial: { opacity: 0 }, whileInView: { opacity: 1 }, transition: { duration: 0.3 } }
    : {
        initial: { opacity: 0, clipPath: hidden, filter: "brightness(0.25)" },
        whileInView: { opacity: 1, clipPath: "inset(0 0% 0 0%)", filter: "brightness(1)" },
        transition: { duration: 1, ease: EASE_OUT },
      };

  const settle = (i: number) => {
    const el = figs.current[i];
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 64 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ block: r.height > window.innerHeight ? "start" : "center", behavior: reduced ? "auto" : "smooth" });
    }
  };

  const toggle = (i: number) => {
    setOpen((cur) => (cur === i ? null : i));
    if (reduced) requestAnimationFrame(() => settle(i));
  };

  return (
    <>
      {lead && (
        <figure className="pj-lead">
          <img
            className="pj-img pj-lead-img"
            src={lead.src}
            srcSet={lead.srcSet}
            sizes={`min(100vw, ${CAP})`}
            alt={t("imageAlt", { title, n: num(1), total: num(total) })}
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
        </figure>
      )}

      {interlude}

      {rest.length > 0 && (
        <LayoutGroup>
          <div className="pj-grid">
            {rest.map((img, k) => {
              const n = k + 2;
              const v = k % VW.length;
              const isOpen = open === n;
              return (
                <motion.figure
                  key={img.src}
                  ref={(el: HTMLElement | null) => {
                    figs.current[n] = el;
                  }}
                  className="pj-fig"
                  data-v={v}
                  data-open={isOpen ? "true" : "false"}
                  layout={!reduced}
                  transition={{ layout: { duration: 0.65, ease: EASE_OUT } }}
                  onLayoutAnimationComplete={() => {
                    if (isOpen) settle(n);
                  }}
                >
                  <motion.div
                    className="pj-frame"
                    initial={reveal.initial}
                    whileInView={reveal.whileInView}
                    viewport={{ once: true, margin: "0px 0px -8% 0px" }}
                    transition={reveal.transition}
                  >
                    <button
                      type="button"
                      className="pj-zoom"
                      aria-expanded={isOpen}
                      aria-label={isOpen ? t("shrink", { n: num(n) }) : t("enlarge", { n: num(n) })}
                      onClick={() => toggle(n)}
                    >
                      <img
                        className="pj-img"
                        src={img.src}
                        srcSet={img.srcSet}
                        sizes={isOpen ? `min(100vw, ${CAP})` : `(min-width: 56rem) ${VW[v]}vw, 92vw`}
                        alt={t("imageAlt", { title, n: num(n), total: num(total) })}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </button>
                  </motion.div>
                </motion.figure>
              );
            })}
          </div>
        </LayoutGroup>
      )}
    </>
  );
}
