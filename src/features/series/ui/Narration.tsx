"use client";

import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { CHAPTER_BY_ID, TYPE_WINDOW } from "@/shared/content/chapters";
import { HELLO, MAKER, TELLER_BY_ID } from "@/shared/content/characters";
import type { ChapterId, TellerId } from "@/shared/content/types";
import { clamp, damp, hash1, invLerp, smoothstep } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { useSeries, useUI } from "@/shared/state/store";
import { enterMotion } from "./lib/enter";
import { hasArabicScript } from "./lib/i18n";

const RETYPE_MS = 600;
const EXIT_MS = 200;

const TEXT_SHADOW =
  "0 1px 1px oklch(0.06 0.01 var(--hue) / 0.55), 0 0 18px oklch(0.06 0.01 var(--hue) / 0.75), 0 0 44px oklch(0.06 0.01 var(--hue) / 0.5)";

/** Placement of the narration block. Text sits opposite the hero; mobile docks above the switcher. */
function placement(chapter: ChapterId): string {
  const side = CHAPTER_BY_ID[chapter].side;
  const textSide = side === 0 ? 0 : -side; // matches runtime.frame.textSide
  if (chapter === "others") {
    return "items-start justify-start pt-[5.5rem] md:pt-[12vh]";
  }
  if (textSide === 0) {
    return "items-end justify-start pb-[8.5rem] md:pb-[24vh] md:pl-[6vw]";
  }
  if (textSide === -1) {
    return "items-end justify-start pb-[8.5rem] md:items-center md:pb-0";
  }
  return "items-end justify-start pb-[8.5rem] md:items-center md:justify-end md:pb-0";
}

interface Cur {
  teller: TellerId;
  chapter: ChapterId;
  /** Entered because the teller changed: old line exits, new one re-types. */
  retype: boolean;
}

export function Narration() {
  const tr = useTranslations("series");
  const teller = useSeries((s) => s.teller);
  const chapter = useSeries((s) => s.chapter);
  const rm = useUI((s) => s.reducedMotion);

  const [cur, setCur] = useState<Cur>({ teller, chapter, retype: false });
  if (cur.teller !== teller || cur.chapter !== chapter) {
    setCur({ teller, chapter, retype: cur.teller !== teller });
  }

  const t = TELLER_BY_ID[cur.teller];
  const raw = t.narration[cur.chapter];
  // The shared HELLO / MAKER templates are localized; every other line is the teller's own copy.
  const text =
    cur.chapter === "hello" && raw === HELLO(t.name)
      ? tr("narration.hello", { name: t.name })
      : cur.chapter === "maker" && raw === MAKER
        ? tr("narration.maker")
        : raw;
  const retype = cur.retype && !rm;
  const m = enterMotion(rm, retype ? EXIT_MS / 1000 : 0);

  return (
    <div className="absolute inset-0">
      <AnimatePresence initial>
        {text ? (
          <motion.div
            key={`${cur.teller}:${cur.chapter}`}
            // Stage-anchored: the text side follows where the hero stands in 3D, so placement stays physical in RTL.
            dir="ltr"
            className={`absolute inset-0 flex px-[var(--gutter)] ${placement(cur.chapter)}`}
            initial={m.initial}
            animate={m.animate}
            exit={m.exit}
          >
            <Line
              tellerLabel={tr("tellerLabel", { name: t.name, role: tr(`roles.${t.id}`) })}
              chapter={cur.chapter}
              text={text}
              retypeDelayMs={retype ? EXIT_MS : 0}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * One narration line: per-letter spans, a caret, and a single rAF loop writing their styles.
 * Persian (Arabic script) must keep its letters joined, so such lines animate per word instead:
 * each word is one span that types in over its own length, with the same motion terms.
 */
function Line({
  tellerLabel,
  chapter,
  text,
  retypeDelayMs,
}: {
  tellerLabel: string;
  chapter: ChapterId;
  text: string;
  retypeDelayMs: number;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLParagraphElement>(null);
  const present = useIsPresent();
  const presentRef = useRef(true);
  useEffect(() => {
    presentRef.current = present;
  }, [present]);

  const rtl = hasArabicScript(text);

  // Words of units; `i` is the index of the unit's first character in the full string (spaces
  // count), `len` how many characters it covers. Latin text: one unit per letter. Persian: one
  // unit per word, with runs of non-Persian words (e.g. a Latin name) kept together as one LTR unit.
  const { words, n } = useMemo(() => {
    const tokens = text.split(" ");
    const out: { ch: string; i: number; len: number; ltr?: boolean }[][] = [];
    let off = 0;
    if (!rtl) {
      for (const w of tokens) {
        out.push(Array.from(w).map((ch, k) => ({ ch, i: off + k, len: 1 })));
        off += Array.from(w).length + 1;
      }
    } else {
      let k = 0;
      while (k < tokens.length) {
        let j = k + 1;
        const ltr = !hasArabicScript(tokens[k]);
        if (ltr) while (j < tokens.length && !hasArabicScript(tokens[j])) j++;
        const ch = tokens.slice(k, j).join(" ");
        const len = Array.from(ch).length;
        out.push([{ ch, i: off, len, ltr }]);
        off += len + 1;
        k = j;
      }
    }
    return { words: out, n: Array.from(text).length };
  }, [text, rtl]);

  useEffect(() => {
    const textEl = textRef.current;
    const blockEl = blockRef.current;
    const labelEl = labelRef.current;
    const caret = caretRef.current;
    if (!textEl || !blockEl || !caret) return;

    const letters = Array.from(textEl.querySelectorAll<HTMLElement>("[data-l]"));
    const L = letters.length;
    const idx = letters.map((l) => Number(l.dataset.i));
    const span = letters.map((l) => Number(l.dataset.len) || 1);
    const left = new Float32Array(L);
    const top = new Float32Array(L);
    const wid = new Float32Array(L);
    const hei = new Float32Array(L);
    let fontPx = 32;
    const measure = () => {
      for (let k = 0; k < L; k++) {
        const e = letters[k];
        left[k] = e.offsetLeft;
        top[k] = e.offsetTop;
        wid[k] = e.offsetWidth;
        hei[k] = e.offsetHeight;
      }
      fontPx = parseFloat(getComputedStyle(textEl).fontSize) || 32;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(textEl);
    document.fonts?.ready.then(measure).catch(() => {});

    // Per-letter state
    const lastA = new Float32Array(L).fill(-1);
    // Last strings written per letter: identical frames cost no style invalidation.
    const lastO: string[] = new Array(L).fill("");
    const lastT: string[] = new Array(L).fill("-");
    const offX = new Float32Array(L);
    const offY = new Float32Array(L);
    const fx = new Float32Array(L);
    const fy = new Float32Array(L);
    const fr = new Float32Array(L);

    const start = performance.now() + retypeDelayMs;
    let disp = 0;
    let caretOp = 0;
    let lastMotion = -1;
    let lastFade = -1;
    let raf = 0;
    let last = performance.now();

    const tick = (nowMs: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, Math.max(0.0001, (nowMs - last) / 1000));
      last = nowMs;
      const t = nowMs / 1000;
      const ui = useUI.getState();
      const rm = ui.reducedMotion;
      const motionOn = !rm && !ui.paused;
      const F = runtime.frame;
      const isPresent = presentRef.current;

      // ── how many characters are revealed ──────────────────────────────
      if (isPresent) {
        const holdT = F.r.chapter === chapter ? F.r.holdT : 0;
        let target = n * invLerp(TYPE_WINDOW.start, TYPE_WINDOW.end, holdT);
        if (retypeDelayMs > 0) {
          // Teller switch: re-type from 0 up to the current count over ~600 ms, then follow scroll.
          target *= clamp((nowMs - start) / RETYPE_MS);
        }
        if (rm) disp = target;
        else {
          disp = damp(disp, target, 38, dt);
          if (Math.abs(disp - target) < 0.004) disp = target;
        }
      }

      // ── fade out as MY MAKER content rises over the line ──────────────
      let fade = 1;
      if (chapter === "maker") {
        const mk = document.getElementById("maker-content");
        const vh = window.innerHeight;
        fade = mk
          ? smoothstep(0.3 * vh, 0.62 * vh, mk.getBoundingClientRect().top)
          : 1 - smoothstep(0.6, 0.85, F.r.holdT);
      }
      if (fade !== lastFade) {
        lastFade = fade;
        blockEl.style.opacity = fade.toFixed(3);
      }

      // ── letters ───────────────────────────────────────────────────────
      const W = F.mood.letters;
      const m = motionOn ? 1 : 0;
      const force = m !== lastMotion;
      lastMotion = m;
      const px = runtime.pointer.px;
      const py = runtime.pointer.py;
      const flinchOn = m === 1 && W.flinch > 0.01 && runtime.pointer.active;
      const rr = flinchOn ? textEl.getBoundingClientRect() : null;
      let lastK = -1;

      for (let k = 0; k < L; k++) {
        const i = idx[k];
        const len = span[k];
        const a = clamp((disp - i) / (len + W.settle));
        if (a > 0 && disp - i > 0) lastK = k;
        const el = letters[k];
        if (a === 0 && lastA[k] === 0 && !force) continue;
        if (m === 0 && !force && a === lastA[k]) continue;
        lastA[k] = a;

        let x = 0;
        let y = 0;
        let rot = 0;

        if (!rm) {
          // Entry: letters rise in; settle lands them from above with a slow stagger.
          const aS = 1 - Math.pow(1 - clamp((disp - i) / (4 + len)), 3);
          y += (1 - a) * 0.3 * (1 - W.settle) - (1 - aS) * 0.45 * W.settle;
        }

        if (m === 1) {
          const pos = n > 1 ? i / (n - 1) : 0;
          if (W.droop > 0.001) {
            const d = W.droop;
            y += d * (0.2 * Math.pow(pos, 1.3) + 0.012 * Math.sin(t * 0.7 + i * 0.21));
            x += d * Math.sin(t * 0.45 + i * 0.15) * 0.01;
            rot += d * (pos * 3.5 + Math.sin(t * 0.5 + i * 0.3) * 0.8);
          }
          if (W.jitter > 0.001) {
            // Fractured, not shaking: each letter is knocked off its line once and holds there.
            const j = W.jitter;
            x += j * hash1(i * 3.7) * 0.022;
            y += j * hash1(i * 9.1 + 17) * 0.03;
            rot += j * hash1(i * 1.9 + 53) * 2.4;
          }
          if (W.wave > 0.001) {
            const w = W.wave;
            const ph = t * 0.55 - i * 0.22;
            y += w * Math.sin(ph) * 0.035;
            rot += w * Math.cos(ph) * 0.6;
          }
          if (W.hop > 0.001) {
            // A slow lift travelling along the line.
            const lift = Math.max(0, Math.sin(t * 0.6 - i * 0.12));
            y -= W.hop * lift * lift * 0.05;
          }
          // Flinch: letters lean away from the cursor and ease back, never jump.
          let tx = 0;
          let ty = 0;
          let lr = 0;
          if (flinchOn && rr) {
            const dx = rr.left + left[k] + wid[k] / 2 - px;
            const dy = rr.top + top[k] + hei[k] / 2 - py;
            const d = Math.hypot(dx, dy);
            if (d < 140) {
              const s = smoothstep(0, 1, 1 - d / 140);
              const inv = d > 0.001 ? 1 / d : 0;
              tx = dx * inv * s * 0.18;
              ty = dy * inv * s * 0.12;
              lr = Math.sign(dx || 1) * s * 3;
            }
          }
          fx[k] = damp(fx[k], tx, 4, dt);
          fy[k] = damp(fy[k], ty, 4, dt);
          fr[k] = damp(fr[k], lr, 4, dt);
          if (W.flinch > 0.001) {
            x += W.flinch * fx[k];
            y += W.flinch * fy[k];
            rot += W.flinch * fr[k];
          }
        }

        offX[k] = x;
        offY[k] = y;
        const o = a.toFixed(3);
        if (o !== lastO[k]) el.style.opacity = lastO[k] = o;
        const tr =
          x === 0 && y === 0 && rot === 0
            ? ""
            : `translate3d(${x.toFixed(3)}em,${y.toFixed(3)}em,0) rotate(${rot.toFixed(2)}deg)`;
        if (tr !== lastT[k]) el.style.transform = lastT[k] = tr;
      }

      // ── caret after the last revealed letter (steady, no blink) ───────
      const typing = isPresent && lastK >= 0 && disp < n - 0.01;
      caretOp = damp(caretOp, typing ? 1 : 0, 16, dt);
      if (lastK >= 0) {
        // RTL lines type leftward, so the caret sits at the revealed word's left edge.
        const cx =
          (rtl ? left[lastK] - 0.12 * fontPx : left[lastK] + wid[lastK] + 0.05 * fontPx) + offX[lastK] * fontPx;
        const cy = top[lastK] + (hei[lastK] - 0.88 * fontPx) / 2 + offY[lastK] * fontPx;
        caret.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      }
      caret.style.opacity = caretOp < 0.01 ? "0" : caretOp.toFixed(3);
      // The speaker label appears with the first letters, so it never floats alone between lines.
      if (labelEl) labelEl.style.opacity = clamp(disp / 3).toFixed(3);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [chapter, n, retypeDelayMs, words, rtl]);

  return (
    <div
      ref={blockRef}
      dir={rtl ? "rtl" : "ltr"}
      className="relative"
      style={{
        fontFamily: "var(--font-sans)",
        fontSize: "var(--step-2)",
        maxWidth: "min(22ch, 100%)",
        width: "22ch",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-[3rem] -inset-y-[4rem] -z-10"
        style={{
          background:
            "radial-gradient(closest-side, oklch(0.07 0.012 var(--hue) / 0.55), oklch(0.07 0.012 var(--hue) / 0.28) 55%, transparent)",
        }}
      />
      <p
        ref={labelRef}
        className={`mb-[0.9rem] text-[length:var(--step--1)] leading-tight ${hasArabicScript(tellerLabel) ? "" : "tracking-[0.01em]"}`}
        style={{ color: "var(--ink-dim)", textShadow: TEXT_SHADOW }}
      >
        {tellerLabel}
      </p>
      <div
        ref={textRef}
        role="text"
        aria-label={text}
        className="relative"
        style={{
          fontWeight: 500,
          lineHeight: 1.18,
          // Tracking would pull joined Persian letters apart.
          letterSpacing: rtl ? 0 : "-0.005em",
          color: "var(--ink)",
          textShadow: TEXT_SHADOW,
        }}
      >
        {words.map((w, wi) => (
          <span key={wi} aria-hidden="true">
            <span className="inline-block whitespace-nowrap">
              {w.map((l) => (
                <span
                  key={l.i}
                  data-l=""
                  data-i={l.i}
                  data-len={l.len}
                  dir={l.ltr ? "ltr" : undefined}
                  className="inline-block"
                  style={{ opacity: 0, transformOrigin: "50% 100%" }}
                >
                  {l.ch}
                </span>
              ))}
            </span>
            {wi < words.length - 1 ? " " : null}
          </span>
        ))}
        <span
          ref={caretRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-[1px]"
          style={{ width: "0.07em", height: "0.88em", background: "var(--accent)", opacity: 0, willChange: "transform" }}
        />
      </div>
    </div>
  );
}
