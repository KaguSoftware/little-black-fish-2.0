"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/shared/data/localize";
import type { ActionResult } from "@/shared/data/types";
import type { ReorderTable } from "@/shared/actions/admin/types";
import { reorder } from "@/shared/actions/admin/reorder";
import { DownIcon, GripIcon, Thumb, UpIcon, type Notify, type ThumbKind } from "./parts";

const SortableList = dynamic(() => import("./SortableList"), {
  ssr: false,
  loading: () => (
    <div aria-busy="true">
      <div className="adm-skel" />
      <div className="adm-skel" />
      <div className="adm-skel" />
    </div>
  ),
});

export interface RowView {
  title: string;
  /** Short meta pieces shown under the title (category, media, counts). */
  meta: string[];
  thumb?: { src: string; kind: ThumbKind } | null;
}

export interface EditorArgs<T> {
  row: T | null;
  /** Effective on/off state (after any optimistic toggle). */
  active: boolean;
  close: () => void;
  /** Called by the editor after a successful save. */
  saved: (message: string) => void;
}

interface Props<T extends { id: string; order: number }> {
  table: ReorderTable;
  rows: T[];
  notify: Notify;
  hidden: boolean;
  labelledBy: string;
  text: {
    title: string;
    sub: string;
    add: string;
    emptyTitle: string;
    emptyText: string;
    /** The "off" marker shown in text next to the title (Unpublished, Inactive, Hidden). */
    off: string;
    turnOn: string;
    turnOff: string;
    confirmDelete: (row: T) => string;
  };
  showThumb?: boolean;
  isActive: (row: T) => boolean;
  view: (row: T) => RowView;
  onToggle: (id: string, next: boolean) => Promise<ActionResult>;
  onDelete: (id: string) => Promise<ActionResult>;
  renderEditor: (args: EditorArgs<T>) => ReactNode;
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * One editable collection (projects, hero slides, categories): an ordered hairline list with
 * drag + keyboard reordering behind a Save order / Discard bar, optimistic on/off toggles,
 * confirmed deletes, and an inline editor that opens beside (wide) or above (narrow) the list.
 */
export function CollectionPanel<T extends { id: string; order: number }>({
  table,
  rows,
  notify,
  hidden,
  labelledBy,
  text,
  showThumb = true,
  isActive,
  view,
  onToggle,
  onDelete,
  renderEditor,
}: Props<T>) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());

  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  /** Saved, waiting for the refreshed rows to arrive: keep the local order, hide the bar. */
  const [awaitingSync, setAwaitingSync] = useState(false);
  const [activeOverride, setActiveOverride] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<Record<string, "toggle" | "delete" | undefined>>({});
  const [editing, setEditing] = useState<string | "new" | null>(null);

  const serverRows = useMemo(
    () => [...rows].sort((a, b) => a.order - b.order).filter((r) => !removed.has(r.id)),
    [rows, removed],
  );
  const byId = useMemo(() => new Map(serverRows.map((r) => [r.id, r])), [serverRows]);
  const serverIds = useMemo(() => serverRows.map((r) => r.id), [serverRows]);

  // Local order wins while dirty; rows created meanwhile go to the end, deleted ones drop out.
  const ids = useMemo(() => {
    if (!localOrder) return serverIds;
    const kept = localOrder.filter((id) => byId.has(id));
    return [...kept, ...serverIds.filter((id) => !kept.includes(id))];
  }, [localOrder, serverIds, byId]);
  const dirty = localOrder !== null && !sameIds(ids, serverIds);

  // Once the server order catches up (after a save + refresh), drop the local copy.
  if (localOrder && !savingOrder && sameIds(ids, serverIds)) {
    setLocalOrder(null);
    setAwaitingSync(false);
  }

  // Optimistic toggles are dropped once the server rows agree (or the row is gone), so later
  // changes from elsewhere (the editor's Published box) show through.
  const staleOverrides = Object.keys(activeOverride).filter((id) => {
    const r = byId.get(id);
    return !r || isActive(r) === activeOverride[id];
  });
  if (staleOverrides.length) {
    setActiveOverride((o) => {
      const copy = { ...o };
      staleOverrides.forEach((id) => delete copy[id]);
      return copy;
    });
  }

  const active = (row: T) => activeOverride[row.id] ?? isActive(row);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    setLocalOrder(next);
    setAwaitingSync(false);
  };

  const saveOrder = async () => {
    setSavingOrder(true);
    try {
      const res = await reorder(table, ids.map((id, i) => ({ id, order: i })));
      if (res.success) {
        setAwaitingSync(true);
        notify.ok(t("orderSaved"));
        refresh();
      } else notify.fail(t("orderFailed", { error: res.error }));
    } catch {
      notify.fail(t("orderFailed", { error: t("networkError") }));
    } finally {
      setSavingOrder(false);
    }
  };

  const toggle = async (row: T) => {
    const next = !active(row);
    setActiveOverride((o) => ({ ...o, [row.id]: next }));
    setBusy((b) => ({ ...b, [row.id]: "toggle" }));
    let res: ActionResult;
    try {
      res = await onToggle(row.id, next);
    } catch {
      res = { success: false, error: t("networkError") };
    }
    setBusy((b) => ({ ...b, [row.id]: undefined }));
    if (res.success) {
      notify.ok(next ? t("turnedOn", { title: view(row).title || t("untitled") }) : t("turnedOff", { title: view(row).title || t("untitled") }));
      refresh();
    } else {
      setActiveOverride((o) => {
        const copy = { ...o };
        delete copy[row.id];
        return copy;
      });
      notify.fail(t("toggleFailed", { error: res.error }));
    }
  };

  const remove = async (row: T) => {
    if (!window.confirm(text.confirmDelete(row))) return;
    setBusy((b) => ({ ...b, [row.id]: "delete" }));
    let res: ActionResult;
    try {
      res = await onDelete(row.id);
    } catch {
      res = { success: false, error: t("networkError") };
    }
    setBusy((b) => ({ ...b, [row.id]: undefined }));
    if (res.success) {
      setRemoved((s) => new Set(s).add(row.id));
      if (editing === row.id) setEditing(null);
      notify.ok(t("deleted", { title: view(row).title || t("untitled") }));
      refresh();
    } else notify.fail(t("deleteFailed", { error: res.error }));
  };

  const close = () => {
    const back = editing && editing !== "new" ? `adm-edit-${editing}` : `adm-add-${table}`;
    setEditing(null);
    requestAnimationFrame(() => document.getElementById(back)?.focus({ preventScroll: true }));
  };

  const editingRow = editing && editing !== "new" ? (byId.get(editing) ?? null) : null;
  const editorOpen = editing === "new" || editingRow !== null;

  const renderRow = (id: string, index: number, handle: object | null) => {
    const row = byId.get(id);
    if (!row) return null;
    const v = view(row);
    const on = active(row);
    const title = v.title || t("untitled");
    const state = busy[id];
    return (
      <div className="adm-row">
        <span className="adm-grip" {...(handle ?? {})} aria-label={t("dragHandle", { title })}>
          <GripIcon />
          <span aria-hidden="true">{formatNumber(index + 1, locale)}</span>
        </span>
        {showThumb && <Thumb thumb={v.thumb ?? null} off={!on} />}
        <div className="adm-main">
          <p className="adm-title" data-off={on ? "false" : "true"}>
            {title}
          </p>
          <p className="adm-row-meta">
            {!on && <span className="adm-off">{text.off}</span>}
            {v.meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </p>
        </div>
        <div className="adm-acts">
          <span className="adm-move">
            <button
              type="button"
              className="adm-icon"
              onClick={() => move(index, index - 1)}
              disabled={index === 0 || savingOrder}
              aria-label={t("moveUp", { title })}
            >
              <UpIcon />
            </button>
            <button
              type="button"
              className="adm-icon"
              onClick={() => move(index, index + 1)}
              disabled={index === ids.length - 1 || savingOrder}
              aria-label={t("moveDown", { title })}
            >
              <DownIcon />
            </button>
          </span>
          <button type="button" className="lbf-textbtn" onClick={() => toggle(row)} disabled={!!state} aria-busy={state === "toggle"}>
            {on ? text.turnOff : text.turnOn}
            <span className="sr-only">: {title}</span>
          </button>
          <button
            type="button"
            id={`adm-edit-${id}`}
            className="lbf-textbtn"
            onClick={() => setEditing(editing === id ? null : id)}
            aria-expanded={editing === id}
            disabled={state === "delete"}
          >
            {t("edit")}
            <span className="sr-only">: {title}</span>
          </button>
          <button
            type="button"
            className="lbf-textbtn adm-danger"
            onClick={() => remove(row)}
            disabled={!!state}
            aria-busy={state === "delete"}
          >
            {state === "delete" ? t("deleting") : t("delete")}
            <span className="sr-only">: {title}</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="adm-panel" role="tabpanel" id={`adm-panel-${table}`} aria-labelledby={labelledBy} hidden={hidden}>
      <div className="adm-panel-head">
        <div>
          <h2 className="adm-h2">{text.title}</h2>
          <p className="adm-sub">{text.sub}</p>
        </div>
        <button
          type="button"
          id={`adm-add-${table}`}
          className="lbf-textbtn adm-add"
          onClick={() => setEditing(editing === "new" ? null : "new")}
          aria-expanded={editing === "new"}
        >
          {text.add}
        </button>
      </div>

      <div className="adm-stage" data-editing={editorOpen ? "true" : "false"}>
        {editorOpen && (
          <div className="adm-editor" key={editing ?? "none"}>
            {renderEditor({
              row: editingRow,
              active: editingRow ? active(editingRow) : false,
              close,
              saved: (message) => {
                notify.ok(message);
                setEditing(null);
                refresh();
              },
            })}
          </div>
        )}

        <div className="adm-listwrap">
          {ids.length === 0 ? (
            <div className="adm-empty">
              <p className="adm-empty-title">{text.emptyTitle}</p>
              <p className="adm-empty-text">{text.emptyText}</p>
            </div>
          ) : (
            <>
              <SortableList
                droppableId={`adm-${table}`}
                ids={ids}
                label={text.title}
                instructions={t("dragInstructions")}
                currentId={editing}
                onMove={move}
                renderItem={renderRow}
              />
              {ids.length > 1 && (!dirty || awaitingSync) && <p className="adm-hint-line">{t("reorderHint")}</p>}
            </>
          )}

          {dirty && !awaitingSync && (
            <div className="adm-bar" role="region" aria-label={t("orderBar")}>
              <span className="adm-bar-text">{savingOrder ? t("savingOrder") : t("unsavedOrder")}</span>
              <span className="adm-bar-acts">
                <button type="button" className="lbf-textbtn" onClick={() => setLocalOrder(null)} disabled={savingOrder}>
                  {t("discard")}
                </button>
                <button type="button" className="lbf-cta" onClick={saveOrder} disabled={savingOrder}>
                  <span>{t("saveOrder")}</span>
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
