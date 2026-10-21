"use client";

import { motion, useInView, useScroll, useTransform } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { getPathname } from "@/i18n/navigation";
import { cardImage, type ProjectCard } from "@/shared/data/cards";
import { useUI } from "@/shared/state/store";
import { navigateWithIris } from "@/shared/transition/navigate";
import s from "./home.module.css";

/** Large, small, medium: image-led, deliberately unequal. */
const SIZES = ["large", "small", "medium"] as const;
const EASE = [0.22, 1, 0.36, 1] as const;

/** Plain <a> for the iris transition; the href attribute still carries the locale for new tabs. */
function irisClick(href: string) {
  return (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigateWithIris(href, e);
  };
}

function Teaser({ card, size, index }: { card: ProjectCard; size: (typeof SIZES)[number]; index: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const locale = useLocale();
  const reduced = useUI((st) => st.reducedMotion);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["-7%", "7%"]);
  // Watch the link, not the plate: the plate starts fully clipped, and IntersectionObserver
  // honours clip-path, so the plate itself would never count as in view.
  const shown = useInView(ref, { once: true, amount: 0.2 });
  const sizes = size === "large" ? "(max-width: 800px) 100vw, 62vw" : "(max-width: 800px) 80vw, 36vw";

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
    el.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
  };

  return (
    <a
      ref={ref}
      href={getPathname({ href: card.href, locale })}
      className={`${s.teaser} ${s[`teaser_${size}`]}`}
      onClick={irisClick(card.href)}
    >
      <motion.div
        className={s.teaserPlate}
        initial={reduced ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
        animate={shown ? (reduced ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)" }) : undefined}
        transition={{ duration: reduced ? 0.4 : 1.15, ease: EASE, delay: index * 0.05 }}
        onPointerMove={onMove}
      >
        <motion.div className={s.teaserImg} style={{ y: drift }}>
          <picture>
            {card.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                {...cardImage(card.image, sizes)}
                alt={card.title}
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            )}
          </picture>
        </motion.div>
        <div className={s.teaserShade} aria-hidden />
      </motion.div>

      <motion.div
        className={s.teaserText}
        initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.25 }}
      >
        <span className={s.teaserTitle}>{card.title}</span>
        {card.categoryName && <span className={s.teaserMeta}>{card.categoryName}</span>}
      </motion.div>
    </a>
  );
}

export function OtherWork({ projects }: { projects: ProjectCard[] }) {
  const t = useTranslations("home.work");
  const locale = useLocale();
  const teasers = projects.slice(0, SIZES.length);
  return (
    <section id="work" className={s.work} aria-labelledby="work-title">
      <header className={s.workHead}>
        <h2 id="work-title" className={s.workTitle}>
          {t("title")}
        </h2>
        <a href={getPathname({ href: "/projects", locale })} className={s.allWork} onClick={irisClick("/projects")}>
          <span>{t("all")}</span>
          <span className={s.allWorkLine} aria-hidden />
        </a>
      </header>
      <div className={s.workGrid}>
        {teasers.map((c, i) => (
          <Teaser key={c.id} card={c} size={SIZES[i]} index={i} />
        ))}
      </div>
    </section>
  );
}
