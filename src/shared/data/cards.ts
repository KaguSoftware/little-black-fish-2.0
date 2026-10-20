import { getImageProps } from "next/image";
import type { Locale } from "@/i18n/routing";
import { pick } from "./localize";
import type { CategoryRow, ProjectRow } from "./types";
import { getYouTubeId, youTubeMaxRes } from "./youtube";

/**
 * The Shahnameh series' database row. It has no generic /projects/[slug] page: its one
 * page is the 3D story at /projects/series, so every link to it goes there.
 */
export const SERIES_SLUG = "shahname-microseries";
export const SERIES_HREF = "/projects/series";

/** Unprefixed page path for a project slug. */
export function projectHref(slug: string) {
  return slug === SERIES_SLUG ? SERIES_HREF : `/projects/${slug}`;
}

/** What list UIs (home teasers, archive, category) render for one project. Serialisable. */
export interface ProjectCard {
  id: string;
  slug: string;
  /** Unprefixed; the locale-aware Link / iris router adds /en or /fa. */
  href: string;
  title: string;
  description: string;
  categoryName: string | null;
  categorySlug: string | null;
  mediaType: "youtube" | "gallery";
  youtubeId: string | null;
  /** Cover: image_url → YouTube maxres → first gallery image. */
  image: string | null;
}

export function coverImage(row: ProjectRow): string | null {
  const yt = getYouTubeId(row.youtube_url);
  return row.image_url?.trim() || (yt ? youTubeMaxRes(yt) : null) || row.gallery_urls?.[0] || null;
}

export function toProjectCard(row: ProjectRow, locale: Locale | string, categories: CategoryRow[]): ProjectCard {
  const cat = row.category_id ? categories.find((c) => c.id === row.category_id) : undefined;
  return {
    id: row.id,
    slug: row.slug,
    href: projectHref(row.slug),
    title: pick(row, "title", locale),
    description: pick(row, "description", locale),
    categoryName: cat ? pick(cat, "name", locale) : null,
    categorySlug: cat?.slug ?? null,
    mediaType: row.media_type === "gallery" ? "gallery" : "youtube",
    youtubeId: getYouTubeId(row.youtube_url),
    image: coverImage(row),
  };
}

/**
 * Responsive src/srcSet for a remote (Supabase / YouTube) or local image, served through
 * the Next image optimiser so Supabase egress stays low. Spread onto an existing <img>
 * to keep its markup: <img {...cardImage(url, sizes)} alt=… />.
 */
export function cardImage(src: string, sizes: string, width = 1600, height = 900) {
  const { props } = getImageProps({ src, alt: "", width, height, sizes });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}
