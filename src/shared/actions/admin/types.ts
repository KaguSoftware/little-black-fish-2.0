/**
 * Contract between the admin UI (src/features/admin) and the admin server actions
 * (src/shared/actions/admin/*.ts). Every action: `await requireAdminUser()` first,
 * service client, returns ActionResult, revalidates public pages + admin page.
 *
 * projects.ts
 *   createProject(input: ProjectInput): Promise<ActionResult<{ id: string; slug: string }>>
 *   updateProject(id: string, input: ProjectInput): Promise<ActionResult>        // slug stays stable
 *   setProjectPublished(id: string, published: boolean): Promise<ActionResult>
 *   deleteProject(id: string): Promise<ActionResult>                             // + removes its storage files
 * hero.ts
 *   createHeroSlide(input: HeroSlideInput): Promise<ActionResult<{ id: string }>>
 *   updateHeroSlide(id: string, input: HeroSlideInput): Promise<ActionResult>
 *   setHeroSlideActive(id: string, active: boolean): Promise<ActionResult>
 *   deleteHeroSlide(id: string): Promise<ActionResult>                           // + removes its hero-bucket file
 * categories.ts
 *   createCategory(input: CategoryInput): Promise<ActionResult<{ id: string; slug: string }>>
 *   updateCategory(id: string, input: CategoryInput): Promise<ActionResult>     // slug stays stable
 *   setCategoryVisible(id: string, visible: boolean): Promise<ActionResult>
 *   deleteCategory(id: string): Promise<ActionResult>
 * submissions.ts
 *   setSubmissionRead(id: string, read: boolean): Promise<ActionResult>
 *   deleteSubmission(id: string): Promise<ActionResult>
 * reorder.ts
 *   reorder(table: ReorderTable, items: { id: string; order: number }[]): Promise<ActionResult>
 * auth.ts
 *   signOut(locale: string): Promise<never>                                       // → /{locale}/login
 * data.ts (server-only, not an action)
 *   loadAdminData(): Promise<AdminData>
 */
import type { CategoryRow, ContactSubmissionRow, HeroSlideRow, ProjectRow } from "@/shared/data/types";

export interface ProjectInput {
  titleEn: string;
  titleFa: string;
  descriptionEn?: string | null;
  descriptionFa?: string | null;
  mediaType: "youtube" | "gallery";
  youtubeUrl?: string | null;
  imageUrl?: string | null;
  galleryUrls: string[];
  categoryId?: string | null;
  published: boolean;
  supportEnabled: boolean;
  supportTitleEn?: string | null;
  supportTitleFa?: string | null;
  supportIntroEn?: string | null;
  supportIntroFa?: string | null;
  supportBodyEn?: string | null;
  supportBodyFa?: string | null;
  supportClosingEn?: string | null;
  supportClosingFa?: string | null;
  /** Non-negative integer or null (strings from inputs are accepted and parsed). */
  supportEpisodesDone?: number | string | null;
  supportEpisodesTotal?: number | string | null;
}

export interface HeroSlideInput {
  titleEn?: string | null;
  titleFa?: string | null;
  subtitleEn?: string | null;
  subtitleFa?: string | null;
  /** Image or .mp4 URL. One of imageUrl / youtubeUrl is required. */
  imageUrl?: string | null;
  youtubeUrl?: string | null;
}

export interface CategoryInput {
  nameEn: string;
  nameFa: string;
}

export type ReorderTable = "projects" | "hero_slides" | "categories";

export interface AdminData {
  projects: ProjectRow[];
  heroSlides: HeroSlideRow[];
  categories: CategoryRow[];
  /** Latest 200, newest first. */
  submissions: ContactSubmissionRow[];
}
