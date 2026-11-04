"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ADMIN_CSS } from "@/features/admin/styles";
import { FIELD_CSS } from "@/shared/ui/fields";

type Props = { error: unknown; retry?: () => void; reset?: () => void };

const CSS = `
.adm-err{max-width:40rem}
.adm-err .adm-h1{font-size:var(--step-2);line-height:1.05}
.adm-err-body{margin:1rem 0 0;max-width:52ch;font-size:var(--step-0);line-height:1.55;color:var(--ink-dim)}
.adm-err-actions{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1.75rem;margin-top:1.75rem}
.adm-err-ref{margin:1.5rem 0 0;font-size:.8125rem;color:var(--ink-dim);font-variant-numeric:tabular-nums}
`;

/**
 * Admin error boundary: calmer than the public one. Says what happened, offers a retry in place
 * and a way back to sign in. Never shows error.message or a stack; only the digest as a reference.
 */
export default function AdminError({ error, retry, reset }: Props) {
  const t = useTranslations("admin.error");
  const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="adm">
      <style>{FIELD_CSS + ADMIN_CSS + CSS}</style>
      <meta name="robots" content="noindex, nofollow" />
      <div className="adm-err" role="alert">
        <h1 className="adm-h1">{t("title")}</h1>
        <p className="adm-err-body">{t("body")}</p>
        <div className="adm-err-actions">
          <button type="button" className="lbf-cta" onClick={() => (retry ?? reset)?.()}>
            <span>{t("retry")}</span>
          </button>
          <Link href="/login" className="lbf-textbtn">
            {t("login")}
          </Link>
        </div>
        {digest ? <p className="adm-err-ref">{t("reference", { id: digest })}</p> : null}
      </div>
    </main>
  );
}
