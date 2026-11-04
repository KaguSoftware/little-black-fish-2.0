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
import { LowResFilters } from "@/shared/ui/LowResFilters";
import { SiteDataProvider } from "@/shared/data/SiteData";
import { getSettings } from "@/shared/data/settings";
import { getSeriesContent } from "@/shared/data/series";
import { CHAPTERS } from "@/shared/content/chapters";
import { rosterFrom } from "@/shared/content/roster";

const ENV_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

/** Only real locales render; any other first segment (e.g. /foo.txt) 404s without running the layout. */
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  const { seo, studio } = await getSettings();
  const name = seo.title || t("studio");
  const description = seo.description || t("description");
  let base: URL;
  try {
    base = new URL(ENV_SITE_URL ?? studio.url);
  } catch {
    base = new URL("https://littleblackfishstudios.com");
  }
  return {
    metadataBase: base,
    title: {
      default: name,
      template: `%s · ${name}`,
    },
    description,
    ...(seo.ogImage
      ? {
          openGraph: { title: name, description, images: [seo.ogImage] },
          twitter: { card: "summary_large_image" as const, images: [seo.ogImage] },
        }
      : {}),
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
  const [settings, series] = await Promise.all([getSettings(), getSeriesContent()]);
  const shownChapters = new Set(series.chapters.map((c) => c.slug));
  const hiddenChapters = shownChapters.size ? CHAPTERS.map((x) => x.id as string).filter((id) => !shownChapters.has(id)) : [];
  const siteData = {
    studio: settings.studio,
    socials: settings.socials,
    series: settings.series,
    heroVideos: settings.heroVideos,
    roster: rosterFrom(series.characters, settings.tellers),
    hiddenChapters,
  };

  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      <body>
        <NextIntlClientProvider>
          <SiteDataProvider value={siteData}>
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
          </SiteDataProvider>
        </NextIntlClientProvider>
        <LowResFilters />
      </body>
    </html>
  );
}
