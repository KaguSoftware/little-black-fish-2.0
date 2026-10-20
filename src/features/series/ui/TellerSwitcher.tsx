"use client";

import { motion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { TELLERS, tellerPortrait } from "@/shared/content/characters";
import { useSeries, useUI } from "@/shared/state/store";
import { SPRING, tellerAccentCss } from "./lib/enter";

/**
 * Persistent bottom-edge row of six portrait chips. Always reachable (z-20, pointer-events
 * auto). Switching never touches scroll. Roving tabindex: arrows move focus, Enter/Space picks.
 * High-frequency control: instant hover, scale(.97) press, no looping motion.
 */
export function TellerSwitcher() {
  const tr = useTranslations("series");
  const rtl = useLocale() === "fa";
  const teller = useSeries((s) => s.teller);
  const rm = useUI((s) => s.reducedMotion);
  const rowRef = useRef<HTMLUListElement>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const current = TELLERS.findIndex((t) => t.id === teller);

  // Keep the pressed chip (plus its name) in view on the mobile scroll row.
  useEffect(() => {
    const row = rowRef.current;
    const el = btns.current[current];
    if (!row || !el || row.scrollWidth <= row.clientWidth + 1) return;
    const r = row.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    const behavior = rm ? "auto" : "smooth";
    if (rtl) {
      // RTL: the name opens to the chip's left.
      const need = b.left - 170;
      if (b.right > r.right - 8) row.scrollBy({ left: b.right - r.right + 16, behavior });
      else if (need < r.left) row.scrollBy({ left: need - r.left - 16, behavior });
      return;
    }
    const need = b.right + 170;
    if (b.left < r.left + 8) row.scrollBy({ left: b.left - r.left - 16, behavior });
    else if (need > r.right) row.scrollBy({ left: need - r.right + 16, behavior });
  }, [current, rm, rtl]);

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const n = TELLERS.length;
    let j = -1;
    // The row flows right to left on fa, so the arrow that points at the next chip flips.
    const next = rtl ? "ArrowLeft" : "ArrowRight";
    const prev = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === next || e.key === "ArrowDown") j = (i + 1) % n;
    else if (e.key === prev || e.key === "ArrowUp") j = (i - 1 + n) % n;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = n - 1;
    if (j < 0) return;
    e.preventDefault();
    btns.current[j]?.focus();
  };

  return (
    <nav
      aria-label={tr("switcherLabel")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      <ul
        ref={rowRef}
        className="pointer-events-auto flex w-full items-center gap-1.5 overflow-x-auto px-[calc(var(--gutter)-0.25rem)] py-2 [scrollbar-width:none] md:w-fit md:max-w-full md:gap-2 [&::-webkit-scrollbar]:hidden"
      >
        {TELLERS.map((t, i) => {
          const pressed = i === current;
          const accent = tellerAccentCss(t.accent);
          const role = tr(`roles.${t.id}`);
          return (
            <motion.li key={t.id} layout="position" transition={rm ? { duration: 0 } : SPRING} className="shrink-0">
              <button
                ref={(el) => {
                  btns.current[i] = el;
                }}
                type="button"
                aria-pressed={pressed}
                aria-label={tr("hearFrom", { name: t.name, role })}
                tabIndex={pressed ? 0 : -1}
                onClick={() => useSeries.getState().switchTeller(t.id, "switcher")}
                onKeyDown={(e) => onKeyDown(e, i)}
                onPointerEnter={() => useSeries.getState().request([t.id])}
                onFocus={() => useSeries.getState().request([t.id])}
                className="group flex min-h-11 min-w-11 items-center gap-2.5 rounded-full p-0.5 pe-0.5 outline-offset-4 active:scale-[0.97] data-[pressed=true]:pe-3.5"
                data-pressed={pressed}
              >
                <span
                  className="relative block size-11 shrink-0 rounded-full md:size-12"
                  style={{ background: `color-mix(in oklab, ${accent} 35%, var(--stage-deep))` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tellerPortrait(t.id)}
                    alt=""
                    width={48}
                    height={64}
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.visibility = "hidden";
                    }}
                    className={`size-full rounded-full object-cover ${
                      pressed ? "" : "opacity-70 saturate-[0.7] group-hover:opacity-100 group-hover:saturate-100"
                    }`}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-[3px] rounded-full border-2 transition-[opacity,transform] duration-150 ease-out"
                    style={{
                      borderColor: accent,
                      opacity: pressed ? 1 : 0,
                      transform: pressed ? "scale(1)" : "scale(0.92)",
                    }}
                  />
                </span>
                {pressed ? (
                  <motion.span
                    className="whitespace-nowrap"
                    initial={rm ? { opacity: 0 } : { opacity: 0, filter: "blur(4px)" }}
                    animate={rm ? { opacity: 1 } : { opacity: 1, filter: "blur(0px)" }}
                    transition={{ duration: rm ? 0.12 : 0.3, ease: [0.22, 1, 0.36, 1] }}
                    style={{ textShadow: "0 0 14px oklch(0.06 0.01 var(--hue) / 0.9)" }}
                  >
                    <span className="display block text-[length:var(--step-0)]" style={{ color: "var(--ink)" }}>
                      {t.name}
                    </span>
                    <span className="block text-[0.78rem] leading-tight" style={{ color: "var(--ink-dim)" }}>
                      {role}
                    </span>
                  </motion.span>
                ) : null}
              </button>
            </motion.li>
          );
        })}
      </ul>
    </nav>
  );
}
