"use server";

import { createServiceClient } from "@/shared/supabase/server";
import type { ActionResult } from "@/shared/data/types";
import { TAGS } from "@/shared/data/cached";
import { adminUser, audit, BUCKETS, collectReferences, fail, findReferences, refresh, UNAUTHORIZED, type StorageBucket } from "./lib";
import type { MediaItem, MediaPage } from "./types";

const isBucket = (b: unknown): b is StorageBucket => (BUCKETS as readonly unknown[]).includes(b);

/** A storage object path: no leading slash, no empty / "." / ".." segment ("my..photo.jpg" is a fine name). */
function isSafePath(path: unknown): path is string {
  if (typeof path !== "string" || !path || path.startsWith("/") || path.includes("\\") || path.includes("\u0000")) return false;
  return path.split("/").every((seg) => seg !== "" && seg !== "." && seg !== "..");
}

const PAGE_DEFAULT = 100;
const PAGE_MAX = 200;

/**
 * One page of files in a bucket (top level; uploads write `<uuid>-<name>` at the root), newest
 * first, each with the places that still reference it. `nextOffset` is null on the last page.
 * Uploads themselves happen in the browser.
 */
export async function listMedia(bucket: StorageBucket, offset = 0, limit = PAGE_DEFAULT): Promise<ActionResult<MediaPage>> {
  if (!(await adminUser())) return UNAUTHORIZED;
  try {
    if (!isBucket(bucket)) return { success: false, error: "Unknown bucket" };
    const off = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
    const lim = Number.isFinite(limit) ? Math.min(PAGE_MAX, Math.max(1, Math.floor(limit))) : PAGE_DEFAULT;
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .list("", { limit: lim, offset: off, sortBy: { column: "created_at", order: "desc" } });
    if (error) return fail("media list", error, "Failed to list files");

    const used = await collectReferences();

    const items: MediaItem[] = (data ?? [])
      .filter((f) => f.id) // folders have no id
      .map((f) => {
        const url = supabase.storage.from(bucket).getPublicUrl(f.name).data.publicUrl;
        return {
          name: f.name,
          path: f.name,
          url,
          size: (f.metadata?.size as number | undefined) ?? 0,
          mimeType: (f.metadata?.mimetype as string | undefined) ?? "",
          createdAt: f.created_at ?? "",
          usedBy: used.get(url) ?? [],
        };
      });
    return { success: true, data: { items, nextOffset: (data ?? []).length >= lim ? off + lim : null } };
  } catch (error) {
    return fail("media list", error, "Failed to list files");
  }
}

/**
 * Deletes one file. Refuses while the file is still referenced (listed in the error) unless
 * `force` is true.
 */
export async function deleteMedia(bucket: StorageBucket, path: string, force = false): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    if (!isBucket(bucket)) return { success: false, error: "Unknown bucket" };
    if (!isSafePath(path)) {
      return { success: false, error: "Invalid path" };
    }
    const supabase = createServiceClient();
    const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    if (!force) {
      const refs = await findReferences(url);
      if (refs.length > 0) return { success: false, error: `Still in use by: ${refs.join(", ")}` };
    }
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) return fail("media delete", error, "Failed to delete file");

    await audit(user, "media.delete", `${bucket}/${path}`);
    refresh();
    return { success: true };
  } catch (error) {
    return fail("media delete", error, "Failed to delete file");
  }
}

/** Replaces every string leaf equal to `from` (deep). Returns the new value and how many leaves changed. */
function swapLeaves(v: unknown, from: string, to: string): { value: unknown; n: number } {
  if (typeof v === "string") return v.trim() === from ? { value: to, n: 1 } : { value: v, n: 0 };
  if (Array.isArray(v)) {
    let n = 0;
    const value = v.map((x) => {
      const r = swapLeaves(x, from, to);
      n += r.n;
      return r.value;
    });
    return { value, n };
  }
  if (v && typeof v === "object") {
    let n = 0;
    const value: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) {
      const r = swapLeaves(x, from, to);
      n += r.n;
      value[k] = r.value;
    }
    return { value, n };
  }
  return { value: v, n: 0 };
}

/**
 * Re-points every reference to `oldUrl` (projects.image_url / gallery_urls, hero_slides.image_url,
 * team_members.photo_url and each string leaf in site_settings) at `newUrl`. Both must be files of
 * `bucket`. The old file is NOT deleted: it simply becomes unused and the caller offers to remove it.
 */
export async function replaceMedia(bucket: StorageBucket, oldUrl: string, newUrl: string): Promise<ActionResult<{ updated: number }>> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    if (!isBucket(bucket)) return { success: false, error: "Unknown bucket" };
    const supabase = createServiceClient();
    const base = new URL(supabase.storage.from(bucket).getPublicUrl("x").data.publicUrl);
    const objectPath = (raw: unknown): string | null => {
      if (typeof raw !== "string") return null;
      try {
        const u = new URL(raw);
        const root = base.pathname.slice(0, -1); // ".../object/public/<bucket>/"
        if (u.protocol !== base.protocol || u.host !== base.host || u.search || u.hash || !u.pathname.startsWith(root)) return null;
        const path = decodeURIComponent(u.pathname.slice(root.length));
        return isSafePath(path) ? path : null;
      } catch {
        return null;
      }
    };
    const oldPath = objectPath(oldUrl);
    const newPath = objectPath(newUrl);
    if (oldPath === null || newPath === null) return { success: false, error: "Both files must be in this storage" };
    if (oldUrl === newUrl) return { success: true, data: { updated: 0 } };

    // The new file must really exist, or every page that used the old one would point at nothing.
    const slash = newPath.lastIndexOf("/");
    const dir = slash >= 0 ? newPath.slice(0, slash) : "";
    const file = newPath.slice(slash + 1);
    const found = await supabase.storage.from(bucket).list(dir, { limit: 100, search: file });
    if (found.error) return fail("media replace (check)", found.error, "Failed to check the new file");
    if (!(found.data ?? []).some((f) => f.name === file)) return { success: false, error: "The new file was not found in storage" };

    let updated = 0;
    const check = (label: string, error: { message?: string } | null) => {
      if (error) throw new Error(`${label}: ${error.message ?? "update failed"}`);
    };

    const proj = await supabase.from("projects").update({ image_url: newUrl }).eq("image_url", oldUrl).select("slug");
    check("projects", proj.error);
    updated += proj.data?.length ?? 0;

    const gal = await supabase.from("projects").select("slug, gallery_urls").contains("gallery_urls", [oldUrl]);
    check("galleries", gal.error);
    for (const row of gal.data ?? []) {
      const next = ((row.gallery_urls as string[] | null) ?? []).map((u) => (u === oldUrl ? newUrl : u));
      const r = await supabase.from("projects").update({ gallery_urls: next }).eq("slug", row.slug);
      check("galleries", r.error);
      updated += 1;
    }

    const hero = await supabase.from("hero_slides").update({ image_url: newUrl }).eq("image_url", oldUrl).select("id");
    check("hero", hero.error);
    updated += hero.data?.length ?? 0;

    const team = await supabase.from("team_members").update({ photo_url: newUrl }).eq("photo_url", oldUrl).select("id");
    check("team", team.error);
    updated += team.data?.length ?? 0;

    const settings = await supabase.from("site_settings").select("key, value");
    check("settings", settings.error);
    for (const row of settings.data ?? []) {
      if (swapLeaves(row.value, oldUrl, newUrl).n === 0) continue;
      // Re-read just before writing so a save made since the first read is not overwritten.
      const fresh = await supabase.from("site_settings").select("value").eq("key", row.key).maybeSingle();
      check("settings", fresh.error);
      if (!fresh.data) continue;
      const { value, n } = swapLeaves(fresh.data.value, oldUrl, newUrl);
      if (n === 0) continue;
      const r = await supabase.from("site_settings").update({ value }).eq("key", row.key);
      check("settings", r.error);
      updated += n;
    }

    await audit(user, "media.replace", `${bucket}: ${oldUrl} -> ${newUrl} (${updated})`);
    refresh(TAGS.content, TAGS.settings, TAGS.team, TAGS.series);
    return { success: true, data: { updated } };
  } catch (error) {
    return fail("media replace", error, "Failed to replace file");
  }
}

/** Where one file is used (empty = unreferenced). Same labels as MediaItem.usedBy. */
export async function mediaUsage(bucket: StorageBucket, url: string): Promise<ActionResult<string[]>> {
  if (!(await adminUser())) return UNAUTHORIZED;
  try {
    if (!isBucket(bucket) || typeof url !== "string" || !url) return { success: false, error: "Invalid request" };
    return { success: true, data: await findReferences(url.trim()) };
  } catch (error) {
    return fail("media usage", error, "Failed to check where the file is used");
  }
}
