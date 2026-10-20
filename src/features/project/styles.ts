/** Stylesheets for the client pieces, kept out of the "use client" modules so the server page can inline them. */

export const VIDEO_CSS = `
.pj-stage{position:relative;margin-block:clamp(1.5rem,5vh,3.5rem) 0}
.pj-stage::before{content:"";position:absolute;inset:-12% -8%;z-index:-1;pointer-events:none;
background:radial-gradient(ellipse 60% 55% at 50% 45%,oklch(0.93 0.012 80/.06),transparent 70%)}
.pj-screen{position:relative;width:100%;aspect-ratio:16/9;background:var(--stage-deep);overflow:hidden}
.pj-stage[data-tall="true"] .pj-screen{aspect-ratio:9/16;width:min(100%,28rem,calc(84svh * 9 / 16))}
.pj-stage[data-state="playing"] .pj-screen{box-shadow:0 0 140px oklch(0.93 0.012 80/.07)}
.pj-iframe{position:absolute;inset:0;width:100%;height:100%;border:0;opacity:0;transition:opacity .7s var(--ease-out-quint)}
.pj-stage[data-state="playing"] .pj-iframe{opacity:1}

.pj-poster{position:absolute;inset:0;z-index:2;display:block;width:100%;height:100%;margin:0;padding:0;border:0;
background:var(--stage-deep);color:var(--ink);cursor:pointer;
transition:opacity .7s var(--ease-out-quint),visibility 0s linear .7s}
.pj-poster:disabled{cursor:progress}
.pj-stage[data-state="playing"] .pj-poster{opacity:0;visibility:hidden;pointer-events:none}
.pj-poster-img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:cover;
-webkit-mask-image:radial-gradient(ellipse 78% 82% at 50% 45%,#000 52%,transparent 100%);
mask-image:radial-gradient(ellipse 78% 82% at 50% 45%,#000 52%,transparent 100%);
animation:pj-emerge 2.2s var(--ease-out-quint) both;
transition:filter .8s var(--ease-out-quint),transform 1.2s var(--ease-out-quint)}
.pj-poster:hover .pj-poster-img,.pj-poster:focus-visible .pj-poster-img{transform:scale(1.015)}
.pj-stage[data-state="loading"] .pj-poster-img{filter:brightness(.28);transform:scale(1.02)}
@keyframes pj-emerge{from{opacity:0;filter:brightness(0);transform:scale(1.035)}60%{opacity:1}to{opacity:1;filter:brightness(1);transform:none}}
.pj-poster-flicker{position:absolute;inset:0;background:oklch(0.97 0.01 80);mix-blend-mode:soft-light;opacity:0;pointer-events:none;
animation:pj-flicker 5.3s steps(1,end) 2.2s infinite}
@keyframes pj-flicker{0%{opacity:0}7%{opacity:.12}8%{opacity:0}41%{opacity:.08}43%{opacity:0}77%{opacity:.14}78%{opacity:.04}80%{opacity:0}100%{opacity:0}}

.pj-play{position:absolute;inset-block-end:clamp(1rem,4%,2.5rem);inset-inline-start:clamp(1rem,4%,2.75rem);
display:flex;align-items:center;gap:clamp(.75rem,1.5vw,1.25rem);text-shadow:0 0 24px oklch(0.08 0.01 215/.9)}
.pj-stage[data-tall="true"] .pj-play{inset-inline-start:50%;translate:-50% 0;flex-direction:column;gap:.6rem}
[dir="rtl"] .pj-stage[data-tall="true"] .pj-play{translate:50% 0}
.pj-play-ring{width:clamp(3.25rem,5vw,4.5rem);height:auto;overflow:visible;filter:drop-shadow(0 0 18px oklch(0.08 0.01 215/.8))}
.pj-ring-rest{fill:oklch(0.08 0.01 215/.35);stroke:var(--hairline);stroke-width:1.5}
.pj-ring-lit{fill:none;stroke:var(--accent);stroke-width:2;stroke-dasharray:1;stroke-dashoffset:1;
transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset .7s var(--ease-out-quint)}
.pj-play-tri{fill:var(--ink);transition:fill .2s linear}
.pj-play-label{font-family:var(--font-display-35);font-size:var(--step-2);line-height:1;color:var(--ink);
transition:transform .5s var(--ease-out-quint)}
.pj-poster:hover .pj-ring-lit,.pj-poster:focus-visible .pj-ring-lit{stroke-dashoffset:0}
.pj-poster:hover .pj-play-tri,.pj-poster:focus-visible .pj-play-tri{fill:var(--accent)}
.pj-poster:hover .pj-play-label,.pj-poster:focus-visible .pj-play-label{transform:translateX(.12em)}
[dir="rtl"] .pj-poster:hover .pj-play-label,[dir="rtl"] .pj-poster:focus-visible .pj-play-label{transform:translateX(-.12em)}
.pj-stage[data-tall="true"] .pj-poster:hover .pj-play-label{transform:none}
.pj-poster:active .pj-play-ring{scale:.97}
.pj-stage[data-state="loading"] .pj-ring-lit{stroke-dashoffset:0;animation:pj-breathe 1.4s ease-in-out infinite alternate}
@keyframes pj-breathe{from{opacity:1}to{opacity:.35}}
.pj-poster:focus-visible{outline:none}
.pj-poster:focus-visible .pj-play-ring{outline:2px solid var(--accent);outline-offset:6px;border-radius:50%}

html[data-motion="paused"] .pj-poster-flicker{animation:none}
.pj-stage[data-reduced="true"] .pj-poster-img{animation:none}
@media (prefers-reduced-motion:reduce){
.pj-poster-img{animation:pj-fade .4s linear both;transition:none}
.pj-poster:hover .pj-poster-img,.pj-poster:focus-visible .pj-poster-img{transform:none}
.pj-poster-flicker,.pj-stage[data-state="loading"] .pj-ring-lit{animation:none}
.pj-poster,.pj-iframe{transition:none}
.pj-play-label{transition:none}
}
@keyframes pj-fade{from{opacity:0}to{opacity:1}}
`;

export const GALLERY_CSS = `
.pj-img{display:block;width:100%;height:auto;
-webkit-mask-image:linear-gradient(to right,transparent,#000 4%,#000 96%,transparent),linear-gradient(to bottom,transparent,#000 6%,#000 94%,transparent);
-webkit-mask-composite:source-in;
mask-image:linear-gradient(to right,transparent,#000 4%,#000 96%,transparent),linear-gradient(to bottom,transparent,#000 6%,#000 94%,transparent);
mask-composite:intersect}

.pj-lead{position:relative;margin:clamp(1.5rem,5vh,3.5rem) calc(var(--gutter) * -1) 0}
.pj-lead-img{max-height:88svh;object-fit:cover;
-webkit-mask-image:radial-gradient(ellipse 85% 90% at 50% 40%,#000 55%,transparent 100%);
mask-image:radial-gradient(ellipse 85% 90% at 50% 40%,#000 55%,transparent 100%);
animation:pj-emerge 2.2s var(--ease-out-quint) both}

.pj-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));align-items:start;
gap:clamp(2.5rem,7vw,6rem) clamp(.75rem,2vw,2rem);margin-top:clamp(3.5rem,10vh,7rem)}
.pj-fig{position:relative;margin:0;grid-column:1/-1}
.pj-fig[data-v="1"]{grid-column:4/-1}
.pj-fig[data-v="2"]{grid-column:1/span 10}
.pj-fig[data-v="3"]{grid-column:3/-1}
.pj-fig[data-v="5"]{grid-column:1/span 9}
.pj-fig[data-v="6"]{grid-column:4/-1}
@media (min-width:56rem){
.pj-fig[data-v="0"]{grid-column:1/span 7}
.pj-fig[data-v="1"]{grid-column:9/span 4;margin-top:clamp(4rem,14vw,12rem)}
.pj-fig[data-v="2"]{grid-column:3/span 8}
.pj-fig[data-v="3"]{grid-column:1/span 5;margin-top:clamp(2rem,6vw,5rem)}
.pj-fig[data-v="4"]{grid-column:6/span 7}
.pj-fig[data-v="5"]{grid-column:2/span 6}
.pj-fig[data-v="6"]{grid-column:8/span 5;margin-top:clamp(3rem,10vw,9rem)}
}
.pj-grid .pj-fig[data-open="true"]{grid-column:1/-1;margin-top:0;z-index:2}
.pj-frame{position:relative}
.pj-zoom{display:block;width:100%;margin:0;padding:0;border:0;background:none;color:inherit;cursor:zoom-in}
.pj-fig[data-open="true"] .pj-zoom{cursor:zoom-out}
.pj-zoom .pj-img{transition:filter .5s var(--ease-out-quint)}
.pj-grid:has(.pj-fig[data-open="true"]) .pj-fig[data-open="false"] .pj-img{filter:brightness(.45)}
.pj-zoom:focus-visible{outline:2px solid var(--accent);outline-offset:4px}

@media (prefers-reduced-motion:reduce){.pj-lead-img{animation:pj-fade .4s linear both}.pj-zoom .pj-img{transition:none}}
`;
