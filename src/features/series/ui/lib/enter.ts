/**
 * Shared enter/exit recipes (DESIGN.md): enter = opacity + 8px translate + 4px blur on a
 * bounce-0 spring (~0.45 s); exit is subtler (~200 ms). Reduced motion: opacity only.
 */
export const SPRING = { type: "spring", bounce: 0, duration: 0.45 } as const;
const EXIT_EASE = [0.22, 1, 0.36, 1] as const;

export function enterMotion(rm: boolean, delay = 0) {
  if (rm) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration: 0.2, delay } },
      exit: { opacity: 0, transition: { duration: 0.15 } },
    };
  }
  return {
    initial: { opacity: 0, y: 8, filter: "blur(4px)" },
    animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { ...SPRING, delay } },
    exit: {
      opacity: 0,
      y: -8,
      filter: "blur(4px)",
      transition: { duration: 0.2, ease: EXIT_EASE },
    },
  };
}

/** Variants version for staggered lists. */
export function listVariants(rm: boolean, stagger = 0.07, delay = 0.2) {
  return {
    parent: {
      hidden: {},
      show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      exit: { opacity: 0, transition: { duration: rm ? 0.12 : 0.2 } },
    },
    item: rm
      ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } }
      : {
          hidden: { opacity: 0, y: 8, filter: "blur(4px)" },
          show: { opacity: 1, y: 0, filter: "blur(0px)", transition: SPRING },
        },
  };
}

/** Teller accent as a CSS colour (not the blended per-frame one). */
export const tellerAccentCss = (a: readonly [number, number, number]) => `oklch(${a[0]} ${a[1]} ${a[2]})`;
