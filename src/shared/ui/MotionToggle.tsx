"use client";

import { usePathname } from "next/navigation";
import { useUI } from "../state/store";

const CSS = `
.lbf-motion{position:fixed;left:var(--gutter);bottom:max(.5rem,env(safe-area-inset-bottom));z-index:55;margin-left:-.5rem;
padding:.4rem .5rem;border:0;border-radius:3px;background:none;cursor:pointer;color:var(--ink-dim);
font-family:var(--font-sans);font-weight:500;font-size:var(--step--1);line-height:1;white-space:nowrap;
text-shadow:0 0 14px oklch(0.08 0.01 215/.9);transition:color .12s linear}
.lbf-motion:hover,.lbf-motion:focus-visible{color:var(--ink)}
.lbf-motion:active{transform:scale(.97)}
.lbf-motion[data-side=right]{left:auto;right:var(--gutter);margin-left:0;margin-right:-.5rem}
@media (max-width:40rem){.lbf-motion{top:calc(env(safe-area-inset-top) + 3.4rem);bottom:auto}.lbf-motion[data-side=right]{top:max(.75rem,env(safe-area-inset-top))}.lbf-motion{font-size:.75rem}}
`;

export function MotionToggle() {
  const paused = useUI((s) => s.paused);
  const toggle = useUI((s) => s.togglePaused);
  // The series page owns the bottom-left corner (teller switcher), so the toggle moves right there.
  const side = usePathname()?.startsWith("/projects/series") ? "right" : "left";
  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="lbf-motion" data-side={side} onClick={toggle}>
        {paused ? "Play motion" : "Pause motion"}
      </button>
    </>
  );
}
