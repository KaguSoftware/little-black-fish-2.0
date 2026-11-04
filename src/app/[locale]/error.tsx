"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { FilmSlip } from "@/features/errors/FilmSlip";

type Props = { error: unknown; retry?: () => void; reset?: () => void };

/**
 * Runtime error boundary for every public page. Never shows error.message or a stack: only the
 * digest, as a reference the studio can match to the server log.
 */
export default function ErrorPage({ error, retry, reset }: Props) {
  const t = useTranslations("errors.jammed");
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <title>{t("metaTitle")}</title>
      <meta name="robots" content="noindex, nofollow" />
      <FilmSlip
        variant="jammed"
        code="500"
        eyebrow={t("eyebrow")}
        title={t("title")}
        announce={t("announce")}
        focusTitle
        actions={
          <>
            <button type="button" data-primary onClick={() => (retry ?? reset)?.()}>
              {t("retry")}
            </button>
            <Link href="/" data-secondary>
              {t("home")}
            </Link>
          </>
        }
        note={digest ? t("reference", { id: digest }) : undefined}
      >
        <p>{t("body")}</p>
      </FilmSlip>
    </>
  );
}
