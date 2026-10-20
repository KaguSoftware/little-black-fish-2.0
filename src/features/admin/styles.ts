/**
 * Admin styles: a quiet backstage of the same theatre. Hairline lists, Redaction headings,
 * text buttons, the accent only as light (focus, selected tab, dirty bar rule).
 * Prefix `adm-`. Logical properties throughout so fa (RTL) mirrors cleanly.
 */
export const ADMIN_CSS = `
.adm{position:relative;z-index:2;max-width:104rem;margin-inline:auto;
padding:clamp(6rem,13vh,8.5rem) var(--gutter) clamp(5rem,12vh,8rem)}
[dir="rtl"] .adm{--adm-flip:-1}
.adm-head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:1rem var(--gutter);
margin-bottom:clamp(1.75rem,5vh,3rem)}
.adm-h1{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-3);line-height:.9;color:var(--ink-dim)}
.adm-lede{margin:.9rem 0 0;max-width:46ch;font-size:var(--step--1);line-height:1.45;color:var(--ink-mute)}
.adm-signout{margin:0}

/* Tabs */
.adm-tabs{display:flex;flex-wrap:wrap;gap:0 clamp(1.25rem,3vw,2.75rem);margin:0 0 clamp(1.5rem,4vh,2.5rem);
box-shadow:inset 0 -1px 0 var(--hairline);overflow-x:auto;scrollbar-width:none}
.adm-tab{position:relative;display:inline-flex;align-items:baseline;gap:.5rem;padding:.85rem 0 1rem;border:0;background:none;
color:var(--ink-mute);font-family:var(--font-sans);font-weight:500;font-size:var(--step-0);line-height:1;cursor:pointer;
white-space:nowrap;transition:color .12s linear;-webkit-tap-highlight-color:transparent}
.adm-tab:hover{color:var(--ink-dim)}
.adm-tab[aria-selected="true"]{color:var(--ink)}
.adm-tab::after{content:"";position:absolute;inset-inline:0;bottom:0;height:1px;background:var(--accent);
transform:scaleX(0);transition:transform .35s var(--ease-out-quint)}
.adm-tab[aria-selected="true"]::after{transform:scaleX(1)}
.adm-tab:active{transform:scale(.97)}
.adm-tab-count{font-size:var(--step--1);color:var(--ink-mute);font-variant-numeric:tabular-nums}
.adm-tab-count[data-lit="true"]{color:var(--accent)}

/* Panel */
.adm-panel{animation:adm-in .6s var(--ease-out-quint) both}
.adm-panel-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.75rem var(--gutter);
margin-bottom:1rem}
.adm-h2{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-2);line-height:1;color:var(--ink)}
.adm-sub{margin:.4rem 0 0;font-size:var(--step--1);color:var(--ink-mute);max-width:60ch}
.adm-add{font-size:var(--step-0)}
.adm-add[aria-expanded="true"]{color:var(--ink-mute)}

/* Notice (live region) */
.adm-notice{min-height:1.6rem;margin:0 0 .75rem;font-size:var(--step--1);line-height:1.4;color:var(--ink-dim)}
.adm-notice-line{display:inline-flex;flex-wrap:wrap;align-items:baseline;gap:.25rem .9rem;animation:adm-in .35s var(--ease-out-quint) both}
.adm-notice-line[data-kind="error"]{color:oklch(0.78 0.12 28)}
.adm-notice-line[data-kind="ok"]::before{content:"";align-self:center;width:.4rem;height:.4rem;border-radius:50%;background:var(--accent);
box-shadow:0 0 10px var(--accent)}

/* List + editor layout */
.adm-stage{display:grid;gap:clamp(1.5rem,4vw,3rem);align-items:start}
@media (min-width:72rem){
.adm-stage[data-editing="true"]{grid-template-columns:minmax(0,1fr) minmax(0,1.25fr)}
.adm-stage[data-editing="true"] .adm-editor{grid-column:2;grid-row:1;position:sticky;top:5.5rem;max-height:calc(100dvh - 7rem);
overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--hairline) transparent}
.adm-stage[data-editing="true"] .adm-listwrap{grid-column:1;grid-row:1}
.adm-stage[data-editing="true"] .adm-row{grid-template-columns:auto auto minmax(0,1fr);grid-template-areas:"grip thumb main" "acts acts acts"}
.adm-stage[data-editing="true"] .adm-acts{justify-content:flex-start;padding-inline-start:calc(3.2rem + clamp(.75rem,1.6vw,1.25rem))}
}

/* Rows */
.adm-list{margin:0;padding:0;list-style:none}
.adm-item{border-top:1px solid var(--hairline);background:var(--stage)}
.adm-item:last-child{border-bottom:1px solid var(--hairline)}
.adm-item[data-dragging="true"]{border-color:transparent;background:var(--stage-raised);
box-shadow:0 18px 40px -18px oklch(0.05 0.01 215/.9),inset 0 0 0 1px var(--hairline)}
.adm-item[data-current="true"]{background:oklch(0.15 0.016 var(--hue))}
.adm-row{display:grid;grid-template-columns:auto auto minmax(0,1fr);grid-template-areas:"grip thumb main" "acts acts acts";
align-items:center;gap:.6rem clamp(.75rem,1.6vw,1.25rem);padding:clamp(.7rem,1.4vw,1rem) 0}
@media (min-width:48rem){.adm-row{grid-template-columns:auto auto minmax(0,1fr) auto;grid-template-areas:"grip thumb main acts"}}
.adm-grip{grid-area:grip;display:grid;grid-template-columns:auto auto;align-items:center;gap:.35rem;padding:.4rem .15rem;
color:var(--ink-mute);cursor:grab;border-radius:2px;font-size:var(--step--1);font-variant-numeric:tabular-nums;min-width:3.2rem}
.adm-grip:hover{color:var(--ink-dim)}
.adm-grip:active{cursor:grabbing}
.adm-grip svg{opacity:.7}
.adm-thumb{grid-area:thumb;position:relative;width:clamp(4.5rem,9vw,6.5rem);aspect-ratio:16/9;overflow:hidden;border-radius:2px;
background:var(--stage-deep);box-shadow:inset 0 0 0 1px var(--ink-faint)}
.adm-thumb img,.adm-thumb video{display:block;width:100%;height:100%;object-fit:cover}
.adm-thumb[data-off="true"] img,.adm-thumb[data-off="true"] video{opacity:.45;filter:grayscale(.6)}
.adm-thumb-none{display:grid;place-items:center;width:100%;height:100%;font-size:.6875rem;color:var(--ink-mute);text-align:center;padding:.25rem}
.adm-thumb-kind{position:absolute;inset-block-end:.2rem;inset-inline-start:.25rem;padding:.05rem .3rem;border-radius:2px;
font-size:.625rem;font-weight:600;line-height:1.3;color:var(--ink);background:oklch(0.08 0.01 215/.72)}
.adm-main{grid-area:main;min-width:0}
.adm-title{margin:0;font-family:var(--font-sans);font-weight:500;font-size:var(--step-0);line-height:1.3;color:var(--ink);
overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.adm-title[data-off="true"]{color:var(--ink-dim)}
.adm-row-meta{display:flex;flex-wrap:wrap;gap:.1rem .8rem;margin:.2rem 0 0;font-size:var(--step--1);line-height:1.35;color:var(--ink-mute)}
.adm-off{display:inline-flex;align-items:center;gap:.35rem;color:var(--ink-dim)}
.adm-off::before{content:"";width:.45rem;height:.45rem;border:1px solid currentColor;border-radius:50%}
.adm-acts{grid-area:acts;display:flex;flex-wrap:wrap;align-items:center;justify-content:flex-end;gap:.1rem 1rem}
@media (max-width:47.99rem){.adm-acts{justify-content:flex-start;padding-inline-start:calc(3.2rem + clamp(.75rem,1.6vw,1.25rem))}}
.adm-move{display:inline-flex;gap:.15rem}
.adm-icon{display:inline-grid;place-items:center;width:1.9rem;height:1.9rem;border:0;border-radius:2px;background:none;
color:var(--ink-mute);cursor:pointer;transition:color .12s linear}
.adm-icon:hover:not(:disabled){color:var(--ink)}
.adm-icon:disabled{opacity:.3;cursor:default}
.adm-icon:active:not(:disabled){transform:scale(.94)}
.adm-danger:hover{color:oklch(0.78 0.12 28)}
.lbf-textbtn:disabled{opacity:.45;cursor:default}
.lbf-textbtn[aria-busy="true"]{cursor:progress}

/* Dirty (unsaved order) bar */
.adm-bar{position:sticky;bottom:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
gap:.5rem var(--gutter);margin-top:1rem;padding:.85rem 0 max(.85rem,env(safe-area-inset-bottom));padding-left:clamp(0rem,9vw,8.5rem);
background:var(--stage);box-shadow:0 -1px 0 var(--accent),0 -24px 32px -8px var(--stage);animation:adm-in .35s var(--ease-out-quint) both}
.adm-bar-text{font-size:var(--step--1);color:var(--ink-dim)}
.adm-bar-acts{display:flex;align-items:center;gap:1.5rem}
.adm-bar .lbf-cta{font-size:var(--step-0)}

/* Empty + loading */
.adm-empty{padding:clamp(2.5rem,8vh,4.5rem) 0;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline)}
.adm-empty-title{margin:0;font-family:var(--font-display);font-size:var(--step-1);color:var(--ink-dim)}
.adm-empty-text{margin:.5rem 0 0;max-width:48ch;font-size:var(--step--1);color:var(--ink-mute)}
.adm-skel{height:4.4rem;border-top:1px solid var(--hairline)}
.adm-skel:last-child{border-bottom:1px solid var(--hairline)}
.adm-hint-line{margin:.75rem 0 0;font-size:var(--step--1);color:var(--ink-mute)}

/* Editor */
.adm-editor{padding-block:0 1.25rem;animation:adm-in .5s var(--ease-out-quint) both}
.adm-editor-head{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;padding-bottom:1rem;margin-bottom:1.5rem;
box-shadow:inset 0 -1px 0 var(--hairline)}
.adm-editor-title{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-2);line-height:1;color:var(--ink)}
.adm-editor-title:focus{outline:none}
.adm-form{display:grid;gap:1.6rem}
.adm-pair{display:grid;gap:1.6rem var(--gutter)}
@media (min-width:40rem){.adm-pair{grid-template-columns:repeat(2,minmax(0,1fr))}}
.adm-group{display:grid;gap:1.4rem;padding-top:1.5rem;border-top:1px solid var(--hairline)}
.adm-group-title{margin:0;font-family:var(--font-sans);font-weight:600;font-size:var(--step--1);color:var(--ink-dim)}
.adm-group[hidden]{display:none}
.adm-collapse[data-open="false"]{display:none}
.adm-form-foot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:1rem var(--gutter);
padding-top:1.25rem;border-top:1px solid var(--hairline)}
.adm-form-foot-acts{display:flex;align-items:center;gap:1.75rem;margin-inline-start:auto}
.adm-form .lbf-error:empty{display:none}
.adm-req{color:var(--ink-mute);font-weight:400}
.adm-note{margin:0;padding:.75rem 0;font-size:var(--step--1);line-height:1.45;color:var(--ink-dim);border-block:1px solid var(--ink-faint)}
.adm-note code{font-size:.92em;color:var(--ink)}

/* Segmented (media type): text options, an accent baseline under the chosen one. */
.adm-seg{display:flex;gap:1.5rem;margin:0;padding:0;border:0}
.adm-seg legend{padding:0;margin-bottom:.55rem}
.adm-seg-opt{position:relative;display:inline-flex;padding:.35rem 0 .5rem;cursor:pointer;color:var(--ink-mute);
font-weight:500;font-size:var(--step-0);transition:color .12s linear}
.adm-seg-opt:hover{color:var(--ink-dim)}
.adm-seg-opt input{position:absolute;opacity:0;pointer-events:none}
.adm-seg-opt::after{content:"";position:absolute;inset-inline:0;bottom:0;height:1px;background:var(--accent);transform:scaleX(0);
transition:transform .35s var(--ease-out-quint)}
.adm-seg-opt:has(input:checked){color:var(--ink)}
.adm-seg-opt:has(input:checked)::after{transform:scaleX(1)}
.adm-seg-opt:has(input:focus-visible){outline:2px solid var(--accent);outline-offset:3px;border-radius:2px}

/* Gallery grid */
.adm-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(9rem,1fr));gap:.9rem;margin:0;padding:0;list-style:none}
.adm-gal-item{display:grid;gap:.35rem}
.adm-gal-img{position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:2px;background:var(--stage-deep);
box-shadow:inset 0 0 0 1px var(--ink-faint)}
.adm-gal-img img{display:block;width:100%;height:100%;object-fit:cover}
.adm-gal-idx{position:absolute;inset-block-start:.25rem;inset-inline-start:.3rem;padding:.05rem .35rem;border-radius:2px;
font-size:.6875rem;font-weight:600;color:var(--ink);background:oklch(0.08 0.01 215/.72);font-variant-numeric:tabular-nums}
.adm-gal-acts{display:flex;align-items:center;justify-content:space-between}

/* Upload */
.adm-up{display:grid;gap:.6rem;min-width:0}
.adm-up-row{display:flex;align-items:end;gap:1rem}
.adm-up-row .lbf-input{flex:1;min-width:0}
.adm-up-file{position:relative;flex:none;white-space:nowrap}
.adm-up-file input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}
.adm-up-file:focus-within{outline:2px solid var(--accent);outline-offset:3px;border-radius:2px}
.adm-up-zone{border-radius:2px;transition:box-shadow .2s var(--ease-out-quint)}
.adm-up-zone[data-over="true"]{box-shadow:0 0 0 1px var(--accent),0 0 24px -6px var(--accent)}
.adm-up-preview{position:relative;width:min(100%,22rem);aspect-ratio:16/9;overflow:hidden;border-radius:2px;background:var(--stage-deep);
box-shadow:inset 0 0 0 1px var(--ink-faint)}
.adm-up-preview img,.adm-up-preview video{display:block;width:100%;height:100%;object-fit:cover}
.adm-up-preview[data-busy="true"] img,.adm-up-preview[data-busy="true"] video{opacity:.35}
.adm-up-status{font-size:var(--step--1);color:var(--ink-mute);min-height:1.2em}
.adm-up-status[data-state="error"]{color:oklch(0.78 0.12 28)}
.adm-up-status[data-state="done"]{color:var(--ink-dim)}
.adm-up-status[data-state="compressing"],.adm-up-status[data-state="uploading"]{color:var(--ink-dim);animation:adm-pulse 1.4s ease-in-out infinite}

/* Submissions */
.adm-subs{margin:0;padding:0;list-style:none}
.adm-sub-item{display:grid;gap:.75rem;padding:clamp(1.1rem,2.2vw,1.6rem) 0;border-top:1px solid var(--hairline)}
.adm-sub-item:last-child{border-bottom:1px solid var(--hairline)}
.adm-sub-top{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:.35rem var(--gutter)}
.adm-sub-who{display:flex;flex-wrap:wrap;align-items:baseline;gap:.25rem 1rem;min-width:0}
.adm-sub-name{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-1);line-height:1.1;color:var(--ink)}
.adm-sub-item[data-read="true"] .adm-sub-name{color:var(--ink-dim)}
.adm-new{display:inline-flex;align-items:center;gap:.4rem;font-size:var(--step--1);font-weight:600;color:var(--ink)}
.adm-new::before{content:"";width:.45rem;height:.45rem;border-radius:50%;background:var(--accent);box-shadow:0 0 10px var(--accent)}
.adm-sub-date{font-size:var(--step--1);color:var(--ink-mute);font-variant-numeric:tabular-nums}
.adm-sub-contact{display:flex;flex-wrap:wrap;gap:.25rem 1.5rem;font-size:var(--step--1)}
.adm-sub-contact a{color:var(--ink-dim);text-underline-offset:.2em;text-decoration-color:var(--hairline)}
.adm-sub-contact a:hover{color:var(--ink);text-decoration-color:currentColor}
.adm-sub-msg{margin:0;max-width:72ch;white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--step-0);line-height:1.6;color:var(--ink-dim)}
.adm-sub-item[data-read="false"] .adm-sub-msg{color:var(--ink)}
.adm-sub-flag{margin:0;font-size:var(--step--1);color:oklch(0.78 0.12 28)}
.adm-sub-acts{display:flex;gap:1.5rem}

@keyframes adm-in{from{opacity:0;transform:translateY(8px);filter:blur(4px)}to{opacity:1;transform:none;filter:blur(0)}}
@keyframes adm-pulse{50%{opacity:.55}}
@media (prefers-reduced-motion:reduce){
.adm-panel,.adm-editor,.adm-bar,.adm-notice-line{animation-name:adm-fade;animation-duration:.2s}
.adm-up-status{animation:none!important}
.adm-tab::after,.adm-seg-opt::after{transition:none}
}
@keyframes adm-fade{from{opacity:0}to{opacity:1}}
`;
