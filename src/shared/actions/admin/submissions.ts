"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient, requireAdminUser } from "@/shared/supabase/server";
import type { ActionResult } from "@/shared/data/types";

async function isAdmin() {
  try {
    await requireAdminUser();
    return true;
  } catch {
    return false;
  }
}

/** Submissions are admin-only: no public page to refresh. */
function revalidate() {
  revalidatePath("/[locale]/admin", "page");
}

const fail = (scope: string, error: unknown, fallback: string): ActionResult<never> => {
  console.error(`[admin/submissions] ${scope}:`, error);
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return { success: false, error: message || fallback };
};

export async function setSubmissionRead(id: string, read: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const { error } = await createServiceClient()
      .from("contact_submissions")
      .update({ read: !!read })
      .eq("id", id);
    if (error) return fail("setRead", error, "Failed to update message");

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("setRead", error, "Failed to update message");
  }
}

export async function deleteSubmission(id: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { success: false, error: "Unauthorized" };
  try {
    const { error } = await createServiceClient().from("contact_submissions").delete().eq("id", id);
    if (error) return fail("delete", error, "Failed to delete message");

    revalidate();
    return { success: true };
  } catch (error) {
    return fail("delete", error, "Failed to delete message");
  }
}
