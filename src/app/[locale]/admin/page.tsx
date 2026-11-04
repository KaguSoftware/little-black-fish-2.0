import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { AdminAuthError, requireAdminUser } from "@/shared/supabase/server";
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

  // Only a real auth failure sends the visitor to /login. Anything else (a transient database or
  // auth-server error) is rethrown into admin/error.tsx, where the admin can retry in place.
  try {
    await requireAdminUser();
  } catch (err) {
    unstable_rethrow(err);
    if (!(err instanceof AdminAuthError)) throw err;
    return redirect({ href: { pathname: "/login", query: { error: "forbidden" } }, locale });
  }

  let data: AdminData;
  try {
    data = await loadAdminData();
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AdminAuthError) {
      return redirect({ href: { pathname: "/login", query: { error: "forbidden" } }, locale });
    }
    console.error("[admin] page:", err);
    throw err;
  }

  return <AdminPanel data={data} locale={locale === "fa" ? "fa" : "en"} />;
}
