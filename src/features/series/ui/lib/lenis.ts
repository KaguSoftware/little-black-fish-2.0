import type Lenis from "lenis";
import { useUI } from "@/shared/state/store";
import { easeOutExpo } from "@/shared/lib/math";

/**
 * Module-level handle on the page's Lenis instance, set by <SmoothScroll/>.
 * Everything that needs to move the page (cast list replay, autoplay) goes through here
 * so reduced motion and "no Lenis yet" are handled in one place.
 */
let instance: Lenis | null = null;

export const getLenis = () => instance;
export const setLenis = (l: Lenis | null) => {
  instance = l;
};

/** Scrollable distance of the story: #story-spacer height minus one viewport. */
export function storyRange(): number {
  if (typeof document === "undefined") return 1;
  const el = document.getElementById("story-spacer");
  if (!el) return 1;
  return Math.max(1, el.offsetHeight - window.innerHeight);
}

export interface GlideOptions {
  /** Seconds. */
  duration?: number;
  easing?: (t: number) => number;
  immediate?: boolean;
  onComplete?: () => void;
}

export function scrollToY(y: number, opts: GlideOptions = {}) {
  const rm = useUI.getState().reducedMotion;
  const immediate = opts.immediate || rm;
  const lenis = instance;
  if (!lenis) {
    window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
    opts.onComplete?.();
    return;
  }
  if (immediate) {
    lenis.scrollTo(y, { immediate: true, force: true });
    opts.onComplete?.();
    return;
  }
  lenis.scrollTo(y, {
    duration: opts.duration,
    easing: opts.easing,
    force: true,
    onComplete: () => opts.onComplete?.(),
  });
}

/** Glide to a story progress value (0..1). */
export function scrollToProgress(p: number, opts: GlideOptions = {}) {
  scrollToY(Math.min(1, Math.max(0, p)) * storyRange(), opts);
}

/** Long eased scroll back to chapter 00 (used to replay the story in a new voice). */
export function scrollToTop(opts: GlideOptions = {}) {
  scrollToY(0, { duration: 2.4, easing: easeOutExpo, ...opts });
}

/** Cancel any in-flight programmatic glide by re-targeting the current position. */
export function cancelGlide() {
  const lenis = instance;
  if (lenis) lenis.scrollTo(lenis.scroll, { immediate: true, force: true });
}
