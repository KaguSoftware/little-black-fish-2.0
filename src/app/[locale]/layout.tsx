import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { routing } from "@/i18n/routing";
import { Providers } from "@/shared/ui/Providers";
import { Nav } from "@/shared/ui/Nav";
import { Grain } from "@/shared/ui/Grain";
import { MotionToggle } from "@/shared/ui/MotionToggle";
import { IrisTransition } from "@/shared/transition/IrisTransition";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://littleblackfishstudios.com";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: t("studio"),
      template: `%s · ${t("studio")}`,
    },
    description: t("description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#0b0d10",
  colorScheme: "dark",
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("common");

  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      <body>
        <NextIntlClientProvider>
          <Providers>
            <a href="#main" className="sr-only-focusable fixed start-4 top-4 z-[100] bg-stage px-3 py-2">
              {t("skipToContent")}
            </a>
            <Nav />
            {children}
            <MotionToggle />
            <Grain />
            <IrisTransition />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
