/**
 * Images section (SiteImages) + the voice "Images" group. Injected with the media styles.
 * Logical properties only (RTL), transform/opacity motion, 44px targets.
 */
export const ADMIN_CSS_IMAGES = `
.si-bar{display:grid;gap:.9rem;margin-bottom:1.25rem}
@media (min-width:48rem){.si-bar{grid-template-columns:minmax(0,1fr) auto;align-items:end}}
.si-summary{margin:0;display:grid;gap:.15rem}
.si-summary strong{font-weight:600;font-size:var(--step-0);color:var(--ink);font-variant-numeric:tabular-nums}
.si-summary span{font-size:var(--step--1);color:var(--ink-mute)}
.si-filters{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1.1rem}
.si-search{flex:1 1 14rem;min-width:0}
.si-search .lbf-input{width:100%}
.si-check{display:inline-flex;align-items:center;gap:.55rem;min-height:2.75rem;font-size:var(--step--1);color:var(--ink-dim);cursor:pointer}
.si-check input{width:1.4rem;height:1.4rem;accent-color:var(--accent);margin:0}

.si-groups{display:grid;gap:0}
.si-group{border-top:1px solid var(--hairline)}
.si-group:last-child{border-bottom:1px solid var(--hairline)}
.si-group-head{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem 1rem;min-height:3.5rem}
.si-group-h{margin:0;flex:1 1 auto;min-width:0;font:inherit}
.si-group-btn{display:flex;align-items:center;gap:.75rem;width:100%;min-height:3.5rem;padding:0;border:0;background:none;color:var(--ink);cursor:pointer;
font-family:var(--font-display);font-weight:400;font-size:var(--step-1);line-height:1.1;text-align:start;-webkit-tap-highlight-color:transparent}
.si-group-btn:disabled{cursor:default}
.si-group-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:.25rem}
.si-group-btn .adm-caret{flex:none;transform:rotate(-45deg);transition:transform .2s var(--ease-out-quint)}
[dir="rtl"] .si-group-btn .adm-caret{transform:rotate(45deg)}
.si-group[data-open="true"] .si-group-btn .adm-caret{transform:rotate(45deg)}
[dir="rtl"] .si-group[data-open="true"] .si-group-btn .adm-caret{transform:rotate(-45deg)}
.si-group-count{font-size:var(--step--1);color:var(--ink-mute);font-variant-numeric:tabular-nums}
.si-view{font-size:var(--step--1)}
.si-group-body{display:grid;gap:1.6rem;padding-block:.25rem 2rem;animation:adm-in .35s var(--ease-out-quint) both}
.si-group-sub{margin:0;max-width:62ch;font-size:var(--step--1);line-height:1.5;color:var(--ink-mute)}
.si-block{display:grid;gap:.9rem}
.si-section{margin:0;font-family:var(--font-sans);font-weight:600;font-size:var(--step--1);color:var(--ink-dim);letter-spacing:.01em}

.si-grid{margin:0;padding:0;list-style:none;display:grid;gap:1.1rem 1rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,11.5rem),1fr))}
.si-card{display:grid;gap:.5rem;align-content:start;min-width:0}
.si-thumb{position:relative;display:block;width:100%;padding:0;overflow:hidden;border:1px solid var(--hairline);border-radius:.5rem;background:var(--stage-deep,#000);
color:var(--ink);cursor:pointer;text-decoration:none;-webkit-tap-highlight-color:transparent;transition:transform .12s ease-out,border-color .15s linear}
.si-thumb:hover{border-color:oklch(0.93 0.012 80 / .35)}
.si-thumb:active{transform:scale(.985)}
.si-thumb:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.si-thumb img{display:block;width:100%;height:100%;object-fit:cover}
.si-card[data-custom="true"] .si-thumb{border-color:oklch(0.7 0.1 var(--hue,210) / .55)}
.si-thumb-none{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;gap:.4rem;padding:.5rem;text-align:center;font-size:var(--step--1);color:var(--ink-mute)}
.si-thumb-none svg{font-size:1.5rem}
.si-thumb-act{position:absolute;inset-inline:0;inset-block-end:0;display:grid;place-items:center;min-height:2.5rem;padding:.3rem .5rem;font-size:var(--step--1);font-weight:600;color:var(--ink);
background:linear-gradient(to top,oklch(0.12 0.01 215 / .88),oklch(0.12 0.01 215 / 0));opacity:0;transform:translateY(.25rem);transition:opacity .15s linear,transform .15s var(--ease-out-quint)}
.si-thumb:hover .si-thumb-act,.si-thumb:focus-visible .si-thumb-act{opacity:1;transform:none}
@media (hover:none){.si-thumb-act{opacity:1;transform:none}}
.si-meta{display:grid;gap:.1rem;min-width:0}
.si-name{margin:0;font-size:var(--step--1);font-weight:600;color:var(--ink);overflow-wrap:anywhere}
.si-status{margin:0;font-size:.75rem;color:var(--ink-mute)}
.si-status[data-custom="true"]{color:var(--accent)}
.si-acts{display:grid;gap:.3rem}
.si-acts-row{display:flex;gap:.3rem}
.si-acts .adm-btn{flex:1 1 0;min-width:0;min-height:2.75rem;padding:.25rem .5rem;font-size:.8125rem;line-height:1.2;text-align:center}
.si-acts .adm-btn-quiet{border-color:var(--hairline);color:var(--ink-dim)}
.si-acts .si-main{color:var(--ink);background:oklch(0.93 0.012 80 / .07)}
.si-empty{margin:0;font-size:var(--step--1);color:var(--ink-mute)}
.si-none{display:grid;justify-items:start;gap:.75rem;padding:2.5rem 0;color:var(--ink-dim)}
.si-none p{margin:0}
.si-ro{margin:0;padding:0;list-style:none;display:grid;gap:1rem 1.5rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,18rem),1fr))}
.si-ro li{display:grid;gap:.2rem;padding-block:.75rem;border-top:1px solid var(--hairline)}
.si-ro .si-status{font-size:var(--step--1);line-height:1.45}

.si-list{display:grid;gap:.9rem}
.si-list-acts{display:flex;flex-wrap:wrap;gap:.5rem}
.si-fine{border-top:1px solid var(--hairline);padding-top:.25rem}
.si-fine>summary{display:flex;align-items:center;min-height:2.75rem;cursor:pointer;font-size:var(--step--1);font-weight:600;color:var(--ink-dim);list-style:none}
.si-fine>summary::-webkit-details-marker{display:none}
.si-fine>summary::before{content:"";width:.45rem;height:.45rem;margin-inline-end:.65rem;border-inline-end:1.5px solid currentColor;border-block-end:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .2s var(--ease-out-quint)}
[dir="rtl"] .si-fine>summary::before{transform:rotate(45deg)}
.si-fine[open]>summary::before{transform:rotate(45deg)}
[dir="rtl"] .si-fine[open]>summary::before{transform:rotate(-45deg)}
.si-fine>summary:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:.25rem}
.si-fine[open]{display:grid;gap:.9rem}
.si-strip{margin:0;padding:0;list-style:none;display:flex;gap:.5rem;overflow-x:auto;padding-block:.25rem}
.si-strip-btn{position:relative;display:block;width:3.25rem;height:4.25rem;padding:0;overflow:hidden;border:2px solid transparent;border-radius:.4rem;background:var(--stage-deep,#000);cursor:pointer;opacity:.6;transition:opacity .15s linear,transform .1s ease-out}
.si-strip-btn:hover{opacity:1}
.si-strip-btn:active{transform:scale(.96)}
.si-strip-btn[aria-pressed="true"]{opacity:1;border-color:var(--accent)}
.si-strip-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.si-strip-btn img,.si-strip-btn video{display:block;width:100%;height:100%;object-fit:cover}
.si-strip-btn span{position:absolute;inset-block-end:.1rem;inset-inline-start:.2rem;font-size:.65rem;font-weight:600;text-shadow:0 0 4px #000;font-variant-numeric:tabular-nums}
.si-zoom{display:grid;grid-template-columns:5rem minmax(0,1fr) 3.5rem;align-items:center;gap:.7rem;max-width:34rem;font-size:var(--step--1);color:var(--ink-dim)}
.si-zoom input{width:100%;accent-color:var(--accent)}
.si-zoom output{text-align:end;color:var(--ink);font-variant-numeric:tabular-nums}

.si-groups,.si-group,.si-group-body,.si-block,.si-list,.si-fine[open],.si-fine>*{min-width:0}
.si-group-body,.si-block,.si-list,.si-fine[open]{grid-template-columns:minmax(0,1fr)}

/* voice editor: Images group */
.vi{display:grid;gap:1.1rem}
.vi-grid{display:grid;gap:1.4rem 1.25rem;grid-template-columns:repeat(auto-fill,minmax(min(100%,15rem),1fr))}
.vi-def{display:grid;gap:.5rem;min-width:0}
.vi-box{display:block;position:relative;overflow:hidden;width:100%;border:1px solid var(--hairline);border-radius:.5rem;background:var(--stage-deep,#000)}
.vi-box img{display:block;width:100%;height:100%;object-fit:cover}
.vi-tag{position:absolute;inset-block-start:.5rem;inset-inline-start:.5rem;padding:.15rem .5rem;border-radius:99px;font-size:.7rem;font-weight:600;background:oklch(0.12 0.01 215 / .75);color:var(--ink-dim)}
`;
