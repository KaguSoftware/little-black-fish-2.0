"use server";

import { createServiceClient } from "@/shared/supabase/server";
import { TAGS } from "@/shared/data/cached";
import { getDefaultCopy } from "@/shared/data/contentDefaults";
import { icuProblem } from "@/shared/data/icu";
import type { ActionResult, ContentLocale } from "@/shared/data/types";
import { adminUser, audit, fail, refresh, UNAUTHORIZED } from "./lib";
import type { ContentEntryInput } from "./types";

const MAX_VALUE = 20000;
const isLocale = (v: unknown): v is ContentLocale => v === "en" || v === "fa";

/**
 * Saves copy edits. A value identical to the built-in default deletes the override instead of
 * storing it, so the table only ever holds real differences. Unknown/non-editable keys are rejected.
 */
export async function saveContent(
  entries: ContentEntryInput[],
): Promise<ActionResult<{ saved: number; cleared: number }>> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    if (!Array.isArray(entries) || entries.length === 0) return { success: false, error: "Nothing to save" };
    if (entries.length > 500) return { success: false, error: "Too many entries at once (max 500)" };

    const defaults = { en: await getDefaultCopy("en"), fa: await getDefaultCopy("fa") };
    const upserts: { key: string; locale: ContentLocale; value: string }[] = [];
    const clears: { key: string; locale: ContentLocale }[] = [];
    const problems: string[] = [];
    for (const e of entries) {
      if (!e || typeof e.key !== "string" || !isLocale(e.locale) || typeof e.value !== "string") {
        return { success: false, error: "Invalid entry" };
      }
      if (!Object.hasOwn(defaults[e.locale], e.key)) return { success: false, error: `Unknown content key: ${e.key}` };
      if (e.value.length > MAX_VALUE) return { success: false, error: `Text for ${e.key} is too long` };
      if (e.value === defaults[e.locale][e.key]) clears.push({ key: e.key, locale: e.locale });
      else {
        // Must parse as ICU and keep the default's {arguments} and <rich tags>, or the page would break.
        const problem = icuProblem(e.value, defaults[e.locale][e.key]);
        if (problem) problems.push(`${e.key} (${e.locale}): ${problem}`);
        else upserts.push({ key: e.key, locale: e.locale, value: e.value });
      }
    }
    if (problems.length > 0) {
      const lines = problems.slice(0, 5);
      if (problems.length > 5) lines.push(`...and ${problems.length - 5} more`);
      return { success: false, error: ["Nothing saved. Fix these entries:", ...lines].join("\n") };
    }

    const supabase = createServiceClient();
    if (upserts.length) {
      const { error } = await supabase.from("site_content").upsert(upserts, { onConflict: "key,locale" });
      if (error) return fail("content save", error, "Failed to save");
    }
    for (const c of clears) {
      const { error } = await supabase.from("site_content").delete().eq("key", c.key).eq("locale", c.locale);
      if (error) return fail("content clear", error, "Failed to save");
    }

    await audit(user, "content.save", `${upserts.length} saved, ${clears.length} reverted`);
    refresh(TAGS.content);
    return { success: true, data: { saved: upserts.length, cleared: clears.length } };
  } catch (error) {
    return fail("content save", error, "Failed to save");
  }
}

/** Removes the override for one key (one locale or both), restoring the default copy. */
export async function resetContent(key: string, locale: ContentLocale | "both"): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    if (typeof key !== "string" || !key) return { success: false, error: "Missing key" };
    if (locale !== "both" && !isLocale(locale)) return { success: false, error: "Invalid locale" };

    let q = createServiceClient().from("site_content").delete().eq("key", key);
    if (locale !== "both") q = q.eq("locale", locale);
    const { error } = await q;
    if (error) return fail("content reset", error, "Failed to reset");

    await audit(user, "content.reset", `${key} (${locale})`);
    refresh(TAGS.content);
    return { success: true };
  } catch (error) {
    return fail("content reset", error, "Failed to reset");
  }
}
