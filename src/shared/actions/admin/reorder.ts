"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, requireAdminUser } from "@/shared/supabase/server";
import type { ActionResult } from "@/shared/data/types";
import type { ReorderTable } from "./types";

const TABLES: readonly ReorderTable[] = ["projects", "hero_slides", "categories"];

async function isAdmin() {
  try {
    await requireAdminUser();
    return true;
  } catch {
    return false;
  }
}

export async function reorder(table: ReorderTable, items: { id: string; order: number }[]): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    if (!TABLES.includes(table)) return { success: false, error: "Unknown table" };
    if (
      !Array.isArray(items) ||
      items.some((it) => !it || typeof it.id !== "string" || !it.id || !Number.isInteger(it.order))
    ) {
      return { success: false, error: "Invalid order" };
    }
    if (items.length === 0) return { success: true };

    const supabase = createServiceClient();
    const results = await Promise.all(
      items.map(({ id, order }) => supabase.from(table).update({ order }).eq("id", id)),
    );
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) {
      console.error(`[admin/reorder] ${table}:`, firstError);
      return { success: false, error: firstError.message || "Failed to save the order" };
    }

    revalidatePath("/[locale]", "layout");
    revalidatePath("/[locale]/admin", "page");
    return { success: true };
  } catch (error) {
    console.error(`[admin/reorder] ${table}:`, error);
    return { success: false, error: "Failed to save the order" };
  }
}
