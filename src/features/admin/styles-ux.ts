/**
 * Admin UX layer, loaded after styles.ts / styles-nav.ts so it can restyle shared pieces
 * (buttons, fields, nav, rows) without touching every editor. Prefix `ux-`.
 *
 * Scale: spacing 4 / 8 / 12 / 16 / 24 / 32 / 48 px; type = the site's --step vars; radius .6rem
 * (controls) and .9rem (surfaces). Motion: transform + opacity only, ~.3s spring-like curve,
 * instant on press, none for keyboard tools. Logical properties only (fa mirrors).
 */
export const ADMIN_CSS_UX = `
.adm{
--ux-surface:oklch(0.93 0.012 80 / .045);
--ux-surface-2:oklch(0.93 0.012 80 / .085);
--ux-line:oklch(0.93 0.012 80 / .3);
--ux-danger:oklch(0.8 0.12 28);
--ux-on-accent:oklch(0.14 0.014 215);
--ux-glass:color-mix(in oklab,var(--stage) 78%,transparent);
--ux-glass-blur:blur(18px) saturate(1.5);
--ux-spring:linear(0,.28 8%,.62 17%,.84 27%,.95 38%,.99 52%,1);
--ux-bar-offset:0px;
}
@media (prefers-reduced-transparency:reduce){.adm{--ux-glass:var(--stage-raised);--ux-glass-blur:none}}
@media (prefers-contrast:more){.adm{--ux-glass:var(--stage-raised);--ux-glass-blur:none;--ux-line:oklch(0.93 0.012 80 / .6)}}
.adm{padding-bottom:clamp(5rem,12vh,8rem)}
@media (max-width:55.99rem){.adm{padding-bottom:calc(6.5rem + env(safe-area-inset-bottom))}}

/* ---------- Skip link, kbd, icon buttons ---------- */
.ux-skip{position:absolute;inset-inline-start:var(--gutter);top:.75rem;z-index:90;padding:.7rem 1rem;border-radius:.6rem;background:var(--accent);
color:var(--ux-on-accent);font-weight:600;text-decoration:none;transform:translateY(-200%)}
.ux-skip:focus{transform:none;outline:2px solid var(--ink);outline-offset:2px}
.ux-kbd{display:inline-flex;align-items:center;justify-content:center;min-width:1.4rem;padding:.08rem .38rem;border-radius:.35rem;
border:1px solid var(--hairline);background:oklch(0.93 0.012 80 / .06);color:var(--ink-dim);font:600 .6875rem/1.4 var(--font-sans);
letter-spacing:0;vertical-align:middle}
.ux-btn[data-primary="true"] .ux-kbd{border-color:oklch(0.14 0.014 215 / .35);background:oklch(0.14 0.014 215 / .12);color:var(--ux-on-accent)}
.ux-x{display:inline-grid;place-items:center;flex:none;width:2.75rem;height:2.75rem;margin-inline-end:-.5rem;border:0;border-radius:.6rem;background:none;
color:var(--ink-dim);cursor:pointer;font-size:1.1rem;transition:background-color .14s linear,color .14s linear,transform .14s var(--ux-spring)}
.ux-x:hover{background:var(--ux-surface-2);color:var(--ink)}
.ux-x:active{transform:scale(.92);transition-duration:.04s}
.ux-x:focus-visible,.ux-icon:focus-visible,.ux-link:focus-visible,.ux-pwtoggle:focus-visible,.ux-switch:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ux-icon{display:inline-grid;place-items:center;width:2.75rem;height:2.75rem;border:0;border-radius:.6rem;background:none;color:var(--ink-mute);
cursor:pointer;font-size:1.05rem;transition:background-color .14s linear,color .14s linear,transform .14s var(--ux-spring)}
@media (hover:hover){.ux-icon:hover:not(:disabled){background:var(--ux-surface-2);color:var(--ink)}}
.ux-icon:active:not(:disabled){transform:scale(.92);transition-duration:.04s}
.ux-icon:disabled{opacity:.3;cursor:default}
.ux-link{border:0;background:none;padding:.5rem 0;min-height:2.75rem;display:inline-flex;align-items:center;color:var(--ink-dim);font:500 var(--step--1)/1.2 var(--font-sans);
cursor:pointer;text-decoration:underline;text-decoration-color:var(--hairline);text-underline-offset:.25em;transition:color .12s linear}
.ux-link:hover{color:var(--ink);text-decoration-color:currentColor}
.ux-link:disabled{opacity:.45;cursor:default}

/* ---------- Buttons: one family everywhere ---------- */
.ux-btn,.adm .lbf-cta{display:inline-flex;align-items:center;justify-content:center;gap:.5rem;min-height:2.75rem;padding:.45rem 1.1rem;
border:1px solid var(--hairline);border-radius:.6rem;background:var(--ux-surface);color:var(--ink);font:500 var(--step--1)/1.2 var(--font-sans);
text-decoration:none;white-space:nowrap;cursor:pointer;-webkit-tap-highlight-color:transparent;
transition:background-color .14s linear,border-color .14s linear,color .14s linear,transform .16s var(--ux-spring)}
.adm .lbf-cta{background:var(--accent);color:var(--ux-on-accent);border-color:transparent;font-weight:600;letter-spacing:0}
.adm .lbf-cta::after{display:none}
.adm .lbf-cta>span{display:contents}
@media (hover:hover){
.ux-btn:hover:not(:disabled){background:var(--ux-surface-2);border-color:var(--ux-line)}
.adm .lbf-cta:hover:not(:disabled){filter:brightness(1.1)}
}
.ux-btn:active:not(:disabled),.adm .lbf-cta:active:not(:disabled){transform:scale(.97);transition-duration:.04s}
.ux-btn[data-primary="true"]{background:var(--accent);color:var(--ux-on-accent);border-color:transparent;font-weight:600}
@media (hover:hover){.ux-btn[data-primary="true"]:hover:not(:disabled){background:var(--accent);filter:brightness(1.1)}}
.ux-btn[data-quiet="true"]{background:transparent;border-color:transparent;color:var(--ink-dim)}
@media (hover:hover){.ux-btn[data-quiet="true"]:hover:not(:disabled){background:var(--ux-surface-2);color:var(--ink)}}
.ux-btn[data-tone="danger"]{color:var(--ux-danger)}
@media (hover:hover){.ux-btn[data-tone="danger"]:hover:not(:disabled){border-color:oklch(0.8 0.12 28 / .5);background:oklch(0.8 0.12 28 / .08)}}
.ux-btn:disabled,.adm .lbf-cta:disabled{opacity:.5;cursor:default;filter:none}
.ux-btn[data-primary="true"]:disabled,.adm .lbf-cta:disabled{background:var(--ux-surface-2);color:var(--ink-mute);opacity:1;border-color:var(--hairline)}
.ux-btn[aria-busy="true"],.adm .lbf-cta:disabled{cursor:progress}
.ux-btn:focus-visible,.adm .lbf-cta:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ux-btn[data-primary="true"]:focus-visible,.adm .lbf-cta:focus-visible{outline-color:var(--ink)}
.ux-btn-ico{font-size:1.05em;flex:none}
[dir="rtl"] .ux-btn-ico[data-flip]{transform:scaleX(-1)}
.adm .lbf-textbtn{border-radius:.4rem}
.adm .lbf-textbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

/* ---------- Fields: boxed, so they look editable ---------- */
.adm .lbf-input{padding:.7rem .85rem;border-radius:.6rem;background:var(--ux-surface);box-shadow:inset 0 0 0 1px var(--hairline);
transition:box-shadow .16s linear,background-color .16s linear}
.adm .lbf-input:hover{box-shadow:inset 0 0 0 1px var(--ux-line)}
.adm .lbf-input:focus{background:oklch(0.93 0.012 80 / .07);box-shadow:inset 0 0 0 2px var(--accent)}
.adm .lbf-input[aria-invalid="true"]{box-shadow:inset 0 0 0 2px var(--ux-danger)}
.adm select.lbf-input{padding-inline-end:2.4rem;background-position:calc(100% - 17px) 55%,calc(100% - 12px) 55%}
[dir="rtl"] .adm select.lbf-input{background-position:17px 55%,12px 55%}
.adm textarea.lbf-input{min-height:6rem}
.adm .lbf-label{font-size:var(--step--1);color:var(--ink-dim);font-weight:600}
.adm .lbf-error{display:flex;gap:.4rem;align-items:baseline}
.adm .lbf-error:not(:empty)::before{content:"!";flex:none;display:inline-grid;place-items:center;width:1.05rem;height:1.05rem;border-radius:50%;
background:var(--ux-danger);color:var(--ux-on-accent);font:700 .7rem/1 var(--font-sans);transform:translateY(.1rem)}
.adm .lbf-error:empty{display:none}
.adm .lbf-check input{width:1.5rem;height:1.5rem;border-radius:.4rem}
.adm .lbf-check input::after{width:.7rem;height:.7rem;border-radius:.15rem}
.adm .lbf-check{min-height:2.75rem;padding-block:.15rem}

/* ---------- Header ---------- */
.ux-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:1rem var(--gutter);margin-bottom:clamp(1.5rem,4vh,2.25rem)}
.ux-head-title{min-width:0}
.ux-head .adm-h1{font-size:var(--step-2);line-height:1;color:var(--ink)}
.ux-head .adm-lede{margin-top:.5rem;font-size:var(--step--1)}
.ux-head-acts{display:flex;align-items:center;gap:.25rem;grid-column:2;grid-row:1}
.ux-head-acts form{margin:0}
.ux-search{grid-column:1/-1;grid-row:2;display:flex;align-items:center;gap:.75rem;width:100%;min-height:3rem;padding:.5rem .6rem .5rem .95rem;border:1px solid var(--hairline);
border-radius:.8rem;background:var(--ux-surface);color:var(--ink-mute);font:400 var(--step-0)/1.2 var(--font-sans);text-align:start;cursor:pointer;
transition:background-color .14s linear,border-color .14s linear,transform .16s var(--ux-spring)}
.ux-search:hover{background:var(--ux-surface-2);border-color:var(--ux-line);color:var(--ink-dim)}
.ux-search:active{transform:scale(.99);transition-duration:.04s}
.ux-search:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ux-search-ico{font-size:1.15rem;flex:none}
.ux-search-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (min-width:56rem){
.ux-head{grid-template-columns:minmax(0,1fr) minmax(16rem,26rem) auto}
.ux-search{grid-column:2;grid-row:1}
.ux-head-acts{grid-column:3}
}
.ux-kbd:empty{display:none}
@media (hover:none),(pointer:coarse),(max-width:40rem){.ux-search .ux-kbd,.ux-btn .ux-kbd,.ux-hint-kbd,.ux-tip-keys,.ux-tip kbd,.ux-tip-inline kbd{display:none}.ux-tip span:has(>kbd){display:none}}

/* ---------- Sidebar ---------- */
@media (min-width:56rem){.adm-shell{grid-template-columns:15rem minmax(0,1fr)}}
@media (max-width:55.99rem){.adm-side{display:none}}
.adm-nav{gap:1.25rem}
@media (min-width:56rem){.adm-nav{padding-bottom:3.5rem}}
.adm-nav-group+.adm-nav-group{padding-top:1.1rem;border-top:1px solid var(--hairline)}
.adm-nav-title{margin:0 0 .35rem;padding-inline:.75rem;font-size:.75rem;letter-spacing:.05em}
.adm-nav-list{border:0;display:grid;gap:.125rem}
.adm-nav-item{gap:.7rem;padding:.4rem .75rem;border-radius:.6rem;font-size:var(--step--1);font-weight:500;color:var(--ink-dim);
transition:color .12s linear,background-color .12s linear,transform .16s var(--ux-spring)}
.adm-nav-item::before{display:none}
.adm-nav-ico{font-size:1.2rem;color:var(--ink-mute);flex:none;transition:color .12s linear}
.adm-nav-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (hover:hover){.adm-nav-item:hover{background:var(--ux-surface);color:var(--ink)}}
.adm-nav-item:active{transform:scale(.98);transition-duration:.04s}
.adm-nav-item[aria-current="page"]{background:var(--ux-surface-2);color:var(--ink)}
.adm-nav-item[aria-current="page"] .adm-nav-ico{color:var(--accent)}
.adm-nav-item:focus-visible{outline-offset:-2px;border-radius:.6rem}
.adm-tab-count{display:inline-grid;place-items:center;min-width:1.5rem;height:1.5rem;padding-inline:.4rem;border-radius:.75rem;background:var(--ux-surface-2);font-size:.75rem;font-weight:600;color:var(--ink-dim)}
.adm-tab-count[data-lit="true"]{background:var(--accent);color:var(--ux-on-accent)}

/* ---------- Panel header: title + sentence, then View on site, then the primary action ---------- */
.adm-panel{animation:ux-in .3s var(--ease-out-quint) both}
.adm-panel-head{align-items:flex-end;margin-bottom:1.5rem;gap:1rem var(--gutter)}
.adm-panel-titles{min-width:0;flex:1 1 20rem}
.ux-acts{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-inline-start:auto}
.adm-h2{font-size:var(--step-2);letter-spacing:-.01em}
.adm-sub{margin-top:.55rem;font-size:var(--step-0);line-height:1.45;color:var(--ink-mute);max-width:62ch}
.ux-h3{margin:0;font:600 var(--step-0)/1.3 var(--font-sans);color:var(--ink)}
@keyframes ux-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

/* ---------- Save bar (the one explicit-save pattern) ---------- */
.ux-bar,.adm-savebar,.adm-bar{position:sticky;bottom:calc(var(--ux-bar-offset) + .75rem);z-index:20;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
gap:.5rem 1rem;margin-top:1.5rem;padding:.65rem .75rem .65rem 1.1rem;border:1px solid var(--ux-line);border-radius:.9rem;
background:var(--ux-glass);-webkit-backdrop-filter:var(--ux-glass-blur);backdrop-filter:var(--ux-glass-blur);
box-shadow:0 18px 40px -16px oklch(0 0 0 / .65);animation:ux-bar-in .32s var(--ux-spring) both}
.ux-bar[data-state="saved"]{border-color:oklch(0.7 0.1 210 / .6)}
.ux-bar-text{display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .65rem;margin:0;font-size:var(--step--1);color:var(--ink-dim);min-width:0}
.ux-bar-text strong{color:var(--ink);font-weight:600}
.ux-bar-dot{width:.55rem;height:.55rem;border-radius:50%;background:var(--accent);flex:none;box-shadow:0 0 0 3px oklch(0.7 0.1 210 / .22)}
.ux-bar-ico{color:var(--accent);font-size:1.15rem}
.ux-bar-acts{display:flex;align-items:center;gap:.5rem;margin-inline-start:auto}
@keyframes ux-bar-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.ux-foot-dirty{display:inline-flex;align-items:center;gap:.5rem;font-size:var(--step--1);color:var(--ink-dim)}
@media (max-width:55.99rem){.adm{--ux-bar-offset:calc(3.75rem + env(safe-area-inset-bottom))}}

/* ---------- Switch ---------- */
.ux-switch{display:inline-flex;align-items:center;gap:.6rem;min-height:2.75rem;padding:0 .35rem;border:0;border-radius:.6rem;background:none;color:var(--ink-dim);
font:500 var(--step--1)/1.2 var(--font-sans);cursor:pointer;-webkit-tap-highlight-color:transparent}
.ux-switch-track{position:relative;flex:none;width:2.6rem;height:1.55rem;border-radius:.8rem;background:oklch(0.93 0.012 80 / .16);
transition:background-color .2s linear}
.ux-switch-thumb{position:absolute;inset-block-start:.19rem;inset-inline-start:.19rem;width:1.17rem;height:1.17rem;border-radius:50%;background:var(--ink);
box-shadow:0 1px 3px oklch(0 0 0 / .5);transition:transform .32s var(--ux-spring)}
.ux-switch[aria-checked="true"] .ux-switch-track{background:var(--accent)}
.ux-switch[aria-checked="true"] .ux-switch-thumb{transform:translateX(1.05rem);background:var(--ux-on-accent)}
[dir="rtl"] .ux-switch[aria-checked="true"] .ux-switch-thumb{transform:translateX(-1.05rem)}
.ux-switch:active .ux-switch-thumb{width:1.4rem}
.ux-switch:disabled{opacity:.6;cursor:progress}
.ux-switch-text{min-width:3.6rem;text-align:start}
@media (hover:hover){.ux-switch:hover:not(:disabled){color:var(--ink)}}

/* ---------- Empty + loading ---------- */
.ux-empty{display:grid;justify-items:start;gap:.6rem;padding:clamp(2rem,6vh,3.25rem) clamp(1.25rem,4vw,2.5rem);border:1px dashed var(--ux-line);border-radius:.9rem;background:var(--ux-surface)}
.ux-empty-ico{display:grid;place-items:center;width:3rem;height:3rem;border-radius:.8rem;background:var(--ux-surface-2);color:var(--accent);font-size:1.4rem}
.ux-empty-title{margin:.25rem 0 0;font:400 var(--step-1)/1.15 var(--font-display);color:var(--ink)}
.ux-empty-text{margin:0 0 .6rem;max-width:48ch;font-size:var(--step--1);line-height:1.5;color:var(--ink-mute)}
.ux-skels{display:grid;gap:.5rem}
.ux-skel{height:4.6rem;border:1px solid var(--hairline);border-radius:.7rem;background:linear-gradient(100deg,var(--ux-surface) 30%,var(--ux-surface-2) 50%,var(--ux-surface) 70%) 0 0/300% 100%;
animation:ux-shimmer 1.4s linear infinite}
@keyframes ux-shimmer{to{background-position:-300% 0}}

/* ---------- Collection rows ---------- */
.adm-list{display:block}
.adm-item{margin-bottom:.5rem;border:1px solid var(--hairline);border-radius:.8rem;background:var(--ux-surface);
transition:border-color .16s linear,background-color .16s linear,box-shadow .2s linear}
.adm-item:last-child{border-bottom:1px solid var(--hairline);margin-bottom:0}
.adm-item[data-current="true"]{border-color:oklch(0.7 0.1 210 / .6);background:oklch(0.7 0.1 210 / .07)}
.adm-item[data-dragging="true"]{border-color:var(--accent);background:var(--stage-raised)}
@media (hover:hover){.adm-item:hover{border-color:var(--ux-line)}}
.ux-row{display:grid;grid-template-columns:auto auto minmax(0,1fr);grid-template-areas:"grip thumb main" "acts acts acts";align-items:center;
gap:.5rem clamp(.6rem,1.4vw,1rem);padding:.65rem clamp(.5rem,1.4vw,1rem) .65rem .25rem}
@media (min-width:40.01rem){.ux-row{grid-template-areas:"grip thumb main" ". . acts"}}
@media (min-width:75rem){.ux-row{grid-template-columns:auto auto minmax(12rem,1fr) auto;grid-template-areas:"grip thumb main acts"}}
.ux-row .adm-thumb{grid-area:thumb;width:clamp(4.25rem,8vw,6rem);border-radius:.5rem}
.ux-row:not(:has(.adm-thumb)){grid-template-columns:auto minmax(0,1fr)}
.ux-row:not(:has(.adm-thumb)){grid-template-areas:"grip main" "acts acts"}
@media (min-width:40.01rem){.ux-row:not(:has(.adm-thumb)){grid-template-areas:"grip main" ". acts"}}
@media (min-width:75rem){.ux-row:not(:has(.adm-thumb)){grid-template-columns:auto minmax(12rem,1fr) auto;grid-template-areas:"grip main acts"}}
.ux-grip{grid-area:grip;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:.1rem;min-width:2.75rem;min-height:2.75rem;
border-radius:.6rem;color:var(--ink-mute);cursor:grab;font-size:1.15rem;touch-action:manipulation;transition:background-color .14s linear,color .14s linear}
@media (hover:hover){.ux-grip:hover{background:var(--ux-surface-2);color:var(--ink)}}
.ux-grip:active{cursor:grabbing;color:var(--accent)}
.ux-grip:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.ux-grip-n{font-size:.6875rem;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ink-mute);line-height:1}
.ux-row-main{grid-area:main;min-width:0}
.ux-row-title{margin:0;font:600 var(--step-0)/1.3 var(--font-sans);color:var(--ink);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow-wrap:anywhere;cursor:pointer}
.ux-row[data-off="true"] .ux-row-title{color:var(--ink-dim)}
.ux-row-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.2rem .75rem;margin:.3rem 0 0;font-size:var(--step--1);color:var(--ink-mute)}
.ux-pill{display:inline-flex;align-items:center;gap:.4rem;padding:.12rem .55rem;border-radius:1rem;font-size:.75rem;font-weight:600;line-height:1.4;
background:var(--ux-surface-2);color:var(--ink-dim)}
.ux-pill::before{content:"";width:.45rem;height:.45rem;border-radius:50%;border:1.5px solid currentColor}
.ux-pill[data-on="true"]{background:oklch(0.7 0.1 210 / .16);color:var(--ink)}
.ux-pill[data-on="true"]::before{background:var(--accent);border-color:var(--accent)}
.ux-row-acts{grid-area:acts;display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .5rem;justify-content:flex-start}
@media (min-width:75rem){.ux-row-acts{justify-content:flex-end;flex-wrap:nowrap}}
.ux-move{display:inline-flex}
@media (min-width:40.01rem){.ux-row .ux-switch-text{min-width:5.75rem}}
@media (max-width:40rem){.ux-row .ux-switch-text{display:none}.ux-row-acts{gap:.1rem .25rem}.ux-row-acts .ux-btn{padding-inline:.9rem}}
.ux-tip{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem;margin:1rem 0 0;font-size:var(--step--1);color:var(--ink-mute)}
.adm-thumb{border-radius:.5rem}

/* ---------- Dashboard ---------- */
.ux-dash-block{margin-bottom:clamp(2rem,5vh,3rem)}
.ux-dash-block>.ux-h3{margin-bottom:1rem;font-size:var(--step-1);font-weight:400;font-family:var(--font-display)}
.ux-launch{margin:0;padding:0;list-style:none;display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,19rem),1fr))}
.ux-task{position:relative;display:flex;align-items:center;gap:1rem;width:100%;min-height:5.5rem;padding:1rem 1.1rem;border:1px solid var(--hairline);border-radius:.9rem;
background:var(--ux-surface);color:var(--ink);text-align:start;cursor:pointer;-webkit-tap-highlight-color:transparent;
transition:background-color .14s linear,border-color .14s linear,transform .18s var(--ux-spring)}
@media (hover:hover){.ux-task:hover{background:var(--ux-surface-2);border-color:var(--ux-line)}.ux-task:hover .ux-task-go{transform:translateX(3px)}[dir="rtl"] .ux-task:hover .ux-task-go{transform:translateX(-3px) scaleX(-1)}}
.ux-task:active{transform:scale(.98);transition-duration:.04s}
.ux-task:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ux-task-ico{display:grid;place-items:center;flex:none;width:3rem;height:3rem;border-radius:.8rem;background:oklch(0.7 0.1 210 / .14);color:var(--accent);font-size:1.45rem}
.ux-task-text{display:grid;gap:.2rem;min-width:0;flex:1}
.ux-task-title{font:600 var(--step-0)/1.25 var(--font-sans)}
.ux-task-sub{font-size:var(--step--1);line-height:1.4;color:var(--ink-mute)}
.ux-task-badge{display:inline-grid;place-items:center;min-width:1.6rem;height:1.6rem;padding-inline:.45rem;border-radius:.8rem;background:var(--accent);color:var(--ux-on-accent);font-size:.8125rem;font-weight:700}
.ux-task-go{color:var(--ink-mute);flex:none;transition:transform .2s var(--ux-spring)}
[dir="rtl"] .ux-task-go{transform:scaleX(-1)}
.ux-hint-kbd{margin:1rem 0 0;font-size:var(--step--1);color:var(--ink-mute)}
.ux-glance{margin:0;padding:0;list-style:none;display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,10.5rem),1fr))}
.ux-glance>li{display:flex;min-width:0}
.ux-stat{display:grid;align-content:start;gap:.15rem;width:100%;padding:.95rem 1rem;border:1px solid var(--hairline);border-radius:.8rem;background:transparent;color:var(--ink);text-align:start;cursor:pointer;
transition:background-color .14s linear,border-color .14s linear,transform .16s var(--ux-spring)}
@media (hover:hover){.ux-stat:hover{background:var(--ux-surface);border-color:var(--ux-line)}}
.ux-stat:active{transform:scale(.98);transition-duration:.04s}
.ux-stat:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ux-stat-v{font:400 var(--step-2)/1 var(--font-display);font-variant-numeric:tabular-nums}
.ux-stat[data-lit="true"] .ux-stat-v{color:var(--accent)}
.ux-stat-l{margin-top:.35rem;font-size:var(--step--1);font-weight:600;color:var(--ink-dim)}
.ux-stat-n{font-size:.8125rem;color:var(--ink-mute)}
.ux-recent{margin:0;padding:0;list-style:none;border:1px solid var(--hairline);border-radius:.9rem;overflow:hidden}
.ux-recent-item{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.15rem 1rem;padding:.8rem 1.1rem;font-size:var(--step--1)}
.ux-recent-item+.ux-recent-item{border-top:1px solid var(--hairline)}
.ux-recent-what{color:var(--ink);min-width:0;overflow-wrap:anywhere}
.ux-recent-target{color:var(--ink-mute)}
.ux-recent-when{color:var(--ink-mute);white-space:nowrap}

/* ---------- Page text ---------- */
.ux-pages{display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1.25rem}
.ux-page{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;padding:.4rem .95rem .4rem .8rem;border:1px solid var(--hairline);border-radius:1.4rem;background:transparent;
color:var(--ink-dim);font:500 var(--step--1)/1.2 var(--font-sans);cursor:pointer;-webkit-tap-highlight-color:transparent;
transition:background-color .14s linear,border-color .14s linear,color .14s linear,transform .16s var(--ux-spring)}
@media (hover:hover){.ux-page:hover{background:var(--ux-surface);color:var(--ink)}}
.ux-page:active{transform:scale(.97);transition-duration:.04s}
.ux-page[aria-pressed="true"]{background:var(--ux-surface-2);border-color:var(--accent);color:var(--ink)}
.ux-page:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ux-page-ico{font-size:1.1rem;color:var(--ink-mute)}
.ux-page[aria-pressed="true"] .ux-page-ico{color:var(--accent)}
.ux-page-mod{display:inline-grid;place-items:center;min-width:1.35rem;height:1.35rem;padding-inline:.3rem;border-radius:.7rem;background:var(--accent);color:var(--ux-on-accent);font-size:.6875rem;font-weight:700}
.ux-pagecard{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:.75rem 1rem;margin:0 0 1rem;padding:1.1rem 1.25rem;border:1px solid var(--hairline);border-radius:.9rem;background:var(--ux-surface)}
.ux-pagecard-text{min-width:0;flex:1 1 18rem}
.ux-pagecard .adm-sub{margin-top:.25rem;font-size:var(--step--1)}
.adm-ctools{align-items:end}
.adm-csearch{flex:1 1 18rem}
.adm-cgroups{gap:.5rem}
.adm-cgroup{border:1px solid var(--hairline);border-radius:.9rem;background:var(--ux-surface);overflow:hidden}
.adm-cgroup:last-child{border-bottom:1px solid var(--hairline)}
.adm-cgroup-btn{padding:.6rem 1rem;min-height:3.25rem;font-weight:600;font-size:var(--step--1);transition:background-color .14s linear}
@media (hover:hover){.adm-cgroup-btn:hover{background:var(--ux-surface)}}
.adm-cgroup-btn:focus-visible{outline-offset:-2px}
.ux-cg-name{font-weight:600;color:var(--ink);flex:none}
.ux-cg-peek{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400;color:var(--ink-mute)}
.adm-cgroup-n{display:inline-flex;align-items:center;gap:.6rem;margin-inline-start:auto;flex:none}
.ux-cg-mod{color:var(--accent);font-weight:600}
.ux-cg-uns{color:oklch(0.84 0.12 80);font-weight:600}
.adm-cgroup .adm-crows{padding:0 1rem 1rem}
.adm-crow{padding:1.1rem 0;gap:.7rem}
.adm-crow[data-found="true"]{animation:ux-found 2s var(--ease-out-quint) both}
@keyframes ux-found{0%,40%{background:oklch(0.7 0.1 210 / .16)}100%{background:transparent}}
.ux-crow-label{display:flex;flex-wrap:wrap;align-items:baseline;gap:.2rem .75rem;margin:0;font:600 var(--step--1)/1.3 var(--font-sans);color:var(--ink)}
.ux-crow-key{font:400 .75rem/1.3 var(--font-mono,ui-monospace,monospace);color:var(--ink-mute)}
.adm-crow[data-unsaved="true"]{padding-inline-start:1rem}
.adm-crow[data-unsaved="true"]::before{width:3px;border-radius:2px}
.adm-more{margin-top:.75rem}

/* ---------- Inbox ---------- */
.ux-inbox-tools{display:flex;flex-wrap:wrap;align-items:flex-end;gap:1rem var(--gutter);margin-bottom:1rem}
.ux-inbox-search{flex:1 1 18rem}
.ux-seg{display:inline-flex;padding:.25rem;gap:.25rem;border-radius:.8rem;background:var(--ux-surface);border:1px solid var(--hairline)}
.ux-seg-btn{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;padding:.3rem .9rem;border:0;border-radius:.6rem;background:none;color:var(--ink-dim);
font:500 var(--step--1)/1.2 var(--font-sans);cursor:pointer;transition:background-color .14s linear,color .14s linear,transform .16s var(--ux-spring)}
.ux-seg-btn:active{transform:scale(.97);transition-duration:.04s}
.ux-seg-btn[aria-pressed="true"]{background:var(--ux-surface-2);color:var(--ink);box-shadow:inset 0 0 0 1px var(--ux-line)}
.ux-seg-btn:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.ux-seg-n{font-variant-numeric:tabular-nums;color:var(--ink-mute);font-size:.8125rem}
.ux-bulk{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.25rem 1rem;min-height:3rem;margin:0 0 .5rem;padding:.1rem .9rem;border-radius:.8rem}
.ux-bulk:has(.ux-bulk-acts){background:oklch(0.7 0.1 210 / .1);box-shadow:inset 0 0 0 1px oklch(0.7 0.1 210 / .35)}
.ux-bulk-acts{display:inline-flex;flex-wrap:wrap;gap:.5rem;padding-block:.25rem}
.ux-tip-inline{display:inline-flex;flex-wrap:wrap;gap:.25rem 1.25rem;font-size:var(--step--1);color:var(--ink-mute)}
.ux-msgs{margin:0;padding:0;list-style:none;display:grid;gap:.5rem}
.ux-msg{border:1px solid var(--hairline);border-radius:.9rem;background:var(--ux-surface);overflow:hidden;transition:border-color .16s linear,background-color .16s linear}
.ux-msg[data-read="false"]{border-color:oklch(0.7 0.1 210 / .45);background:oklch(0.7 0.1 210 / .06)}
.ux-msg[data-open="true"]{border-color:var(--ux-line);background:var(--stage-raised)}
.ux-msg[data-selected="true"]{box-shadow:inset 0 0 0 2px var(--accent)}
.ux-msg-head{display:flex;align-items:center}
.ux-msg-check{display:inline-grid;place-items:center;flex:none;width:3rem;min-height:3.5rem;cursor:pointer}
.ux-check{appearance:none;margin:0;width:1.5rem;height:1.5rem;border:1.5px solid var(--ux-line);border-radius:.35rem;background:transparent;cursor:pointer;display:grid;place-content:center}
.ux-check::after{content:"";width:.7rem;height:.7rem;border-radius:.15rem;background:var(--accent);transform:scale(0);transition:transform .2s var(--ux-spring)}
.ux-check:checked{border-color:var(--accent)}
.ux-check:checked::after{transform:scale(1)}
.ux-check:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.ux-msg-btn{display:grid;grid-template-columns:auto minmax(7rem,12rem) minmax(0,1fr) auto;align-items:center;gap:.75rem;flex:1;min-width:0;min-height:3.5rem;padding:.4rem 1rem .4rem .25rem;
border:0;background:none;color:var(--ink);text-align:start;font:400 var(--step--1)/1.35 var(--font-sans);cursor:pointer}
.ux-msg-btn:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:.9rem}
@media (hover:hover){.ux-msg-btn:hover{background:var(--ux-surface)}}
.ux-msg-dot{width:.6rem;height:.6rem;border-radius:50%;background:transparent}
.ux-msg-dot[data-on="true"]{background:var(--accent);box-shadow:0 0 0 3px oklch(0.7 0.1 210 / .22)}
.ux-msg-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;color:var(--ink-dim)}
.ux-msg[data-read="false"] .ux-msg-name{font-weight:700;color:var(--ink)}
.ux-msg-snip{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink-mute)}
.ux-msg[data-read="false"] .ux-msg-snip{color:var(--ink-dim)}
.ux-msg-date{color:var(--ink-mute);font-variant-numeric:tabular-nums;white-space:nowrap;font-size:.8125rem}
@media (max-width:40rem){
.ux-msg-btn{grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"dot name date" ". snip snip";row-gap:.15rem}
.ux-msg-dot{grid-area:dot}.ux-msg-name{grid-area:name}.ux-msg-snip{grid-area:snip}.ux-msg-date{grid-area:date}
}
.ux-msg-from{margin:0;font:600 var(--step-0)/1.35 var(--font-sans);color:var(--ink);overflow-wrap:anywhere;word-break:break-word}
.ux-msg[data-open="true"] .ux-msg-name{white-space:normal;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
.ux-msg-meta a,.ux-msg-meta span{overflow-wrap:anywhere;min-width:0}
.ux-msg-body{display:grid;gap:1rem;padding:.25rem 1.25rem 1.25rem 3.5rem}
@media (max-width:40rem){.ux-msg-body{padding:.25rem 1rem 1rem}}
.ux-msg-meta{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem;font-size:var(--step--1);color:var(--ink-mute)}
.ux-msg-meta a{color:var(--ink-dim);text-underline-offset:.2em;text-decoration-color:var(--hairline)}
.ux-msg-meta a:hover{color:var(--ink);text-decoration-color:currentColor}
.ux-msg .adm-sub-msg{max-width:68ch;font-size:var(--step-0);line-height:1.65;color:var(--ink)}
.ux-msg-acts{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem}
.ux-msg-nav{display:inline-flex;margin-inline-start:auto}

/* ---------- Settings ---------- */
.ux-jump{gap:.5rem;margin-bottom:1.5rem}
.ux-chip{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;padding:.3rem .9rem;border:1px solid var(--hairline);border-radius:1.4rem;background:transparent;color:var(--ink-dim);
font:500 var(--step--1)/1.2 var(--font-sans);cursor:pointer;transition:background-color .14s linear,color .14s linear,transform .16s var(--ux-spring)}
@media (hover:hover){.ux-chip:hover{background:var(--ux-surface);color:var(--ink)}}
.ux-chip:active{transform:scale(.97);transition-duration:.04s}
.ux-chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.adm-setcard{padding:1.5rem clamp(1rem,2.4vw,1.75rem);margin-bottom:1rem;border:1px solid var(--hairline);border-radius:.9rem;background:var(--ux-surface);scroll-margin-top:6rem}
.adm-setcard[data-dirty="true"]{border-color:oklch(0.7 0.1 210 / .5)}
.adm-setcard .adm-form{gap:1.4rem}
.adm-setcard .adm-group-h{font-family:var(--font-sans);font-weight:600;font-size:var(--step-1)}
.adm-setcard .adm-sub{font-size:var(--step--1);margin-top:.35rem}
.ux-setcard-foot{display:flex;justify-content:flex-start}
.ux-crosslink{display:flex;flex-wrap:wrap;gap:.25rem .5rem;align-items:center}
.adm-listed-item{border-top:0;padding:1rem;border:1px solid var(--hairline);border-radius:.8rem;background:oklch(0.93 0.012 80 / .025)}
.adm-listed-item[data-bad="true"]{border-color:var(--ux-danger);padding-inline-start:1rem}
.adm-listed-item[data-bad="true"]::before{display:none}
.adm-listed-head{margin-bottom:.25rem}
.adm-listed .adm-add{justify-self:start;display:inline-flex;align-items:center;min-height:2.75rem;padding:.45rem 1.1rem;border:1px solid var(--hairline);border-radius:.6rem;
background:var(--ux-surface);color:var(--ink);font:500 var(--step--1)/1.2 var(--font-sans);transition:background-color .14s linear,transform .16s var(--ux-spring)}
.adm-listed .adm-add:hover:not(:disabled){background:var(--ux-surface-2);color:var(--ink)}
.adm-listed .adm-add:active:not(:disabled){transform:scale(.97);transition-duration:.04s}
.adm-listed-items{gap:.75rem}
.adm-note{padding:.9rem 1rem;border:1px solid var(--hairline);border-radius:.8rem;background:var(--ux-surface)}

/* ---------- My account ---------- */
.adm-pw{max-width:30rem;gap:1.25rem}
.ux-pw-intro{margin:-.5rem 0 0}
.ux-pwfield{position:relative;display:flex;align-items:center}
.ux-pwfield .lbf-input{padding-inline-end:5.6rem}
.ux-pwtoggle{position:absolute;inset-inline-end:.25rem;display:inline-flex;align-items:center;gap:.4rem;min-height:2.75rem;padding:0 .8rem;border:0;border-radius:.5rem;background:none;
color:var(--ink-dim);font:500 var(--step--1)/1 var(--font-sans);cursor:pointer}
@media (hover:hover){.ux-pwtoggle:hover{background:var(--ux-surface-2);color:var(--ink)}}
.ux-meter{display:flex;align-items:center;gap:.75rem;margin-top:.5rem;font-size:var(--step--1);color:var(--ink-mute)}
.ux-meter-bars{display:grid;grid-template-columns:repeat(4,2.4rem);gap:.25rem}
.ux-meter-bars i{height:.3rem;border-radius:.2rem;background:oklch(0.93 0.012 80 / .14);transition:background-color .2s linear}
.ux-meter[data-score="1"] i:nth-child(-n+1){background:var(--ux-danger)}
.ux-meter[data-score="2"] i:nth-child(-n+2){background:oklch(0.84 0.12 80)}
.ux-meter[data-score="3"] i:nth-child(-n+3){background:oklch(0.8 0.12 150)}
.ux-meter[data-score="4"] i:nth-child(-n+4){background:oklch(0.8 0.12 150)}
.ux-pw-done{display:flex;align-items:center;gap:.6rem;margin:0;padding:.85rem 1rem;border-radius:.8rem;background:oklch(0.7 0.1 210 / .12);box-shadow:inset 0 0 0 1px oklch(0.7 0.1 210 / .4);
color:var(--ink);font-size:var(--step--1);animation:ux-in .3s var(--ease-out-quint) both}
.ux-pw-done svg{color:var(--accent);font-size:1.2rem;flex:none}
.ux-signout{display:grid;justify-items:start;gap:.5rem;max-width:30rem;padding-top:1.75rem;border-top:1px solid var(--hairline)}
.ux-signout .adm-hint-line{margin:0 0 .5rem}

/* ---------- Editor status row (Published) ---------- */
.adm-status{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem 1rem;padding:.55rem .9rem;border:1px solid var(--hairline);border-radius:.8rem;background:var(--ux-surface)}
.adm-status[data-on="true"]{border-color:oklch(0.7 0.1 210 / .4);background:oklch(0.7 0.1 210 / .07)}
.adm-status-text{display:grid;gap:.1rem;min-width:0}
.adm-status-text .lbf-label,.adm-status-text .lbf-hint{margin:0}

/* ---------- Mobile tab bar + More sheet ---------- */
.ux-tabbar{display:none}
@media (max-width:55.99rem){
.ux-tabbar{position:fixed;inset-inline:0;bottom:0;z-index:40;display:grid;grid-template-columns:repeat(5,1fr);padding:.25rem .25rem calc(.25rem + env(safe-area-inset-bottom));
border-top:1px solid var(--hairline);background:var(--ux-glass);-webkit-backdrop-filter:var(--ux-glass-blur);backdrop-filter:var(--ux-glass-blur)}
.adm-content .adm-toasts,.adm .adm-toasts{bottom:calc(4.5rem + env(safe-area-inset-bottom))}
body:has(.ux-tabbar) .lbf-motion{bottom:calc(4.4rem + env(safe-area-inset-bottom))}
}
.ux-tab{position:relative;display:grid;justify-items:center;align-content:center;gap:.15rem;min-height:3.25rem;padding:.35rem .15rem;border:0;border-radius:.7rem;background:none;color:var(--ink-mute);
font:500 .6875rem/1.2 var(--font-sans);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:color .12s linear,transform .16s var(--ux-spring)}
.ux-tab:active{transform:scale(.94);transition-duration:.04s}
.ux-tab[aria-current="page"]{color:var(--ink)}
.ux-tab[aria-current="page"] .ux-tab-ico{color:var(--accent)}
.ux-tab:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.ux-tab-ico{position:relative;display:grid;place-items:center;font-size:1.45rem}
.ux-tab-label{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ux-tab-badge{position:absolute;inset-block-start:-.3rem;inset-inline-start:55%;display:inline-grid;place-items:center;min-width:1.15rem;height:1.15rem;padding-inline:.3rem;border-radius:.6rem;
background:var(--accent);color:var(--ux-on-accent);font-size:.6875rem;font-weight:700;line-height:1}
.ux-more .ux-tab-badge{position:static}
.ux-tab-dirty{position:absolute;inset-block-start:-.1rem;inset-inline-end:-.25rem;width:.5rem;height:.5rem;border-radius:50%;background:oklch(0.84 0.12 80)}
.ux-more{margin:0;padding:0;list-style:none;display:grid;gap:.25rem}
.ux-more-item{display:flex;align-items:center;gap:.9rem;width:100%;min-height:3.5rem;padding:.5rem .75rem;border:0;border-radius:.8rem;background:none;color:var(--ink);text-align:start;cursor:pointer;
transition:background-color .12s linear,transform .16s var(--ux-spring)}
.ux-more-item:active{transform:scale(.98);background:var(--ux-surface-2);transition-duration:.04s}
.ux-more-item[aria-current="page"]{background:var(--ux-surface-2)}
.ux-more-item:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.ux-more-ico{display:grid;place-items:center;flex:none;width:2.5rem;height:2.5rem;border-radius:.7rem;background:var(--ux-surface-2);color:var(--accent);font-size:1.3rem}
.ux-more-text{display:grid;gap:.1rem;flex:1;min-width:0}
.ux-more-title{font:600 var(--step-0)/1.25 var(--font-sans)}
.ux-more-sub{font-size:var(--step--1);line-height:1.35;color:var(--ink-mute)}

/* ---------- Quick find ---------- */
.ux-pal{box-sizing:border-box;width:min(42rem,calc(100vw - 1.5rem));max-width:none;max-height:min(34rem,calc(100dvh - 4rem));margin:min(12vh,6rem) auto auto;padding:0;border:1px solid var(--ux-line);
border-radius:1rem;background:var(--ux-glass);color:var(--ink);overflow:hidden;-webkit-backdrop-filter:var(--ux-glass-blur);backdrop-filter:var(--ux-glass-blur);
box-shadow:0 40px 90px -20px oklch(0 0 0 / .75)}
.ux-pal[open]{display:flex;flex-direction:column}
.ux-pal::backdrop{background:oklch(0.06 0.008 215 / .6)}
@media (max-width:40rem){.ux-pal{margin-top:.75rem;max-height:calc(100dvh - 1.5rem)}}
.ux-pal-box{display:flex;flex-direction:column;min-height:0;flex:1}
.ux-pal-field{display:flex;align-items:center;gap:.75rem;padding:.35rem .75rem .35rem 1.1rem;border-bottom:1px solid var(--hairline)}
.ux-pal-ico{font-size:1.25rem;color:var(--ink-mute);flex:none}
.ux-pal-input{flex:1;min-width:0;min-height:3.5rem;border:0;background:none;color:var(--ink);font:400 var(--step-1)/1.2 var(--font-sans);outline:none}
.ux-pal-input::placeholder{color:var(--ink-mute)}
.ux-pal-esc{border:0;background:none;padding:.5rem;cursor:pointer;border-radius:.5rem}
.ux-pal-list{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:.5rem;scrollbar-width:thin;scrollbar-color:var(--hairline) transparent}
.ux-pal-gh{margin:.6rem .6rem .3rem;font-size:.75rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink-mute)}
[dir="rtl"] .ux-pal-gh{letter-spacing:0;text-transform:none;font-size:.8125rem}
.ux-pal-opt{display:flex;align-items:center;gap:.85rem;min-height:3rem;padding:.45rem .7rem;border-radius:.7rem;cursor:pointer}
.ux-pal-opt[data-active="true"]{background:var(--ux-surface-2);box-shadow:inset 0 0 0 1px var(--ux-line)}
.ux-pal-oico{display:grid;place-items:center;flex:none;width:2.1rem;height:2.1rem;border-radius:.55rem;background:var(--ux-surface-2);color:var(--ink-dim);font-size:1.1rem}
.ux-pal-opt[data-active="true"] .ux-pal-oico{background:oklch(0.7 0.1 210 / .2);color:var(--accent)}
.ux-pal-otext{display:grid;min-width:0;flex:1}
.ux-pal-otitle{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:500 var(--step--1)/1.3 var(--font-sans);color:var(--ink)}
.ux-pal-ohint{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8125rem;line-height:1.3;color:var(--ink-mute)}
.ux-pal-go{color:var(--ink-mute);flex:none;opacity:0}
[dir="rtl"] .ux-pal-go{transform:scaleX(-1)}
.ux-pal-opt[data-active="true"] .ux-pal-go{opacity:1}
.ux-pal-none{display:grid;gap:.4rem;margin:0;padding:2.5rem 1rem;text-align:center;color:var(--ink-dim);font-size:var(--step--1)}
.ux-pal-none span{color:var(--ink-mute)}
.ux-pal-foot{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem;margin:0;padding:.65rem 1.1rem;border-top:1px solid var(--hairline);font-size:.8125rem;color:var(--ink-mute)}
@media (hover:none),(pointer:coarse),(max-width:40rem){.ux-pal-foot{display:none}}
.ux-pal-close{display:none;align-items:center;min-height:2.75rem;padding:0 .9rem;border:0;border-radius:.6rem;background:var(--ux-surface-2);color:var(--ink);font:600 var(--step--1)/1 var(--font-sans);cursor:pointer}
@media (hover:none),(pointer:coarse),(max-width:40rem){.ux-pal-esc{display:none}.ux-pal-close{display:inline-flex}}

/* Toasts inside a dialog sit under its header, never over the Save / Confirm buttons. */
.adm-modal .adm-toasts{bottom:auto;top:max(.5rem,env(safe-area-inset-top))}
.adm-modal .adm-toast{max-width:min(32rem,calc(100% - 7rem))}

/* ---------- Dialogs share the same close + foot language ---------- */
.adm-editor-head{align-items:center;padding-block:.75rem .75rem}
.adm-editor-title{font-size:var(--step-1)}
.adm-modal{border-radius:1rem}
.adm-modal .adm-form-foot{background:var(--ux-glass);-webkit-backdrop-filter:var(--ux-glass-blur);backdrop-filter:var(--ux-glass-blur)}
.adm-form-foot-acts{gap:.5rem}
.adm-modal::backdrop{backdrop-filter:blur(6px)}
@media (prefers-reduced-transparency:reduce){.adm-modal::backdrop{backdrop-filter:none;background:oklch(0.06 0.008 215 / .88)}}

@media (prefers-reduced-motion:reduce){
.adm-panel,.ux-bar,.adm-savebar,.adm-bar,.ux-pw-done{animation:adm-fade .2s linear both}
.ux-skel{animation:none}
.ux-switch-thumb,.ux-task-go,.ux-check::after{transition:none}
.ux-btn:active,.ux-task:active,.ux-stat:active,.ux-page:active,.ux-tab:active,.adm-nav-item:active{transform:none}
.adm-crow[data-found="true"]{animation:none;background:oklch(0.7 0.1 210 / .1)}
}
`;
