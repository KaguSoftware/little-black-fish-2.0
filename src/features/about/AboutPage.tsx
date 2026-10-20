import { getLocale, getTranslations } from "next-intl/server";
import { FishMark } from "@/shared/ui/FishMark";

interface AboutSection {
  title?: string;
  paragraphs: string[];
}

/**
 * /about. The studio's statement, set as a long read: one big headline, then
 * numbered sections with a hairline between them. Copy lives in messages/<locale>/about.json;
 * the section count may differ per locale (EN: the live site's statement, FA: the three acts).
 */
export async function AboutPage() {
  const locale = await getLocale();
  const t = await getTranslations("about");
  const sections = t.raw("sections") as AboutSection[];
  const num = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });

  return (
    <main id="main" className="ab">
      <style>{CSS}</style>

      <header className="ab-head">
        <p className="ab-kicker">{t("kicker")}</p>
        <h1 className="ab-h1">{t("headline")}</h1>
        <span className="ab-fish" aria-hidden="true">
          <FishMark size={22} animated rim="oklch(0.7 0.1 210 / 0.85)" />
        </span>
      </header>

      {sections.map((sec, i) => (
        <section
          key={i}
          className="ab-sec"
          style={{ ["--i" as string]: i }}
          aria-labelledby={sec.title ? `ab-${i}` : undefined}
        >
          <p className="ab-num" aria-hidden="true">
            {num.format(i + 1)}
          </p>
          <div className="ab-body">
            {sec.title && (
              <h2 className="ab-h2" id={`ab-${i}`}>
                {sec.title}
              </h2>
            )}
            {sec.paragraphs.map((p, j) => (
              // An untitled opening section reads as the lede.
              <p key={j} className={i === 0 && j === 0 && !sec.title ? "ab-p ab-lede" : "ab-p"}>
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}

      <p className="ab-fine">{t("fine")}</p>
    </main>
  );
}

const CSS = `
.ab{position:relative;z-index:2;max-width:104rem;margin-inline:auto;
padding:clamp(6.5rem,15vh,10rem) var(--gutter) clamp(4.5rem,10vh,7rem)}
.ab-head{position:relative;margin-bottom:clamp(3rem,10vh,7rem)}
.ab-kicker{margin:0 0 1rem;font-weight:500;font-size:var(--step--1);color:var(--ink-mute)}
.ab-h1{margin:0;max-width:12ch;font-family:var(--font-display);font-weight:400;font-size:var(--step-4);line-height:.9;
letter-spacing:-.012em;color:var(--ink);text-wrap:balance}
.ab-fish{position:absolute;inset-inline-end:0;bottom:.5rem;color:var(--stage-deep);animation:ab-idle 7s ease-in-out infinite}
@keyframes ab-idle{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(-10px,-5px,0)}}

.ab-sec{display:grid;gap:1rem var(--gutter);padding:clamp(1.75rem,5vh,3.5rem) 0;border-top:1px solid var(--hairline);
animation:ab-in .8s var(--ease-out-quint) both;animation-delay:calc(var(--i) * 80ms + 120ms)}
@media (min-width:64rem){.ab-sec{grid-template-columns:6.5rem minmax(0,1fr) minmax(0,40rem)}.ab-body{grid-column:3}}
.ab-num{margin:0;font-weight:500;font-size:var(--step--1);color:var(--ink-mute);font-variant-numeric:tabular-nums}
.ab-body{display:grid;gap:1.1rem;max-width:40rem}
.ab-h2{margin:0 0 .25rem;font-family:var(--font-display);font-weight:400;font-size:var(--step-2);line-height:1;color:var(--teller-child);text-wrap:balance}
.ab-p{margin:0;font-size:var(--step-0);line-height:1.6;color:var(--ink-dim);text-wrap:pretty}
.ab-lede{font-size:var(--step-1);line-height:1.35;color:var(--ink)}
.ab-fine{margin:clamp(3rem,8vh,5rem) 0 0;padding-top:1.5rem;border-top:1px solid var(--hairline);font-size:var(--step--1);color:var(--ink-mute)}

[dir="rtl"] .ab-fish{scale:-1 1}
.ab:lang(fa) .ab-h1{max-width:16ch;line-height:1.3}
.ab:lang(fa) .ab-h2{line-height:1.4}
.ab:lang(fa) .ab-p{line-height:1.95}

@keyframes ab-in{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}
html[data-motion="paused"] .ab-fish{animation:none}
@media (prefers-reduced-motion:reduce){.ab-fish{animation:none}.ab-sec{animation-name:ab-fade}}
@keyframes ab-fade{from{opacity:0}to{opacity:1}}
`;
