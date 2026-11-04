/**
 * Code defaults for the admin-editable tables, in the DB row shape. Isomorphic (no server-only):
 * used by the public data layer as the fallback and by scripts/seed-content.mjs as the seed.
 */
import { CHAPTERS } from "@/shared/content/chapters";
import { TELLERS } from "@/shared/content/characters";
import { TEAM } from "@/shared/content/team";
import enSeries from "../../../messages/en/series.json";
import faSeries from "../../../messages/fa/series.json";
import type { NarrationMap, SeriesChapterRow, SeriesCharacterRow, TeamMemberRow } from "./types";

const EPOCH = "1970-01-01T00:00:00.000Z";
const NARRATION_KEYS = ["hello", "world", "day", "did", "others"] as const;

type SeriesMsgs = {
  chapters: Record<string, { word: string; title: string }>;
  roles: Record<string, string>;
  names?: Record<string, string>;
  lines?: Record<string, NarrationMap>;
  moods: Record<string, string>;
};
const en = enSeries as unknown as SeriesMsgs;
const fa = faSeries as unknown as SeriesMsgs;

export const TEAM_DEFAULTS: TeamMemberRow[] = TEAM.map((m, i) => ({
  id: m.id,
  name_en: m.name.en,
  name_fa: m.name.fa,
  title_en: m.title.en,
  title_fa: m.title.fa,
  role_en: m.role.en,
  role_fa: m.role.fa,
  photo_url: m.photo,
  instagram: m.instagram,
  order: i,
  visible: true,
  created_at: EPOCH,
  updated_at: EPOCH,
}));

export const CHAPTER_DEFAULTS: SeriesChapterRow[] = CHAPTERS.map((c, i) => ({
  slug: c.id,
  word_en: en.chapters[c.id]?.word ?? c.word,
  word_fa: fa.chapters[c.id]?.word ?? c.word,
  title_en: en.chapters[c.id]?.title ?? c.title,
  title_fa: fa.chapters[c.id]?.title ?? c.title,
  order: i,
  visible: true,
  created_at: EPOCH,
  updated_at: EPOCH,
}));

function pickNarration(src: Record<string, string | undefined> | undefined): NarrationMap {
  const out: NarrationMap = {};
  for (const k of NARRATION_KEYS) if (src?.[k]) out[k] = src[k];
  return out;
}

export const CHARACTER_DEFAULTS: SeriesCharacterRow[] = TELLERS.map((t, i) => ({
  slug: t.id,
  name_en: t.name,
  name_fa: fa.names?.[t.id] ?? t.name,
  role_en: en.roles[t.id] ?? t.role,
  role_fa: fa.roles[t.id] ?? t.role,
  mood_en: en.moods[t.mood] ?? "",
  mood_fa: fa.moods[t.mood] ?? "",
  narration_en: pickNarration(t.narration),
  narration_fa: pickNarration(fa.lines?.[t.id]),
  order: i,
  visible: true,
  created_at: EPOCH,
  updated_at: EPOCH,
}));
