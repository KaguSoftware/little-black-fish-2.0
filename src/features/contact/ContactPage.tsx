import { getTranslations } from "next-intl/server";
import { FIELD_CSS } from "@/shared/ui/fields";
import { ContactForm } from "./ContactForm";

/**
 * /contact. Asymmetric: the title and the studio's invitation hold one side,
 * the proposal form the other. Stacks on narrow screens.
 */
export async function ContactPage() {
  const t = await getTranslations("contact");

  return (
    <main id="main" className="ct">
      <style>{FIELD_CSS}</style>
      <style>{CSS}</style>

      <div className="ct-grid">
        <header className="ct-head">
          <h1 className="ct-h1 ct-rise" style={{ ["--i" as string]: 0 }}>
            {t("title")}
          </h1>
          <p className="ct-intro ct-rise" style={{ ["--i" as string]: 1 }}>
            {t("intro")}
          </p>
        </header>

        <ContactForm />
      </div>
    </main>
  );
}

const CSS = `
.ct{position:relative;z-index:2;max-width:104rem;margin-inline:auto;
padding:clamp(6.5rem,15vh,10rem) var(--gutter) clamp(4.5rem,10vh,7rem)}
.ct-grid{display:grid;gap:clamp(2.5rem,8vh,5rem) var(--gutter)}
@media (min-width:64rem){
.ct-grid{grid-template-columns:minmax(0,5fr) minmax(0,6fr);align-items:start;column-gap:clamp(3rem,8vw,9rem)}
.ct-head{position:sticky;top:clamp(6.5rem,15vh,10rem)}
}
.ct-head{display:grid;gap:1.25rem;align-content:start}
.ct-h1{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-3);line-height:.9;color:var(--ink-dim);text-wrap:balance}
.ct-intro{margin:0;max-width:24ch;font-size:var(--step-1);line-height:1.3;color:var(--ink-dim);text-wrap:pretty}
:lang(fa) .ct-h1{line-height:1.15}
:lang(fa) .ct-intro{line-height:1.6}

.ct-form{display:grid;gap:clamp(2rem,5vh,2.75rem) var(--gutter);max-width:46rem}
@media (min-width:40rem){.ct-form{grid-template-columns:1fr 1fr}.ct-wide{grid-column:1 / -1}}
.ct-foot{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:1rem 2rem;margin-top:.5rem}
.ct-req{margin:0;font-size:var(--step--1);color:var(--ink-mute)}
.ct-alert{margin:0;font-size:var(--step--1);line-height:1.4;color:oklch(0.78 0.12 28)}
.ct-alert:empty{display:none}

.ct-done{display:grid;gap:1.25rem;align-content:start;max-width:34rem;padding-top:clamp(.5rem,2vh,1.5rem)}
.ct-done-h{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-2);line-height:1;color:var(--ink);outline:none}
.ct-done-h::before{content:"";display:block;width:2.5rem;height:1px;margin-bottom:1.5rem;background:var(--accent)}
.ct-done-p{margin:0;font-size:var(--step-0);line-height:1.6;color:var(--ink-dim);text-wrap:pretty}
.ct-done .lbf-textbtn{justify-self:start;margin-top:.5rem}

.ct-rise{animation:ct-in .8s var(--ease-out-quint) both;animation-delay:calc(var(--i,0) * 80ms + 120ms)}
@keyframes ct-in{from{opacity:0;transform:translateY(10px);filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}
@media (prefers-reduced-motion:reduce){.ct-rise{animation-name:ct-fade;animation-duration:.3s}}
@keyframes ct-fade{from{opacity:0}to{opacity:1}}
`;
