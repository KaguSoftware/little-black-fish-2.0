import { getTranslations } from "next-intl/server";
import { FIELD_CSS } from "@/shared/ui/fields";
import { FishMark } from "@/shared/ui/FishMark";
import { LoginForm } from "./LoginForm";

/**
 * /login. A quiet stage door: the Redaction title sits low on the start side, the form
 * stands apart on the end side, and the fish idles in the dark between them.
 */
export async function LoginPage({ forbidden }: { forbidden: boolean }) {
  const t = await getTranslations("login");

  return (
    <main id="main" className="lg">
      <style>{FIELD_CSS + CSS}</style>

      <div className="lg-grid">
        <header className="lg-head">
          <span className="lg-fish" aria-hidden="true">
            <FishMark size={20} animated rim="oklch(0.7 0.1 210 / 0.85)" />
          </span>
          <p className="lg-kicker">{t("kicker")}</p>
          <h1 className="lg-h1">{t("title")}</h1>
          <p className="lg-intro">{t("intro")}</p>
        </header>

        <LoginForm forbidden={forbidden} />
      </div>
    </main>
  );
}

const CSS = `
.lg{position:relative;z-index:2;max-width:104rem;margin-inline:auto;min-height:100svh;display:flex;flex-direction:column;
padding:clamp(6.5rem,15vh,10rem) var(--gutter) clamp(4.5rem,10vh,7rem)}
.lg-grid{flex:1;display:grid;align-content:end;gap:clamp(3rem,9vh,5.5rem) var(--gutter)}
@media (min-width:56rem){.lg-grid{grid-template-columns:minmax(0,1fr) minmax(0,26rem);align-items:end}}

.lg-head{position:relative;display:grid;gap:1rem;animation:lg-in .8s var(--ease-out-quint) both;animation-delay:80ms}
.lg-fish{display:block;margin-bottom:clamp(1.5rem,6vh,3.5rem);color:var(--stage-deep);animation:lg-idle 7s ease-in-out infinite}
.lg-kicker{margin:0;font-weight:500;font-size:var(--step--1);color:var(--ink-mute)}
.lg-h1{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-4);line-height:.9;letter-spacing:-.012em;
color:var(--ink);text-wrap:balance}
.lg-intro{margin:0;max-width:30ch;font-size:var(--step-1);line-height:1.3;color:var(--ink-dim);text-wrap:pretty}

.lg-form{display:grid;gap:2rem;padding-top:clamp(1.5rem,4vh,2.25rem);border-top:1px solid var(--hairline);
animation:lg-in .8s var(--ease-out-quint) both;animation-delay:200ms}
.lg-actions{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:1rem 2rem;margin-top:.5rem}
.lg-back{color:var(--ink-mute);font-weight:500;font-size:var(--step--1);text-decoration:none;
text-underline-offset:.25em;transition:color .12s linear}
.lg-back:hover,.lg-back:focus-visible{color:var(--ink);text-decoration:underline}
.lg-alert{margin:0;font-size:var(--step--1);line-height:1.45;color:oklch(0.78 0.12 28)}
.lg-alert:empty{display:none}

@keyframes lg-in{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes lg-idle{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(10px,-5px,0)}}
html[data-motion="paused"] .lg-fish{animation:none}
@media (prefers-reduced-motion:reduce){.lg-fish{animation:none}.lg-head,.lg-form{animation-name:lg-fade}}
@keyframes lg-fade{from{opacity:0}to{opacity:1}}
`;
