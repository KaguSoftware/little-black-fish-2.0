"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createServiceClient, requireAdminUser } from "@/shared/supabase/server";
import { TAGS } from "@/shared/data/cached";
import { CHAPTER_DEFAULTS, CHARACTER_DEFAULTS } from "@/shared/data/defaults";
import type { ActionResult } from "@/shared/data/types";
import type { ReorderTable } from "./types";

const TABLES: readonly ReorderTable[] = [
  "projects",
  "hero_slides",
  "categories",
  "team_members",
  "series_chapters",
  "series_characters",
];
/** Primary-key column per table (series rows are keyed by their stable slug). */
const PK: Partial<Record<ReorderTable, string>> = { series_chapters: "slug", series_characters: "slug" };

/** Code defaults (minus timestamps) per slug-keyed table, used to create rows that were never seeded. */
const stripTimes = <T extends { created_at: string; updated_at: string }>({ created_at, updated_at, ...rest }: T) => {
  void created_at;
  void updated_at;
  return rest;
};
const SLUG_DEFAULTS: Partial<Record<ReorderTable, Map<string, Record<string, unknown>>>> = {
  series_chapters: new Map(CHAPTER_DEFAULTS.map((r) => [r.slug, stripTimes(r)])),
  series_characters: new Map(CHARACTER_DEFAULTS.map((r) => [r.slug, stripTimes(r)])),
};

async function isAdmin() {
  try {
    await requireAdminUser();
    return true;
  } catch {
    return false;
  }
}

export async function reorder(table: ReorderTable, items: { id: string; order: number }[]): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    if (!TABLES.includes(table)) return { success: false, error: "Unknown table" };
    if (
      !Array.isArray(items) ||
      items.some((it) => !it || typeof it.id !== "string" || !it.id || !Number.isInteger(it.order))
    ) {
      return { success: false, error: "Invalid order" };
    }
    if (items.length === 0) return { success: true };

    const supabase = createServiceClient();

    // Series rows may not exist yet (never seeded / never edited). Unknown slugs are rejected;
    // missing known ones are inserted from the code defaults (existing rows, and their edited
    // text, are never overwritten) so the new order persists.
    const defaults = SLUG_DEFAULTS[table];
    if (defaults) {
      const unknown = items.filter((it) => !defaults.has(it.id)).map((it) => it.id);
      if (unknown.length > 0) return { success: false, error: `Unknown slug: ${unknown.join(", ")}` };
      const { data: existing, error: selectError } = await supabase.from(table).select("slug");
      if (selectError) {
        console.error(`[admin/reorder] ${table}:`, selectError);
        return { success: false, error: selectError.message || "Failed to save the order" };
      }
      const have = new Set((existing ?? []).map((r) => r.slug as string));
      const missing = items
        .filter((it) => !have.has(it.id))
        .map((it) => ({ ...defaults.get(it.id)!, order: it.order }));
      if (missing.length > 0) {
        const { error: insertError } = await supabase
          .from(table)
          .upsert(missing, { onConflict: "slug", ignoreDuplicates: true });
        if (insertError) {
          console.error(`[admin/reorder] ${table}:`, insertError);
          return { success: false, error: insertError.message || "Failed to save the order" };
        }
      }
    }

    const results = await Promise.all(
      items.map(({ id, order }) => supabase.from(table).update({ order }).eq(PK[table] ?? "id", id)),
    );
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.error(`[admin/reorder] ${table}:`, firstError);
      return { success: false, error: firstError.message || "Failed to save the order" };
    }

    if (table === "team_members") updateTag(TAGS.team);
    if (table === "series_chapters" || table === "series_characters") updateTag(TAGS.series);
    revalidatePath("/[locale]", "layout");
    revalidatePath("/[locale]/admin", "page");
    return { success: true };
  } catch (error) {
    console.error(`[admin/reorder] ${table}:`, error);
    return { success: false, error: "Failed to save the order" };
  }
}
