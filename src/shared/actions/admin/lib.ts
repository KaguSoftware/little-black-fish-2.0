import "server-only";

import { revalidatePath, updateTag } from "next/cache";
import type { User } from "@supabase/supabase-js";
import { createServiceClient, requireAdminUser } from "@/shared/supabase/server";
import type { CacheTag } from "@/shared/data/cached";
import type { ActionResult } from "@/shared/data/types";

/** The admin, or null when the caller is not one. Every action calls this first (requireAdminUser). */
export async function adminUser(): Promise<User | null> {
  try {
    return await requireAdminUser();
  } catch {
    return null;
  }
}

export const UNAUTHORIZED: ActionResult<never> = { success: false, error: "Unauthorized" };

/** Expire the given cache tags and rebuild every public page + the admin page. */
export function refresh(...tags: CacheTag[]) {
  for (const tag of tags) updateTag(tag);
  revalidatePath("/[locale]", "layout");
  revalidatePath("/[locale]/admin", "page");
}

export function fail(scope: string, error: unknown, fallback: string): ActionResult<never> {
  console.error(`[admin/${scope}]`, error);
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return { success: false, error: message || fallback };
}

/** Lightweight audit trail (admin_audit). Never throws: a logging failure must not fail the action. */
export async function audit(user: User, action: string, target?: string) {
  try {
    const { error } = await createServiceClient()
      .from("admin_audit")
      .insert({ actor_email: user.email ?? null, action, target: target ?? null });
    if (error) console.error("[admin/audit]", error);
  } catch (e) {
    console.error("[admin/audit]", e);
  }
}

export const text = (v: unknown, max = 2000): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

export type StorageBucket = "projects" | "hero";
export const BUCKETS: readonly StorageBucket[] = ["projects", "hero"];

/** Every string leaf of a JSON value, with its dotted path (e.g. "heroVideos.0.src"). */
function* stringLeaves(v: unknown, path: string): Generator<[string, string]> {
  if (typeof v === "string") yield [path, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* stringLeaves(v[i], `${path}.${i}`);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) yield* stringLeaves(x, `${path}.${k}`);
}

/**
 * Map of file URL -> human-readable places that use it (projects, galleries, hero slides, team
 * members and every string in site_settings, e.g. heroVideos[].src / seo.ogImage). Throws when
 * any read fails: callers must treat "unknown" as "in use", never as "unreferenced".
 */
export async function collectReferences(): Promise<Map<string, string[]>> {
  const supabase = createServiceClient();
  const [projects, slides, team, settings] = await Promise.all([
    supabase.from("projects").select("slug, image_url, gallery_urls"),
    supabase.from("hero_slides").select("id, image_url"),
    supabase.from("team_members").select("name_en, photo_url"),
    supabase.from("site_settings").select("key, value"),
  ]);
  const failed = projects.error ?? slides.error ?? team.error ?? settings.error;
  if (failed) throw failed;

  const used = new Map<string, string[]>();
  const add = (url: string | null | undefined, label: string) => {
    if (url) used.set(url, [...(used.get(url) ?? []), label]);
  };
  for (const p of projects.data ?? []) {
    add(p.image_url as string | null, `project ${p.slug}`);
    for (const g of (p.gallery_urls as string[] | null) ?? []) add(g, `project gallery ${p.slug}`);
  }
  for (const r of slides.data ?? []) add(r.image_url as string | null, `hero slide ${r.id}`);
  for (const t of team.data ?? []) add(t.photo_url as string | null, `team member ${t.name_en}`);
  for (const row of settings.data ?? []) {
    for (const [path, value] of stringLeaves(row.value, String(row.key))) add(value.trim(), `setting ${path}`);
  }
  return used;
}

/** Where in the site a storage file is still used (empty = unreferenced). Throws if a read fails. */
export async function findReferences(url: string): Promise<string[]> {
  return (await collectReferences()).get(url) ?? [];
}
