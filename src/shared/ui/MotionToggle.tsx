"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { useUI } from "../state/store";

const CSS = `
.lbf-motion{position:fixed;inset-inline-start:var(--gutter);bottom:max(.5rem,env(safe-area-inset-bottom));z-index:55;margin-inline-start:-.5rem;
padding:.4rem .5rem;border:0;border-radius:3px;background:none;cursor:pointer;color:var(--ink-dim);
font-family:var(--font-sans);font-weight:500;font-size:var(--step--1);line-height:1;white-space:nowrap;
text-shadow:0 0 14px oklch(0.08 0.01 215/.9);transition:color .12s linear}
.lbf-motion:hover,.lbf-motion:focus-visible{color:var(--ink)}
.lbf-motion:active{transform:scale(.97)}
.lbf-motion[data-side=end]{inset-inline-start:auto;inset-inline-end:var(--gutter);margin-inline-start:0;margin-inline-end:-.5rem}
@media (max-width:40rem){.lbf-motion{top:calc(env(safe-area-inset-top) + 3.4rem);bottom:auto}.lbf-motion[data-side=end]{top:max(.75rem,env(safe-area-inset-top))}.lbf-motion{font-size:.75rem}}
`;

export function MotionToggle() {
  const paused = useUI((s) => s.paused);
  const toggle = useUI((s) => s.togglePaused);
  const t = useTranslations("common");
  // The series page owns the bottom start corner (teller switcher), so the toggle moves to the end there.
  // Logical sides, so both mirror together in RTL.
  const side = usePathname()?.startsWith("/projects/series") ? "end" : "start";
  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="lbf-motion" data-side={side} onClick={toggle}>
        {paused ? t("playMotion") : t("pauseMotion")}
      </button>
    </>
  );
}
