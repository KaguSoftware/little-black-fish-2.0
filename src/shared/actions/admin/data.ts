import "server-only";

import { createServiceClient, requireAdminUser } from "@/shared/supabase/server";
import { getDefaultCopy } from "@/shared/data/contentDefaults";
import { isSettingKey, SETTING_DEFAULTS, validateSetting } from "@/shared/data/settingsSchema";
import type {
  AdminAuditRow,
  CategoryRow,
  ContactSubmissionRow,
  HeroSlideRow,
  ProjectRow,
  SeriesChapterRow,
  SeriesCharacterRow,
  SiteContentRow,
  TeamMemberRow,
} from "@/shared/data/types";
import type { AdminData, ContentEntry, Settings } from "./types";

/**
 * Every editable string of site copy (default JSON for both locales, flattened) with the
 * current overrides applied. Server helper, not an action; throws when the caller is not an admin.
 */
export async function listContentEntries(): Promise<ContentEntry[]> {
  await requireAdminUser();
  const { data, error } = await createServiceClient().from("site_content").select("key, locale, value");
  if (error) throw new Error(`Failed to load content: ${error.message}`);
  return buildContentEntries((data ?? []) as Pick<SiteContentRow, "key" | "locale" | "value">[]);
}

async function buildContentEntries(rows: Pick<SiteContentRow, "key" | "locale" | "value">[]): Promise<ContentEntry[]> {
  const [enDef, faDef] = await Promise.all([getDefaultCopy("en"), getDefaultCopy("fa")]);
  const over = { en: new Map<string, string>(), fa: new Map<string, string>() };
  for (const r of rows) over[r.locale]?.set(r.key, r.value);

  const keys = [...new Set([...Object.keys(enDef), ...Object.keys(faDef)])];
  return keys.map((key) => {
    const dot = key.indexOf(".");
    const enDefault = enDef[key] ?? "";
    const faDefault = faDef[key] ?? "";
    return {
      key,
      namespace: key.slice(0, dot),
      path: key.slice(dot + 1),
      en: over.en.get(key) ?? enDefault,
      fa: over.fa.get(key) ?? faDefault,
      enOverridden: over.en.has(key),
      faOverridden: over.fa.has(key),
      enDefault,
      faDefault,
    };
  });
}

/** Everything the admin page shows. Throws when the caller is not an admin or a read fails. */
export async function loadAdminData(): Promise<AdminData> {
  await requireAdminUser();
  const supabase = createServiceClient();

  const [projects, heroSlides, categories, submissions, team, chapters, characters, settings, content, audit] =
    await Promise.all([
      supabase.from("projects").select("*").order("order").order("created_at"),
      supabase.from("hero_slides").select("*").order("order").order("created_at"),
      supabase.from("categories").select("*").order("order").order("created_at"),
      supabase.from("contact_submissions").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("team_members").select("*").order("order").order("created_at"),
      supabase.from("series_chapters").select("*").order("order"),
      supabase.from("series_characters").select("*").order("order"),
      supabase.from("site_settings").select("key, value"),
      supabase.from("site_content").select("key, locale, value"),
      supabase.from("admin_audit").select("*").order("id", { ascending: false }).limit(50),
    ]);

  const error =
    projects.error ??
    heroSlides.error ??
    categories.error ??
    submissions.error ??
    team.error ??
    chapters.error ??
    characters.error ??
    settings.error ??
    content.error ??
    audit.error;
  if (error) throw new Error(`Failed to load admin data: ${error.message}`);

  const effective: Settings = structuredClone(SETTING_DEFAULTS);
  const stored: string[] = [];
  for (const row of settings.data ?? []) {
    if (!isSettingKey(row.key)) continue;
    const v = validateSetting(row.key, row.value);
    if (!v.ok) continue;
    (effective as unknown as Record<string, unknown>)[row.key] = v.value;
    stored.push(row.key);
  }

  return {
    projects: (projects.data ?? []) as ProjectRow[],
    heroSlides: (heroSlides.data ?? []) as HeroSlideRow[],
    categories: (categories.data ?? []) as CategoryRow[],
    submissions: (submissions.data ?? []) as ContactSubmissionRow[],
    teamMembers: (team.data ?? []) as TeamMemberRow[],
    seriesChapters: (chapters.data ?? []) as SeriesChapterRow[],
    seriesCharacters: (characters.data ?? []) as SeriesCharacterRow[],
    settings: effective,
    settingsStored: stored,
    content: await buildContentEntries((content.data ?? []) as Pick<SiteContentRow, "key" | "locale" | "value">[]),
    audit: (audit.data ?? []) as AdminAuditRow[],
  };
}
