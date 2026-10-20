"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, requireAdminUser } from "@/shared/supabase/server";
import type { ActionResult } from "@/shared/data/types";
import { slugify } from "@/shared/data/slug";
import { getYouTubeId, youTubeMaxRes } from "@/shared/data/youtube";
import { isSupabaseStorageUrl, storagePath } from "@/shared/data/storage";
import type { ProjectInput } from "./types";

/* Not exported: a "use server" file may only export async actions. */

async function isAdmin() {
  try {
    await requireAdminUser();
    return true;
  } catch {
    return false;
  }
}

function revalidate() {
  revalidatePath("/[locale]", "layout");
  revalidatePath("/[locale]/admin", "page");
}

const fail = (scope: string, error: unknown, fallback: string): ActionResult<never> => {
  console.error(`[admin/projects] ${scope}:`, error);
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return { success: false, error: message || fallback };
};

/** Trimmed text, empty → null. */
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Non-negative integer or null. Accepts numbers and numeric strings from inputs. */
function count(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number.parseInt(String(v).trim(), 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Columns shared by create and update. The slug is never part of this (it stays stable). */
function toRow(input: ProjectInput): { row: Record<string, unknown> } | { error: string } {
  const titleEn = text(input?.titleEn);
  const titleFa = text(input?.titleFa);
  if (!titleEn || !titleFa) return { error: "Both titles are required" };

  const mediaType = input.mediaType === "gallery" ? "gallery" : "youtube";
  const youtubeUrl = text(input.youtubeUrl);
  let imageUrl = text(input.imageUrl);
  if (!imageUrl) {
    const id = getYouTubeId(youtubeUrl);
    if (id) imageUrl = youTubeMaxRes(id);
  }
  const galleryUrls = Array.isArray(input.galleryUrls)
    ? input.galleryUrls.map(text).filter((u): u is string => !!u)
    : [];

  return {
    row: {
      title_en: titleEn,
      title_fa: titleFa,
      description_en: text(input.descriptionEn),
      description_fa: text(input.descriptionFa),
      media_type: mediaType,
      youtube_url: youtubeUrl,
      image_url: imageUrl,
      gallery_urls: galleryUrls,
      category_id: text(input.categoryId),
      published: !!input.published,
      support_enabled: !!input.supportEnabled,
      support_title_en: text(input.supportTitleEn),
      support_title_fa: text(input.supportTitleFa),
      support_intro_en: text(input.supportIntroEn),
      support_intro_fa: text(input.supportIntroFa),
      support_body_en: text(input.supportBodyEn),
      support_body_fa: text(input.supportBodyFa),
      support_closing_en: text(input.supportClosingEn),
      support_closing_fa: text(input.supportClosingFa),
      support_episodes_done: count(input.supportEpisodesDone),
      support_episodes_total: count(input.supportEpisodesTotal),
    },
  };
}

export async function createProject(input: ProjectInput): Promise<ActionResult<{ id: string; slug: string }>> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const parsed = toRow(input);
    if ("error" in parsed) return { success: false, error: parsed.error };

    const slug = `${slugify(String(input.titleEn)) || "project"}-${Date.now()}`;
    const { data, error } = await createServiceClient()
      .from("projects")
      .insert({ ...parsed.row, slug, order: 0 })
      .select("id, slug")
      .single();
    if (error) return fail("create", error, "Failed to create project");

    revalidate();
    return { success: true, data: { id: data.id as string, slug: data.slug as string } };
  } catch (error) {
    return fail("create", error, "Failed to create project");
  }
}

export async function updateProject(id: string, input: ProjectInput): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    if (!id) return { success: false, error: "Missing project id" };
    const parsed = toRow(input);
    if ("error" in parsed) return { success: false, error: parsed.error };

    const { error } = await createServiceClient().from("projects").update(parsed.row).eq("id", id);
    if (error) return fail("update", error, "Failed to update project");

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("update", error, "Failed to update project");
  }
}

export async function setProjectPublished(id: string, published: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const { error } = await createServiceClient()
      .from("projects")
      .update({ published: !!published })
      .eq("id", id);
    if (error) return fail("setPublished", error, "Failed to update status");

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("setPublished", error, "Failed to update status");
  }
}

export async function deleteProject(id: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const supabase = createServiceClient();
    const { data: project, error: fetchError } = await supabase
      .from("projects")
      .select("image_url, gallery_urls")
      .eq("id", id)
      .single();
    if (fetchError || !project) return { success: false, error: "Project not found" };

    const urls = [project.image_url as string | null, ...((project.gallery_urls as string[] | null) ?? [])];
    const paths = [
      ...new Set(
        urls
          .filter(isSupabaseStorageUrl)
          .map((u) => storagePath(u, "projects"))
          .filter((p): p is string => !!p),
      ),
    ];

    // Row first: if the file cleanup then fails, the worst case is an orphaned file, never a broken project.
    const { error: deleteError } = await supabase.from("projects").delete().eq("id", id);
    if (deleteError) return fail("delete", deleteError, "Failed to delete project");

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from("projects").remove(paths);
      if (storageError) console.error("[admin/projects] delete storage files:", storageError);
    }

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("delete", error, "Failed to delete project");
  }
}
