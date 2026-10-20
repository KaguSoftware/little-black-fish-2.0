import { getTranslations } from "next-intl/server";
import { cardImage, coverImage, projectHref } from "@/shared/data/cards";
import { formatNumber, pick } from "@/shared/data/localize";
import type { CategoryRow, ProjectNavRow, ProjectRow } from "@/shared/data/types";
import { getYouTubeId, youTubeEmbed } from "@/shared/data/youtube";
import { Description } from "./Description";
import { Gallery } from "./Gallery";
import { IrisLink } from "./IrisLink";
import { GALLERY_CSS, VIDEO_CSS } from "./styles";
import { VideoStage } from "./VideoStage";

const Arrow = () => (
  <svg className="pj-arrow" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);

/**
 * /projects/[slug]. Header (back, category and medium, title healing from Redaction 70
 * to 10), then the work itself: a screening for video projects, a hung gallery for image
 * projects, the description beside or under it, and the neighbouring projects as exits.
 */
export async function ProjectPage({
  project,
  locale,
  categories,
  nav,
}: {
  project: ProjectRow;
  locale: string;
  categories: CategoryRow[];
  nav: ProjectNavRow[];
}) {
  const t = await getTranslations({ locale, namespace: "project" });
  const title = pick(project, "title", locale);
  const description = pick(project, "description", locale);
  const category = project.category_id ? categories.find((c) => c.id === project.category_id) : undefined;

  const ytId = getYouTubeId(project.youtube_url);
  const isVideo = project.media_type !== "gallery" && !!ytId;
  const tall = isVideo && /\/shorts\//.test(project.youtube_url ?? "");
  const cover = coverImage(project);

  const galleryUrls = (project.gallery_urls ?? []).map((u) => u?.trim()).filter(Boolean) as string[];
  const images = (galleryUrls.length ? galleryUrls : cover ? [cover] : []).map((src) => {
    const { src: s, srcSet } = cardImage(src, "100vw");
    return { src: s, srcSet };
  });

  const i = nav.findIndex((p) => p.slug === project.slug);
  const prev = i >= 0 && nav.length > 1 ? nav[(i - 1 + nav.length) % nav.length] : null;
  const next = i >= 0 && nav.length > 1 ? nav[(i + 1) % nav.length] : null;

  const long = title.length > 26;
  const support = project.support_enabled ? (
    <IrisLink href={`/support?project=${encodeURIComponent(project.slug)}`} className="pj-support">
      <span className="pj-support-t">{t("support")}</span>
      <Arrow />
    </IrisLink>
  ) : null;

  const body = (
    <div className="pj-body" data-aside={support ? "true" : "false"}>
      {description ? <Description text={description} /> : null}
      {support && <div className="pj-aside">{support}</div>}
    </div>
  );

  return (
    <main id="main" className="pj" data-kind={isVideo ? "video" : "gallery"} data-tall={tall ? "true" : "false"}>
      <style>{CSS + VIDEO_CSS + GALLERY_CSS}</style>

      <header className="pj-head">
        <IrisLink href="/projects" className="pj-back">
          <Arrow />
          <span>{t("backToWork")}</span>
        </IrisLink>
        <p className="pj-meta">
          {category && (
            <IrisLink href={`/category/${category.slug}`} className="pj-cat">
              {pick(category, "name", locale)}
            </IrisLink>
          )}
          <span className="pj-medium">
            {isVideo ? t("mediaVideo") : t("mediaGallery")}
            {!isVideo && images.length > 1 && (
              <span className="pj-count">{t("imageCount", { count: formatNumber(images.length, locale) })}</span>
            )}
          </span>
        </p>
        <h1 className="pj-h1" data-long={long ? "true" : "false"}>
          <span className="pj-cut pj-cut-rest">{title}</span>
          <span className="pj-cut pj-cut-heal" aria-hidden="true">
            {title}
          </span>
        </h1>
      </header>

      {isVideo ? (
        <div className="pj-show">
          <VideoStage
            embed={youTubeEmbed(ytId)}
            title={title}
            poster={cover ? cardImage(cover, tall ? "(min-width: 64rem) 28rem, 100vw" : `min(100vw, 104rem)`) : null}
            tall={tall}
          />
          {body}
        </div>
      ) : (
        <Gallery images={images} title={title} interlude={body} />
      )}

      {prev && next && (
        <nav className="pj-adj" aria-label={t("moreWork")}>
          <IrisLink href={projectHref(prev.slug)} className="pj-adj-link" data-dir="prev" rel="prev">
            <span className="pj-adj-k">
              <Arrow />
              {t("previous")}
            </span>
            <span className="pj-adj-t">
              <span className="pj-cut pj-cut-rest">{pick(prev, "title", locale)}</span>
              <span className="pj-cut pj-cut-heal" aria-hidden="true">
                {pick(prev, "title", locale)}
              </span>
            </span>
          </IrisLink>
          <IrisLink href={projectHref(next.slug)} className="pj-adj-link" data-dir="next" rel="next">
            <span className="pj-adj-k">
              {t("next")}
              <Arrow />
            </span>
            <span className="pj-adj-t">
              <span className="pj-cut pj-cut-rest">{pick(next, "title", locale)}</span>
              <span className="pj-cut pj-cut-heal" aria-hidden="true">
                {pick(next, "title", locale)}
              </span>
            </span>
          </IrisLink>
        </nav>
      )}

      <IrisLink href="/projects" className="pj-all">
        <Arrow />
        <span>{t("backToWork")}</span>
      </IrisLink>
    </main>
  );
}

const CSS = `
.pj{position:relative;z-index:2;width:100%;max-width:104rem;margin-inline:auto;overflow-x:clip;
padding:clamp(6.5rem,15vh,10rem) var(--gutter) clamp(4.5rem,10vh,7rem)}

.pj-arrow{display:inline-block;flex:none;transition:transform .45s var(--ease-out-quint)}
[dir="rtl"] .pj-arrow{transform:scaleX(-1)}

.pj-head{display:grid;gap:1rem}
.pj-back{justify-self:start;display:inline-flex;align-items:center;gap:.5rem;padding:.35rem 0;margin-bottom:clamp(1rem,4vh,2.5rem);
color:var(--ink-dim);text-decoration:none;font-weight:500;font-size:var(--step--1);transition:color .12s linear}
.pj-back:hover,.pj-back:focus-visible{color:var(--ink)}
.pj-back:hover .pj-arrow{transform:translateX(-3px)}
[dir="rtl"] .pj-back:hover .pj-arrow{transform:scaleX(-1) translateX(-3px)}

.pj-meta{display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem 1.75rem;margin:0;
font-weight:500;font-size:var(--step--1);line-height:1.3;color:var(--ink-dim)}
.pj-cat{position:relative;color:var(--ink);text-decoration:none;padding-bottom:.15em}
.pj-cat::after{content:"";position:absolute;inset-inline:0;bottom:0;height:1px;background:var(--accent);
transform:scaleX(0);transform-origin:var(--origin,left);transition:transform .35s var(--ease-out-quint)}
[dir="rtl"] .pj-cat::after{--origin:right}
.pj-cat:hover::after,.pj-cat:focus-visible::after{transform:scaleX(1)}
.pj-medium{display:inline-flex;gap:.6rem}
.pj-count{color:var(--ink-mute)}

.pj-h1{position:relative;margin:0;max-width:18ch;font-weight:400;font-size:clamp(3rem,1.6rem + 7vw,10rem);
line-height:.92;letter-spacing:-.015em;text-wrap:balance;font-synthesis:none}
.pj-h1[data-long="true"]{max-width:22ch;font-size:clamp(2.4rem,1.4rem + 4.6vw,7rem);line-height:.96}
.pj-cut{display:block;text-shadow:0 0 28px oklch(0.08 0.01 215/.85)}
.pj-cut-rest{font-family:var(--font-display-70);color:var(--ink-dim)}
.pj-cut-heal{position:absolute;inset:0;font-family:var(--font-display-10);color:var(--ink)}
.pj-h1 .pj-cut-rest{animation:pj-out 1.6s var(--ease-out-quint) .35s both}
.pj-h1 .pj-cut-heal{animation:pj-in 1.6s var(--ease-out-quint) .35s both}
@keyframes pj-out{from{opacity:1}to{opacity:0}}
@keyframes pj-in{from{opacity:0}to{opacity:1}}
.pj-head > *{animation:pj-enter .8s var(--ease-out-quint) both}
.pj-head > :nth-child(2){animation-delay:.08s}
.pj-head > :nth-child(3){animation-delay:.14s}
@keyframes pj-enter{from{opacity:0;transform:translateY(8px);filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}

.pj-body{display:grid;gap:clamp(2rem,5vh,3rem);margin-top:clamp(2.5rem,8vh,5rem)}
@media (min-width:64rem){
.pj-body{grid-template-columns:repeat(12,minmax(0,1fr));column-gap:clamp(.75rem,2vw,2rem);align-items:start}
.pj-body .pj-desc{grid-column:5/span 7}
.pj-body[data-aside="true"] .pj-desc{grid-column:2/span 7}
.pj-aside{grid-column:9/-1;position:sticky;top:clamp(6rem,14vh,8rem);padding-top:.4rem}
}
.pj-desc{display:grid;gap:1.4em;max-width:65ch;font-size:var(--step-0);line-height:1.68;color:var(--ink-dim);text-wrap:pretty}
.pj-p{margin:0}
.pj-p:first-child{font-size:var(--step-1);line-height:1.45;color:var(--ink)}
.pj-p[data-credits="true"],.pj-p:first-child[data-credits="true"]{font-size:var(--step-0);line-height:1.68;color:var(--ink-dim)}
.pj-line{display:block}
.pj-role{color:var(--ink-mute)}
.pj-url{color:var(--ink);text-decoration-color:var(--hairline);text-underline-offset:.2em;overflow-wrap:anywhere;transition:text-decoration-color .2s linear}
.pj-url:hover,.pj-url:focus-visible{text-decoration-color:var(--accent)}

.pj-support{position:relative;display:inline-flex;align-items:baseline;gap:.5em;padding-bottom:.2em;color:var(--ink);text-decoration:none;
font-family:var(--font-display-35);font-size:var(--step-2);line-height:1.05;transition:color .3s var(--ease-out-quint)}
.pj-support::before,.pj-support::after{content:"";position:absolute;inset-inline:0;bottom:0}
.pj-support::before{height:1px;background:var(--hairline)}
.pj-support::after{height:2px;background:var(--accent);transform:scaleX(0);transform-origin:var(--origin,left);
transition:transform .4s var(--ease-out-quint)}
[dir="rtl"] .pj-support::after{--origin:right}
.pj-support .pj-arrow{font-size:.6em;transform:rotate(180deg)}
[dir="rtl"] .pj-support .pj-arrow{transform:none}
.pj-support:hover,.pj-support:focus-visible{color:var(--accent)}
.pj-support:hover::after,.pj-support:focus-visible::after{transform:scaleX(1)}
.pj-support:hover .pj-arrow{transform:rotate(180deg) translateX(-4px)}
[dir="rtl"] .pj-support:hover .pj-arrow{transform:translateX(-4px)}

@media (min-width:64rem){
.pj[data-tall="true"] .pj-show{display:grid;grid-template-columns:minmax(0,1fr) min(28rem,calc(84svh * 9 / 16));column-gap:clamp(2rem,6vw,6rem);align-items:start;
margin-top:clamp(1.5rem,5vh,3.5rem)}
.pj[data-tall="true"] .pj-stage{grid-column:2;grid-row:1;margin:0}
.pj[data-tall="true"] .pj-body{grid-column:1;grid-row:1;margin:0;display:grid;grid-template-columns:none;align-content:end;
min-height:100%;gap:clamp(2rem,6vh,3.5rem)}
.pj[data-tall="true"] .pj-body .pj-desc,.pj[data-tall="true"] .pj-aside{grid-column:auto;position:static}
}
.pj[data-tall="true"] .pj-screen{margin-inline:auto}
@media (min-width:64rem){.pj[data-tall="true"] .pj-screen{margin-inline:0;width:100%}}

.pj-adj{display:grid;gap:clamp(2rem,5vh,3rem);margin-top:clamp(5rem,16vh,11rem);padding-top:clamp(1.5rem,4vh,2.5rem);
border-top:1px solid var(--hairline)}
@media (min-width:48rem){.pj-adj{grid-template-columns:1fr 1fr;align-items:start}}
.pj-adj-link{display:grid;gap:.6rem;color:inherit;text-decoration:none}
.pj-adj-link[data-dir="next"]{justify-items:end;text-align:end}
@media (min-width:48rem){.pj-adj-link[data-dir="next"]{margin-top:clamp(2rem,8vw,6rem)}}
.pj-adj-k{display:inline-flex;align-items:center;gap:.5rem;font-weight:500;font-size:var(--step--1);color:var(--ink-dim);transition:color .12s linear}
.pj-adj-link[data-dir="next"] .pj-arrow{transform:rotate(180deg)}
[dir="rtl"] .pj-adj-link[data-dir="next"] .pj-arrow{transform:none}
.pj-adj-t{position:relative;display:block;font-size:clamp(2rem,1.2rem + 3.6vw,5.5rem);line-height:.98;letter-spacing:-.012em;
text-wrap:balance;max-width:14ch;transition:transform .6s var(--ease-out-quint)}
.pj-adj-t .pj-cut-rest,.pj-adj-t .pj-cut-heal{transition:opacity .55s var(--ease-out-quint)}
.pj-adj-t .pj-cut-heal{opacity:0}
.pj-adj-link:hover .pj-adj-k,.pj-adj-link:focus-visible .pj-adj-k{color:var(--ink)}
.pj-adj-link:hover .pj-cut-rest,.pj-adj-link:focus-visible .pj-cut-rest{opacity:0}
.pj-adj-link:hover .pj-cut-heal,.pj-adj-link:focus-visible .pj-cut-heal{opacity:1}
.pj-adj-link[data-dir="prev"]:hover .pj-adj-t{transform:translateX(-.08em)}
.pj-adj-link[data-dir="next"]:hover .pj-adj-t{transform:translateX(.08em)}
[dir="rtl"] .pj-adj-link[data-dir="prev"]:hover .pj-adj-t{transform:translateX(.08em)}
[dir="rtl"] .pj-adj-link[data-dir="next"]:hover .pj-adj-t{transform:translateX(-.08em)}
.pj-adj-link:active .pj-adj-t{scale:.99}

.pj-all{display:inline-flex;align-items:center;gap:.6rem;margin-top:clamp(4rem,12vh,8rem);padding:.35rem 0;color:var(--ink-dim);text-decoration:none;
font-family:var(--font-display);font-size:var(--step-1);transition:color .12s linear}
.pj-all:hover,.pj-all:focus-visible{color:var(--ink)}
.pj-all:hover .pj-arrow{transform:translateX(-3px)}
[dir="rtl"] .pj-all:hover .pj-arrow{transform:scaleX(-1) translateX(-3px)}

@media (prefers-reduced-motion:reduce){
.pj-head > *{animation-name:pj-fade}
.pj-h1 .pj-cut-rest{animation:none;opacity:0}
.pj-h1 .pj-cut-heal{animation:none;opacity:1}
.pj-adj-t,.pj-arrow{transition:none}
.pj-adj-link:hover .pj-adj-t,[dir="rtl"] .pj-adj-link:hover .pj-adj-t{transform:none}
}
`;
