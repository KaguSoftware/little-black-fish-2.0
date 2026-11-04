/**
 * Admin shell + the newer panels (sidebar nav, dashboard, content editor, settings, media).
 * Same language as styles.ts: hairlines, text buttons, accent only as light. Logical properties only.
 */
export const ADMIN_CSS_NAV = `
/* Shell */
.adm-shell{display:grid;gap:clamp(1.25rem,3vw,3rem);align-items:start}
@media (min-width:56rem){.adm-shell{grid-template-columns:14.5rem minmax(0,1fr)}}
.adm-content{min-width:0}
.adm-content .lbf-textbtn{display:inline-flex;align-items:center;min-height:2.75rem}
.adm-content .adm-acts .lbf-textbtn,.adm-content .adm-sub-acts .lbf-textbtn{min-height:2.75rem}
@media (pointer:coarse){.adm-icon{width:2.75rem;height:2.75rem}}
.adm-panel:focus{outline:none}
.adm-panel:focus-visible{outline:none}

/* Sidebar */
.adm-side{min-width:0}
@media (min-width:56rem){.adm-side{position:sticky;top:5.5rem;max-height:calc(100dvh - 7rem);overflow-y:auto;overscroll-behavior:contain;
scrollbar-width:thin;scrollbar-color:var(--hairline) transparent;padding-inline-end:.5rem}}
.adm-jumpsel{margin-bottom:1rem}
.adm-jumpsel .lbf-input{min-height:2.75rem}
@media (min-width:56rem){.adm-jumpsel{display:none}}
.adm-nav{display:none}
@media (min-width:56rem){.adm-nav{display:grid;gap:1.5rem}}
.adm-nav-title{margin:0 0 .35rem;font-size:.6875rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-mute)}
[dir="rtl"] .adm-nav-title{letter-spacing:0;text-transform:none;font-size:var(--step--1)}
.adm-nav-list{margin:0;padding:0;list-style:none;border-inline-start:1px solid var(--hairline)}
.adm-nav-item{position:relative;display:flex;align-items:center;justify-content:space-between;gap:.6rem;width:100%;min-height:2.75rem;
padding:.4rem 0;padding-inline:1rem .25rem;border:0;background:none;text-align:start;color:var(--ink-mute);
font-family:var(--font-sans);font-weight:500;font-size:var(--step-0);line-height:1.2;cursor:pointer;
transition:color .12s linear;-webkit-tap-highlight-color:transparent}
.adm-nav-item:hover{color:var(--ink-dim)}
.adm-nav-item[aria-current="page"]{color:var(--ink)}
.adm-nav-item::before{content:"";position:absolute;inset-inline-start:-1px;top:.35rem;bottom:.35rem;width:1px;background:var(--accent);
transform:scaleY(0);transition:transform .3s var(--ease-out-quint)}
.adm-nav-item[aria-current="page"]::before{transform:scaleY(1)}
.adm-nav-item:focus-visible{outline:2px solid var(--accent);outline-offset:-2px;border-radius:2px}
.adm-nav-dirty{margin-inline-start:auto;width:.45rem;height:.45rem;border-radius:50%;background:var(--accent);flex:none}
.adm-nav-item .adm-tab-count{margin-inline-start:auto}
.adm-nav-dirty + .adm-tab-count{margin-inline-start:.4rem}

/* Small shared bits */
.adm-group-h{margin:0;font-family:var(--font-display);font-weight:400;font-size:var(--step-1);line-height:1.1;color:var(--ink)}
.adm-badge{display:inline-flex;align-items:center;padding:.05rem .45rem;border-radius:2px;font-size:.6875rem;font-weight:600;line-height:1.5;
color:var(--ink-dim);box-shadow:inset 0 0 0 1px var(--hairline)}
.adm-badge[data-tone="accent"]{color:var(--ink);box-shadow:inset 0 0 0 1px var(--accent)}
.adm-badge[data-tone="warn"]{color:oklch(0.78 0.12 28);box-shadow:inset 0 0 0 1px oklch(0.78 0.12 28/.6)}
.adm-seg-btn{position:relative;display:inline-flex;align-items:center;min-height:2.75rem;padding:.35rem 0;border:0;background:none;
color:var(--ink-mute);font-family:var(--font-sans);font-weight:500;font-size:var(--step-0);cursor:pointer;transition:color .12s linear}
.adm-seg-btn:hover{color:var(--ink-dim)}
.adm-seg-btn[aria-pressed="true"]{color:var(--ink)}
.adm-seg-btn::after{content:"";position:absolute;inset-inline:0;bottom:0;height:1px;background:var(--accent);transform:scaleX(0);
transition:transform .35s var(--ease-out-quint)}
.adm-seg-btn[aria-pressed="true"]::after{transform:scaleX(1)}
.adm-seg-btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:2px}
.adm-seg{margin-bottom:1rem}
.adm-more{margin-top:.5rem}

/* Tools row (search + filters) */
.adm-ctools{display:flex;flex-wrap:wrap;align-items:end;gap:1rem var(--gutter);margin-bottom:1rem}
.adm-csearch{flex:1 1 16rem}
.adm-cfilter{flex:0 1 12rem}
.adm-ctools .lbf-check{min-height:2.75rem}
.adm-ctools .lbf-input{min-height:2.75rem}
.adm-cmeta{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.25rem 1rem;margin:0 0 .75rem;
font-size:var(--step--1);color:var(--ink-mute);min-height:1.5rem}

/* Content editor */
.adm-chips{display:flex;flex-wrap:wrap;gap:.25rem 1.25rem;margin-bottom:1rem}
.adm-chip{display:inline-flex;align-items:baseline;gap:.45rem;min-height:2.75rem;padding:.4rem 0;border:0;background:none;cursor:pointer;
color:var(--ink-mute);font-family:var(--font-sans);font-weight:500;font-size:var(--step-0);position:relative;transition:color .12s linear}
.adm-chip:hover{color:var(--ink-dim)}
.adm-chip[aria-pressed="true"]{color:var(--ink)}
.adm-chip::after{content:"";position:absolute;inset-inline:0;bottom:.25rem;height:1px;background:var(--accent);transform:scaleX(0);
transition:transform .3s var(--ease-out-quint)}
.adm-chip[aria-pressed="true"]::after{transform:scaleX(1)}
.adm-chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
.adm-chip-n{font-size:var(--step--1);color:var(--ink-mute);font-variant-numeric:tabular-nums}
.adm-chip-mod{color:var(--accent)}
.adm-cgroups,.adm-crows{display:grid;gap:0}
.adm-cgroup{border-top:1px solid var(--hairline)}
.adm-cgroup:last-child{border-bottom:1px solid var(--hairline)}
.adm-cgroup-h{margin:0;font-size:inherit}
.adm-cgroup-btn{display:flex;align-items:center;gap:.75rem;width:100%;min-height:2.75rem;padding:.5rem 0;border:0;background:none;cursor:pointer;
text-align:start;color:var(--ink);font-family:var(--font-sans);font-weight:500;font-size:var(--step-0)}
.adm-cgroup-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:2px}
.adm-cgroup-caret{width:.5rem;height:.5rem;border-inline-end:1.5px solid var(--ink-mute);border-bottom:1.5px solid var(--ink-mute);
transform:rotate(-45deg);transition:transform .2s var(--ease-out-quint);flex:none}
[dir="rtl"] .adm-cgroup-caret{transform:rotate(45deg)}
.adm-cgroup[data-open="true"] .adm-cgroup-caret{transform:rotate(45deg)}
[dir="rtl"] .adm-cgroup[data-open="true"] .adm-cgroup-caret{transform:rotate(-45deg)}
.adm-cgroup-name{font-family:var(--font-mono,ui-monospace,monospace);font-size:var(--step--1)}
.adm-cgroup-n{margin-inline-start:auto;font-size:var(--step--1);color:var(--ink-mute);font-variant-numeric:tabular-nums}
.adm-cgroup .adm-crows{padding-bottom:1rem}
.adm-crow{display:grid;gap:.6rem;padding:1rem 0;border-top:1px solid var(--hairline);content-visibility:auto;contain-intrinsic-size:auto 9rem}
.adm-crow:first-child{border-top:0}
.adm-crow[data-unsaved="true"]{position:relative;padding-inline-start:.9rem}
.adm-crow[data-unsaved="true"]::before{content:"";position:absolute;inset-block:0;inset-inline-start:0;width:2px;background:var(--accent)}
.adm-ckey{margin:0;font-family:var(--font-mono,ui-monospace,monospace);font-size:.75rem;color:var(--ink-mute);overflow-wrap:anywhere}
.adm-cpair{gap:.5rem var(--gutter)}
.adm-clane{gap:.35rem}
.adm-clane textarea.lbf-input{min-height:4.5rem}
.adm-cmeta-line{display:flex;flex-wrap:wrap;align-items:center;gap:.1rem .9rem;min-height:.5rem}
.adm-cmeta-line:empty{display:none}
.adm-cdefault{margin:0;font-size:var(--step--1);line-height:1.4;color:var(--ink-mute);white-space:pre-wrap;overflow-wrap:anywhere}
.adm-cdefault-l{font-weight:600;color:var(--ink-dim)}
.adm-savebar{position:sticky;bottom:0;z-index:5;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;
gap:.5rem var(--gutter);margin-top:1rem;padding:.85rem 0 max(.85rem,env(safe-area-inset-bottom));background:var(--stage);
box-shadow:0 -1px 0 var(--accent),0 -24px 32px -8px var(--stage);animation:adm-in .35s var(--ease-out-quint) both}

/* Settings */
.adm-jump{display:flex;flex-wrap:wrap;gap:0 1.25rem;margin-bottom:1rem}
.adm-setcard{scroll-margin-top:5.5rem;margin-bottom:2rem}
.adm-setcard-head{display:flex;flex-wrap:wrap;align-items:start;justify-content:space-between;gap:.5rem 1rem}
.adm-setcard-badges{display:inline-flex;gap:.5rem}
.adm-setcard .adm-sub{margin-top:.3rem}
.adm-listed{display:grid;gap:.75rem}
.adm-listed-items{margin:0;padding:0;list-style:none;display:grid;gap:1.25rem}
.adm-listed-item{display:grid;gap:.9rem;padding:1rem 0 0;border-top:1px solid var(--hairline)}
.adm-listed-item[data-bad="true"]{position:relative;padding-inline-start:.9rem}
.adm-listed-item[data-bad="true"]::before{content:"";position:absolute;inset-block:0;inset-inline-start:0;width:2px;background:oklch(0.78 0.12 28)}
.adm-listed-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.25rem 1rem}
.adm-listed-title{font-size:var(--step--1);font-weight:600;color:var(--ink-dim)}
.adm-listed-body{display:grid;gap:1.4rem}
.adm-listed .adm-add{justify-self:start}

/* Media */
.adm-media-up{margin-bottom:1.5rem}
.adm-media{margin:0;padding:0;list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(13rem,1fr));gap:1.5rem 1.25rem}
.adm-media-item{display:grid;align-content:start;gap:.35rem;min-width:0}
.adm-media-thumb{position:relative;aspect-ratio:16/9;overflow:hidden;border-radius:2px;background:var(--stage-deep);box-shadow:inset 0 0 0 1px var(--ink-faint)}
.adm-media-thumb img,.adm-media-thumb video{display:block;width:100%;height:100%;object-fit:cover}
.adm-media-name{margin:.2rem 0 0;font-size:var(--step--1);color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.adm-media-use{display:flex;flex-wrap:wrap;gap:.25rem}
.adm-media-use .adm-badge{white-space:normal;overflow-wrap:anywhere}
.adm-media-acts{display:flex;flex-wrap:wrap;gap:0 1rem}

/* Dashboard */
.adm-stats{margin:0 0 clamp(1.75rem,4vh,2.75rem);padding:0;list-style:none;display:grid;gap:.75rem;grid-template-columns:repeat(auto-fill,minmax(11.5rem,1fr));align-items:stretch}
.adm-stats>li{display:flex;min-width:0}
.adm-stat{display:grid;grid-template-rows:auto auto 1fr;align-content:start;gap:.35rem;width:100%;min-height:7.5rem;padding:1.1rem 1.15rem;border:1px solid var(--hairline);border-radius:.5rem;background:oklch(0.93 0.012 80 / 0.03);
text-align:start;cursor:pointer;color:var(--ink);transition:color .12s linear,border-color .12s linear,background-color .12s linear}
.adm-stat:hover{border-color:oklch(0.93 0.012 80 / 0.32);background:oklch(0.93 0.012 80 / 0.06)}
.adm-stat:hover .adm-stat-l{color:var(--ink)}
.adm-stat:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.adm-stat-v{font-family:var(--font-display);font-size:var(--step-3);line-height:1;font-variant-numeric:tabular-nums;margin-block-end:.25rem}
.adm-stat[data-lit="true"] .adm-stat-v{color:var(--accent)}
.adm-stat-l{font-size:var(--step--1);font-weight:500;color:var(--ink-dim)}
.adm-stat-n{font-size:var(--step--1);color:var(--ink-mute);align-self:start}
.adm-dash-cols{display:grid;gap:clamp(1.5rem,4vw,3rem)}
@media (min-width:64rem){.adm-dash-cols{grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)}}
.adm-audit{margin:.75rem 0 0;padding:0;list-style:none}
.adm-audit-item{display:flex;flex-wrap:wrap;justify-content:space-between;gap:.15rem 1rem;padding:.65rem 0;border-top:1px solid var(--hairline);font-size:var(--step--1)}
.adm-audit-item:last-child{border-bottom:1px solid var(--hairline)}
.adm-audit-what{color:var(--ink);min-width:0;overflow-wrap:anywhere}
.adm-audit-target{color:var(--ink-mute)}
.adm-audit-meta{display:inline-flex;flex-wrap:wrap;gap:0 .9rem;color:var(--ink-mute);font-variant-numeric:tabular-nums}
.adm-quick{margin:.75rem 0 0;padding:0;list-style:none;display:grid}
.adm-account{margin:0;padding-top:1rem}

@media (prefers-reduced-motion:reduce){
.adm-savebar{animation-name:adm-fade;animation-duration:.2s}
.adm-nav-item::before,.adm-seg-btn::after,.adm-chip::after,.adm-cgroup-caret{transition:none}
}
`;
