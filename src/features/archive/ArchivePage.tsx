"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { animate, motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { SITE } from "@/shared/content/site";
import { STILL_BY_ID, stillCard } from "@/shared/content/stills";
import { SERIES_HREF, SERIES_SLUG, cardImage } from "@/shared/data/cards";
import type { ProjectCard } from "@/shared/data/cards";
import type { StillId } from "@/shared/content/types";
import { useUI } from "@/shared/state/store";
import { FishMark } from "@/shared/ui/FishMark";
import { irisLinkClick } from "@/shared/ui/Nav";

/**
 * /projects, "The Projection Booth".
 * Desktop: hovering or focusing a title projects its still onto the page (follows the
 * cursor on a spring, wipes in, flickers, lit by a beam from a top-left projector) and
 * the title's cut heals from Redaction 70 to Redaction 10. Idle for 3 s: the projector
 * walks the visible titles by itself. Touch: scrolling opens each row's still in turn, tap goes in.
 * Rows come from the database (ProjectCard); the series' own row is pinned first when `showFeatured`.
 * Also used by /category/[slug] with a heading override and no featured row.
 */

export interface ArchiveCategoryLink {
  slug: string;
  name: string;
}

export interface ArchivePageProps {
  projects: ProjectCard[];
  /** Visible categories, localized; rendered as a quiet row of links under the intro. */
  categories?: ArchiveCategoryLink[];
  /** Slug of the category this page shows (marks its link as current). */
  currentCategory?: string;
  /** Overrides the H1 ("Work"). */
  heading?: string;
  /** Overrides the intro (both the pointer and the touch variant). */
  intro?: string;
  /** Leading link in the category row, e.g. back to all work. */
  back?: { href: string; label: string };
  /** Pin the series (its database row, or a stand-in) as the first row. Default true. */
  showFeatured?: boolean;
}

/** One row of the list: the pinned series (local still) or a database project (remote cover). */
interface Row {
  key: string;
  title: string;
  role: string | null;
  href: string;
  featured: boolean;
  still: StillId | null;
  image: string | null;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_IN: [number, number, number, number] = [0.5, 0, 0.75, 0];
const IDLE_AFTER_MS = 3000;
const IDLE_STEP_MS = 3400;
const FINE = "(hover: hover) and (pointer: fine)";
const CHILD_RIM = "oklch(0.7 0.1 210)";
const INDENTS = ["0vw", "7vw", "2.5vw", "12vw", "4vw", "9vw", "1.5vw"];
const ASPECT = 16 / 9;
/** Touch: share of the viewport height where a row opens as its top scrolls past. */
const FOCAL = 0.42;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const frameWidth = () => clamp(window.innerWidth * 0.32, 300, 520);

function useFinePointer() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(FINE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(FINE).matches,
    () => true,
  );
}

function StillImg({ id, sizes, lazy }: { id: StillId; sizes: string; lazy?: boolean }) {
  const set = (fmt: "avif" | "webp") => `${stillCard(id, 640, fmt)} 640w, ${stillCard(id, 1200, fmt)} 1200w`;
  return (
    <picture>
      <source type="image/avif" srcSet={set("avif")} sizes={sizes} />
      <source type="image/webp" srcSet={set("webp")} sizes={sizes} />
      <img
        src={stillCard(id, 1200)}
        srcSet={set("webp")}
        sizes={sizes}
        alt={STILL_BY_ID[id]?.alt ?? ""}
        draggable={false}
        decoding="async"
        loading={lazy ? "lazy" : undefined}
      />
    </picture>
  );
}

/** A database cover through the Next image optimiser (it negotiates AVIF/WebP itself). */
function CoverImg({ src, alt, sizes, lazy }: { src: string; alt: string; sizes: string; lazy?: boolean }) {
  return (
    <picture>
      <img
        {...cardImage(src, sizes)}
        alt={alt}
        draggable={false}
        decoding="async"
        loading={lazy ? "lazy" : undefined}
      />
    </picture>
  );
}

function RowImg({ row, sizes, lazy }: { row: Row; sizes: string; lazy?: boolean }) {
  if (row.still) return <StillImg id={row.still} sizes={sizes} lazy={lazy} />;
  if (row.image) return <CoverImg src={row.image} alt={row.title} sizes={sizes} lazy={lazy} />;
  return null;
}

/** One projected still. Wipes in left to right, wipes out the same way (clip-path only). */
function ProjectedLayer({ row, on, reduced }: { row: Row; on: boolean; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (first.current) {
      first.current = false;
      if (!on) return;
    }
    const c = reduced
      ? animate(el, { opacity: on ? 1 : 0, clipPath: "inset(0 0% 0 0)" }, { duration: 0.25 })
      : on
        ? animate(
            el,
            { clipPath: ["inset(0 100% 0 0)", "inset(0 0% 0 0)"], opacity: 1 },
            { duration: 0.7, ease: EASE_OUT },
          )
        : animate(el, { clipPath: "inset(0 0% 0 100%)" }, { duration: 0.45, ease: EASE_IN });
    return () => c.stop();
  }, [on, reduced]);

  return (
    <div
      ref={ref}
      className={row.still || row.image ? "ar-layer" : "ar-layer ar-layer-blank"}
      style={{ clipPath: "inset(0 100% 0 0)", opacity: reduced ? 0 : 1, zIndex: on ? 2 : 1 }}
    >
      <RowImg row={row} sizes="(min-width: 768px) 32vw, 90vw" />
    </div>
  );
}

export function ArchivePage({
  projects,
  categories,
  currentCategory,
  heading,
  intro,
  back,
  showFeatured = true,
}: ArchivePageProps) {
  const t = useTranslations("archive");
  const tc = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();

  // The series' database row is the pinned row: pulled to the top and drawn with its
  // still, never listed twice. Without that row the pin still links to the series.
  const series = projects.find((p) => p.slug === SERIES_SLUG);
  const rows: Row[] = [
    ...(showFeatured
      ? [
          {
            key: series?.id ?? "featured:series",
            title: t("seriesTitle"),
            role: t("featuredRole"),
            href: SERIES_HREF,
            featured: true,
            still: "s20" as StillId,
            image: null,
          },
        ]
      : []),
    ...projects
      .filter((p) => !(showFeatured && p === series))
      .map((p) => ({
        key: p.id,
        title: p.title,
        role: p.categoryName,
        href: p.href,
        featured: false,
        still: null,
        image: p.image,
      })),
  ];
  const year = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { useGrouping: false }).format(
    Number(SITE.year),
  );
  const fine = useFinePointer();
  const paused = useUI((s) => s.paused);
  const reduced = useUI((s) => s.reducedMotion);

  const [active, setActive] = useState<number | null>(null);
  const [inline, setInline] = useState<number | null>(null);
  const [fw, setFw] = useState(420);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 170, damping: 24, mass: 0.7 });
  const sy = useSpring(y, { stiffness: 170, damping: 24, mass: 0.7 });
  const beam = useTransform([sx, sy], ([px, py]: number[]) => {
    const w = fw;
    const h = fw / ASPECT;
    return `polygon(0px 0px, ${px + w}px ${py}px, ${px + w}px ${py + h}px, ${px}px ${py + h}px)`;
  });

  const titleEls = useRef<(HTMLElement | null)[]>([]);
  const rowEls = useRef<(HTMLElement | null)[]>([]);
  const activeRef = useRef<number | null>(null);
  const hover = useRef<number | null>(null);
  const idle = useRef(false);
  const lastInput = useRef(0);
  const lastStep = useRef(0);
  const sizeRef = useRef({ w: 420, h: 420 / ASPECT });
  const reducedRef = useRef(reduced);
  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  const show = useCallback((i: number | null) => {
    activeRef.current = i;
    setActive(i);
  }, []);

  const move = useCallback(
    (tx: number, ty: number, snap: boolean) => {
      x.set(tx);
      y.set(ty);
      if (snap || reducedRef.current) {
        sx.jump(tx);
        sy.jump(ty);
      }
    },
    [x, y, sx, sy],
  );

  /** Place the frame on the right-hand part of a title (keyboard focus and idle). */
  const placeOnRow = useCallback(
    (i: number, snap: boolean) => {
      const el = titleEls.current[i];
      if (!el) return;
      const r = el.getBoundingClientRect();
      const { w, h } = sizeRef.current;
      const share = 0.3 + 0.35 * ((i * 0.37) % 1);
      move(
        clamp(r.left + r.width * share, 16, window.innerWidth - w - 16),
        clamp(r.top + r.height / 2 - h / 2, 76, window.innerHeight - h - 24),
        snap,
      );
    },
    [move],
  );

  // Frame size follows the viewport.
  useEffect(() => {
    const apply = () => {
      const w = frameWidth();
      sizeRef.current = { w, h: w / ASPECT };
      setFw(w);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // Pointer following + the idle projectionist (desktop only).
  const canIdle = fine && !paused && !reduced;
  useEffect(() => {
    if (!fine) return;
    lastInput.current = performance.now();

    const bump = () => {
      lastInput.current = performance.now();
      if (idle.current) {
        idle.current = false;
        show(hover.current);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      bump();
      if (hover.current !== null) {
        const { w, h } = sizeRef.current;
        move(
          clamp(e.clientX + 36, 16, window.innerWidth - w - 16),
          clamp(e.clientY - h * 0.62, 76, window.innerHeight - h - 24),
          false,
        );
      }
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
    window.addEventListener("pointermove", onMove, { passive: true });
    events.forEach((n) => window.addEventListener(n, bump, { passive: true }));

    const step = () => {
      const vh = window.innerHeight;
      const visible: number[] = [];
      titleEls.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.bottom > 90 && r.top < vh - 60) visible.push(i);
      });
      if (!visible.length) return;
      const cur = activeRef.current;
      const next = visible.find((i) => cur === null || i > cur) ?? visible[0];
      placeOnRow(next, cur === null);
      show(next);
      lastStep.current = performance.now();
    };

    let id = 0;
    if (canIdle) {
      id = window.setInterval(() => {
        if (document.hidden) return;
        const now = performance.now();
        const focused = !!(document.activeElement as HTMLElement | null)?.closest?.("[data-ar-link]");
        if (!idle.current) {
          if (hover.current === null && !focused && now - lastInput.current > IDLE_AFTER_MS) {
            idle.current = true;
            step();
          }
        } else if (now - lastStep.current > IDLE_STEP_MS) {
          step();
        }
      }, 400);
    }

    return () => {
      window.clearInterval(id);
      window.removeEventListener("pointermove", onMove);
      events.forEach((n) => window.removeEventListener(n, bump));
      if (idle.current) {
        idle.current = false;
        show(hover.current);
      }
    };
  }, [fine, canIdle, move, placeOnRow, show]);

  // Touch: the row whose top has passed the focal line opens its still as you scroll.
  // Opening and closing rows animate their height on the same curve, so the list doesn't jump,
  // and the new row's top stays above the line once the swap settles (no flip-flopping).
  useEffect(() => {
    if (fine) return;
    let raf = 0;
    const pick = () => {
      raf = 0;
      const focal = window.innerHeight * FOCAL;
      let next: number | null = null;
      for (let i = 0; i < rowEls.current.length; i++) {
        const el = rowEls.current[i];
        if (el && el.getBoundingClientRect().top <= focal) next = i;
      }
      setInline(next);
    };
    const queue = () => {
      if (!raf) raf = requestAnimationFrame(pick);
    };
    pick();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, [fine]);

  const onEnter = (i: number, e: React.PointerEvent) => {
    if (!fine || e.pointerType === "touch") return;
    hover.current = i;
    idle.current = false;
    const { w, h } = sizeRef.current;
    const first = activeRef.current === null;
    move(
      clamp(e.clientX + 36, 16, window.innerWidth - w - 16),
      clamp(e.clientY - h * 0.62, 76, window.innerHeight - h - 24),
      first,
    );
    show(i);
  };

  const onLeaveList = () => {
    hover.current = null;
    if (!idle.current) show(null);
  };

  const onFocusRow = (i: number) => {
    if (!fine) return;
    idle.current = false;
    placeOnRow(i, activeRef.current === null);
    show(i);
  };

  const onBlurRow = () => {
    if (!idle.current) show(hover.current);
  };

  const onClickRow = (e: MouseEvent<HTMLAnchorElement>, p: Row) => {
    irisLinkClick(e, p.href, pathname, p.featured ? { rim: CHILD_RIM, waitForReady: true } : undefined);
  };

  const hot = fine ? active : inline;

  return (
    <>
      <style>{CSS}</style>

      {fine && (
        <div className="ar-projector" aria-hidden="true">
          <motion.div
            className="ar-beam"
            style={{ clipPath: beam }}
            initial={false}
            animate={{ opacity: active !== null ? 1 : 0 }}
            transition={{ duration: reduced ? 0.25 : 0.6, ease: EASE_OUT }}
          />
          <motion.div className="ar-frame" style={{ x: sx, y: sy, width: fw, height: fw / ASPECT }}>
            {rows.map((p, i) => (
              <ProjectedLayer key={p.key} row={p} on={active === i} reduced={reduced} />
            ))}
            <div className="ar-vignette" />
            <div className="ar-flicker" />
          </motion.div>
        </div>
      )}

      <main id="main" className="ar">
        <header className="ar-head">
          <h1 className="ar-h1">{heading ?? t("heading")}</h1>
          <p className="ar-intro">{intro ?? (fine ? t("introPointer") : t("introTouch"))}</p>
          {(back || (categories && categories.length > 0)) && (
            <nav className="ar-cats" aria-label={t("categoriesLabel")}>
              <ul>
                {back && (
                  <li>
                    <Link href={back.href} onClick={(e) => irisLinkClick(e, back.href, pathname)}>
                      {back.label}
                    </Link>
                  </li>
                )}
                {categories?.map((c) => {
                  const href = `/category/${c.slug}`;
                  return (
                    <li key={c.slug}>
                      <Link
                        href={href}
                        aria-current={c.slug === currentCategory ? "page" : undefined}
                        onClick={(e) => irisLinkClick(e, href, pathname)}
                      >
                        {c.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </header>

        {rows.length === 0 && <p className="ar-intro ar-empty">{t("empty")}</p>}

        <ul className="ar-list" data-hot={hot !== null ? "true" : "false"} onPointerLeave={onLeaveList}>
          {rows.map((p, i) => {
            const isActive = hot === i;
            return (
              <motion.li
                key={p.key}
                className="ar-row"
                data-featured={p.featured ? "true" : "false"}
                ref={(el) => {
                  rowEls.current[i] = el;
                }}
                initial={{ opacity: 0, y: reduced ? 0 : 10, filter: reduced ? "blur(0px)" : "blur(4px)" }}
                whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                viewport={{ once: true, margin: "0px 0px -6% 0px" }}
                transition={{ duration: 0.7, ease: EASE_OUT, delay: Math.min(i, 4) * 0.06 }}
              >
                <Link
                  href={p.href}
                  className="ar-link"
                  data-ar-link=""
                  data-active={isActive ? "true" : "false"}
                  onClick={(e) => onClickRow(e, p)}
                  onPointerEnter={(e) => onEnter(i, e)}
                  onFocus={() => onFocusRow(i)}
                  onBlur={onBlurRow}
                >
                  <span
                    className="ar-title"
                    data-active={isActive ? "true" : "false"}
                    style={{ ["--indent" as string]: p.featured ? "0vw" : INDENTS[i % INDENTS.length] }}
                    ref={(el) => {
                      titleEls.current[i] = el;
                    }}
                  >
                    <span className="ar-cut ar-cut-rest">{p.title}</span>
                    <span className="ar-cut ar-cut-heal" aria-hidden="true">
                      {p.title}
                    </span>
                  </span>
                  <span className="ar-role">{p.role}</span>
                  {p.featured && <span className="ar-sub">{t("featuredSub")}</span>}
                  {p.featured && (
                    <span className="ar-fish" aria-hidden="true">
                      <FishMark size={20} animated rim="oklch(0.7 0.1 210 / 0.85)" style={{ transform: "scaleX(-1)" }} />
                    </span>
                  )}
                </Link>

                {!fine && (p.still || p.image) && (
                  <div
                    className="ar-inline"
                    data-open={isActive ? "true" : "false"}
                    data-reduced={reduced ? "true" : "false"}
                    aria-hidden={!isActive}
                  >
                    <figure className="ar-inline-in">
                      <RowImg row={p} sizes="100vw" lazy />
                    </figure>
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>

        <footer className="ar-foot" id="contact">
          <p className="ar-foot-lead">{t("footLead")}</p>
          <Link className="ar-mail" href="/contact" onClick={(e) => irisLinkClick(e, "/contact", pathname)}>
            {t("footCta")}
          </Link>
          <ul className="ar-socials">
            {SITE.socials.map((s) => (
              <li key={s.label}>
                <a href={s.href}>{s.label}</a>
              </li>
            ))}
          </ul>
          <p className="ar-fine">
            {year} {tc("studio")}
          </p>
        </footer>
      </main>
    </>
  );
}

const CSS = `
.ar{position:relative;z-index:2;max-width:104rem;margin-inline:auto;
padding:clamp(6.5rem,15vh,10rem) var(--gutter) clamp(4.5rem,10vh,7rem)}
.ar-head{display:grid;gap:1.25rem var(--gutter);margin-bottom:clamp(2.5rem,8vh,6rem)}
.ar-h1{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-3);line-height:.9;color:var(--ink-dim)}
.ar-intro{margin:0;max-width:32ch;font-size:var(--step-1);line-height:1.3;color:var(--ink-dim)}
@media (min-width:48rem){.ar-head{grid-template-columns:1fr minmax(0,26rem);align-items:end}.ar-intro{justify-self:end}}
.ar-cats{grid-column:1/-1}
.ar-cats ul{display:flex;flex-wrap:wrap;gap:.25rem 1.5rem;margin:0;padding:0;list-style:none}
.ar-cats a{display:inline-block;padding:.35rem 0;color:var(--ink-dim);font-weight:500;font-size:var(--step--1);
text-decoration:underline 1px var(--hairline);text-underline-offset:.35em;transition:color .12s linear,text-decoration-color .12s linear}
.ar-cats a:hover,.ar-cats a:focus-visible,.ar-cats a[aria-current="page"]{color:var(--ink);text-decoration-color:var(--ink-dim)}
.ar-empty{max-width:none;padding-block:1.5rem;border-top:1px solid var(--hairline)}

.ar-list{margin:0;padding:0;list-style:none}
.ar-row{position:relative;margin:0;border-top:1px solid var(--hairline)}
.ar-row:last-child{border-bottom:1px solid var(--hairline)}
.ar-link{display:grid;grid-template-columns:1fr auto;grid-template-areas:"year role" "title title" "sub fish";
align-items:baseline;gap:.35rem var(--gutter);padding:clamp(.7rem,1.6vw,1.5rem) 0;color:inherit;text-decoration:none;
transition:opacity .45s var(--ease-out-quint)}
.ar-list[data-hot="true"] .ar-link[data-active="false"]{opacity:.42}
.ar-year,.ar-role,.ar-sub{font-family:var(--font-sans);font-weight:500;font-size:var(--step--1);line-height:1.2;color:var(--ink-dim)}
.ar-year{grid-area:year;font-variant-numeric:tabular-nums}
.ar-role{grid-area:role;text-align:end}
.ar-sub{grid-area:sub}

.ar-title{grid-area:title;position:relative;display:inline-block;justify-self:start;
font-size:calc((100vw - 2 * var(--gutter)) / 6.6);line-height:.98;letter-spacing:-.012em;
max-width:calc(100% - .25em);text-wrap:balance;overflow-wrap:break-word;
font-synthesis:none;transition:transform .6s var(--ease-out-quint)}
.ar-row[data-featured="true"] .ar-title{font-size:calc((100vw - 2 * var(--gutter)) / 7.6)}
@media (min-width:40rem) and (max-width:63.99rem){.ar-title{font-size:min(calc((100vw - 2 * var(--gutter)) / 6.6),8rem)}
.ar-row[data-featured="true"] .ar-title{font-size:min(calc((100vw - 2 * var(--gutter)) / 7.6),8.6rem)}}
@media (min-width:64rem){
.ar-link{grid-template-columns:6.5rem minmax(0,1fr) auto;grid-template-areas:"year title role" "fish sub .";gap:0 var(--gutter)}
.ar-title{margin-inline-start:var(--indent,0);max-width:calc(100% - var(--indent,0px) - .25em);font-size:clamp(3rem,7vw,8rem)}
.ar-row[data-featured="true"] .ar-title{font-size:clamp(3.2rem,8.2vw,9.2rem)}
}
.ar-title[data-active="true"]{transform:translateX(.18em)}
[dir="rtl"] .ar-title[data-active="true"]{transform:translateX(-.18em)}
.ar-cut{display:block;text-shadow:0 0 28px oklch(0.08 0.01 215/.85)}
.ar-cut-rest{font-family:var(--font-display-70);color:var(--ink-dim);transition:opacity .55s var(--ease-out-quint)}
.ar-cut-heal{position:absolute;inset:0;font-family:var(--font-display-10);color:var(--ink);opacity:0;
transition:opacity .55s var(--ease-out-quint)}
.ar-title[data-active="true"] .ar-cut-rest{opacity:0}
.ar-title[data-active="true"] .ar-cut-heal{opacity:1}
.ar-row[data-featured="true"] .ar-cut-rest{color:color-mix(in oklch,var(--teller-child) 74%,var(--stage))}
.ar-row[data-featured="true"] .ar-cut-heal{color:var(--teller-child)}
.ar-row[data-featured="true"] .ar-sub{color:var(--teller-child)}
.ar-row[data-featured="true"] .ar-link{padding-block:clamp(1rem,2.4vw,2.25rem)}

.ar-fish{grid-area:fish;justify-self:end;align-self:center;color:var(--stage-deep);pointer-events:none;
animation:ar-idle 7s ease-in-out infinite}
@media (min-width:64rem){.ar-fish{justify-self:start}}
@keyframes ar-idle{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(10px,-5px,0)}}

.ar-inline{display:grid;grid-template-rows:0fr;transition:grid-template-rows .6s var(--ease-out-quint)}
.ar-inline[data-open="true"]{grid-template-rows:1fr}
.ar-inline-in{margin:0;min-height:0;overflow:hidden}
.ar-inline picture{display:block;padding-bottom:1rem}
.ar-inline img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;
opacity:0;transform:scale(1.04);transition:opacity .6s var(--ease-out-quint),transform .9s var(--ease-out-quint)}
.ar-inline[data-open="true"] img{opacity:1;transform:none}
.ar-inline[data-reduced="true"],.ar-inline[data-reduced="true"] img{transition:none}

.ar-projector{position:fixed;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.ar-beam{position:absolute;inset:0;opacity:0;
background:radial-gradient(ellipse 130% 130% at 0 0,oklch(0.95 0.02 80/.24) 0%,oklch(0.95 0.02 80/.07) 45%,transparent 80%)}
.ar-frame{position:absolute;left:0;top:0;will-change:transform}
.ar-layer{position:absolute;inset:0;overflow:hidden}
.ar-layer picture,.ar-layer img{display:block;width:100%;height:100%}
.ar-layer img{object-fit:cover}
.ar-layer-blank{background:var(--stage)}
.ar-vignette{position:absolute;inset:0;z-index:3;background:radial-gradient(ellipse at center,transparent 52%,oklch(0.08 0.01 215/.6) 100%)}
.ar-flicker{position:absolute;inset:0;z-index:4;background:oklch(0.97 0.01 80);mix-blend-mode:soft-light;opacity:0;
animation:ar-flicker 4.7s steps(1,end) infinite}
@keyframes ar-flicker{0%{opacity:0}6%{opacity:.16}7%{opacity:0}29%{opacity:0}30%{opacity:.1}32%{opacity:0}58%{opacity:.18}59%{opacity:.05}61%{opacity:0}84%{opacity:.12}85%{opacity:0}100%{opacity:0}}
html[data-motion="paused"] .ar-flicker,html[data-motion="paused"] .ar-fish{animation:none}
@media (prefers-reduced-motion:reduce){.ar-flicker,.ar-fish{animation:none!important}.ar-title[data-active="true"],[dir="rtl"] .ar-title[data-active="true"]{transform:none}}

.ar-foot{display:grid;gap:1.25rem;margin-top:clamp(5rem,14vh,10rem)}
.ar-foot-lead{margin:0;font-family:var(--font-display);font-size:var(--step-2);line-height:1;color:var(--ink-dim)}
.ar-mail{position:relative;justify-self:start;max-width:100%;overflow-wrap:anywhere;padding-bottom:.15em;color:var(--ink);text-decoration:none;
font-family:var(--font-display);font-size:var(--step-4);line-height:.95}
.ar-mail::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--teller-child);
transform:scaleX(0);transform-origin:left;transition:transform .5s var(--ease-out-quint)}
[dir="rtl"] .ar-mail::after{transform-origin:right}
.ar-mail:hover::after,.ar-mail:focus-visible::after{transform:scaleX(1)}
.ar-socials{display:flex;flex-wrap:wrap;gap:.5rem 1.75rem;margin:.5rem 0 0;padding:0;list-style:none}
.ar-socials a{display:inline-block;padding:.35rem 0;color:var(--ink-dim);text-decoration:none;font-weight:500;font-size:var(--step--1);transition:color .12s linear}
.ar-socials a:hover,.ar-socials a:focus-visible{color:var(--ink)}
.ar-fine{margin:2rem 0 0;font-size:var(--step--1);color:var(--ink-mute)}
`;
