import { getLocale, getTranslations } from "next-intl/server";
import { instagramUrl } from "@/shared/content/team";
import { getTeam } from "@/shared/data/team";
import { getSettings } from "@/shared/data/settings";
import { cardImage } from "@/shared/data/cards";
import { FishMark } from "@/shared/ui/FishMark";

interface AboutSection {
  title?: string;
  paragraphs: string[];
}

/**
 * /about. The studio's statement, set as a long read: one big headline, then
 * numbered sections with a hairline between them, then the team. Copy lives in
 * messages/<locale>/about.json (both locales: the live site's statement); the team comes
 * from /admin (shared/data/team.ts getTeam, code defaults in shared/content/team.ts).
 */
export async function AboutPage() {
  const locale = await getLocale();
  const t = await getTranslations("about");
  const [team, { teamFocus }] = await Promise.all([getTeam(), getSettings()]);
  const sections = t.raw("sections") as AboutSection[];
  const num = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false });
  const lang = locale === "fa" ? "fa" : "en";

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

      {team.length > 0 && (
      <section className="ab-team" aria-labelledby="ab-team">
        <h2 className="ab-team-h" id="ab-team">
          {t("team.heading")}
        </h2>
        <ul className="ab-grid">
          {team.map((m, i) => (
            <li key={m.id} className="ab-member" style={{ ["--i" as string]: i }}>
              <div className="ab-photo">
                {m.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    {...cardImage(m.photo, "(max-width: 640px) 50vw, 25vw", 600, 800)}
                    alt=""
                    width={600}
                    height={800}
                    loading="lazy"
                    decoding="async"
                    style={teamFocus[m.id] ? { objectPosition: `${teamFocus[m.id][0]}% ${teamFocus[m.id][1]}%` } : undefined}
                  />
                ) : (
                  <span className="ab-mono" aria-hidden="true">
                    <FishMark size={28} />
                  </span>
                )}
              </div>
              <div className="ab-who">
                <h3 className="ab-name">{m.name[lang]}</h3>
                {m.instagram && (
                  <a
                    className="ab-ig"
                    href={instagramUrl(m.instagram)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("team.instagram", { name: m.name[lang] })}
                  >
                    <InstagramIcon />
                  </a>
                )}
              </div>
              <p className="ab-title">{m.title[lang]}</p>
              <p className="ab-role">{m.role[lang]}</p>
            </li>
          ))}
        </ul>
      </section>
      )}

      <p className="ab-fine">{t("fine")}</p>
    </main>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.9" />
      <circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none" />
    </svg>
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
.ab-team{padding-top:clamp(2.5rem,7vh,5rem);border-top:1px solid var(--hairline)}
.ab-team-h{margin:0 0 clamp(1.75rem,5vh,3rem);font-family:var(--font-display);font-weight:400;font-size:var(--step-3);line-height:.95;color:var(--ink)}
.ab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr));gap:clamp(2rem,5vw,3.5rem) var(--gutter);margin:0;padding:0;list-style:none}
.ab-member{display:grid;align-content:start;gap:.35rem;animation:ab-in .8s var(--ease-out-quint) both;animation-delay:calc(var(--i) * 80ms + 200ms)}
.ab-photo{position:relative;aspect-ratio:3/4;margin-bottom:.85rem;overflow:hidden;background:var(--stage-raised)}
.ab-photo img{display:block;width:100%;height:100%;object-fit:cover;filter:grayscale(1) brightness(.85);
transition:filter .7s var(--ease-out-quint),transform .9s var(--ease-out-quint)}
.ab-member:hover .ab-photo img,.ab-member:focus-within .ab-photo img{filter:none;transform:scale(1.025)}
.ab-mono{position:absolute;inset:0;display:grid;place-items:center;color:var(--ink-mute)}
.ab-who{display:flex;align-items:baseline;justify-content:space-between;gap:1rem}
.ab-name{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-1);line-height:1.05;color:var(--ink)}
.ab-ig{flex:none;display:inline-grid;place-items:center;inline-size:2.5rem;block-size:2.5rem;margin:-.6rem;font-size:1.15rem;color:var(--ink-dim);
border-radius:50%;transition:color .3s var(--ease-out-quint),transform .2s var(--ease-out-quint)}
.ab-ig:hover,.ab-ig:focus-visible{color:var(--teller-child)}
.ab-ig:active{transform:scale(.94)}
.ab-title{margin:0;font-weight:500;font-size:var(--step--1);color:var(--teller-child)}
.ab-role{margin:.2rem 0 0;font-size:var(--step--1);line-height:1.55;color:var(--ink-dim);text-wrap:pretty}
.ab:lang(fa) .ab-name{line-height:1.4}
.ab:lang(fa) .ab-role{line-height:1.9}
.ab-fine{margin:clamp(3rem,8vh,5rem) 0 0;padding-top:1.5rem;border-top:1px solid var(--hairline);font-size:var(--step--1);color:var(--ink-mute)}

[dir="rtl"] .ab-fish{scale:-1 1}
.ab:lang(fa) .ab-h1{max-width:16ch;line-height:1.3}
.ab:lang(fa) .ab-h2{line-height:1.4}
.ab:lang(fa) .ab-p{line-height:1.95}

@keyframes ab-in{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}
html[data-motion="paused"] .ab-fish{animation:none}
@media (prefers-reduced-motion:reduce){.ab-fish{animation:none}.ab-sec,.ab-member{animation-name:ab-fade}.ab-photo img{transition:filter .2s linear}.ab-member:hover .ab-photo img{transform:none}}
@keyframes ab-fade{from{opacity:0}to{opacity:1}}
`;
