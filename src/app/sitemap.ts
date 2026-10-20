import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SERIES_SLUG } from "@/shared/data/cards";
import { getSitemapData } from "@/shared/data/public";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://littleblackfishstudios.com";
const STATIC_ROUTES = ["", "/projects", "/projects/series", "/about", "/contact", "/support"];

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { projects, categories } = await getSitemapData();
  const now = new Date();

  // Every route in both locales, each entry listing its other-language alternate.
  const entries = (path: string, lastModified: Date) =>
    routing.locales.map((l) => ({
      url: `${BASE_URL}/${l}${path}`,
      lastModified,
      alternates: { languages: Object.fromEntries(routing.locales.map((alt) => [alt, `${BASE_URL}/${alt}${path}`])) },
    }));

  return [
    ...STATIC_ROUTES.flatMap((p) => entries(p, now)),
    // The series row's page is /projects/series, already listed above.
    ...projects
      .filter((p) => p.slug !== SERIES_SLUG)
      .flatMap((p) => entries(`/projects/${p.slug}`, new Date(p.updated_at))),
    ...categories.flatMap((c) => entries(`/category/${c.slug}`, new Date(c.updated_at))),
  ];
}
