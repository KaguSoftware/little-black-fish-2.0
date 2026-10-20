import type { ChapterId } from "./types";

export interface ChapterMeta {
  id: ChapterId;
  index: number;
  /** Two-digit label, e.g. "02". */
  number: string;
  /** Big faint chapter word behind the hero. */
  word: string;
  /** Short title used in UI. */
  title: string;
  /** Which side of the stage the hero stands on during the hold: -1 left, 0 centre, 1 right. Text goes opposite. */
  side: -1 | 0 | 1;
}

export const CHAPTERS: readonly ChapterMeta[] = [
  { id: "look", index: 0, number: "00", word: "LOOK CLOSER", title: "Look closer", side: 0 },
  { id: "hello", index: 1, number: "01", word: "HELLO", title: "Hello", side: 0 },
  { id: "world", index: 2, number: "02", word: "MY WORLD", title: "My world", side: -1 },
  { id: "day", index: 3, number: "03", word: "THE DAY", title: "The day", side: 1 },
  { id: "did", index: 4, number: "04", word: "WHAT I DID", title: "What I did", side: -1 },
  { id: "others", index: 5, number: "05", word: "THE OTHERS", title: "The others", side: 1 },
  { id: "maker", index: 6, number: "06", word: "MY MAKER", title: "My maker", side: 0 },
] as const;

export const CHAPTER_BY_ID: Record<ChapterId, ChapterMeta> = Object.fromEntries(
  CHAPTERS.map((c) => [c.id, c]),
) as Record<ChapterId, ChapterMeta>;

/**
 * Segment kinds:
 * - hold: the hero stands on their mark, narration types out.
 * - pullback: camera pulls back from the face close-up to the full figure (look -> hello).
 * - dive: camera dives into the hero's left eye; the next scene opens as an iris (hello -> world).
 * - walk: hero turns one full circle while walking to the next mark (alternating sides).
 */
export type SegmentKind = "hold" | "pullback" | "dive" | "walk";

export interface Segment {
  kind: SegmentKind;
  /** Chapter this segment leads INTO (for transitions) or belongs to (for holds). */
  chapter: ChapterId;
  /** For transitions: the chapter we come from. */
  from?: ChapterId;
  weight: number;
}

export const SEGMENTS: readonly Segment[] = [
  { kind: "hold", chapter: "look", weight: 1.0 },
  { kind: "pullback", chapter: "hello", from: "look", weight: 0.7 },
  { kind: "hold", chapter: "hello", weight: 1.1 },
  { kind: "dive", chapter: "world", from: "hello", weight: 1.0 },
  { kind: "hold", chapter: "world", weight: 1.3 },
  { kind: "walk", chapter: "day", from: "world", weight: 0.55 },
  { kind: "hold", chapter: "day", weight: 1.5 },
  { kind: "walk", chapter: "did", from: "day", weight: 0.55 },
  { kind: "hold", chapter: "did", weight: 1.3 },
  { kind: "walk", chapter: "others", from: "did", weight: 0.55 },
  { kind: "hold", chapter: "others", weight: 1.3 },
  { kind: "walk", chapter: "maker", from: "others", weight: 0.5 },
  { kind: "hold", chapter: "maker", weight: 1.6 },
] as const;

const TOTAL = SEGMENTS.reduce((s, x) => s + x.weight, 0);

/** Start/end of each segment on 0..1 progress. */
export const SEGMENT_RANGES: readonly { start: number; end: number }[] = (() => {
  let acc = 0;
  return SEGMENTS.map((s) => {
    const start = acc / TOTAL;
    acc += s.weight;
    return { start, end: acc / TOTAL };
  });
})();

/** Viewport heights of scroll per unit of weight. The page spacer is TOTAL * this. */
export const VH_PER_WEIGHT = 85;
export const STORY_SCROLL_VH = Math.round(TOTAL * VH_PER_WEIGHT);

export interface Resolved {
  /** Raw progress 0..1. */
  p: number;
  segIndex: number;
  segment: Segment;
  /** 0..1 within the current segment. */
  segT: number;
  /** The chapter currently "on stage" (for transitions: the destination). */
  chapter: ChapterId;
  chapterIndex: number;
  /** 0..1 within the chapter's hold; 0 during the incoming transition. */
  holdT: number;
  /** For transitions: the chapter we're leaving. Equals `chapter` during holds. */
  from: ChapterId;
}

export function resolveProgress(pRaw: number): Resolved {
  const p = Math.min(1, Math.max(0, pRaw));
  let i = SEGMENT_RANGES.findIndex((r) => p < r.end);
  if (i === -1) i = SEGMENTS.length - 1;
  const r = SEGMENT_RANGES[i];
  const segment = SEGMENTS[i];
  const segT = r.end > r.start ? (p - r.start) / (r.end - r.start) : 1;
  const chapter = segment.chapter;
  return {
    p,
    segIndex: i,
    segment,
    segT,
    chapter,
    chapterIndex: CHAPTER_BY_ID[chapter].index,
    holdT: segment.kind === "hold" ? segT : 0,
    from: segment.from ?? chapter,
  };
}

/** Progress value at the start of a chapter's hold (used for scrollTo / autoplay dwell points). */
export function chapterHoldStart(id: ChapterId): number {
  const i = SEGMENTS.findIndex((s) => s.kind === "hold" && s.chapter === id);
  return SEGMENT_RANGES[i].start;
}

export function chapterHoldEnd(id: ChapterId): number {
  const i = SEGMENTS.findIndex((s) => s.kind === "hold" && s.chapter === id);
  return SEGMENT_RANGES[i].end;
}

/**
 * Narration reveal window inside a hold: letters type between these holdT values,
 * and stay fully typed until the hold ends. Scrolling back un-types.
 */
export const TYPE_WINDOW = { start: 0.08, end: 0.5 } as const;
