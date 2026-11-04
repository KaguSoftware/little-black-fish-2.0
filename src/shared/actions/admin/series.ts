"use server";

import { createServiceClient } from "@/shared/supabase/server";
import { TAGS } from "@/shared/data/cached";
import { CHAPTER_DEFAULTS, CHARACTER_DEFAULTS } from "@/shared/data/defaults";
import type { ActionResult, NarrationMap } from "@/shared/data/types";
import { adminUser, audit, fail, refresh, text, UNAUTHORIZED } from "./lib";
import type { SeriesChapterInput, SeriesCharacterInput } from "./types";

const NARRATION_KEYS = ["hello", "world", "day", "did", "others"] as const;

function narration(v: unknown): NarrationMap | string {
  if (v == null) return {};
  if (typeof v !== "object" || Array.isArray(v)) return "Narration must be an object";
  const out: NarrationMap = {};
  for (const k of NARRATION_KEYS) {
    const line = text((v as Record<string, unknown>)[k], 2000);
    if (line) out[k] = line;
  }
  return out;
}

/**
 * Upserts by slug (rows are created on first edit if the table was never seeded). Slugs must be
 * ones the code knows (ChapterId): the scene is built from code, the DB only supplies text.
 */
export async function updateSeriesChapter(slug: string, input: SeriesChapterInput): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    const def = CHAPTER_DEFAULTS.find((c) => c.slug === slug);
    if (!def) return { success: false, error: "Unknown chapter" };
    const row = {
      slug,
      word_en: text(input?.wordEn, 80),
      word_fa: text(input?.wordFa, 80),
      title_en: text(input?.titleEn, 80),
      title_fa: text(input?.titleFa, 80),
    };
    if (!row.word_en || !row.word_fa || !row.title_en || !row.title_fa) {
      return { success: false, error: "Word and title are required in both languages" };
    }
    const supabase = createServiceClient();
    const { data: existing } = await supabase.from("series_chapters").select("order, visible").eq("slug", slug).maybeSingle();
    const { error } = await supabase
      .from("series_chapters")
      .upsert({ ...row, order: existing?.order ?? def.order, visible: existing?.visible ?? true }, { onConflict: "slug" });
    if (error) return fail("series chapter", error, "Failed to save chapter");
    await audit(user, "series.chapter.update", slug);
    refresh(TAGS.series);
    return { success: true };
  } catch (error) {
    return fail("series chapter", error, "Failed to save chapter");
  }
}

export async function updateSeriesCharacter(slug: string, input: SeriesCharacterInput): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    const def = CHARACTER_DEFAULTS.find((c) => c.slug === slug);
    if (!def) return { success: false, error: "Unknown character" };
    const nEn = narration(input?.narrationEn);
    const nFa = narration(input?.narrationFa);
    if (typeof nEn === "string") return { success: false, error: nEn };
    if (typeof nFa === "string") return { success: false, error: nFa };
    const row = {
      slug,
      name_en: text(input?.nameEn, 80),
      name_fa: text(input?.nameFa, 80),
      role_en: text(input?.roleEn, 160),
      role_fa: text(input?.roleFa, 160),
      mood_en: text(input?.moodEn, 200),
      mood_fa: text(input?.moodFa, 200),
      narration_en: nEn,
      narration_fa: nFa,
    };
    if (!row.name_en || !row.name_fa) return { success: false, error: "Name is required in both languages" };

    const supabase = createServiceClient();
    const { data: existing } = await supabase
      .from("series_characters")
      .select("order, visible")
      .eq("slug", slug)
      .maybeSingle();
    const { error } = await supabase
      .from("series_characters")
      .upsert(
        { ...row, order: existing?.order ?? def.order, visible: existing?.visible ?? true },
        { onConflict: "slug" },
      );
    if (error) return fail("series character", error, "Failed to save character");
    await audit(user, "series.character.update", slug);
    refresh(TAGS.series);
    return { success: true };
  } catch (error) {
    return fail("series character", error, "Failed to save character");
  }
}

export async function setSeriesChapterVisible(slug: string, visible: boolean): Promise<ActionResult> {
  return setVisible("series_chapters", CHAPTER_DEFAULTS, slug, visible);
}

export async function setSeriesCharacterVisible(slug: string, visible: boolean): Promise<ActionResult> {
  return setVisible("series_characters", CHARACTER_DEFAULTS, slug, visible);
}

async function setVisible(
  table: "series_chapters" | "series_characters",
  defaults: ReadonlyArray<{ slug: string }>,
  slug: string,
  visible: boolean,
): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    const def = defaults.find((d) => d.slug === slug);
    if (!def) return { success: false, error: "Unknown slug" };
    const supabase = createServiceClient();
    const { data: existing, error: readError } = await supabase.from(table).select("slug").eq("slug", slug).maybeSingle();
    if (readError) return fail(`${table} visible`, readError, "Failed to update");
    const { error } = existing
      ? await supabase.from(table).update({ visible: !!visible }).eq("slug", slug)
      : // Never edited before: materialize the default row first so hiding it sticks.
        await supabase.from(table).insert({ ...stripTimes(def), visible: !!visible });
    if (error) return fail(`${table} visible`, error, "Failed to update");
    await audit(user, `${table}.${visible ? "show" : "hide"}`, slug);
    refresh(TAGS.series);
    return { success: true };
  } catch (error) {
    return fail(`${table} visible`, error, "Failed to update");
  }
}

function stripTimes<T extends object>(row: T) {
  const rest = { ...row } as Record<string, unknown>;
  delete rest.created_at;
  delete rest.updated_at;
  return rest;
}
