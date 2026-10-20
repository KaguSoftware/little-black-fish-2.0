import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import SeriesPage from "@/features/series/SeriesPage";
import { SERIES_SLUG, toProjectCard } from "@/shared/data/cards";
import { getHomeData } from "@/shared/data/public";
import type { ProjectRow } from "@/shared/data/types";

export const revalidate = 3600;

/** The full-episode playlist linked in the row's description, else its own video. */
function watchUrl(row: ProjectRow) {
  const text = `${row.description_en ?? ""} ${row.description_fa ?? ""}`;
  return text.match(/https?:\/\/\S*youtube\.com\/playlist\S*/)?.[0] ?? row.youtube_url?.trim() ?? null;
}

/** MY MAKER has six asymmetric slots. */
const MAKER_COUNT = 6;

export async function generateMetadata({ params }: PageProps<"/[locale]/projects/series">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "series" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function Page({ params }: PageProps<"/[locale]/projects/series">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { projects, categories } = await getHomeData();
  // The series' own row feeds "Watch the series"; MY MAKER shows the studio's other work.
  const series = projects.find((p) => p.slug === SERIES_SLUG);
  const cards = projects
    .filter((p) => p.slug !== SERIES_SLUG)
    .slice(0, MAKER_COUNT)
    .map((p) => toProjectCard(p, locale, categories));
  return <SeriesPage projects={cards} watchUrl={series ? watchUrl(series) : null} />;
}
