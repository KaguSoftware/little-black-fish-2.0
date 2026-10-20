import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { PuppetLab } from "@/features/series/PuppetLab";

export const metadata: Metadata = {
  title: "Puppet lab",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: PageProps<"/[locale]/dev/puppets">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PuppetLab />;
}
