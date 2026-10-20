"use client";

import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { PROJECTS } from "@/shared/content/site";
import type { Project } from "@/shared/content/site";
import { STILL_BY_ID, stillCard } from "@/shared/content/stills";
import { useUI } from "@/shared/state/store";
import { navigateWithIris } from "@/shared/transition/navigate";
import s from "./home.module.css";

const TEASERS = PROJECTS.filter((p) => !p.featured).slice(0, 3);
/** Large, small, medium: image-led, deliberately unequal. */
const SIZES = ["large", "small", "medium"] as const;
const EASE = [0.22, 1, 0.36, 1] as const;

function Teaser({ project, size, index }: { project: Project; size: (typeof SIZES)[number]; index: number }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduced = useUI((st) => st.reducedMotion);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], reduced ? ["0%", "0%"] : ["-7%", "7%"]);
  const still = STILL_BY_ID[project.still];

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
    el.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
  };

  return (
    <a
      ref={ref}
      href={project.href}
      className={`${s.teaser} ${s[`teaser_${size}`]}`}
      onClick={(e) => {
        if (project.href === "#") e.preventDefault();
      }}
    >
      <motion.div
        className={s.teaserPlate}
        initial={reduced ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
        whileInView={reduced ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)" }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: reduced ? 0.4 : 1.15, ease: EASE, delay: index * 0.05 }}
        onPointerMove={onMove}
      >
        <motion.div className={s.teaserImg} style={{ y: drift }}>
          <picture>
            <source
              type="image/avif"
              srcSet={`${stillCard(project.still, 640, "avif")} 640w, ${stillCard(project.still, 1200, "avif")} 1200w`}
              sizes={size === "large" ? "(max-width: 800px) 100vw, 62vw" : "(max-width: 800px) 80vw, 36vw"}
            />
            <img
              src={stillCard(project.still, 1200, "webp")}
              srcSet={`${stillCard(project.still, 640, "webp")} 640w, ${stillCard(project.still, 1200, "webp")} 1200w`}
              sizes={size === "large" ? "(max-width: 800px) 100vw, 62vw" : "(max-width: 800px) 80vw, 36vw"}
              alt={still.alt}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
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
        <span className={s.teaserTitle}>{project.title}</span>
        <span className={s.teaserMeta}>
          {project.role} · {project.year}
        </span>
      </motion.div>
    </a>
  );
}

export function OtherWork() {
  return (
    <section id="work" className={s.work} aria-labelledby="work-title">
      <header className={s.workHead}>
        <h2 id="work-title" className={s.workTitle}>
          Other work
        </h2>
        <a
          href="/projects"
          className={s.allWork}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            navigateWithIris("/projects", e);
          }}
        >
          <span>All work</span>
          <span className={s.allWorkLine} aria-hidden />
        </a>
      </header>
      <div className={s.workGrid}>
        {TEASERS.map((p, i) => (
          <Teaser key={p.slug} project={p} size={SIZES[i]} index={i} />
        ))}
      </div>
    </section>
  );
}
