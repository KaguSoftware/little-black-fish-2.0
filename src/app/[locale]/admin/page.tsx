import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireAdminUser } from "@/shared/supabase/server";
import { loadAdminData } from "@/shared/actions/admin/data";
import type { AdminData } from "@/shared/actions/admin/types";
import { AdminPanel } from "@/features/admin/AdminPanel";

export async function generateMetadata({ params }: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/** /{locale}/admin. The proxy gates it too; this is the second lock. Always request-time (cookies). */
export default async function Page({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await connection();

  let data: AdminData;
  try {
    await requireAdminUser();
    data = await loadAdminData();
  } catch (err) {
    unstable_rethrow(err);
    console.error("[admin] page:", err);
    return redirect({ href: { pathname: "/login", query: { error: "forbidden" } }, locale });
  }

  return <AdminPanel data={data} locale={locale === "fa" ? "fa" : "en"} />;
}
