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
 *   listContentEntries(): Promise<ContentEntry[]>                                   // also included in AdminData.content
 * Full details: docs/admin-contract.md
 */
import type {
  AdminAuditRow,
  CategoryRow,
  ContactSubmissionRow,
  ContentLocale,
  HeroSlideRow,
  ProjectRow,
  SeriesChapterRow,
  SeriesCharacterRow,
  TeamMemberRow,
} from "@/shared/data/types";
import type { Settings } from "@/shared/data/settingsSchema";

export type { Settings, SettingKey } from "@/shared/data/settingsSchema";

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

export type ReorderTable =
  | "projects"
  | "hero_slides"
  | "categories"
  | "team_members"
  | "series_chapters"
  | "series_characters";

export interface ContentEntryInput {
  /** "<namespace>.<dotted.path>", numeric segments for arrays. Must exist in the default JSON. */
  key: string;
  locale: ContentLocale;
  value: string;
}

/** One editable string of site copy, both languages side by side. */
export interface ContentEntry {
  key: string;
  namespace: string;
  /** key without the namespace. */
  path: string;
  /** Effective text (override if present, else default). */
  en: string;
  fa: string;
  enOverridden: boolean;
  faOverridden: boolean;
  enDefault: string;
  faDefault: string;
}

export interface TeamMemberInput {
  nameEn: string;
  nameFa: string;
  titleEn?: string | null;
  titleFa?: string | null;
  roleEn?: string | null;
  roleFa?: string | null;
  /** http(s) URL (storage upload) or site path; empty = monogram stand-in. */
  photoUrl?: string | null;
  /** Handle, @handle or instagram.com URL; stored as the bare handle. */
  instagram?: string | null;
}

export interface SeriesChapterInput {
  wordEn: string;
  wordFa: string;
  titleEn: string;
  titleFa: string;
}

export interface SeriesCharacterInput {
  nameEn: string;
  nameFa: string;
  roleEn?: string | null;
  roleFa?: string | null;
  moodEn?: string | null;
  moodFa?: string | null;
  /** hello / world / day / did / others; empty or missing = built-in line. */
  narrationEn?: Record<string, string> | null;
  narrationFa?: Record<string, string> | null;
}

export interface MediaItem {
  name: string;
  /** Path inside the bucket (pass to deleteMedia). */
  path: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: string;
  /** Labels of the records still using this file; empty = safe to delete. */
  usedBy: string[];
}

export interface AdminData {
  projects: ProjectRow[];
  heroSlides: HeroSlideRow[];
  categories: CategoryRow[];
  /** Latest 200, newest first. */
  submissions: ContactSubmissionRow[];
  teamMembers: TeamMemberRow[];
  /** All rows incl. hidden; empty until seeded (scripts/seed-content.mjs). */
  seriesChapters: SeriesChapterRow[];
  seriesCharacters: SeriesCharacterRow[];
  /** Effective settings (stored value or code default) for every key. */
  settings: Settings;
  /** Keys that have a stored value (the rest show code defaults). */
  settingsStored: string[];
  /** Every editable string of copy; see ContentEntry. */
  content: ContentEntry[];
  /** Latest 50 admin actions, newest first. */
  audit: AdminAuditRow[];
}
