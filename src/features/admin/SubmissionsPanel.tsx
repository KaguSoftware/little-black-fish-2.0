"use client";

import { useId, useState, useTransition } from "react";
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
/** An address safe to put raw in a mailto: URL (no ?, &, #, %, spaces, commas or quotes that could inject headers/params). */
const safeEmail = (e: string) => /^[^\s?&#%,;"<>]+@[^\s?&#%,;"<>]+$/.test(e);

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

  const searchId = useId();
  const filterId = useId();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const isRead = (r: ContactSubmissionRow) => readOverride[r.id] ?? r.read;
  const all = rows.filter((r) => !removed.has(r.id)).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const q = query.trim().toLowerCase();
  const list = all.filter(
    (r) =>
      (filter === "all" || !isRead(r)) &&
      (!q || [r.name, r.email, r.phone, r.message].some((v) => (v ?? "").toLowerCase().includes(q))),
  );

  const exportCsv = () => {
    const cell = (v: unknown) => {
      let s = String(v ?? "");
      // Neutralize spreadsheet formula injection.
      if (/^[=+@\t\r-]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const head = ["date", "name", "email", "phone", "message", "read", "email_sent"];
    const lines = list.map((r) => [r.created_at, r.name, r.email, r.phone, r.message, isRead(r), r.email_sent].map(cell).join(","));
    const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `messages-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify.ok(t("submissions.exported", { count: list.length }));
  };

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
    <section className="adm-panel" id="adm-panel-submissions" aria-labelledby={labelledBy} hidden={hidden} tabIndex={-1}>
      <div className="adm-panel-head">
        <div>
          <h2 className="adm-h2">{t("nav.items.inbox")}</h2>
          <p className="adm-sub">{t("submissions.sub")}</p>
        </div>
        <button type="button" className="lbf-textbtn adm-add" onClick={exportCsv} disabled={list.length === 0}>
          {t("submissions.export")}
        </button>
      </div>

      <div className="adm-ctools">
        <div className="lbf-field adm-csearch">
          <label className="lbf-label" htmlFor={searchId}>
            {t("submissions.search")}
          </label>
          <input id={searchId} className="lbf-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <div className="lbf-field adm-cfilter">
          <label className="lbf-label" htmlFor={filterId}>
            {t("submissions.filter")}
          </label>
          <select id={filterId} className="lbf-input" value={filter} onChange={(e) => setFilter(e.target.value as "all" | "unread")}>
            <option value="all">{t("submissions.filterAll")}</option>
            <option value="unread">{t("submissions.filterUnread")}</option>
          </select>
        </div>
      </div>
      <div className="adm-cmeta" role="status" aria-live="polite">
        <span>{t("submissions.count", { count: list.length, total: all.length })}</span>
      </div>

      {list.length === 0 ? (
        <div className="adm-empty">
          <p className="adm-empty-title">{all.length === 0 ? t("submissions.emptyTitle") : t("submissions.noMatchTitle")}</p>
          <p className="adm-empty-text">{all.length === 0 ? t("submissions.emptyText") : t("submissions.noMatchText")}</p>
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
                  {r.email &&
                    (safeEmail(r.email) ? (
                      <a href={`mailto:${r.email}`} dir="ltr">
                        {r.email}
                      </a>
                    ) : (
                      <span dir="ltr">{r.email}</span>
                    ))}
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
                  {r.email && safeEmail(r.email) && (
                    <a
                      className="lbf-textbtn"
                      href={`mailto:${r.email}?subject=${encodeURIComponent(t("submissions.replySubject"))}`}
                    >
                      {t("submissions.reply")}
                      <span className="sr-only">: {r.name}</span>
                    </a>
                  )}
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
