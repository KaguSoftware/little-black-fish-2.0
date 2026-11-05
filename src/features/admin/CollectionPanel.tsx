"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/shared/data/localize";
import type { ActionResult } from "@/shared/data/types";
import type { ReorderTable } from "@/shared/actions/admin/types";
import { EditorDirtyContext } from "./EditorShell";
import { PanelHead } from "./forms";
import { Icon } from "./icons-ux";
import { DownIcon, Thumb, UpIcon, type Notify, type ThumbKind } from "./parts";
import { useAdminActions } from "./actions-seam";
import { EmptyState, Switch, useConfirm } from "./ux";

const SortableList = dynamic(() => import("./SortableList"), {
  ssr: false,
  loading: () => (
    <div className="ux-skels" aria-busy="true" role="status">
      <span className="sr-only">…</span>
      <div className="ux-skel" />
      <div className="ux-skel" />
      <div className="ux-skel" />
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
    /**
     * Why the row can't simply be brought back (files that go with it). A non-empty sentence asks
     * first; empty/null means "just delete it, with Undo".
     */
    confirmDelete: (row: T) => string | null;
  };
  showThumb?: boolean;
  isActive: (row: T) => boolean;
  view: (row: T) => RowView;
  /** Omit when rows have no public on/off effect (series chapters): no toggle. */
  onToggle?: (id: string, next: boolean) => Promise<ActionResult>;
  /** Omit for collections whose rows are fixed in code (series chapters, characters). */
  onDelete?: (id: string) => Promise<ActionResult>;
  /** Hide the Add button (default true). */
  canAdd?: boolean;
  /** Extra line under the panel heading. */
  footnote?: ReactNode;
  /** "h3" = a sub-panel inside another section: no header of its own. */
  headingTag?: "h2" | "h3";
  renderEditor: (args: EditorArgs<T>) => ReactNode;
  /** Reports unsaved work (an open editor with edits, or an order change not yet saved). */
  onDirty?: (dirty: boolean) => void;
}

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
/** A burst of moves saves once, this long after the last one. */
const ORDER_DEBOUNCE = 600;

/**
 * One editable collection (projects, categories, people, voices): an ordered list where every
 * row shows its state, an On/Off switch and an Edit button; reordering and showing/hiding apply at
 * once with an Undo toast; deleting asks first and names what will be lost. The editor is a modal.
 */
export function CollectionPanel<T extends { id: string; order: number }>({
  table,
  rows,
  notify,
  hidden,
  labelledBy,
  text,
  showThumb = true,
  canAdd = true,
  footnote,
  headingTag = "h2",
  isActive,
  view,
  onToggle,
  onDelete,
  renderEditor,
  onDirty,
}: Props<T>) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const router = useRouter();
  const actions = useAdminActions();
  const [, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());
  const { ask, sheet } = useConfirm();

  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  /** Saved, waiting for the refreshed rows to arrive: keep the local order. */
  const [awaitingSync, setAwaitingSync] = useState(false);
  const [activeOverride, setActiveOverride] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  /** Rows deleted but still inside their Undo window: hidden now, really deleted when the toast ends. */
  const [pending, setPending] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState<Record<string, "toggle" | "delete" | undefined>>({});
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);

  const serverRows = useMemo(
    () => [...rows].sort((a, b) => a.order - b.order).filter((r) => !removed.has(r.id) && !pending.has(r.id)),
    [rows, removed, pending],
  );
  const byId = useMemo(() => new Map(serverRows.map((r) => [r.id, r])), [serverRows]);
  const serverIds = useMemo(() => serverRows.map((r) => r.id), [serverRows]);

  // Local order wins while it differs; rows created meanwhile go to the end, deleted ones drop out.
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

  // Optimistic toggles are dropped once the server rows agree (or the row is gone).
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

  /* ----- Reorder: applies at once (saved after a short pause), with Undo ----- */
  const idsRef = useRef(ids);
  useEffect(() => {
    idsRef.current = ids;
  });
  const baseline = useRef<string[] | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const commitOrder = async (order: string[], before: string[] | null) => {
    setSavingOrder(true);
    try {
      const res = await actions.reorder(table, order.map((id, i) => ({ id, order: i })));
      if (res.success) {
        setAwaitingSync(true);
        notify.ok(
          t("orderSaved"),
          before
            ? {
                undo: () => {
                  setLocalOrder(before);
                  void commitOrder(before, null);
                },
              }
            : undefined,
        );
        refresh();
      } else {
        setLocalOrder(null);
        notify.fail(t("orderFailed"));
      }
    } catch {
      setLocalOrder(null);
      notify.fail(t("orderFailed"));
    } finally {
      setSavingOrder(false);
    }
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    if (!baseline.current) baseline.current = serverIds;
    setLocalOrder(next);
    setAwaitingSync(false);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      const before = baseline.current;
      baseline.current = null;
      void commitOrder(idsRef.current, before);
    }, ORDER_DEBOUNCE);
  };

  /* ----- On / off: applies at once, Undo flips it back ----- */
  const setOn = async (row: T, next: boolean, withUndo = true) => {
    if (!onToggle) return;
    const name = view(row).title || t("untitled");
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
      notify.ok(next ? t("turnedOn", { title: name }) : t("turnedOff", { title: name }), withUndo ? { undo: () => void setOn(row, !next, false) } : undefined);
      refresh();
    } else {
      setActiveOverride((o) => {
        const copy = { ...o };
        delete copy[row.id];
        return copy;
      });
      notify.fail(t("toggleFailed"));
    }
  };

  /* ----- Delete: hidden at once with Undo; the real delete runs when the Undo window ends ----- */
  const setPendingRow = (id: string, on: boolean) =>
    setPending((s0) => {
      const n = new Set(s0);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const remove = async (row: T) => {
    if (!onDelete) return;
    const name = view(row).title || t("untitled");
    const why = text.confirmDelete(row);
    // Only things that can't come back after the Undo window (uploaded pictures) ask first, and say so.
    if (why) {
      const ok = await ask({
        title: t("deleteTitle", { title: name }),
        body: <p>{why}</p>,
        confirm: t("deleteForever"),
        cancel: t("keepIt"),
      });
      if (!ok) return;
    }
    const at = idsRef.current.indexOf(row.id);
    const neighbour = idsRef.current[at + 1] ?? idsRef.current[at - 1];
    setPendingRow(row.id, true);
    if (editing === row.id) setEditing(null);
    requestAnimationFrame(() => document.getElementById(neighbour ? `adm-edit-${neighbour}` : `adm-add-${table}`)?.focus({ preventScroll: true }));
    notify.ok(t("deleted", { title: name }), {
      undo: () => {
        setPendingRow(row.id, false);
        requestAnimationFrame(() => document.getElementById(`adm-edit-${row.id}`)?.focus({ preventScroll: true }));
      },
      onExpire: () => {
        void (async () => {
          let res: ActionResult;
          try {
            res = await onDelete(row.id);
          } catch {
            res = { success: false, error: t("networkError") };
          }
          if (res.success) {
            setRemoved((s0) => new Set(s0).add(row.id));
            setPendingRow(row.id, false);
            refresh();
          } else {
            setPendingRow(row.id, false);
            notify.fail(t("deleteFailed"));
          }
        })();
      },
    });
  };

  const anyDirty = editorDirty || (dirty && !awaitingSync);
  useEffect(() => onDirty?.(anyDirty), [anyDirty, onDirty]);

  const restoreFocus = () => {
    const back = editing && editing !== "new" ? `adm-edit-${editing}` : `adm-add-${table}`;
    requestAnimationFrame(() => document.getElementById(back)?.focus({ preventScroll: true }));
  };
  const close = () => {
    restoreFocus();
    setEditing(null);
  };

  const editingRow = editing && editing !== "new" ? (byId.get(editing) ?? null) : null;
  const editorOpen = editing === "new" || editingRow !== null;
  const addNew = () => setEditing(editing === "new" ? null : "new");

  // "N" adds one (a shortcut for people who live in the keyboard; ignored while typing).
  useEffect(() => {
    if (hidden || !canAdd) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      setEditing("new");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hidden, canAdd]);

  const renderRow = (id: string, index: number, handle: object | null) => {
    const row = byId.get(id);
    if (!row) return null;
    const v = view(row);
    const on = active(row);
    const title = v.title || t("untitled");
    const state = busy[id];
    return (
      <div className="ux-row" data-off={on ? "false" : "true"}>
        <span className="ux-grip" {...(handle ?? {})} aria-label={t("dragHandle", { title })} title={t("dragTip")}>
          <Icon name="grip" />
          <span className="ux-grip-n" aria-hidden="true">
            {formatNumber(index + 1, locale)}
          </span>
        </span>
        {showThumb && <Thumb thumb={v.thumb ?? null} off={!on} />}
        <div className="ux-row-main">
          <p className="ux-row-title" onClick={() => state !== "delete" && setEditing(editing === id ? null : id)}>
            {title}
          </p>
          <p className="ux-row-meta">
            {onToggle && !on && (
              <span className="ux-pill" data-on="false">
                {text.off}
              </span>
            )}
            {v.meta.map((m, mi) => (
              <span key={`${mi}-${m}`}>{m}</span>
            ))}
          </p>
        </div>
        <div className="ux-row-acts">
          {onToggle && (
            <Switch
              on={on}
              onChange={() => void setOn(row, !on)}
              label={`${on ? text.turnOff : text.turnOn}: ${title}`}
              onText={t("stateOn")}
              offText={text.off}
              busy={state === "toggle"}
              disabled={!!state}
            />
          )}
          <span className="ux-move">
            <button
              type="button"
              className="ux-icon"
              onClick={() => move(index, index - 1)}
              disabled={index === 0}
              aria-label={t("moveUp", { title })}
              title={t("moveUpTip")}
            >
              <UpIcon />
            </button>
            <button
              type="button"
              className="ux-icon"
              onClick={() => move(index, index + 1)}
              disabled={index === ids.length - 1}
              aria-label={t("moveDown", { title })}
              title={t("moveDownTip")}
            >
              <DownIcon />
            </button>
          </span>
          <button
            type="button"
            id={`adm-edit-${id}`}
            className="ux-btn"
            onClick={() => setEditing(editing === id ? null : id)}
            aria-expanded={editing === id}
            disabled={state === "delete"}
          >
            {t("edit")}
            <span className="sr-only">: {title}</span>
          </button>
          {onDelete && (
            <button type="button" className="ux-btn" data-tone="danger" data-quiet="true" onClick={() => void remove(row)} disabled={!!state}>
              {t("delete")}
              <span className="sr-only">: {title}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const addButton = canAdd ? (
    <button type="button" id={`adm-add-${table}`} className="ux-btn" data-primary="true" onClick={addNew} aria-expanded={editing === "new"}>
      <Icon name="plus" className="ux-btn-ico" />
      {text.add}
    </button>
  ) : null;

  return (
    <section className="adm-panel" id={`adm-panel-${table}`} aria-labelledby={labelledBy} hidden={hidden} tabIndex={-1}>
      {headingTag === "h2" ? (
        <PanelHead id={table} title={text.title} sub={text.sub} actions={addButton} />
      ) : (
        <h3 className="sr-only">{text.title}</h3>
      )}
      {footnote}

      <div className="adm-stage" data-editing={editorOpen ? "true" : "false"}>
        {editorOpen && (
          <div className="adm-editor" key={editing ?? "none"}>
            <EditorDirtyContext.Provider value={setEditorDirty}>
              {renderEditor({
                row: editingRow,
                active: editingRow ? active(editingRow) : false,
                close,
                saved: (message) => {
                  notify.ok(message);
                  restoreFocus();
                  setEditing(null);
                  refresh();
                },
              })}
            </EditorDirtyContext.Provider>
          </div>
        )}

        <div className="adm-listwrap">
          {ids.length === 0 ? (
            <EmptyState
              icon="folder"
              title={text.emptyTitle}
              text={text.emptyText}
              action={
                canAdd ? (
                  <button type="button" className="ux-btn" data-primary="true" onClick={addNew}>
                    <Icon name="plus" className="ux-btn-ico" />
                    {text.add}
                  </button>
                ) : undefined
              }
            />
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
              <p className="ux-tip" aria-live="polite">
                {savingOrder ? (
                  t("savingOrder")
                ) : (
                  <>
                    {ids.length > 1 && <span>{t("reorderHint")}</span>}
                    {canAdd && (
                      <span>{t.rich("shortcutAdd", { k: () => <kbd className="ux-kbd">N</kbd> })}</span>
                    )}
                  </>
                )}
              </p>
            </>
          )}
        </div>
      </div>
      {sheet}
    </section>
  );
}
