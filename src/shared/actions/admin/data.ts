import "server-only";

import { createServiceClient, requireAdminUser } from "@/shared/supabase/server";
import type { CategoryRow, ContactSubmissionRow, HeroSlideRow, ProjectRow } from "@/shared/data/types";
import type { AdminData } from "./types";

/** Everything the admin page shows. Throws when the caller is not an admin or a read fails. */
export async function loadAdminData(): Promise<AdminData> {
  await requireAdminUser();
  const supabase = createServiceClient();

  const [projects, heroSlides, categories, submissions] = await Promise.all([
    supabase.from("projects").select("*").order("order").order("created_at"),
    supabase.from("hero_slides").select("*").order("order").order("created_at"),
    supabase.from("categories").select("*").order("order").order("created_at"),
    supabase.from("contact_submissions").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const error = projects.error ?? heroSlides.error ?? categories.error ?? submissions.error;
  if (error) throw new Error(`Failed to load admin data: ${error.message}`);

  return {
    projects: (projects.data ?? []) as ProjectRow[],
    heroSlides: (heroSlides.data ?? []) as HeroSlideRow[],
    categories: (categories.data ?? []) as CategoryRow[],
    submissions: (submissions.data ?? []) as ContactSubmissionRow[],
  };
}
