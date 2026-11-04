"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FilmSlip } from "@/features/errors/FilmSlip";

/**
 * 404 inside a valid locale (unknown path, or notFound() from a page). Next sends the 404 status
 * and the noindex tag. A client component on purpose: the locale comes from the provider in the
 * layout, so rendering never touches headers() and statically generated pages can still 404.
 */
export default function NotFound() {
  const t = useTranslations("errors.missing");
  return (
    <>
      <title>{t("metaTitle")}</title>
      <FilmSlip
        variant="missing"
        code="404"
        eyebrow={t("eyebrow")}
        title={t("title")}
        actions={
          <>
            <Link href="/" data-primary>
              {t("home")}
            </Link>
            <Link href="/projects" data-secondary>
              {t("projects")}
            </Link>
          </>
        }
      >
        <p>{t("body")}</p>
      </FilmSlip>
    </>
  );
}
