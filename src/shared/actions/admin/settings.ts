"use server";

import { createServiceClient } from "@/shared/supabase/server";
import { TAGS } from "@/shared/data/cached";
import { isSettingKey, validateSetting, type SettingKey, type Settings } from "@/shared/data/settingsSchema";
import type { ActionResult } from "@/shared/data/types";
import { adminUser, audit, fail, refresh, UNAUTHORIZED } from "./lib";

/** Validates per key (URLs http(s)/relative, emails, lengths) and stores the normalized value. */
export async function saveSettings<K extends SettingKey>(key: K, value: Settings[K]): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    if (!isSettingKey(key)) return { success: false, error: "Unknown setting" };
    const v = validateSetting(key, value);
    if (!v.ok) return { success: false, error: v.error };

    const { error } = await createServiceClient()
      .from("site_settings")
      .upsert({ key, value: v.value }, { onConflict: "key" });
    if (error) return fail("settings", error, "Failed to save settings");

    await audit(user, "settings.save", key);
    refresh(TAGS.settings);
    return { success: true };
  } catch (error) {
    return fail("settings", error, "Failed to save settings");
  }
}
