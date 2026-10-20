import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProjectPage } from "@/features/project/ProjectPage";
import { permanentRedirect } from "@/i18n/navigation";
import { SERIES_HREF, SERIES_SLUG, coverImage } from "@/shared/data/cards";
import { pick } from "@/shared/data/localize";
import { getProjectBySlug, getProjectNav, getVisibleCategories } from "@/shared/data/public";

export const revalidate = 3600;

export async function generateStaticParams() {
  const nav = await getProjectNav();
  return nav.filter((p) => p.slug !== SERIES_SLUG).map((p) => ({ slug: p.slug }));
}

/** First ~160 characters of the description, on a word boundary. */
function excerpt(text: string, max = 160) {
  const flat = text.replace(/\s+/g, " ").trim().replace(/(…|\.{3})+$/, "");
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:،؛…]+$/, "")}…`;
}

export async function generateMetadata({ params }: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  const project = await getProjectBySlug(decodeURIComponent(slug));
  if (!project) return {};
  const t = await getTranslations({ locale, namespace: "project" });
  const title = pick(project, "title", locale);
  const description = excerpt(pick(project, "description", locale)) || t("metaFallback", { title });
  const image = coverImage(project);
  const path = `/projects/${project.slug}`;
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { en: `/en${path}`, fa: `/fa${path}` },
    },
    openGraph: {
      type: "article",
      title,
      description,
      locale: locale === "fa" ? "fa_IR" : "en_US",
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default async function Page({ params }: PageProps<"/[locale]/projects/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  // The series' one page is the 3D story; old links to its row land there.
  if (decodeURIComponent(slug) === SERIES_SLUG) permanentRedirect({ href: SERIES_HREF, locale });
  const [project, categories, nav] = await Promise.all([
    getProjectBySlug(decodeURIComponent(slug)),
    getVisibleCategories(),
    getProjectNav(),
  ]);
  if (!project) notFound();
  return <ProjectPage project={project} locale={locale} categories={categories} nav={nav} />;
}
