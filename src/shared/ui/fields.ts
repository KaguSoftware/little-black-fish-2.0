/**
 * Shared form styling (contact, login, admin). Inject once per page: <style>{FIELD_CSS}</style>.
 * Hairline fields on the stage; focus draws the accent along the baseline; the submit is a
 * Redaction CTA with an accent hairline (no filled pills). Logical properties only (RTL-safe).
 *
 * Markup:
 *   <label className="lbf-field">
 *     <span className="lbf-label">Name</span>
 *     <input className="lbf-input" />            // or textarea.lbf-input / select.lbf-input
 *     <span className="lbf-hint">…</span>         // optional
 *     <span className="lbf-error" role="alert">…</span>
 *   </label>
 *   <label className="lbf-check"><input type="checkbox" /> <span>Published</span></label>
 *   <button className="lbf-cta" type="submit"><span>Send</span></button>
 *   <button className="lbf-textbtn" type="button">Cancel</button>   // quiet UI text button
 */
export const FIELD_CSS = `
.lbf-field{position:relative;display:flex;flex-direction:column;gap:.55rem;min-width:0}
.lbf-label{font-family:var(--font-sans);font-weight:500;font-size:var(--step--1);line-height:1.2;color:var(--ink-dim)}
.lbf-input{appearance:none;width:100%;margin:0;padding:.7rem 0 .75rem;border:0;border-radius:0;background:transparent;
color:var(--ink);font-family:var(--font-sans);font-size:var(--step-0);line-height:1.45;
box-shadow:inset 0 -1px 0 var(--hairline);transition:box-shadow .35s var(--ease-out-quint)}
.lbf-input::placeholder{color:var(--ink-mute);opacity:1}
.lbf-input:hover{box-shadow:inset 0 -1px 0 oklch(0.93 0.012 80 / .32)}
.lbf-input:focus{outline:none;box-shadow:inset 0 -2px 0 var(--accent)}
.lbf-input:focus-visible{outline:none}
.lbf-input[aria-invalid="true"]{box-shadow:inset 0 -2px 0 var(--teller-creature)}
textarea.lbf-input{min-height:9rem;resize:vertical}
select.lbf-input{cursor:pointer;padding-inline-end:1.5rem;
background-image:linear-gradient(45deg,transparent 50%,var(--ink-dim) 50%),linear-gradient(135deg,var(--ink-dim) 50%,transparent 50%);
background-position:calc(100% - 9px) 55%,calc(100% - 4px) 55%;background-size:5px 5px;background-repeat:no-repeat}
[dir="rtl"] select.lbf-input{background-position:9px 55%,4px 55%}
select.lbf-input option{background:var(--stage-raised);color:var(--ink)}
.lbf-input[dir="ltr"]{text-align:start}
[dir="rtl"] .lbf-input[dir="ltr"]{text-align:end}
.lbf-hint{font-family:var(--font-sans);font-size:var(--step--1);color:var(--ink-mute);line-height:1.4}
.lbf-error{font-family:var(--font-sans);font-size:var(--step--1);color:oklch(0.78 0.12 28);line-height:1.4}
.lbf-check{display:inline-flex;align-items:center;gap:.65rem;cursor:pointer;font-family:var(--font-sans);
font-size:var(--step--1);font-weight:500;color:var(--ink-dim)}
.lbf-check input{appearance:none;flex:none;width:1.05rem;height:1.05rem;margin:0;border:1px solid var(--hairline);
border-radius:2px;background:transparent;display:grid;place-content:center;cursor:pointer;transition:border-color .12s linear}
.lbf-check input::after{content:"";width:.55rem;height:.55rem;background:var(--accent);transform:scale(0);
transition:transform .25s var(--ease-out-quint)}
.lbf-check input:checked{border-color:var(--accent)}
.lbf-check input:checked::after{transform:scale(1)}
.lbf-check:hover{color:var(--ink)}
.lbf-cta{position:relative;display:inline-flex;align-items:center;gap:.6rem;padding:.4rem 0 .6rem;border:0;background:none;
color:var(--ink);font-family:var(--font-display);font-size:var(--step-1);line-height:1.1;cursor:pointer;
-webkit-tap-highlight-color:transparent}
.lbf-cta::after{content:"";position:absolute;inset-inline:0;bottom:0;height:1px;background:var(--accent);
transform:scaleX(.18);transform-origin:var(--lbf-origin,left);transition:transform .45s var(--ease-out-quint)}
[dir="rtl"] .lbf-cta::after{--lbf-origin:right}
.lbf-cta:hover::after,.lbf-cta:focus-visible::after{transform:scaleX(1)}
.lbf-cta:active{transform:scale(.97)}
.lbf-cta:disabled{cursor:progress;color:var(--ink-dim)}
.lbf-cta:disabled::after{animation:lbf-cta-wait 1.2s var(--ease-out-quint) infinite}
@keyframes lbf-cta-wait{0%{transform:scaleX(0)}60%{transform:scaleX(1)}100%{transform:scaleX(1);opacity:0}}
.lbf-textbtn{border:0;background:none;padding:.35rem 0;color:var(--ink-dim);font-family:var(--font-sans);font-weight:500;
font-size:var(--step--1);cursor:pointer;transition:color .12s linear}
.lbf-textbtn:hover{color:var(--ink)}
.lbf-textbtn:active{transform:scale(.97)}
@media (prefers-reduced-motion:reduce){
.lbf-input,.lbf-cta::after,.lbf-check input::after{transition:none}
.lbf-cta:disabled::after{animation:none}
}
`;
