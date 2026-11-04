import "server-only";

import { createAnonClient, createServiceClient } from "@/shared/supabase/server";
import { cachedRead, TAGS, warn } from "./cached";
import { isSettingKey, SETTING_DEFAULTS, validateSetting, type Settings } from "./settingsSchema";

export type { Settings } from "./settingsSchema";

// `contact` holds the private notification address: it is never read with the anon client (the
// public SELECT policy excludes it once supabase/migrations/*_harden_policies.sql is applied).
// Public getSettings() therefore always reports the default for `contact`; server code that needs
// the real value uses getNotificationEmail().
const read = cachedRead(TAGS.settings, async (): Promise<Record<string, unknown>> => {
  const { data, error } = await createAnonClient().from("site_settings").select("key, value").neq("key", "contact");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as unknown]));
});

/**
 * All settings, every key present: stored value if it exists and validates, otherwise the code
 * default (SETTING_DEFAULTS). Never throws.
 */
export async function getSettings(): Promise<Settings> {
  let rows: Record<string, unknown> = {};
  try {
    rows = await read();
  } catch (e) {
    warn("site_settings", e);
  }
  const out: Settings = structuredClone(SETTING_DEFAULTS);
  for (const [key, value] of Object.entries(rows)) {
    if (!isSettingKey(key)) continue;
    const v = validateSetting(key, value);
    if (v.ok) (out as unknown as Record<string, unknown>)[key] = v.value;
    else warn(`site_settings.${key} invalid`, v.error);
  }
  return out;
}

/** Contact-form recipient from the admin setting (service client, uncached). "" when unset/invalid/unreadable. */
export async function getNotificationEmail(): Promise<string> {
  try {
    const { data, error } = await createServiceClient().from("site_settings").select("value").eq("key", "contact").maybeSingle();
    if (error) throw error;
    if (!data) return "";
    const v = validateSetting("contact", data.value);
    return v.ok ? v.value.notificationEmail : "";
  } catch (e) {
    warn("site_settings.contact", e);
    return "";
  }
}
