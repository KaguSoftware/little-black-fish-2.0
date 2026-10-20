"use client";

import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CHAPTER_BY_ID } from "@/shared/content/chapters";
import { SITE } from "@/shared/content/site";
import { cardImage, type ProjectCard as Card } from "@/shared/data/cards";
import { navigateWithIris } from "@/shared/transition/navigate";
import { useUI } from "@/shared/state/store";
import { HairlineLink } from "./lib/HairlineLink";
import { SPRING } from "./lib/enter";
import { localDigits } from "./lib/i18n";

/**
 * MY MAKER: normal-flow content that scrolls over the ripple grid (transparent background).
 * The narration line ("Little Black Fish made me...") is the overlay; this is the work grid
 * and the way out. Image-led, asymmetric: three rows with different spans, aspects and offsets.
 */

interface Slot {
  /** Tailwind classes for the grid cell (desktop columns/rows/offsets + mobile width). */
  cell: string;
  /** Image aspect. */
  aspect: string;
  /** Rendered width hint for sizes=. */
  sizes: string;
  title: string; // caption title size
}

const SLOTS: Slot[] = [
  { cell: "md:col-[1/8] md:row-start-1", aspect: "4 / 3", sizes: "(min-width: 768px) 55vw, 92vw", title: "var(--step-3)" },
  { cell: "ms-auto w-[72%] md:col-[9/13] md:row-start-1 md:mt-[11rem] md:w-auto", aspect: "3 / 4", sizes: "(min-width: 768px) 30vw, 66vw", title: "var(--step-2)" },
  { cell: "w-[84%] md:col-[2/7] md:row-start-2 md:mt-[-1rem] md:w-auto", aspect: "1 / 1", sizes: "(min-width: 768px) 38vw, 78vw", title: "var(--step-2)" },
  { cell: "md:col-[7/13] md:row-start-2 md:mt-[7rem]", aspect: "16 / 10", sizes: "(min-width: 768px) 46vw, 92vw", title: "var(--step-3)" },
  { cell: "ms-auto w-[64%] md:col-[1/5] md:row-start-3 md:ms-0 md:w-auto", aspect: "4 / 5", sizes: "(min-width: 768px) 28vw, 60vw", title: "var(--step-1)" },
  { cell: "w-[88%] md:col-[6/12] md:row-start-3 md:mt-[5rem] md:w-auto", aspect: "3 / 2", sizes: "(min-width: 768px) 46vw, 82vw", title: "var(--step-2)" },
];

const SHADOW = "0 0 18px oklch(0.06 0.01 var(--hue) / 0.9), 0 0 3px oklch(0.06 0.01 var(--hue) / 0.8)";

function ProjectCard({ p, slot }: { p: Card; slot: Slot }) {
  const rm = useUI((s) => s.reducedMotion);
  return (
    <motion.article
      className={slot.cell}
      initial={rm ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(4px)" }}
      whileInView={rm ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={rm ? { duration: 0.2 } : SPRING}
    >
      <Link href={p.href} className="group block">
        <div className="relative overflow-hidden" style={{ aspectRatio: slot.aspect, background: "var(--stage-raised)" }}>
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              {...cardImage(p.image, slot.sizes)}
              alt={p.title}
              loading="lazy"
              decoding="async"
              draggable={false}
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              className="h-full w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] group-focus-visible:scale-[1.03] motion-reduce:transition-none"
            />
          ) : null}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-4">
          <h3 className="display" style={{ fontSize: slot.title, color: "var(--ink)", textShadow: SHADOW }}>
            {p.title}
          </h3>
        </div>
        {p.categoryName ? (
          <p className="mt-1 text-[length:var(--step--1)]" style={{ color: "var(--ink-dim)", textShadow: SHADOW }}>
            {p.categoryName}
          </p>
        ) : null}
      </Link>
    </motion.article>
  );
}

export function Maker({ projects }: { projects: Card[] }) {
  const t = useTranslations("series");
  const tc = useTranslations("common");
  const locale = useLocale();
  const works = projects.slice(0, SLOTS.length);

  return (
    <section
      id="maker-content"
      aria-labelledby="maker-heading"
      className="relative px-[var(--gutter)] pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[clamp(2rem,6vw,5rem)]"
      style={{ color: "var(--ink)" }}
    >
      <h2 id="maker-heading" className="sr-only">
        {t("maker.heading", { studio: tc("studio") })}
      </h2>

      <div className="mb-[clamp(2.5rem,7vw,6rem)] flex items-center gap-4" aria-hidden="true">
        <span style={{ fontFamily: "var(--font-display-10)", fontSize: "1rem", color: "var(--ink-dim)", textShadow: SHADOW }}>
          {t("chapterLabel", { number: localDigits(CHAPTER_BY_ID.maker.number, locale), title: t("maker.kicker") })}
        </span>
        <span className="h-px flex-1" style={{ background: "var(--hairline)" }} />
      </div>

      <div className="grid grid-cols-1 gap-y-[clamp(3rem,7vw,5.5rem)] md:grid-cols-12 md:items-start md:gap-x-[clamp(1.5rem,3vw,3rem)] md:gap-y-[clamp(3rem,6vw,5rem)]">
        {works.map((p, i) => (
          <ProjectCard key={p.id} p={p} slot={SLOTS[i]} />
        ))}
      </div>

      <div className="mt-[clamp(5rem,12vw,10rem)] grid gap-y-10 md:grid-cols-12 md:gap-x-[clamp(1.5rem,3vw,3rem)]">
        <div className="md:col-[1/8]">
          <HairlineLink
            href={`/${locale}/projects`}
            className="display"
            style={{ fontSize: "var(--step-4)", lineHeight: 0.95, color: "var(--ink)", textShadow: SHADOW }}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
              e.preventDefault();
              navigateWithIris("/projects", e);
            }}
          >
            {t("maker.allWork")}
          </HairlineLink>
        </div>
        <div className="flex flex-col gap-5 md:col-[9/13] md:pt-3">
          <p className="text-[length:var(--step--1)]" style={{ color: "var(--ink-dim)", textShadow: SHADOW }}>
            {t("maker.sayHello")}
          </p>
          <HairlineLink
            href={`mailto:${SITE.email}`}
            className="display w-fit"
            style={{ fontSize: "var(--step-2)", lineHeight: 1, color: "var(--ink)", textShadow: SHADOW }}
          >
            {SITE.email}
          </HairlineLink>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-[length:var(--step-0)]">
            {SITE.socials.map((s) => (
              <li key={s.label}>
                <HairlineLink href={s.href} style={{ color: "var(--ink)", textShadow: SHADOW }}>
                  {s.label}
                </HairlineLink>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p
        className="display mt-[clamp(6rem,16vw,14rem)] select-none"
        style={{ fontSize: "clamp(3.4rem, 13vw, 14rem)", lineHeight: 0.88, color: "var(--ink)", textShadow: SHADOW }}
      >
        {tc("studio")}
      </p>
    </section>
  );
}
