"use client";

import { useEffect, useRef } from "react";
import { useUI } from "../state/store";

const TILE = 160;
const FPS = 12;

function makeTile(): string | null {
  const c = document.createElement("canvas");
  c.width = c.height = TILE;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(TILE, TILE);
  for (let i = 0; i < img.data.length; i += 4) {
    // Slightly clustered noise: average two samples for a softer, filmic grain.
    const v = ((Math.random() + Math.random()) * 127.5) | 0;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

const CSS = `
.lbf-grain{position:fixed;inset:0;z-index:80;overflow:hidden;pointer-events:none;mix-blend-mode:overlay;opacity:.3}
.lbf-grain>div{position:absolute;inset:-${TILE}px;background-size:${TILE}px ${TILE}px;will-change:transform}
`;

/**
 * Fixed film grain. ONE noise layer, jumped to a random offset at 12 fps (a compositor-only
 * transform); a fresh offset of the same tile reads as new grain. No React renders.
 */
export function Grain() {
  const layer = useRef<HTMLDivElement>(null);
  const paused = useUI((s) => s.paused);
  const reduced = useUI((s) => s.reducedMotion);
  const still = paused || reduced;

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    if (!el.style.backgroundImage) {
      const tile = makeTile();
      if (!tile) return;
      el.style.backgroundImage = `url(${tile})`;
    }
    if (still) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const x = Math.floor(Math.random() * TILE);
      const y = Math.floor(Math.random() * TILE);
      el.style.transform = `translate3d(${-x}px,${-y}px,0)`;
    }, 1000 / FPS);
    return () => window.clearInterval(id);
  }, [still]);

  return (
    <div className="lbf-grain" aria-hidden="true">
      <style>{CSS}</style>
      <div ref={layer} />
    </div>
  );
}
