/** Rows exactly as stored in Supabase (public schema). Never change these to fit a component. */

export interface ProjectRow {
  id: string;
  slug: string;
  title_en: string;
  title_fa: string;
  description_en: string | null;
  description_fa: string | null;
  /** 'youtube' = video project (image_url is its poster); 'gallery' = image gallery (image_url is the cover). */
  media_type: "youtube" | "gallery" | string;
  youtube_url: string | null;
  image_url: string | null;
  gallery_urls: string[] | null;
  category_id: string | null;
  order: number;
  published: boolean;
  created_at: string;
  updated_at: string;
  support_enabled?: boolean | null;
  support_title_en?: string | null;
  support_title_fa?: string | null;
  support_intro_en?: string | null;
  support_intro_fa?: string | null;
  support_body_en?: string | null;
  support_body_fa?: string | null;
  support_closing_en?: string | null;
  support_closing_fa?: string | null;
  support_episodes_done?: number | null;
  support_episodes_total?: number | null;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name_en: string;
  name_fa: string;
  order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface HeroSlideRow {
  id: string;
  title_en: string | null;
  title_fa: string | null;
  subtitle_en: string | null;
  subtitle_fa: string | null;
  /** An image or an .mp4 video URL. */
  image_url: string | null;
  youtube_url: string | null;
  order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContactSubmissionRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  email_sent: boolean;
  email_error: string | null;
  read: boolean;
  created_at: string;
}

export type ProjectNavRow = Pick<ProjectRow, "id" | "slug" | "title_en" | "title_fa">;

/** The shape every mutation returns to the client. */
export type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };

export type ContentLocale = "en" | "fa";

export interface SiteContentRow {
  key: string;
  locale: ContentLocale;
  value: string;
  updated_at: string;
}

export interface SiteSettingRow {
  key: string;
  value: unknown;
  updated_at: string;
}

export interface TeamMemberRow {
  id: string;
  name_en: string;
  name_fa: string;
  title_en: string;
  title_fa: string;
  role_en: string;
  role_fa: string;
  photo_url: string | null;
  /** Bare handle, no @. */
  instagram: string | null;
  order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

/** Chapter ids (slug) are fixed in code (ChapterId); only the text, order and visibility are editable. */
export interface SeriesChapterRow {
  slug: string;
  word_en: string;
  word_fa: string;
  title_en: string;
  title_fa: string;
  order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

/** chapter id -> narration line. Only hello/world/day/did/others; missing or "" = use the built-in line. */
export type NarrationMap = Partial<Record<"hello" | "world" | "day" | "did" | "others", string>>;

/** Character ids (slug) are fixed in code (TellerId); 3D models, colors and framing stay in code. */
export interface SeriesCharacterRow {
  slug: string;
  name_en: string;
  name_fa: string;
  role_en: string;
  role_fa: string;
  mood_en: string;
  mood_fa: string;
  narration_en: NarrationMap;
  narration_fa: NarrationMap;
  order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminAuditRow {
  id: number;
  at: string;
  actor_email: string | null;
  action: string;
  target: string | null;
}
