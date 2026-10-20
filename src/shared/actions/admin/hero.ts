"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, requireAdminUser } from "@/shared/supabase/server";
import type { ActionResult } from "@/shared/data/types";
import { isSupabaseStorageUrl, storagePath } from "@/shared/data/storage";
import type { HeroSlideInput } from "./types";

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
  console.error(`[admin/hero] ${scope}:`, error);
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return { success: false, error: message || fallback };
};

const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function toRow(input: HeroSlideInput): { row: Record<string, string | null> } | { error: string } {
  const imageUrl = text(input?.imageUrl);
  const youtubeUrl = text(input?.youtubeUrl);
  if (!imageUrl && !youtubeUrl) return { error: "An image, video or YouTube URL is required" };
  return {
    row: {
      title_en: text(input.titleEn),
      title_fa: text(input.titleFa),
      subtitle_en: text(input.subtitleEn),
      subtitle_fa: text(input.subtitleFa),
      image_url: imageUrl,
      youtube_url: youtubeUrl,
    },
  };
}

/** New slides go to the end of the running order (current max + 1). */
export async function createHeroSlide(input: HeroSlideInput): Promise<ActionResult<{ id: string }>> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const parsed = toRow(input);
    if ("error" in parsed) return { success: false, error: parsed.error };

    const supabase = createServiceClient();
    const { data: last, error: lastError } = await supabase
      .from("hero_slides")
      .select("order")
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) return fail("create (order)", lastError, "Failed to create slide");
    const order = typeof last?.order === "number" ? last.order + 1 : 0;

    const { data, error } = await supabase
      .from("hero_slides")
      .insert({ ...parsed.row, order, active: true })
      .select("id")
      .single();
    if (error) return fail("create", error, "Failed to create slide");

    revalidate();
    return { success: true, data: { id: data.id as string } };
  } catch (error) {
    return fail("create", error, "Failed to create slide");
  }
}

export async function updateHeroSlide(id: string, input: HeroSlideInput): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    if (!id) return { success: false, error: "Missing slide id" };
    const parsed = toRow(input);
    if ("error" in parsed) return { success: false, error: parsed.error };

    const { error } = await createServiceClient().from("hero_slides").update(parsed.row).eq("id", id);
    if (error) return fail("update", error, "Failed to update slide");

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("update", error, "Failed to update slide");
  }
}

export async function setHeroSlideActive(id: string, active: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const { error } = await createServiceClient()
      .from("hero_slides")
      .update({ active: !!active })
      .eq("id", id);
    if (error) return fail("setActive", error, "Failed to update slide");

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("setActive", error, "Failed to update slide");
  }
}

export async function deleteHeroSlide(id: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const supabase = createServiceClient();
    const { data: slide, error: fetchError } = await supabase
      .from("hero_slides")
      .select("image_url")
      .eq("id", id)
      .single();
    if (fetchError || !slide) return { success: false, error: "Slide not found" };

    const url = slide.image_url as string | null;
    const path = isSupabaseStorageUrl(url) ? storagePath(url, "hero") : null;

    // Row first: a failed file cleanup leaves an orphaned file, never a slide pointing at nothing.
    const { error: deleteError } = await supabase.from("hero_slides").delete().eq("id", id);
    if (deleteError) return fail("delete", deleteError, "Failed to delete slide");

    if (path) {
      const { error: storageError } = await supabase.storage.from("hero").remove([path]);
      if (storageError) console.error("[admin/hero] delete storage file:", storageError);
    }

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("delete", error, "Failed to delete slide");
  }
}
