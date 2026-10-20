"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

/**
 * Resolution governor for a <Canvas>. Starts at `max` (clamped to the device ratio), and
 * every second looks at the average frame rate: below ~50 fps it steps the drawing buffer
 * down toward `min`; comfortably smooth again, it steps back up. Each change resizes the
 * buffers (a small hitch), so it settles after a few moves instead of hunting forever.
 */
export function AdaptiveDpr({ min = 1, max = 1.5, step = 0.25 }: { min?: number; max?: number; step?: number }) {
  const setDpr = useThree((s) => s.setDpr);
  const st = useRef({ dpr: 0, acc: 0, frames: 0, slow: 0, fast: 0, moves: 0 });

  useEffect(() => {
    const top = Math.max(min, Math.min(max, window.devicePixelRatio || 1));
    st.current.dpr = top;
    st.current.moves = 0;
    setDpr(top);
  }, [min, max, setDpr]);

  useFrame((_, dt) => {
    const s = st.current;
    // Tab switches and route changes produce huge gaps that say nothing about the GPU.
    if (dt > 0.25 || s.moves >= 6) return;
    s.acc += dt;
    s.frames++;
    if (s.acc < 1) return;
    const fps = s.frames / s.acc;
    s.acc = 0;
    s.frames = 0;
    const top = Math.max(min, Math.min(max, window.devicePixelRatio || 1));
    s.slow = fps < 50 ? s.slow + 1 : 0;
    s.fast = fps > 58 ? s.fast + 1 : 0;
    let next = s.dpr;
    if (s.slow >= 2 && s.dpr > min) next = Math.max(min, s.dpr - step);
    else if (s.fast >= 5 && s.dpr < top) next = Math.min(top, s.dpr + step);
    if (next !== s.dpr) {
      s.dpr = next;
      s.slow = s.fast = 0;
      s.moves++;
      setDpr(next);
    }
  });

  return null;
}
