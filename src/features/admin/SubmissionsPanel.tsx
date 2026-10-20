"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult, ContactSubmissionRow } from "@/shared/data/types";
import { deleteSubmission, setSubmissionRead } from "@/shared/actions/admin/submissions";
import type { Notify } from "./parts";

interface Props {
  rows: ContactSubmissionRow[];
  readOverride: Record<string, boolean>;
  setReadOverride: (fn: (o: Record<string, boolean>) => Record<string, boolean>) => void;
  removed: Set<string>;
  markRemoved: (id: string) => void;
  busy: Record<string, boolean>;
  setBusy: (id: string, on: boolean) => void;
  notify: Notify;
  hidden: boolean;
  labelledBy: string;
}

/** Persian/Arabic-Indic digits to ASCII, so a phone typed on a Persian keyboard still dials. */
const toAsciiDigits = (v: string) =>
  v.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** Contact form messages, newest first. */
export function SubmissionsPanel({
  rows,
  readOverride,
  setReadOverride,
  removed,
  markRemoved,
  busy,
  setBusy,
  notify,
  hidden,
  labelledBy,
}: Props) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const list = rows
    .filter((r) => !removed.has(r.id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const isRead = (r: ContactSubmissionRow) => readOverride[r.id] ?? r.read;

  const toggleRead = async (r: ContactSubmissionRow) => {
    const next = !isRead(r);
    setReadOverride((o) => ({ ...o, [r.id]: next }));
    setBusy(r.id, true);
    let res: ActionResult;
    try {
      res = await setSubmissionRead(r.id, next);
    } catch {
      res = { success: false, error: t("networkError") };
    }
    setBusy(r.id, false);
    if (res.success) refresh();
    else {
      setReadOverride((o) => {
        const c = { ...o };
        delete c[r.id];
        return c;
      });
      notify.fail(t("toggleFailed", { error: res.error }));
    }
  };

  const remove = async (r: ContactSubmissionRow) => {
    if (!window.confirm(t("submissions.confirmDelete", { name: r.name }))) return;
    setBusy(r.id, true);
    let res: ActionResult;
    try {
      res = await deleteSubmission(r.id);
    } catch {
      res = { success: false, error: t("networkError") };
    }
    setBusy(r.id, false);
    if (res.success) {
      markRemoved(r.id);
      notify.ok(t("submissions.deleted"));
      refresh();
    } else notify.fail(t("deleteFailed", { error: res.error }));
  };

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString(locale === "fa" ? "fa-IR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <section className="adm-panel" role="tabpanel" id="adm-panel-submissions" aria-labelledby={labelledBy} hidden={hidden}>
      <div className="adm-panel-head">
        <div>
          <h2 className="adm-h2">{t("tabs.submissions")}</h2>
          <p className="adm-sub">{t("submissions.sub")}</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="adm-empty">
          <p className="adm-empty-title">{t("submissions.emptyTitle")}</p>
          <p className="adm-empty-text">{t("submissions.emptyText")}</p>
        </div>
      ) : (
        <ul className="adm-subs">
          {list.map((r) => {
            const read = isRead(r);
            // Digits only (a leading + kept for international numbers).
            const phoneHref = toAsciiDigits((r.phone ?? "").trim()).replace(/(?!^\+)\D/g, "");
            return (
              <li key={r.id} className="adm-sub-item" data-read={read ? "true" : "false"}>
                <div className="adm-sub-top">
                  <div className="adm-sub-who">
                    <h3 className="adm-sub-name">{r.name || t("submissions.noName")}</h3>
                    {!read && <span className="adm-new">{t("submissions.new")}</span>}
                  </div>
                  <time className="adm-sub-date" dateTime={r.created_at} suppressHydrationWarning>
                    {fmtDate(r.created_at)}
                  </time>
                </div>
                <div className="adm-sub-contact">
                  {r.email && (
                    <a href={`mailto:${r.email}`} dir="ltr">
                      {r.email}
                    </a>
                  )}
                  {r.phone && phoneHref && (
                    <a href={`tel:${phoneHref}`} dir="ltr">
                      {r.phone}
                    </a>
                  )}
                </div>
                <p className="adm-sub-msg" dir="auto">
                  {r.message}
                </p>
                {!r.email_sent && (
                  <p className="adm-sub-flag">
                    {r.email_error
                      ? t("submissions.emailFailedWith", { error: r.email_error })
                      : t("submissions.emailFailed")}
                  </p>
                )}
                <div className="adm-sub-acts">
                  <button type="button" className="lbf-textbtn" onClick={() => toggleRead(r)} disabled={busy[r.id]}>
                    {read ? t("submissions.markUnread") : t("submissions.markRead")}
                    <span className="sr-only">: {r.name}</span>
                  </button>
                  <button
                    type="button"
                    className="lbf-textbtn adm-danger"
                    onClick={() => remove(r)}
                    disabled={busy[r.id]}
                  >
                    {t("delete")}
                    <span className="sr-only">: {r.name}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
