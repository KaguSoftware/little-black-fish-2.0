import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArchivePage } from "@/features/archive/ArchivePage";
import { toProjectCard } from "@/shared/data/cards";
import { pick } from "@/shared/data/localize";
import { getHomeData } from "@/shared/data/public";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/projects">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "archive" });
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function Page({ params }: PageProps<"/[locale]/projects">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { projects, categories } = await getHomeData();
  const cards = projects.map((p) => toProjectCard(p, locale, categories));
  const links = categories.map((c) => ({ slug: c.slug, name: pick(c, "name", locale) }));
  return <ArchivePage projects={cards} categories={links} />;
}
