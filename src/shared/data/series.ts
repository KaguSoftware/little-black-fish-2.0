import "server-only";

import { createAnonClient } from "@/shared/supabase/server";
import { cachedRead, TAGS, warn } from "./cached";
import { CHAPTER_DEFAULTS, CHARACTER_DEFAULTS } from "./defaults";
import type { SeriesChapterRow, SeriesCharacterRow } from "./types";

const byOrder = <T extends { order: number; slug: string }>(a: T, b: T) => a.order - b.order || a.slug.localeCompare(b.slug);

const readAll = cachedRead(TAGS.series, async () => {
  const supabase = createAnonClient();
  const [chapters, characters] = await Promise.all([
    supabase.from("series_chapters").select("*").order("order"),
    supabase.from("series_characters").select("*").order("order"),
  ]);
  if (chapters.error) throw chapters.error;
  if (characters.error) throw characters.error;
  return {
    chapters: (chapters.data ?? []) as SeriesChapterRow[],
    characters: (characters.data ?? []) as SeriesCharacterRow[],
  };
});

export interface SeriesContent {
  /** Visible chapters, ordered. Join to CHAPTERS by `slug` (ChapterId). */
  chapters: SeriesChapterRow[];
  /** Visible characters, ordered. Join to TELLERS by `slug` (TellerId). */
  characters: SeriesCharacterRow[];
}

/**
 * Editable series text. Per table: DB rows when present, else the code defaults (src/shared/data/defaults.ts).
 * A slug missing from the DB (e.g. never seeded) is filled from the defaults, so a partial table is safe.
 * Never throws.
 */
export async function getSeriesContent(): Promise<SeriesContent> {
  let chapters: SeriesChapterRow[] = [];
  let characters: SeriesCharacterRow[] = [];
  try {
    ({ chapters, characters } = await readAll());
  } catch (e) {
    warn("series", e);
  }
  const merge = <T extends { slug: string; order: number; visible: boolean }>(rows: T[], defaults: T[]) => {
    const have = new Set(rows.map((r) => r.slug));
    // Missing slugs come back at their default position, after the stored rows.
    return [...rows, ...defaults.filter((d) => !have.has(d.slug))].filter((r) => r.visible);
  };
  return {
    chapters: merge(chapters, CHAPTER_DEFAULTS).sort(byOrder),
    characters: merge(characters, CHARACTER_DEFAULTS).sort(byOrder),
  };
}
