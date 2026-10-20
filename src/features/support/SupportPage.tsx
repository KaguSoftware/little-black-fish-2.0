import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatNumber, pick, pickStrict } from "@/shared/data/localize";
import { PAYMENT_LINKS, parseSupportBody, paymentOrder } from "@/shared/data/support";
import type { ProjectRow } from "@/shared/data/types";
import { EnamadSeal } from "@/shared/ui/EnamadSeal";
import { resolveSupport } from "./resolve";

type Props = { locale: string; projects: ProjectRow[]; active: ProjectRow | null };

/**
 * /support?project=<slug>. One support-enabled project at a time (its own shareable URL):
 * title and intro, release progress, the long-form body, a closing line, then the two
 * payment pages as full-width rows that open in a new tab.
 */
export async function SupportPage({ locale, projects, active }: Props) {
  const t = await getTranslations("support");
  const tc = await getTranslations("common");
  const { title, intro } = resolveSupport(active, locale, { title: t("studioTitle"), intro: t("studioIntro") });
  const sections = active ? parseSupportBody(pickStrict(active, "support_body", locale)) : [];
  const closing = active ? pickStrict(active, "support_closing", locale) : null;
  const done = active?.support_episodes_done;
  const total = active?.support_episodes_total;
  const hasProgress = done != null && total != null && total > 0;
  const percent = hasProgress ? Math.max(0, Math.min(100, (done / total) * 100)) : 0;
  const pad = new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { minimumIntegerDigits: 2 });

  return (
    <main id="main" className="sp">
      <style>{CSS}</style>

      <header className="sp-head">
        <div className="sp-titles">
          <p className="sp-eyebrow">{t("eyebrow")}</p>
          <h1 className="sp-h1">{title}</h1>
        </div>
        <p className="sp-intro">{intro}</p>
      </header>

      {projects.length > 1 && (
        <nav className="sp-switch" aria-label={t("switcherLabel")}>
          <ul>
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={{ pathname: "/support", query: { project: p.slug } }}
                  aria-current={p.id === active?.id ? "page" : undefined}
                >
                  {pick(p, "title", locale)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {hasProgress && (
        <div className="sp-prog">
          <p className="sp-prog-head">
            <span className="sp-count">
              {formatNumber(done, locale)} / {formatNumber(total, locale)}
            </span>{" "}
            <span className="sp-prog-label">{t("progressLabel")}</span>
          </p>
          <div className="sp-track" aria-hidden="true">
            <span className="sp-fill" style={{ ["--p" as string]: `${percent}%` }} />
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="sp-body">
          {sections.map((s, i) => (
            <section key={i} className="sp-sec">
              {s.heading && <h2 className="sp-sec-h">{s.heading}</h2>}
              <div className="sp-sec-text">
                {s.paragraphs.map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {closing && (
        <blockquote className="sp-quote">
          <p>{closing}</p>
        </blockquote>
      )}

      <section className="sp-pay" aria-labelledby="sp-choose">
        <h2 id="sp-choose" className="sp-choose">
          {t("chooseHeading")}
        </h2>
        <ul className="sp-list">
          {paymentOrder(locale).map((method, i) => (
            <li key={method} className="sp-row" style={{ ["--i" as string]: i }}>
              <a className="sp-link" href={PAYMENT_LINKS[method]} target="_blank" rel="noopener noreferrer">
                <span className="sp-num" aria-hidden="true">
                  {pad.format(i + 1)}
                </span>
                <span className="sp-main">
                  <span className="sp-kicker">{t(`${method}.heading`)}</span>
                  <span className="sp-label">{t(`${method}.label`)}</span>
                </span>
                <span className="sp-note">{t(`${method}.caption`)}</span>
                <span className="sp-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 17L17 7M9 7h8v8" />
                  </svg>
                </span>
                <span className="sr-only"> {tc("opensInNewTab")}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="sp-fine">
        <div className="sp-fine-text">
          <p>{t("disclaimer")}</p>
          <p>
            {t.rich("thanks", {
              contact: (chunks) => <Link href="/contact">{chunks}</Link>,
            })}
          </p>
        </div>
        <EnamadSeal className="sp-seal" />
      </footer>
    </main>
  );
}

const CSS = `
.sp{position:relative;z-index:2;max-width:104rem;margin-inline:auto;
padding:clamp(6.5rem,15vh,10rem) var(--gutter) clamp(4.5rem,10vh,7rem)}
.sp-head{display:grid;gap:1.25rem var(--gutter);margin-bottom:clamp(2.5rem,8vh,6rem)}
.sp-titles{display:grid;gap:1rem}
.sp-eyebrow{margin:0;font-weight:500;font-size:var(--step--1);line-height:1.2;color:var(--ink-mute)}
.sp-h1{margin:0;max-width:16ch;font-family:var(--font-display);font-weight:400;font-size:var(--step-3);line-height:.9;color:var(--ink-dim);text-wrap:balance}
.sp-intro{margin:0;max-width:32ch;font-size:var(--step-1);line-height:1.3;color:var(--ink-dim);text-wrap:pretty}
@media (min-width:48rem){.sp-head{grid-template-columns:1fr minmax(0,26rem);align-items:end}.sp-intro{justify-self:end}}

.sp-switch{margin:calc(clamp(2.5rem,8vh,6rem) * -.5) 0 clamp(2.5rem,8vh,5rem)}
.sp-switch ul{display:flex;flex-wrap:wrap;gap:.5rem 1.75rem;margin:0;padding:0;list-style:none}
.sp-switch a{display:inline-block;padding-block:.35rem;font-weight:500;font-size:var(--step--1);color:var(--ink-mute);text-decoration:none;
background:linear-gradient(var(--teller-child),var(--teller-child)) no-repeat 0 100%/0 1px;transition:color .3s var(--ease-out-quint),background-size .45s var(--ease-out-quint)}
[dir=rtl] .sp-switch a{background-position:100% 100%}
.sp-switch a:hover,.sp-switch a:focus-visible{color:var(--ink);background-size:100% 1px}
.sp-switch a[aria-current=page]{color:var(--ink);background-size:100% 1px}

.sp-prog{margin-bottom:clamp(3rem,10vh,7rem);animation:sp-in .8s var(--ease-out-quint) .2s both}
.sp-prog-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:.35rem 1rem;margin:0}
.sp-count{font-family:var(--font-display-10);font-weight:400;font-size:var(--step-2);line-height:1;color:var(--ink);font-variant-numeric:tabular-nums}
.sp-prog-label{font-weight:500;font-size:var(--step--1);line-height:1.2;color:var(--ink-dim)}
.sp-track{position:relative;block-size:3px;margin-top:1.1rem}
.sp-track::before{content:"";position:absolute;inset-inline:0;inset-block-start:1px;block-size:1px;background:var(--hairline)}
.sp-fill{position:absolute;inset-block:0;inset-inline-start:0;inline-size:var(--p);background:var(--accent);
box-shadow:0 0 14px color-mix(in oklab,var(--accent) 55%,transparent);transform-origin:0 50%;
animation:sp-grow 1.6s var(--ease-out-quint) .55s both}
[dir=rtl] .sp-fill{transform-origin:100% 50%}

.sp-body{margin-bottom:clamp(3rem,10vh,7rem)}
.sp-sec{display:grid;gap:1rem var(--gutter);padding-block:clamp(1.5rem,3.5vw,3rem);border-top:1px solid var(--hairline)}
.sp-sec-h{margin:0;max-width:20ch;font-family:var(--font-display-10);font-weight:400;font-size:var(--step-2);line-height:1.02;color:var(--ink);text-wrap:balance}
.sp-sec-text{display:grid;gap:1em;max-width:62ch}
.sp-sec-text p{margin:0;font-size:var(--step-0);line-height:1.65;color:var(--ink-dim);text-wrap:pretty}
@media (min-width:64rem){.sp-sec{grid-template-columns:minmax(0,1fr) minmax(0,40rem);align-items:start}.sp-sec-text{grid-column:2}}

.sp-quote{margin:0 0 clamp(3.5rem,12vh,8rem);padding:0}
.sp-quote p{margin:0;max-width:24ch;font-family:var(--font-display-35);font-size:var(--step-3);line-height:1;color:var(--ink);text-wrap:balance}
.sp-quote p::before{content:"\\201C"}.sp-quote p::after{content:"\\201D"}
[lang=fa] .sp-quote p::before{content:"\\00AB"}[lang=fa] .sp-quote p::after{content:"\\00BB"}

.sp-choose{margin:0 0 1.25rem;font-weight:500;font-size:var(--step--1);line-height:1.2;color:var(--ink-dim)}
.sp-list{margin:0;padding:0;list-style:none}
.sp-row{border-top:1px solid var(--hairline);animation:sp-in .8s var(--ease-out-quint) both;animation-delay:calc(var(--i) * 80ms + 120ms)}
.sp-row:last-child{border-bottom:1px solid var(--hairline)}
.sp-link{display:grid;grid-template-columns:1fr auto;grid-template-areas:"num arrow" "label label" "note note";
align-items:baseline;gap:.35rem var(--gutter);padding:clamp(1rem,2.4vw,2.25rem) 0;color:inherit;text-decoration:none}
@media (min-width:64rem){.sp-link{grid-template-columns:6.5rem minmax(0,1fr) auto auto;grid-template-areas:"num label note arrow";gap:0 var(--gutter)}}
.sp-num,.sp-note,.sp-kicker{font-weight:500;font-size:var(--step--1);line-height:1.2;color:var(--ink-dim)}
.sp-num{grid-area:num;font-variant-numeric:tabular-nums}
.sp-note{grid-area:note}
.sp-main{grid-area:label;display:grid;gap:.6rem}
.sp-label{font-family:var(--font-display-70);font-size:clamp(2.4rem,6.5vw,7rem);line-height:.98;letter-spacing:-.012em;
color:var(--ink-dim);transition:color .3s var(--ease-out-quint),transform .6s var(--ease-out-quint)}
.sp-arrow{grid-area:arrow;justify-self:end;font-size:var(--step-1);color:var(--ink-mute);
transition:color .3s var(--ease-out-quint),transform .45s var(--ease-out-quint)}
[dir=rtl] .sp-arrow svg{transform:scaleX(-1)}
.sp-link:hover .sp-label,.sp-link:focus-visible .sp-label{color:var(--teller-child);transform:translateX(.12em)}
.sp-link:hover .sp-arrow,.sp-link:focus-visible .sp-arrow{color:var(--teller-child);transform:translate(3px,-3px)}
.sp-link:active .sp-label{transform:translateX(.12em) scale(.99)}
[dir=rtl] .sp-link:hover .sp-label,[dir=rtl] .sp-link:focus-visible .sp-label{transform:translateX(-.12em)}
[dir=rtl] .sp-link:hover .sp-arrow,[dir=rtl] .sp-link:focus-visible .sp-arrow{transform:translate(-3px,-3px)}
[dir=rtl] .sp-link:active .sp-label{transform:translateX(-.12em) scale(.99)}

.sp-fine{display:grid;gap:1.5rem var(--gutter);margin:clamp(3rem,8vh,5rem) 0 0;font-size:var(--step--1);line-height:1.5;color:var(--ink-mute)}
.sp-fine-text{display:grid;gap:.75rem;max-width:62ch}
.sp-fine p{margin:0;text-wrap:pretty}
.sp-fine a{color:var(--ink-dim);text-underline-offset:.2em}
.sp-fine a:hover{color:var(--ink)}
.sp-seal{line-height:0}
.sp-seal img{display:block;inline-size:auto;max-block-size:5.5rem}
@media (min-width:48rem){.sp-fine{grid-template-columns:minmax(0,1fr) auto;align-items:end}.sp-seal{justify-self:end}}

@keyframes sp-in{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes sp-grow{from{transform:scaleX(0)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.sp-row,.sp-prog{animation-name:sp-fade}.sp-fill{animation:none}
.sp-label,.sp-arrow,.sp-switch a{transition:color .2s linear}
.sp-link:hover .sp-label,.sp-link:focus-visible .sp-label,.sp-link:hover .sp-arrow,.sp-link:focus-visible .sp-arrow{transform:none}
[dir=rtl] .sp-link:hover .sp-label,[dir=rtl] .sp-link:focus-visible .sp-label,[dir=rtl] .sp-link:hover .sp-arrow,[dir=rtl] .sp-link:focus-visible .sp-arrow{transform:none}}
@keyframes sp-fade{from{opacity:0}to{opacity:1}}
`;
