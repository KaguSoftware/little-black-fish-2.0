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
