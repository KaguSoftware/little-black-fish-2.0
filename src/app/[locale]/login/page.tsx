import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireAdminUser } from "@/shared/supabase/server";
import { LoginPage } from "@/features/login/LoginPage";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "login" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function Page({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Already signed in as an admin: go straight backstage.
  let isAdmin = false;
  try {
    await requireAdminUser();
    isAdmin = true;
  } catch {
    // Not signed in, or not an admin: show the form.
  }
  if (isAdmin) redirect({ href: "/admin", locale });

  const { error } = await searchParams;
  return <LoginPage forbidden={error === "forbidden"} />;
}
