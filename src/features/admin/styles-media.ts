/**
 * Media system styles: toasts, drop zones, ImageField, ImageListField, ImagePicker, media library.
 * Injected once by <MediaStyles/> (React 19 dedupes it). Tokens from globals.css, logical properties
 * only (RTL), transform/opacity motion, and graceful reduced-motion / reduced-transparency.
 */
export const ADMIN_CSS_MEDIA = `
.adm-mat{--mat:oklch(0.15 0.016 var(--hue,215) / .78)}

/* Buttons: one language everywhere (44px targets, instant press feedback) */
.adm-btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:2.75rem;padding:.4rem 1.05rem;border:1px solid var(--hairline);
border-radius:.5rem;background:oklch(0.93 0.012 80 / .04);color:var(--ink);font-family:var(--font-sans);font-weight:500;font-size:var(--step--1);line-height:1.2;
text-decoration:none;cursor:pointer;transition:background-color .12s linear,border-color .12s linear,color .12s linear,transform .1s ease-out;-webkit-tap-highlight-color:transparent}
.adm-btn:hover:not(:disabled){background:oklch(0.93 0.012 80 / .09);border-color:oklch(0.93 0.012 80 / .32)}
.adm-btn:active:not(:disabled){transform:scale(.97);transition-duration:.04s}
.adm-btn:focus-visible,.adm-toast-btn:focus-visible,.adm-toast-x:focus-visible,.adm-zone:focus-visible,.adm-card:focus-visible,.adm-ili-grab:focus-visible,
.adm-ili-x:focus-visible,.adm-ili-act:focus-visible,.adm-card-sel:focus-visible,.adm-mdl-x:focus-visible,.adm-tab:focus-visible,.adm-q-x:focus-visible,.adm-fp-dot:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.adm-btn:disabled{opacity:.45;cursor:default}
.adm-btn svg{flex:none}
.adm-btn-quiet{border-color:transparent;background:none;color:var(--ink-dim)}
.adm-btn-quiet:hover:not(:disabled){background:oklch(0.93 0.012 80 / .06);border-color:transparent;color:var(--ink)}
.adm-btn-primary{border-color:oklch(0.93 0.012 80 / .4);background:oklch(0.93 0.012 80 / .1)}
.adm-btn-danger{color:oklch(0.8 0.12 28);border-color:oklch(0.78 0.12 28 / .5);background:oklch(0.78 0.12 28 / .08)}
.adm-btn-danger:hover:not(:disabled){background:oklch(0.78 0.12 28 / .16);border-color:oklch(0.78 0.12 28 / .8)}
.adm-caret{width:.45rem;height:.45rem;border-inline-end:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(45deg) translateY(-2px);transition:transform .2s var(--ease-out-quint)}
[aria-expanded="true"] > .adm-caret{transform:rotate(-135deg) translateY(-2px)}
.adm-panel-acts{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem 1rem}

/* Toasts: bottom-center, above the mobile safe area */
.adm-toasts{position:fixed;inset-inline:0;bottom:max(1rem,env(safe-area-inset-bottom));z-index:2147483000;display:grid;justify-items:center;gap:.5rem;margin:0;padding:0 1rem;
list-style:none;pointer-events:none}
.adm-toasts[data-empty="true"]{display:none}
.adm-toast{pointer-events:auto;display:flex;align-items:center;gap:.25rem .75rem;max-width:min(32rem,100%);min-height:3rem;padding:.35rem .4rem .35rem 1rem;padding-inline:1rem .4rem;
border:1px solid oklch(0.93 0.012 80 / .22);border-radius:.75rem;background:oklch(0.17 0.016 var(--hue,215) / .86);color:var(--ink);font-size:var(--step--1);line-height:1.35;
-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);box-shadow:0 18px 40px -16px oklch(0 0 0 / .8);
animation:adm-toast-in .38s var(--ease-out-quint) both}
.adm-toast[data-kind="error"]{border-color:oklch(0.78 0.12 28 / .6)}
.adm-toast[data-kind="ok"] .adm-toast-text::before{content:"";display:inline-block;width:.4rem;height:.4rem;margin-inline-end:.55rem;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent);vertical-align:.1em}
.adm-toast-text{flex:1 1 auto;min-width:0;overflow-wrap:anywhere}
.adm-toast-btn{flex:none;min-height:2.75rem;padding:0 .9rem;border:0;border-radius:.5rem;background:none;color:var(--accent);font-family:var(--font-sans);font-weight:600;font-size:var(--step--1);cursor:pointer}
.adm-toast-btn:hover{background:oklch(0.93 0.012 80 / .08)}
.adm-toast-btn:active{transform:scale(.96)}
.adm-toast-x{flex:none;display:grid;place-items:center;width:2.75rem;height:2.75rem;border:0;border-radius:50%;background:none;color:var(--ink-mute);cursor:pointer;font-size:1rem}
.adm-toast-x:hover{color:var(--ink)}
@keyframes adm-toast-in{from{opacity:0;transform:translateY(14px) scale(.96)}to{opacity:1;transform:none}}

/* Drop zones */
.adm-zone{position:relative;display:grid;place-content:center;justify-items:center;gap:.35rem;width:100%;min-height:9rem;padding:1.25rem 1rem;border:1.5px dashed oklch(0.93 0.012 80 / .26);
border-radius:.75rem;background:oklch(0.93 0.012 80 / .025);color:var(--ink-dim);font:inherit;text-align:center;cursor:pointer;
transition:border-color .15s linear,background-color .15s linear,color .15s linear,transform .1s ease-out;-webkit-tap-highlight-color:transparent}
.adm-zone svg{font-size:1.9rem;color:var(--ink-mute)}
.adm-zone:hover:not(:disabled),.adm-zone[data-over="true"]{border-color:var(--accent);background:oklch(0.7 0.1 210 / .07);color:var(--ink)}
.adm-zone:active:not(:disabled){transform:scale(.99)}
.adm-zone:disabled{opacity:.5;cursor:default}
.adm-zone[data-over="true"]{box-shadow:0 0 0 4px oklch(0.7 0.1 210 / .14)}
.adm-zone-title{font-weight:600;font-size:var(--step-0);color:var(--ink)}
.adm-zone-sub{font-size:var(--step--1);color:var(--ink-mute)}
.adm-zone-hint{font-size:.75rem;color:var(--ink-mute);max-width:32ch}
.adm-zone-wide{min-height:11rem}
.adm-zone-big{min-height:16rem;cursor:pointer}
.adm-zone-big .adm-zone-btn{margin-top:.5rem}
.adm-zone-input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.adm-zone .adm-ring{position:absolute;inset-block-start:.75rem;inset-inline-end:.75rem;color:var(--accent)}
.adm-drop-veil{position:absolute;inset:0;z-index:30;display:grid;place-content:center;justify-items:center;gap:.5rem;border:1.5px dashed var(--accent);border-radius:.75rem;
background:oklch(0.12 0.014 var(--hue,215) / .82);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:var(--ink);font-weight:600;pointer-events:none;
animation:adm-fade .15s linear both}
.adm-drop-veil svg{font-size:2.2rem;color:var(--accent)}
.adm-drop-veil-soft{border-radius:.6rem}

/* ImageField */
.adm-if{position:relative;display:grid;gap:.5rem;min-width:0}
.adm-if-box{position:relative;overflow:hidden;width:100%;border-radius:.6rem;background:var(--stage-deep);box-shadow:inset 0 0 0 1px var(--ink-faint);transition:box-shadow .15s linear}
.adm-if[data-over="true"] .adm-if-box{box-shadow:0 0 0 2px var(--accent),0 0 30px -8px var(--accent)}
.adm-if-box img,.adm-if-box video{display:block;width:100%;height:100%;transition:opacity .2s linear}
.adm-if-box[data-fit="contain"]{background:repeating-conic-gradient(oklch(0.93 0.012 80 / .04) 0% 25%,transparent 0% 50%) 50% / 18px 18px}
.adm-if-box[data-fit="contain"] img,.adm-if-box[data-fit="contain"] video{object-fit:contain}
.adm-if-box[data-busy="true"] img,.adm-if-box[data-busy="true"] video{opacity:.4}
.adm-if-broken{position:absolute;inset:0;display:grid;place-items:center;padding:1rem;text-align:center;font-size:var(--step--1);color:oklch(0.8 0.12 28);background:var(--stage-deep)}
.adm-if-drop{position:absolute;inset:0;display:grid;place-items:center;background:oklch(0.12 0.014 var(--hue,215) / .75);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-weight:600;color:var(--ink)}
.adm-if-prog{position:absolute;inset:0;display:grid;place-items:center;color:var(--accent)}
.adm-if-acts{max-width:34rem;display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .5rem}
.adm-if-meta{margin:0;font-size:.75rem;color:var(--ink-mute);font-variant-numeric:tabular-nums}
.adm-if-meta[data-warn="true"]{color:oklch(0.8 0.12 70)}
.adm-if-details{display:grid;gap:1.1rem;max-width:34rem;padding:1rem 0 .25rem;border-top:1px solid var(--hairline);animation:adm-in .3s var(--ease-out-quint) both}
.adm-if-tools{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem}
.adm-if-uses{margin:0;font-size:var(--step--1);color:var(--ink-dim)}
.adm-if-uses span{color:var(--ink-mute)}
.adm-ring{flex:none}

/* Focus point */
.adm-fp{display:grid;gap:.75rem;grid-template-columns:minmax(0,1fr)}
@media (min-width:36rem){.adm-fp{grid-template-columns:minmax(0,14rem) minmax(0,1fr);align-items:start}}
.adm-fp-img{position:relative;display:inline-block;max-width:100%;line-height:0;border-radius:.4rem;overflow:hidden;cursor:crosshair;touch-action:none;box-shadow:inset 0 0 0 1px var(--ink-faint)}
.adm-fp-img img{display:block;max-width:100%;max-height:14rem;user-select:none}
.adm-fp-dot{position:absolute;width:2.75rem;height:2.75rem;margin:-1.375rem 0 0 -1.375rem;padding:0;border:0;background:none;cursor:grab;touch-action:none}
.adm-fp-dot::before{content:"";position:absolute;left:50%;top:50%;width:1.75rem;height:1.75rem;margin:-.875rem 0 0 -.875rem;border-radius:50%;border:2.5px solid #fff;background:oklch(0.7 0.1 210 / .55);box-shadow:0 0 0 1.5px oklch(0 0 0 / .6),0 2px 10px oklch(0 0 0 / .5)}
.adm-fp-side{display:grid;gap:.5rem;justify-items:start}
.adm-if[data-framing="true"] .adm-fp{grid-template-columns:minmax(0,1fr)}
@media (min-width:36rem){.adm-if[data-framing="true"] .adm-fp{grid-template-columns:minmax(0,auto) minmax(0,1fr)}}
.adm-if[data-framing="true"] .adm-fp-img img{max-height:min(24rem,52dvh)}
.adm-if[data-framing="true"] .adm-if-details{border-top:0;padding-top:0}

/* Upload queue */
.adm-q{display:grid;gap:.4rem;min-width:0}
.adm-q-list{margin:0;padding:0;list-style:none;display:grid;gap:.4rem}
.adm-q-row{display:grid;grid-template-columns:2.75rem minmax(0,1fr) auto;align-items:center;gap:.75rem;padding:.45rem .6rem .45rem .45rem;padding-inline:.45rem .4rem;
border:1px solid var(--hairline);border-radius:.6rem;background:oklch(0.93 0.012 80 / .03);animation:adm-in .3s var(--ease-out-quint) both}
.adm-q-row[data-state="error"]{border-color:oklch(0.78 0.12 28 / .55)}
.adm-q-thumb{position:relative;display:grid;place-items:center;width:2.75rem;height:2.75rem;overflow:hidden;border-radius:.4rem;background:var(--stage-deep);color:var(--ink-mute)}
.adm-q-thumb img{width:100%;height:100%;object-fit:cover}
.adm-q-check{position:absolute;inset:0;display:grid;place-items:center;background:oklch(0.12 0.014 var(--hue,215) / .7);color:var(--accent);font-size:1.25rem;animation:adm-pop .35s var(--ease-out-quint) both}
.adm-q-main{display:grid;gap:.15rem;min-width:0}
.adm-q-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:var(--step--1);color:var(--ink);text-align:start}
.adm-q-status{font-size:.75rem;color:var(--ink-mute)}
.adm-q-row[data-state="error"] .adm-q-status{color:oklch(0.8 0.12 28)}
.adm-q-bar,.adm-ili-bar{display:block;height:3px;overflow:hidden;border-radius:2px;background:oklch(0.93 0.012 80 / .12)}
.adm-q-bar>span,.adm-ili-bar>span{display:block;width:100%;height:100%;background:var(--accent);transform-origin:left center;transition:transform .2s linear}
[dir="rtl"] .adm-q-bar>span,[dir="rtl"] .adm-ili-bar>span{transform-origin:right center}
.adm-q-warn{display:flex;align-items:flex-start;gap:.35rem;font-size:.75rem;color:oklch(0.8 0.12 70)}
.adm-q-warn svg{flex:none;margin-top:.15em}
.adm-q-acts{display:flex;align-items:center;gap:.25rem}
.adm-q-x,.adm-mdl-x{display:grid;place-items:center;width:2.75rem;height:2.75rem;border:0;border-radius:50%;background:none;color:var(--ink-mute);cursor:pointer;font-size:1.1rem}
.adm-q-x:hover,.adm-mdl-x:hover{color:var(--ink);background:oklch(0.93 0.012 80 / .08)}
.adm-q-clear{justify-self:start}
@keyframes adm-pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}

/* ImageListField */
.adm-il{position:relative;display:grid;gap:.6rem;min-width:0}
.adm-il-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:.5rem 1rem}
.adm-il-count{display:block;margin-top:.15rem;font-size:.75rem;color:var(--ink-mute);font-variant-numeric:tabular-nums}
.adm-ilist{position:relative;display:grid;grid-template-columns:repeat(auto-fill,minmax(10.5rem,1fr));gap:1.1rem .9rem;margin:0;padding:0;list-style:none}
.adm-ili{position:relative;display:grid;gap:.4rem;align-content:start;min-width:0;will-change:transform;touch-action:manipulation;-webkit-touch-callout:none;user-select:none}
.adm-ili-frame{position:relative;aspect-ratio:4/3;border-radius:.5rem;background:var(--stage-deep);box-shadow:inset 0 0 0 1px var(--ink-faint);transition:box-shadow .2s linear}
.adm-ili-grab{position:absolute;inset:0;display:block;width:100%;height:100%;padding:0;margin:0;overflow:hidden;border:0;border-radius:inherit;background:none;cursor:pointer}
.adm-ili-grab video{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}
.adm-ili-grab img{display:block;width:100%;height:100%;object-fit:cover;pointer-events:none}
.adm-ilist[data-dragging="true"] .adm-ili-grab{cursor:grabbing}
.adm-ili[data-dragging="true"]{z-index:20}
.adm-ili[data-dragging="true"] .adm-ili-frame{box-shadow:0 22px 44px -14px oklch(0 0 0 / .85),0 0 0 1.5px var(--accent)}
.adm-ili[data-lifted="true"]{z-index:10}
.adm-ili[data-lifted="true"] .adm-ili-frame{box-shadow:0 14px 30px -12px oklch(0 0 0 / .8),0 0 0 2px var(--accent)}
.adm-ili[data-cover="true"] .adm-ili-frame{box-shadow:inset 0 0 0 1.5px var(--accent)}
.adm-ili-n{position:absolute;inset-block-start:.4rem;inset-inline-start:.4rem;display:grid;place-items:center;min-width:1.5rem;height:1.5rem;padding:0 .35rem;border-radius:.75rem;
background:oklch(0.08 0.01 215 / .75);color:var(--ink);font-size:.6875rem;font-weight:600;font-variant-numeric:tabular-nums;pointer-events:none}
.adm-ili-cover{position:absolute;inset-block-start:.4rem;inset-inline-start:2.4rem;padding:0 .45rem;height:1.5rem;display:grid;place-items:center;border-radius:.75rem;background:var(--accent);
color:oklch(0.12 0.014 215);font-size:.6875rem;font-weight:700;pointer-events:none}
.adm-ili-x{position:absolute;inset-block-start:0;inset-inline-end:0;display:grid;place-items:center;width:2.75rem;height:2.75rem;padding:0;border:0;background:none;color:#fff;cursor:pointer}
.adm-ili-x svg{width:1.6rem;height:1.6rem;padding:.4rem;border-radius:50%;background:oklch(0.08 0.01 215 / .75)}
.adm-ili-x:hover svg{background:oklch(0.5 0.15 25 / .9)}
/* The actions are always there (no hover needed): Replace is the main one, the rest sit under it. */
.adm-ili-acts{display:grid;gap:.3rem}
.adm-ili-row{display:flex;gap:.3rem}
.adm-ili-act{flex:1 1 0;min-width:0;display:inline-flex;align-items:center;justify-content:center;gap:.35rem;min-height:2.75rem;padding:.25rem .4rem;border:1px solid var(--hairline);border-radius:.5rem;
background:oklch(0.93 0.012 80 / .05);color:var(--ink-dim);font:600 .8125rem/1.2 var(--font-sans);text-align:center;cursor:pointer;transition:background-color .12s linear,color .12s linear,transform .12s ease-out}
.adm-ili-act:hover:not(:disabled){background:oklch(0.93 0.012 80 / .1);color:var(--ink);border-color:oklch(0.93 0.012 80 / .3)}
.adm-ili-act:active:not(:disabled){transform:scale(.97);transition-duration:.04s}
.adm-ili-act:disabled{opacity:.45;cursor:default}
.adm-ili-act[data-main="true"]{color:var(--ink);background:oklch(0.93 0.012 80 / .09)}
.adm-ili-act svg{flex:none;font-size:1.3em}
.adm-ili-rm{flex:0 0 2.75rem;padding:0}
.adm-ili-rm:hover:not(:disabled){color:oklch(0.82 0.12 28);border-color:oklch(0.78 0.12 28 / .6);background:oklch(0.78 0.12 28 / .1)}
.adm-ili[data-dragging="true"] .adm-ili-acts,.adm-ili[data-lifted="true"] .adm-ili-acts{opacity:.35}
.adm-ili-up .adm-ili-grab{cursor:progress;display:grid;place-items:center;color:var(--ink-mute)}
.adm-ili-up .adm-ili-grab img{opacity:.4}
.adm-ili-up .adm-ili-bar{position:absolute;inset-inline:.6rem;bottom:.6rem}
.adm-il-help{margin:0}

/* Modal shell (picker, file sheet, confirm) */
.adm-mdl{width:min(64rem,calc(100vw - 2rem));max-height:min(90dvh,52rem);height:fit-content}
.adm-mdl[data-tall="true"]{height:min(90dvh,48rem)}
.adm-mdl[data-size="narrow"]{width:min(30rem,calc(100vw - 2rem))}
.adm-mdl[open]{animation:adm-mdl-in .34s var(--ease-out-quint) both}
.adm-mdl-head{align-items:center;padding-block:.75rem .75rem;padding-inline:clamp(1.1rem,3vw,1.9rem) .6rem;-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);
background:oklch(0.14 0.016 var(--hue,215) / .85)}
.adm-mdl-head .adm-editor-title{font-size:var(--step-1);line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.adm-mdl-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:1.1rem clamp(1.1rem,3vw,1.9rem) 1.4rem;scrollbar-width:thin;scrollbar-color:var(--hairline) transparent}
.adm-mdl-foot{flex:none;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem 1rem;padding:.75rem clamp(1.1rem,3vw,1.9rem) calc(.75rem + env(safe-area-inset-bottom,0px));
box-shadow:0 -1px 0 var(--hairline);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);background:oklch(0.14 0.016 var(--hue,215) / .85)}
.adm-mdl-foot-note{font-size:var(--step--1);color:var(--ink-mute)}
.adm-mdl-foot-acts{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem 1rem;margin-inline-start:auto}
.adm-mdl[data-tone="danger"]{border-color:oklch(0.78 0.12 28 / .4)}
.adm-confirm{display:grid;gap:.75rem;font-size:var(--step--1);line-height:1.5;color:var(--ink-dim)}
.adm-confirm p{margin:0}
.adm-confirm-list{margin:0;padding:0;list-style:none;display:grid;gap:.6rem;max-height:14rem;overflow:auto}
.adm-confirm-list li{display:grid;gap:.1rem;padding:.55rem .7rem;border-radius:.5rem;background:oklch(0.78 0.12 28 / .08);box-shadow:inset 0 0 0 1px oklch(0.78 0.12 28 / .25)}
.adm-confirm-list b{font-weight:600;color:var(--ink);overflow-wrap:anywhere}
.adm-confirm-note{color:oklch(0.8 0.12 28)}
@keyframes adm-mdl-in{from{opacity:0;transform:translateY(14px) scale(.975)}to{opacity:1;transform:none}}
@media (max-width:40rem){
.adm-mdl,.adm-mdl[data-tall="true"]{width:100vw;height:100dvh;max-height:none}
.adm-mdl[data-size="narrow"]{width:100vw;height:fit-content;max-height:90dvh;margin:auto 0 0;border-radius:1rem 1rem 0 0}
.adm-mdl[open]{animation-name:adm-sheet-in}
.adm-mdl-foot-acts{flex:1 1 auto;justify-content:space-between}
.adm-mdl-foot-note{flex:1 0 100%}
.adm-mdl-foot-note:empty{display:none}
}
@keyframes adm-sheet-in{from{opacity:.4;transform:translateY(40px)}to{opacity:1;transform:none}}

/* Picker */
.adm-tabs{display:flex;gap:1.25rem;margin:-.25rem 0 1rem;box-shadow:inset 0 -1px 0 var(--hairline)}
.adm-tab{position:relative;min-height:2.75rem;padding:0;border:0;background:none;color:var(--ink-mute);font:500 var(--step-0) var(--font-sans);cursor:pointer;transition:color .12s linear}
.adm-tab:hover{color:var(--ink-dim)}
.adm-tab[aria-selected="true"]{color:var(--ink)}
.adm-tab::after{content:"";position:absolute;inset-inline:0;bottom:0;height:2px;background:var(--accent);transform:scaleX(0);transition:transform .3s var(--ease-out-quint)}
.adm-tab[aria-selected="true"]::after{transform:scaleX(1)}
.adm-pk-panel,.adm-lib{position:relative;display:grid;gap:1rem;align-content:start;min-height:12rem}
.adm-lib-tools{display:flex;flex-wrap:wrap;align-items:end;gap:.5rem 1.25rem}
.adm-lib-search{flex:1 1 14rem}
.adm-lib-tools .lbf-input{min-height:2.75rem}
.adm-lib-search .lbf-input{padding-inline:.85rem;border-radius:.5rem;box-shadow:inset 0 0 0 1px var(--hairline)}
.adm-lib-search .lbf-input:hover{box-shadow:inset 0 0 0 1px oklch(0.93 0.012 80 / .32)}
.adm-lib-search .lbf-input:focus{box-shadow:inset 0 0 0 2px var(--accent)}
.adm-lib-tools .adm-chips{margin:0;gap:.1rem 1rem}
.adm-lib-size{display:grid;gap:.25rem;flex:0 1 9rem}
.adm-lib-size input{width:100%;accent-color:var(--accent);min-height:2.75rem;margin:0}
.adm-grid{--card:9rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(var(--card),44vw),1fr));gap:1rem .9rem;margin:0;padding:0;list-style:none}
.adm-card{position:relative;display:grid;gap:.3rem;width:100%;padding:0;border:0;background:none;color:inherit;text-align:start;cursor:pointer;font:inherit;-webkit-tap-highlight-color:transparent}
.adm-card-img{position:relative;display:block;aspect-ratio:4/3;overflow:hidden;border-radius:.5rem;background:var(--stage-deep);box-shadow:inset 0 0 0 1px var(--ink-faint);
transition:transform .15s var(--ease-out-quint),box-shadow .15s linear}
.adm-card-img img,.adm-card-img video{display:block;width:100%;height:100%;object-fit:cover}
.adm-card:hover .adm-card-img{box-shadow:inset 0 0 0 1px oklch(0.93 0.012 80 / .35)}
.adm-card:active .adm-card-img{transform:scale(.97);transition-duration:.05s}
.adm-card[aria-pressed="true"] .adm-card-img{box-shadow:0 0 0 2px var(--accent)}
.adm-card-check{position:absolute;inset-block-start:.4rem;inset-inline-start:.4rem;display:grid;place-items:center;min-width:1.5rem;height:1.5rem;border-radius:.75rem;background:var(--accent);
color:oklch(0.12 0.014 215);font-size:.8rem;opacity:0;transform:scale(.6);transition:opacity .15s linear,transform .25s var(--ease-out-quint)}
.adm-card-check b{font-size:.6875rem;font-variant-numeric:tabular-nums}
.adm-card[aria-pressed="true"] .adm-card-check{opacity:1;transform:none}
.adm-card-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.75rem;color:var(--ink)}
.adm-card-use{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.6875rem;color:var(--ink-mute)}
.adm-card-use[data-used="false"]{color:oklch(0.8 0.12 70)}
.adm-card-skel{aspect-ratio:4/3;border-radius:.5rem;background:oklch(0.93 0.012 80 / .05);animation:adm-pulse 1.4s ease-in-out infinite}
.adm-more-row{display:flex;justify-content:center;padding-top:.5rem}
.adm-pk-up{display:grid;gap:1rem}
.adm-pk-link{display:grid;gap:1rem;max-width:36rem}
.adm-link-prev{overflow:hidden;border-radius:.6rem;background:var(--stage-deep);box-shadow:inset 0 0 0 1px var(--ink-faint)}
.adm-link-prev img{display:block;max-width:100%;max-height:16rem;margin-inline:auto}
.adm-link-prev[data-ok="false"] img{display:none}
.adm-link-warn{margin:0;padding:1rem;font-size:var(--step--1);color:oklch(0.8 0.12 70)}
.adm-empty-drop{display:grid;justify-items:center;text-align:center;gap:.25rem}
.adm-empty-drop svg{font-size:2rem;color:var(--ink-mute)}

/* Library panel */
.adm-cardw{position:relative}
.adm-cardw[data-selected="true"] .adm-card-img{box-shadow:0 0 0 2px var(--accent)}
.adm-card-sel{position:absolute;inset-block-start:0;inset-inline-start:0;display:grid;place-items:center;width:2.75rem;height:2.75rem;padding:0;border:0;background:none;cursor:pointer;opacity:0;transition:opacity .12s linear}
.adm-card-sel svg{box-sizing:content-box;width:.95rem;height:.95rem;padding:.2rem;border-radius:50%;border:1.5px solid #fff;background:oklch(0.08 0.01 215 / .55);color:transparent;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.adm-card-sel[aria-checked="true"] svg{background:var(--accent);border-color:var(--accent);color:oklch(0.12 0.014 215)}
.adm-cardw:hover .adm-card-sel,.adm-card-sel:focus-visible,.adm-cardw[data-any="true"] .adm-card-sel,.adm-card-sel[aria-checked="true"]{opacity:1}
@media (hover:none),(pointer:coarse){.adm-card-sel{opacity:1}}
.adm-selbar{position:sticky;bottom:max(.75rem,env(safe-area-inset-bottom));z-index:6;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.25rem 1rem;margin-top:1.25rem;padding:.5rem .6rem .5rem 1rem;
padding-inline:1rem .6rem;border:1px solid oklch(0.93 0.012 80 / .2);border-radius:.9rem;background:oklch(0.17 0.016 var(--hue,215) / .86);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);
box-shadow:0 18px 40px -16px oklch(0 0 0 / .8);animation:adm-toast-in .35s var(--ease-out-quint) both}
.adm-selbar-n{font-size:var(--step--1);color:var(--ink)}
.adm-selbar-warn{color:oklch(0.8 0.12 70)}
.adm-selbar-acts{display:flex;flex-wrap:wrap;align-items:center;gap:0 .9rem}

/* File sheet */
.adm-sheet{display:grid;gap:1.25rem}
@media (min-width:48rem){.adm-sheet{grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);align-items:start}}
.adm-sheet-prev{display:grid;place-items:center;overflow:hidden;border-radius:.6rem;background:var(--stage-deep);box-shadow:inset 0 0 0 1px var(--ink-faint);min-height:12rem}
.adm-sheet-prev img,.adm-sheet-prev video{display:block;max-width:100%;max-height:min(60dvh,32rem)}
.adm-sheet-side{display:grid;gap:1.1rem;min-width:0}
.adm-facts{margin:0;display:grid;gap:.5rem}
.adm-facts>div{display:grid;grid-template-columns:6.5rem minmax(0,1fr);gap:.5rem;font-size:var(--step--1)}
.adm-facts dt{color:var(--ink-mute)}
.adm-facts dd{margin:0;color:var(--ink);overflow-wrap:anywhere;text-align:start}
.adm-sheet-uses ul{margin:.4rem 0 0;padding:0;list-style:none;display:grid;gap:.1rem}
.adm-sheet-uses a{display:inline-flex;align-items:center;min-height:2.75rem;color:var(--ink-dim);text-decoration:underline;text-decoration-color:var(--hairline);text-underline-offset:.25em;font-size:var(--step--1)}
.adm-sheet-uses a:hover{color:var(--ink);text-decoration-color:currentColor}
.adm-sheet-acts{display:flex;flex-wrap:wrap;gap:.5rem}

.adm-row-plain{display:block;padding:clamp(.7rem,1.4vw,1rem) 0}
.adm-lib[data-over="true"]{min-height:16rem}

@media (prefers-reduced-motion:reduce){
.adm-toast,.adm-selbar,.adm-mdl[open],.adm-q-row,.adm-if-details,.adm-q-check,.adm-drop-veil{animation:adm-fade .15s linear both}
.adm-card-check,.adm-caret,.adm-tab::after,.adm-q-bar>span,.adm-ili-bar>span,.adm-card-img{transition:none}
.adm-btn:active:not(:disabled),.adm-zone:active:not(:disabled),.adm-card:active .adm-card-img,.adm-toast-btn:active{transform:none}
.adm-card-skel{animation:none}
}
@media (prefers-reduced-transparency:reduce){
.adm-toast,.adm-selbar,.adm-mdl-head,.adm-mdl-foot,.adm-drop-veil,.adm-if-drop,.adm-card-sel svg{-webkit-backdrop-filter:none;backdrop-filter:none}
.adm-toast,.adm-selbar{background:var(--stage-raised)}
.adm-mdl-head,.adm-mdl-foot{background:var(--stage)}
.adm-drop-veil,.adm-if-drop{background:var(--stage)}
}
`;
