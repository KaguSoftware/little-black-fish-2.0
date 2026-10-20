"use client";

import { useIris } from "../state/store";

/**
 * Start an iris page transition. The global <IrisTransition/> closes the iris to
 * `origin`, then router.push(href). If `waitForReady`, the destination page must call
 * `useIris.getState().open()` when its first frame is ready (the series page does,
 * once the hero puppet is built); otherwise the iris opens on route change.
 *
 * Usage: onClick={(e) => navigateWithIris("/projects/series", e, { waitForReady: true })}
 */
export function navigateWithIris(
  href: string,
  from: { clientX: number; clientY: number } | { x: number; y: number },
  opts?: { rim?: string; waitForReady?: boolean },
) {
  const origin = "clientX" in from ? { x: from.clientX, y: from.clientY } : from;
  useIris.getState().close(href, origin, opts);
}
