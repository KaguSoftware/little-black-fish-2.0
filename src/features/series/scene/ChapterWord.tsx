"use client";

import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Color, MeshBasicMaterial, type Group, type Mesh } from "three";
import { CHAPTER_BY_ID } from "@/shared/content/chapters";
import { TELLER_BY_ID } from "@/shared/content/characters";
import { MOODS } from "@/shared/content/moods";
import { oklchToLinear } from "@/shared/lib/color";
import { damp, lerp, smoothstep } from "@/shared/lib/math";
import { runtime } from "@/shared/lib/runtime";
import { useSeries, useUI } from "@/shared/state/store";

// ── Tuning ─────────────────────────────────────────────────────────────────
/** Where the word stands: upstage of the hero, a little above the floor. */
const WORD_Z = -6;
const WORD_BASE_Y = 0.45;
/** Drift toward the hero's side of the stage (fraction of hero x). */
const WORD_X_FOLLOW = 0.3;
const WORD_X_RATE = 4;

/** Wanted letter height (m) and the font's cap-height / em ratio. */
const WORD_CAP_HEIGHT = 2.6;
const CAP_RATIO = 0.7;
/** Never wider than this (m) at maximum spread; the whole group scales down to fit. */
const WORD_MAX_WIDTH = 17;

/** Letter spacing in em: tight at the start of the hold, wide at the end. */
const TRACK_MIN = -0.03;
const TRACK_MAX = 0.3;
/** Advance of a word space in em. */
const SPACE_EM = 0.34;

/** Ink colour (oklch 0.93 0.012 80) tinted toward the accent, at this opacity. */
const INK_TINT = 0.32;
const WORD_ALPHA = 0.08;
const SDF_GLYPH_SIZE = 128;
const RENDER_ORDER = -5;

/** Redaction degradation cuts and their font files. */
const CUTS = [0, 10, 35, 70, 100] as const;
type Cut = (typeof CUTS)[number];
const FONT_FOR_CUT: Record<Cut, string> = {
  0: "/fonts/redaction.woff",
  10: "/fonts/redaction-10.woff",
  35: "/fonts/redaction-35.woff",
  70: "/fonts/redaction-70.woff",
  100: "/fonts/redaction-100.woff",
};
/** How far THE DAY pushes toward the most degraded cut when the font is picked. */
const DAY_PUSH = 0.7;

const INK = oklchToLinear([0.93, 0.012, 80]);

function nearestCut(r: number): Cut {
  let best: Cut = CUTS[0];
  let bd = Infinity;
  for (const c of CUTS) {
    const d = Math.abs(c - r);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

export function ChapterWord() {
  const chapter = useSeries((s) => s.chapter);
  const teller = useSeries((s) => s.teller);
  if (chapter === "look" || chapter === "maker") return null;
  // The font is decided here, once per chapter / teller change, never per frame.
  const base = MOODS[TELLER_BY_ID[teller].mood].redaction;
  const cut = nearestCut(chapter === "day" ? lerp(base, 100, DAY_PUSH) : base);
  const font = FONT_FOR_CUT[cut];
  const word = CHAPTER_BY_ID[chapter].word;
  // Own boundary so a font swap never blanks the backdrop's Suspense tree.
  return (
    <Suspense fallback={null}>
      <Word key={`${chapter}-${font}`} word={word} font={font} />
    </Suspense>
  );
}

interface TroikaLike {
  textRenderInfo: { blockBounds: [number, number, number, number] } | null;
}

function Word({ word, font }: { word: string; font: string }) {
  const group = useRef<Group>(null);
  const chars = useMemo(() => Array.from(word), [word]);
  const letterIdx = useMemo(() => {
    const idx: number[] = [];
    let n = 0;
    for (const c of chars) idx.push(c === " " ? -1 : n++);
    return idx;
  }, [chars]);
  const letterCount = useMemo(() => letterIdx.filter((i) => i >= 0).length, [letterIdx]);

  // Per-word state, all mutated in place.
  const s = useMemo(
    () => ({
      meshes: new Array<Mesh | null>(letterCount).fill(null),
      adv: new Float32Array(letterCount),
      measured: 0,
      ready: false,
      scale: 1,
      x: 0,
      xInit: false,
    }),
    [letterCount],
  );

  const color = useMemo(() => new Color(), []);
  const material = useMemo(
    () => new MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  const onSync = useMemo(
    () =>
      Array.from({ length: letterCount }, (_, i) => (t: unknown) => {
        if (s.adv[i] > 0) return;
        const info = (t as TroikaLike).textRenderInfo;
        if (!info) return;
        const bb = info.blockBounds;
        const w = bb[2] - bb[0];
        if (w > 0) {
          s.adv[i] = w;
          s.measured++;
        }
      }),
    [letterCount, s],
  );

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const f = runtime.frame;
    const ui = useUI.getState();
    const dt = Math.min(delta, 0.05);

    // Wait until every letter has reported its advance once.
    if (!s.ready) {
      if (s.measured < letterCount) {
        g.visible = false;
        return;
      }
      let total = 0;
      for (let i = 0; i < chars.length; i++) {
        const li = letterIdx[i];
        total += li >= 0 ? s.adv[li] : SPACE_EM;
      }
      total += (chars.length - 1) * TRACK_MAX;
      s.scale = Math.min(WORD_CAP_HEIGHT / CAP_RATIO, WORD_MAX_WIDTH / total);
      g.scale.setScalar(s.scale);
      s.ready = true;
    }

    const alpha = WORD_ALPHA * f.fx.wordOpacity;
    if (alpha < 0.0004) {
      g.visible = false;
      return;
    }
    g.visible = true;

    // Spread is scroll-linked; reduced motion parks it mid-way.
    const spread = ui.reducedMotion ? 0.5 : smoothstep(0, 1, f.fx.wordSpread);
    const track = lerp(TRACK_MIN, TRACK_MAX, spread);

    let total = 0;
    for (let i = 0; i < chars.length; i++) {
      const li = letterIdx[i];
      total += (li >= 0 ? s.adv[li] : SPACE_EM) + (i < chars.length - 1 ? track : 0);
    }
    let cursor = -total / 2;
    for (let i = 0; i < chars.length; i++) {
      const li = letterIdx[i];
      if (li >= 0) {
        const m = s.meshes[li];
        if (m) {
          m.position.x = cursor;
          (m as unknown as { fillOpacity: number }).fillOpacity = alpha;
        }
        cursor += s.adv[li] + track;
      } else {
        cursor += SPACE_EM + track;
      }
    }

    // Colour: ink tinted toward the accent (shared Color, read by troika each render).
    color.setRGB(
      lerp(INK[0], f.accent[0], INK_TINT),
      lerp(INK[1], f.accent[1], INK_TINT),
      lerp(INK[2], f.accent[2], INK_TINT),
    );

    const targetX = f.hero.x * WORD_X_FOLLOW;
    if (!s.xInit) {
      s.x = targetX;
      s.xInit = true;
    } else {
      s.x = damp(s.x, targetX, WORD_X_RATE, dt);
    }
    g.position.set(s.x, WORD_BASE_Y, WORD_Z);
  });

  return (
    <group ref={group} visible={false}>
      {chars.map((c, i) => {
        const li = letterIdx[i];
        if (li < 0) return null;
        return (
          <Text
            key={i}
            ref={(m) => {
              s.meshes[li] = m as unknown as Mesh | null;
            }}
            font={font}
            fontSize={1}
            anchorX="left"
            anchorY="bottom-baseline"
            sdfGlyphSize={SDF_GLYPH_SIZE}
            color={color}
            material={material}
            renderOrder={RENDER_ORDER}
            frustumCulled={false}
            onSync={onSync[li]}
          >
            {c}
          </Text>
        );
      })}
    </group>
  );
}
