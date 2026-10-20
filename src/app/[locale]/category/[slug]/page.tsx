import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArchivePage } from "@/features/archive/ArchivePage";
import { toProjectCard } from "@/shared/data/cards";
import { pick } from "@/shared/data/localize";
import { getCategoryBySlug, getProjectsByCategory, getVisibleCategories } from "@/shared/data/public";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[locale]/category/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  const name = pick(category, "name", locale);
  const t = await getTranslations({ locale, namespace: "category" });
  return { title: name, description: t("metaDescription", { name }) };
}

export default async function Page({ params }: PageProps<"/[locale]/category/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const [projects, categories, t] = await Promise.all([
    getProjectsByCategory(category.id),
    getVisibleCategories(),
    getTranslations("category"),
  ]);
  const name = pick(category, "name", locale);
  const cards = projects.map((p) => toProjectCard(p, locale, categories));
  const links = categories.map((c) => ({ slug: c.slug, name: pick(c, "name", locale) }));

  return (
    <ArchivePage
      projects={cards}
      categories={links}
      currentCategory={category.slug}
      heading={name}
      intro={t("intro", { name })}
      back={{ href: "/projects", label: t("allWork") }}
      showFeatured={false}
    />
  );
}
