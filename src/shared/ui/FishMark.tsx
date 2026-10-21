"use client";

import type { CSSProperties } from "react";

interface FishMarkProps {
  /** Rendered height in px (the glyph is about 2:1). Default 22. */
  size?: number;
  /** Accessible name. Omit for a decorative mark (aria-hidden). */
  title?: string;
  /** Gentle tail sway and a glancing pupil. Stops under reduced motion and when ambient motion is paused. */
  animated?: boolean;
  /**
   * Draw the fish as a near-black silhouette outlined in this rim colour (a CSS colour).
   * Without it the fish is a bare line drawing in currentColor.
   */
  rim?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The little black fish: an eye-shaped body holding an iris and pupil, its two
 * lines crossing at the root of a triangular tail. One stroke weight throughout.
 * Geometry is shared with the hero swimmer (FISH_*) so both draw the same fish.
 */
export const FISH_VIEW = { w: 92, h: 48 } as const;
export const FISH_STROKE = 5.2;
/** Nose, crossing (tail root) and tail edge along the axis y = 24. */
export const FISH_NOSE = 3.6;
export const FISH_ROOT = 63.1;
export const FISH_TAIL = 87.7;
export const FISH_EYE = { cx: 32.9, cy: 24, iris: 12.9, pupil: 6.6 } as const;
export const FISH_BODY =
  "M3.6 24C9.2 10 20.5 3.8 31 3.8C48 3.8 57.5 13 63.1 24C57.5 35 48 44.2 31 44.2C20.5 44.2 9.2 38 3.6 24Z";
export const FISH_FIN = "M63.1 24L87.7 7.8V40.2Z";

const CSS = `
.lbf-fish-tail{transform-box:view-box;transform-origin:${FISH_ROOT}px 24px}
.lbf-fish[data-animated="true"] .lbf-fish-tail{animation:lbf-tail 3.4s ease-in-out infinite}
.lbf-fish[data-animated="true"] .lbf-fish-pupil{animation:lbf-glance 9s ease-in-out infinite}
@keyframes lbf-tail{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@keyframes lbf-glance{0%,38%,100%{transform:translate(0,0)}44%,60%{transform:translate(-2.6px,-.6px)}66%,82%{transform:translate(2px,1px)}}
html[data-motion="paused"] .lbf-fish .lbf-fish-tail,
html[data-motion="paused"] .lbf-fish .lbf-fish-pupil{animation:none}
@media (prefers-reduced-motion:reduce){
.lbf-fish .lbf-fish-tail,.lbf-fish .lbf-fish-pupil{animation:none!important}
}
`;

export function FishMark({ size = 22, title, animated = false, rim, className, style }: FishMarkProps) {
  const w = (size * FISH_VIEW.w) / FISH_VIEW.h;
  const line = rim ?? "currentColor";
  const fill = rim ? "var(--stage-deep)" : "none";
  return (
    <svg
      className={["lbf-fish", className].filter(Boolean).join(" ")}
      data-animated={animated ? "true" : "false"}
      viewBox={`0 0 ${FISH_VIEW.w} ${FISH_VIEW.h}`}
      width={w}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      style={{ display: "block", overflow: "visible", ...style }}
    >
      <style>{CSS}</style>
      <g fill={fill} stroke={line} strokeWidth={FISH_STROKE} strokeLinejoin="round" strokeLinecap="round">
        <g className="lbf-fish-tail">
          <path d={FISH_FIN} />
        </g>
        <path d={FISH_BODY} />
        <circle cx={FISH_EYE.cx} cy={FISH_EYE.cy} r={FISH_EYE.iris} fill="none" />
      </g>
      <circle className="lbf-fish-pupil" cx={FISH_EYE.cx} cy={FISH_EYE.cy} r={FISH_EYE.pupil} fill={line} />
    </svg>
  );
}
