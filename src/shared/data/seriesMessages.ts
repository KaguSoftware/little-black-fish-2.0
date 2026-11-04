/**
 * Layers the admin-edited series text (series_chapters / series_characters) over the `series`
 * message namespace, so every useTranslations("series") call site picks it up unchanged.
 * Isomorphic and pure; any malformed input is skipped, never thrown.
 */
import type { SeriesChapterRow, SeriesCharacterRow } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function sub(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const cur = parent[key];
  if (isObj(cur)) return cur;
  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
}

export function applySeriesMessages(
  messages: Record<string, unknown>,
  content: { chapters: SeriesChapterRow[]; characters: SeriesCharacterRow[] },
  locale: "en" | "fa",
) {
  const series = messages.series;
  if (!isObj(series)) return;
  const chapters = sub(series, "chapters");
  for (const c of content.chapters) {
    const word = locale === "fa" ? c.word_fa : c.word_en;
    const title = locale === "fa" ? c.title_fa : c.title_en;
    const entry = sub(chapters, c.slug);
    if (word) entry.word = word;
    if (title) entry.title = title;
  }
  const roles = sub(series, "roles");
  const names = sub(series, "names");
  const lines = sub(series, "lines");
  const moods = sub(series, "characterMoods");
  for (const ch of content.characters) {
    const name = locale === "fa" ? ch.name_fa : ch.name_en;
    const role = locale === "fa" ? ch.role_fa : ch.role_en;
    const mood = locale === "fa" ? ch.mood_fa : ch.mood_en;
    const narration = locale === "fa" ? ch.narration_fa : ch.narration_en;
    if (name) names[ch.slug] = name;
    if (role) roles[ch.slug] = role;
    if (mood) moods[ch.slug] = mood;
    if (isObj(narration)) {
      const own = sub(lines, ch.slug);
      for (const [k, v] of Object.entries(narration)) if (typeof v === "string" && v.trim()) own[k] = v;
    }
  }
}
