"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, requireAdminUser } from "@/shared/supabase/server";
import type { ActionResult } from "@/shared/data/types";
import { slugify } from "@/shared/data/slug";
import type { CategoryInput } from "./types";

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
  console.error(`[admin/categories] ${scope}:`, error);
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return { success: false, error: message || fallback };
};

function names(input: CategoryInput) {
  const nameEn = typeof input?.nameEn === "string" ? input.nameEn.trim() : "";
  const nameFa = typeof input?.nameFa === "string" ? input.nameFa.trim() : "";
  return nameEn && nameFa ? { name_en: nameEn, name_fa: nameFa } : null;
}

export async function createCategory(input: CategoryInput): Promise<ActionResult<{ id: string; slug: string }>> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const row = names(input);
    if (!row) return { success: false, error: "Both names are required" };

    const slug = `${slugify(row.name_en) || "category"}-${Date.now()}`;
    const { data, error } = await createServiceClient()
      .from("categories")
      .insert({ ...row, slug, order: 0, visible: true })
      .select("id, slug")
      .single();
    if (error) return fail("create", error, "Failed to create category");

    revalidate();
    return { success: true, data: { id: data.id as string, slug: data.slug as string } };
  } catch (error) {
    return fail("create", error, "Failed to create category");
  }
}

/** The slug stays stable so existing links keep working. */
export async function updateCategory(id: string, input: CategoryInput): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    if (!id) return { success: false, error: "Missing category id" };
    const row = names(input);
    if (!row) return { success: false, error: "Both names are required" };

    const { error } = await createServiceClient().from("categories").update(row).eq("id", id);
    if (error) return fail("update", error, "Failed to update category");

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("update", error, "Failed to update category");
  }
}

export async function setCategoryVisible(id: string, visible: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const { error } = await createServiceClient()
      .from("categories")
      .update({ visible: !!visible })
      .eq("id", id);
    if (error) return fail("setVisible", error, "Failed to update category");

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("setVisible", error, "Failed to update category");
  }
}

/** projects.category_id is ON DELETE SET NULL, so its projects simply become uncategorised. */
export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const { error } = await createServiceClient().from("categories").delete().eq("id", id);
    if (error) return fail("delete", error, "Failed to delete category");

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("delete", error, "Failed to delete category");
  }
}
