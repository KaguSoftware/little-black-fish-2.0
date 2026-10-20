import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SupportPage } from "@/features/support/SupportPage";
import { resolveSupport } from "@/features/support/resolve";
import { getSupportProjects } from "@/shared/data/public";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

async function load({ params, searchParams }: Props) {
  const [{ locale }, query, projects] = await Promise.all([params, searchParams, getSupportProjects()]);
  const slug = Array.isArray(query.project) ? query.project[0] : query.project;
  const active = projects.find((p) => p.slug === slug) ?? projects[0] ?? null;
  return { locale, projects, active };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { locale, active } = await load(props);
  const t = await getTranslations({ locale, namespace: "support" });
  const { title, intro } = resolveSupport(active, locale, { title: t("studioTitle"), intro: t("studioIntro") });
  return {
    title: { absolute: `${title} | ${t("metaSuffix")}` },
    description: intro,
  };
}

export default async function Page(props: Props) {
  const { locale, projects, active } = await load(props);
  setRequestLocale(locale);
  return <SupportPage locale={locale} projects={projects} active={active} />;
}
