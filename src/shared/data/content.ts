import "server-only";

import { createAnonClient } from "@/shared/supabase/server";
import { cachedRead, TAGS, warn } from "./cached";
import { isEditableKey } from "./contentPaths";

const read = cachedRead(TAGS.content, async (locale: string): Promise<Record<string, string>> => {
  const { data, error } = await createAnonClient().from("site_content").select("key, value").eq("locale", locale);
  if (error) throw error;
  const out: Record<string, string> = {};
  for (const row of data ?? []) {
    if (typeof row.key === "string" && typeof row.value === "string" && isEditableKey(row.key)) out[row.key] = row.value;
  }
  return out;
});

/** Copy overrides for one locale: { "about.sections.1.title": "text" }. {} on any failure. */
export async function getContentOverrides(locale: string): Promise<Record<string, string>> {
  try {
    return await read(locale);
  } catch (e) {
    warn("site_content", e);
    return {};
  }
}
