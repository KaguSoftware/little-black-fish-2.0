import { setRequestLocale } from "next-intl/server";
import { HomePage } from "@/features/home/HomePage";
import { SERIES_SLUG, toProjectCard } from "@/shared/data/cards";
import { getHomeData } from "@/shared/data/public";

export const revalidate = 3600;

export default async function Page({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { projects, categories } = await getHomeData();
  // The eyes already lead into the series; the teasers are the other work.
  const cards = projects.filter((p) => p.slug !== SERIES_SLUG).map((p) => toProjectCard(p, locale, categories));
  return <HomePage projects={cards} />;
}
