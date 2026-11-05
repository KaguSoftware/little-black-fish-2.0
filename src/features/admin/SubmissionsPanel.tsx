"use client";

import { useId, useMemo, useRef, useState, useTransition, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/shared/data/localize";
import type { ActionResult, ContactSubmissionRow } from "@/shared/data/types";
import { useAdminActions } from "./actions-seam";
import { PanelHead } from "./forms";
import { Icon } from "./icons-ux";
import type { Notify } from "./parts";
import { EmptyState } from "./ux";

interface Props {
  rows: ContactSubmissionRow[];
  readOverride: Record<string, boolean>;
  setReadOverride: Dispatch<SetStateAction<Record<string, boolean>>>;
  removed: Set<string>;
  setRemoved: Dispatch<SetStateAction<Set<string>>>;
  notify: Notify;
  hidden: boolean;
  labelledBy: string;
}

/** Persian/Arabic-Indic digits to ASCII, so a phone typed on a Persian keyboard still dials. */
const toAsciiDigits = (v: string) =>
  v.replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** An address safe to put raw in a mailto: URL (no ?, &, #, %, spaces, commas or quotes that could inject headers/params). */
const safeEmail = (e: string) => /^[^\s?&#%,;"<>]+@[^\s?&#%,;"<>]+$/.test(e);

/**
 * Contact-form messages, newest first. Opening a message marks it read (like a mail app);
 * deleting hides at once and really deletes when the Undo toast ends.
 */
export function SubmissionsPanel({ rows, readOverride, setReadOverride, removed, setRemoved, notify, hidden, labelledBy }: Props) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const actions = useAdminActions();
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const searchId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const isRead = (r: ContactSubmissionRow) => readOverride[r.id] ?? r.read;
  const all = useMemo(
    () => rows.filter((r) => !removed.has(r.id)).sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [rows, removed],
  );
  const unreadCount = all.filter((r) => !isRead(r)).length;
  const q = query.trim().toLowerCase();
  const list = all.filter(
    (r) => (filter === "all" || !isRead(r) || r.id === openId) && (!q || [r.name, r.email, r.phone, r.message].some((v) => (v ?? "").toLowerCase().includes(q))),
  );
  const num = (n: number) => formatNumber(n, locale);

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

  /** Sets read state for several messages at once, optimistically; failures roll back. */
  const setRead = async (items: ContactSubmissionRow[], next: boolean, undoable = false) => {
    const todo = items.filter((r) => isRead(r) !== next);
    if (!todo.length) return;
    setReadOverride((o) => {
      const c = { ...o };
      todo.forEach((r) => (c[r.id] = next));
      return c;
    });
    const results: ActionResult[] = await Promise.all(
      todo.map((r) => actions.setSubmissionRead(r.id, next).catch((): ActionResult => ({ success: false, error: "network" }))),
    );
    const failed = todo.filter((_, i) => !results[i].success);
    if (failed.length) {
      setReadOverride((o) => {
        const c = { ...o };
        failed.forEach((r) => delete c[r.id]);
        return c;
      });
      notify.fail(t("toggleFailed"));
    }
    if (failed.length < todo.length) {
      refresh();
      if (undoable) {
        notify.ok(next ? t("submissions.markedRead", { count: todo.length }) : t("submissions.markedUnread", { count: todo.length }), {
          undo: () => void setRead(todo, !next),
        });
      }
    }
  };

  /** Hides now; deletes for real when the Undo toast ends (leaving the page early keeps them). */
  const removeMany = (items: ContactSubmissionRow[]) => {
    if (!items.length) return;
    const ids = items.map((r) => r.id);
    setRemoved((s) => new Set([...s, ...ids]));
    setSelected(new Set());
    if (openId && ids.includes(openId)) setOpenId(null);
    const restore = (these: string[]) =>
      setRemoved((s) => {
        const c = new Set(s);
        these.forEach((id) => c.delete(id));
        return c;
      });
    notify.ok(items.length === 1 ? t("submissions.deleted") : t("submissions.deletedN", { count: items.length }), {
      undo: () => restore(ids),
      onExpire: async () => {
        const results = await Promise.all(ids.map((id) => actions.deleteSubmission(id).catch((): ActionResult => ({ success: false, error: "network" }))));
        const failed = ids.filter((_, i) => !results[i].success);
        if (failed.length) {
          restore(failed);
          notify.fail(t("deleteFailed"));
        }
        refresh();
      },
    });
  };

  const fmtDate = (iso: string, long = false) =>
    new Date(iso).toLocaleString(locale === "fa" ? "fa-IR" : "en-US", {
      ...(long ? { year: "numeric" } : {}),
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const open = (r: ContactSubmissionRow, focus = false) => {
    setOpenId(r.id);
    if (!isRead(r)) void setRead([r], true);
    if (focus) requestAnimationFrame(() => document.getElementById(`adm-msg-btn-${r.id}`)?.focus({ preventScroll: false }));
  };

  // j / k / arrows move between messages without leaving the keyboard.
  const onListKey = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement;
    if (!el.classList.contains("ux-msg-btn")) return;
    const k = e.key;
    const dir = k === "ArrowDown" || k === "j" ? 1 : k === "ArrowUp" || k === "k" ? -1 : 0;
    if (!dir) return;
    const btns = [...(listRef.current?.querySelectorAll<HTMLElement>(".ux-msg-btn") ?? [])];
    const next = btns[btns.indexOf(el) + dir];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  };

  const allSelected = list.length > 0 && list.every((r) => selected.has(r.id));
  const chosen = list.filter((r) => selected.has(r.id));

  return (
    <section className="adm-panel" id="adm-panel-submissions" aria-labelledby={labelledBy} hidden={hidden} tabIndex={-1}>
      <PanelHead
        id="inbox"
        title={t("nav.items.inbox")}
        sub={t("submissions.sub")}
        viewPath="/contact"
        actions={
          <button type="button" className="ux-btn" onClick={exportCsv} disabled={list.length === 0}>
            {t("submissions.export")}
          </button>
        }
      />

      <div className="ux-inbox-tools">
        <div className="lbf-field ux-inbox-search">
          <label className="lbf-label" htmlFor={searchId}>
            {t("submissions.search")}
          </label>
          <input
            id={searchId}
            className="lbf-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("submissions.searchPlaceholder")}
            autoComplete="off"
          />
        </div>
        <div className="ux-seg" role="group" aria-label={t("submissions.filter")}>
          <button type="button" className="ux-seg-btn" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            {t("submissions.filterAll")} <span className="ux-seg-n">{num(all.length)}</span>
          </button>
          <button type="button" className="ux-seg-btn" aria-pressed={filter === "unread"} onClick={() => setFilter("unread")}>
            {t("submissions.filterUnread")} <span className="ux-seg-n">{num(unreadCount)}</span>
          </button>
        </div>
      </div>

      {list.length > 0 && (
        <div className="ux-bulk" role="toolbar" aria-label={t("submissions.bulkLabel")}>
          <label className="lbf-check">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(list.map((r) => r.id)))}
            />
            <span>{chosen.length > 0 ? t("submissions.selected", { count: chosen.length }) : t("submissions.selectAll")}</span>
          </label>
          {chosen.length > 0 ? (
            <span className="ux-bulk-acts">
              <button type="button" className="ux-btn" onClick={() => void setRead(chosen, true, true)}>
                {t("submissions.markRead")}
              </button>
              <button type="button" className="ux-btn" onClick={() => void setRead(chosen, false, true)}>
                {t("submissions.markUnread")}
              </button>
              <button type="button" className="ux-btn" data-tone="danger" onClick={() => removeMany(chosen)}>
                {t("delete")}
              </button>
            </span>
          ) : (
            <span className="ux-tip-inline" role="status" aria-live="polite">
              {t("submissions.count", { count: list.length, total: all.length })}
              <span className="ux-tip-keys">
                <kbd className="ux-kbd">J</kbd> <kbd className="ux-kbd">K</kbd> {t("submissions.keysTip")}
              </span>
            </span>
          )}
        </div>
      )}

      {list.length === 0 ? (
        <EmptyState
          icon="mail"
          title={all.length === 0 ? t("submissions.emptyTitle") : t("submissions.noMatchTitle")}
          text={all.length === 0 ? t("submissions.emptyText") : t("submissions.noMatchText")}
          action={
            all.length > 0 ? (
              <button
                type="button"
                className="ux-btn"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                {t("submissions.showAll")}
              </button>
            ) : undefined
          }
        />
      ) : (
        <ul className="ux-msgs" ref={listRef} onKeyDown={onListKey}>
          {list.map((r, i) => {
            const read = isRead(r);
            const isOpen = openId === r.id;
            // Digits only (a leading + kept for international numbers).
            const phoneHref = toAsciiDigits((r.phone ?? "").trim()).replace(/(?!^\+)\D/g, "");
            const prev = list[i - 1];
            const next = list[i + 1];
            const name = r.name || t("submissions.noName");
            return (
              <li key={r.id} className="ux-msg" data-read={read ? "true" : "false"} data-open={isOpen ? "true" : "false"} data-selected={selected.has(r.id) ? "true" : "false"}>
                <div className="ux-msg-head">
                  <label className="ux-msg-check">
                    <input
                      type="checkbox"
                      className="ux-check"
                      checked={selected.has(r.id)}
                      onChange={() =>
                        setSelected((s) => {
                          const c = new Set(s);
                          if (c.has(r.id)) c.delete(r.id);
                          else c.add(r.id);
                          return c;
                        })
                      }
                      aria-label={t("submissions.select", { name })}
                    />
                  </label>
                  <button
                    type="button"
                    id={`adm-msg-btn-${r.id}`}
                    className="ux-msg-btn"
                    aria-expanded={isOpen}
                    aria-controls={`adm-msg-${r.id}`}
                    onClick={() => (isOpen ? setOpenId(null) : open(r))}
                  >
                    <span className="ux-msg-dot" data-on={read ? "false" : "true"} aria-hidden="true" />
                    <span className="ux-msg-name" dir="auto">
                      {name}
                      {!read && <span className="sr-only"> ({t("submissions.new")})</span>}
                    </span>
                    <span className="ux-msg-snip" dir="auto">
                      {r.message.replace(/\s+/g, " ").slice(0, 110)}
                    </span>
                    <time className="ux-msg-date" dateTime={r.created_at} suppressHydrationWarning>
                      {fmtDate(r.created_at)}
                    </time>
                  </button>
                </div>
                {isOpen && (
                  <div className="ux-msg-body" id={`adm-msg-${r.id}`}>
                    <p className="ux-msg-from" dir="auto">
                      {name}
                    </p>
                    <div className="ux-msg-meta">
                      <time dateTime={r.created_at} suppressHydrationWarning>
                        {fmtDate(r.created_at, true)}
                      </time>
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
                    {!r.email_sent && <p className="adm-sub-flag">{t("submissions.emailFailedNote")}</p>}
                    <div className="ux-msg-acts">
                      {r.email && safeEmail(r.email) && (
                        <a className="ux-btn" data-primary="true" href={`mailto:${r.email}?subject=${encodeURIComponent(t("submissions.replySubject"))}`}>
                          <Icon name="mail" className="ux-btn-ico" />
                          {t("submissions.reply")}
                          <span className="sr-only">: {name}</span>
                        </a>
                      )}
                      <button type="button" className="ux-btn" onClick={() => void setRead([r], !read)}>
                        {read ? t("submissions.markUnread") : t("submissions.markRead")}
                      </button>
                      <button type="button" className="ux-btn" data-tone="danger" data-quiet="true" onClick={() => removeMany([r])}>
                        {t("delete")}
                        <span className="sr-only">: {name}</span>
                      </button>
                      <span className="ux-msg-nav">
                        <button type="button" className="ux-icon" disabled={!prev} onClick={() => prev && open(prev, true)} aria-label={t("submissions.prev")} title={t("submissions.prev")}>
                          <Icon name="up" />
                        </button>
                        <button type="button" className="ux-icon" disabled={!next} onClick={() => next && open(next, true)} aria-label={t("submissions.next")} title={t("submissions.next")}>
                          <Icon name="down" />
                        </button>
                      </span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
