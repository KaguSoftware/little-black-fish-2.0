"use client";

import type { CSSProperties } from "react";

interface FishMarkProps {
  /** Rendered height in px (the glyph is 2:1). Default 22. */
  size?: number;
  /** Accessible name. Omit for a decorative mark (aria-hidden). */
  title?: string;
  /** Gentle tail sway. Stops under reduced motion and when ambient motion is paused. */
  animated?: boolean;
  /**
   * Draw the fish as a near-black silhouette lit by this rim colour (a CSS colour).
   * Without it the fish fills with currentColor.
   */
  rim?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The little black fish: one ink stroke of a body, flicked fins, and a long
 * trailing tail. Body fill is currentColor so it can sit in ink on the stage or
 * in black on a lit plate. The eye is a cut-out coloured by --fish-eye.
 */
const BODY =
  "M2.2 16.6C3.6 11 9 6.8 17 6.8C27 6.8 34 11.2 41.2 14.6L42 17.4C34 22 27 26 17.6 25.6C9 25.2 3.4 22.2 2.2 16.6Z";
const DORSAL = "M19 9.2C21 5 25.5 2.6 31 2.4C28.6 4.2 27.6 6.6 27.8 10.2Z";
const PELVIC = "M22.6 23.6C23.8 26.4 26.4 28.2 29.6 28.4C28 26.8 27.4 25.2 27.6 22.8Z";
const TAIL =
  "M40 14.6C45 14.6 49.5 11.8 53 7.6C55.4 4.8 58 3.4 61.8 3C60 6.2 59.4 9.4 59.6 12.8C58.6 15.2 57.2 16.4 55 17C58.2 19.4 60 23 59.4 28.6C56.8 25.8 54 23.4 50 21.2C46 19 43 17.8 40 17.4Z";

const CSS = `
.lbf-fish-tail{transform-box:view-box;transform-origin:40px 16px}
.lbf-fish-fin{transform-box:view-box;transform-origin:24px 9px}
.lbf-fish[data-animated="true"] .lbf-fish-tail{animation:lbf-tail 3.4s ease-in-out infinite}
.lbf-fish[data-animated="true"] .lbf-fish-fin{animation:lbf-fin 3.4s ease-in-out infinite .4s}
@keyframes lbf-tail{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(6deg)}}
@keyframes lbf-fin{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(3deg)}}
html[data-motion="paused"] .lbf-fish .lbf-fish-tail,
html[data-motion="paused"] .lbf-fish .lbf-fish-fin{animation:none}
@media (prefers-reduced-motion:reduce){
.lbf-fish .lbf-fish-tail,.lbf-fish .lbf-fish-fin{animation:none!important}
}
`;

export function FishMark({ size = 22, title, animated = false, rim, className, style }: FishMarkProps) {
  const w = size * 2;
  const lit = rim ? { fill: "var(--stage-deep)", stroke: rim, strokeWidth: 0.7, strokeLinejoin: "round" as const } : {};
  return (
    <svg
      className={["lbf-fish", className].filter(Boolean).join(" ")}
      data-animated={animated ? "true" : "false"}
      viewBox="0 0 64 32"
      width={w}
      height={size}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
      style={{ display: "block", overflow: "visible", ...style }}
    >
      <style>{CSS}</style>
      <g fill="currentColor" {...lit}>
        <g className="lbf-fish-fin">
          <path d={DORSAL} />
        </g>
        <path d={PELVIC} />
        <path d={BODY} />
        <g className="lbf-fish-tail">
          <path d={TAIL} />
        </g>
      </g>
      <circle cx="9.2" cy="14.4" r="1.2" fill="var(--fish-eye, var(--stage, #1c1f26))" />
    </svg>
  );
}
