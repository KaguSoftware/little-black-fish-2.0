import "server-only";

import { cache } from "react";
import { createAnonClient } from "@/shared/supabase/server";
import snapshot from "./fallback.json";
import type { CategoryRow, HeroSlideRow, ProjectNavRow, ProjectRow } from "./types";
import { getYouTubeId, youTubeMaxRes } from "./youtube";

/**
 * Public reads (publishable key, RLS applies). Every read falls back to the bundled
 * snapshot (scripts/snapshot-db.mjs) on error or timeout, so the site never goes
 * blank when Supabase is down or over quota (it has hit HTTP 402 before).
 */

const fallback = snapshot as unknown as {
  takenAt: string | null;
  projects: ProjectRow[];
  heroSlides: HeroSlideRow[];
  categories: CategoryRow[];
};

// Two projects can share an `order`; created_at keeps the sequence stable.
const byOrder = (a: { order: number; created_at: string }, b: { order: number; created_at: string }) =>
  a.order - b.order || a.created_at.localeCompare(b.created_at);

const snapshotProjects = () => fallback.projects.filter((p) => p.published).sort(byOrder);
const snapshotSlides = () => fallback.heroSlides.filter((s) => s.active).sort(byOrder);
const snapshotCategories = () => fallback.categories.filter((c) => c.visible).sort(byOrder);

type QueryResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;

async function withFallback<T>(label: string, query: QueryResult, fallbackRows: () => T[]): Promise<T[]> {
  try {
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as T[];
  } catch (e) {
    console.warn(`[fallback] ${label}: ${e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)}`);
    return fallbackRows();
  }
}

/**
 * Some stored image_urls are YouTube thumbnails of videos that no longer exist (404 at every
 * size). Swap those for the project's own video thumbnail at read time; the row is not changed.
 * Checks are cached by the fetch cache for a day.
 */
const YT_THUMB_RE = /^https:\/\/img\.youtube\.com\/vi\//;

async function thumbOk(url: string) {
  try {
    const res = await fetch(url, { method: "HEAD", next: { revalidate: 86400 }, signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return true; // network trouble: keep the stored URL rather than guessing
  }
}

async function withLiveThumbs(rows: ProjectRow[]): Promise<ProjectRow[]> {
  return Promise.all(
    rows.map(async (row) => {
      const img = row.image_url?.trim();
      if (!img || !YT_THUMB_RE.test(img) || (await thumbOk(img))) return row;
      const own = getYouTubeId(row.youtube_url);
      const replacement = own ? youTubeMaxRes(own) : null;
      return { ...row, image_url: replacement && replacement !== img && (await thumbOk(replacement)) ? replacement : null };
    }),
  );
}

const projects = () => createAnonClient().from("projects");
const categories = () => createAnonClient().from("categories");

export const getPublishedProjects = cache(async () =>
  withLiveThumbs(
    await withFallback<ProjectRow>(
      "projects",
      projects().select("*").eq("published", true).order("order").order("created_at"),
      snapshotProjects,
    ),
  ),
);

export const getVisibleCategories = cache(() =>
  withFallback<CategoryRow>(
    "categories",
    categories().select("*").eq("visible", true).order("order").order("created_at"),
    snapshotCategories,
  ),
);

/** Active hero_slides as the admin manages them. The home page plays HERO_VIDEOS (hero.ts) instead. */
export const getHeroSlides = cache(() =>
  withFallback<HeroSlideRow>(
    "hero_slides",
    createAnonClient().from("hero_slides").select("*").eq("active", true).order("order"),
    snapshotSlides,
  ),
);

export const getHomeData = cache(async () => {
  const [p, c] = await Promise.all([getPublishedProjects(), getVisibleCategories()]);
  return { projects: p, categories: c };
});

export const getCategoryBySlug = cache(async (slug: string) => {
  const rows = await withFallback<CategoryRow>(
    `category ${slug}`,
    categories().select("*").eq("slug", slug).eq("visible", true).limit(1),
    () => snapshotCategories().filter((c) => c.slug === slug),
  );
  return rows[0] ?? null;
});

export const getProjectsByCategory = cache(async (categoryId: string) =>
  withLiveThumbs(
    await withFallback<ProjectRow>(
      `projects in ${categoryId}`,
      projects().select("*").eq("published", true).eq("category_id", categoryId).order("order").order("created_at"),
      () => snapshotProjects().filter((p) => p.category_id === categoryId),
    ),
  ),
);

export const getProjectBySlug = cache(async (slug: string) => {
  const rows = await withFallback<ProjectRow>(
    `project ${slug}`,
    projects().select("*").eq("slug", slug).eq("published", true).limit(1),
    () => snapshotProjects().filter((p) => p.slug === slug),
  );
  return rows[0] ? (await withLiveThumbs([rows[0]]))[0] : null;
});

export const getProjectNav = cache(() =>
  withFallback<ProjectNavRow>(
    "project nav",
    projects().select("id, slug, title_en, title_fa").eq("published", true).order("order").order("created_at"),
    () => snapshotProjects().map(({ id, slug, title_en, title_fa }) => ({ id, slug, title_en, title_fa })),
  ),
);

export const getSupportProjects = cache(() =>
  withFallback<ProjectRow>(
    "support projects",
    projects().select("*").eq("published", true).eq("support_enabled", true).order("order").order("created_at"),
    () => snapshotProjects().filter((p) => p.support_enabled),
  ),
);

export async function getSitemapData() {
  const [p, c] = await Promise.all([
    withFallback<Pick<ProjectRow, "slug" | "updated_at">>(
      "sitemap projects",
      projects().select("slug, updated_at").eq("published", true),
      snapshotProjects,
    ),
    withFallback<Pick<CategoryRow, "slug" | "updated_at">>(
      "sitemap categories",
      categories().select("slug, updated_at").eq("visible", true),
      snapshotCategories,
    ),
  ]);
  return { projects: p, categories: c };
}
