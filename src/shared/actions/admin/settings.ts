"use server";

import { createServiceClient } from "@/shared/supabase/server";
import { TAGS } from "@/shared/data/cached";
import { isSettingKey, SETTING_DEFAULTS, validateSetting, type SettingKey, type Settings } from "@/shared/data/settingsSchema";
import type { ActionResult } from "@/shared/data/types";
import { adminUser, audit, fail, refresh, UNAUTHORIZED } from "./lib";

/** The current value of one settings key (stored if valid, else the default). For editors that read-modify-write a shared key. */
export async function getAdminSetting<K extends SettingKey>(key: K): Promise<ActionResult<Settings[K]>> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    if (!isSettingKey(key)) return { success: false, error: "Unknown setting" };
    const { data, error } = await createServiceClient().from("site_settings").select("value").eq("key", key).maybeSingle();
    if (error) return fail("settings", error, "Failed to read settings");
    const v = data ? validateSetting(key, data.value) : null;
    return { success: true, data: v?.ok ? v.value : (structuredClone(SETTING_DEFAULTS[key]) as Settings[K]) };
  } catch (error) {
    return fail("settings", error, "Failed to read settings");
  }
}

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
