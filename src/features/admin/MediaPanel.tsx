/* eslint-disable @next/next/no-img-element -- admin previews are arbitrary user-supplied URLs */
"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { isVideoUrl, type Bucket } from "@/shared/data/storage";
import { formatNumber } from "@/shared/data/localize";
import type { MediaItem } from "@/shared/actions/admin/types";
import { PanelFrame } from "./forms";
import type { Notify } from "./parts";
import { ConfirmSheet, MediaDialog } from "./MediaDialog";
import { MediaStyles } from "./MediaStyles";
import { useMediaApi } from "./media-api";
import { CheckIcon, PhotoIcon, UploadQueue, fmtDate, fmtSize, useMediaList, useUseLabels } from "./media-lib";
import { acceptFor, useFileDrop, usePasteImages, useUploader } from "./uploader";
import { toast } from "./toast";

const BUCKETS: Bucket[] = ["projects", "hero"];
type Filter = "all" | "unused" | "used" | "videos";
const SIZE_KEY = "lbf-admin-media-size";

const isVideo = (m: MediaItem) => m.mimeType.startsWith("video/") || isVideoUrl(m.url);

/** The media library: browse, upload (drop anywhere), replace in place, delete with Undo. */
export function MediaPanel({ notify, hidden, labelledBy }: { notify: Notify; hidden: boolean; labelledBy: string }) {
  const t = useTranslations("adminMedia");
  const locale = useLocale();
  const api = useMediaApi();
  const labelOf = useUseLabels();
  const searchId = useId();
  const sizeId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [bucket, setBucket] = useState<Bucket>("projects");
  const list = useMediaList(bucket, !hidden);
  const { items, setItems, refresh } = list;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [size, setSize] = useState(11);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingGone, setPendingGone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [confirm, setConfirm] = useState<MediaItem[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(SIZE_KEY));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v >= 7 && v <= 18) setSize(v);
    } catch {}
  }, []);
  const changeSize = (v: number) => {
    setSize(v);
    try {
      localStorage.setItem(SIZE_KEY, String(v));
    } catch {}
  };

  // Switching storage clears the selection.
  const pickBucket = (b: Bucket) => {
    setBucket(b);
    setSelected(new Set());
    setQuery("");
    setFilter("all");
  };

  const uploader = useUploader({ bucket, maxDimension: 2560 });
  const addFiles = useCallback(
    async (files: File[]) => {
      const urls = await uploader.upload(files);
      if (urls.length) {
        notify.ok(t("panel.uploaded", { count: urls.length }));
        void refresh();
      }
    },
    [uploader, notify, t, refresh],
  );
  const { over, props: drop } = useFileDrop((f) => void addFiles(f));
  usePasteImages((f) => void addFiles(f), !hidden);
  const { items: upItems, clearFinished } = uploader;
  useEffect(() => {
    if (!upItems.some((i) => i.state === "done" && !i.warnings.length)) return;
    const timer = window.setTimeout(() => clearFinished(), 1500);
    return () => window.clearTimeout(timer);
  }, [upItems, clearFinished]);

  const visible = useMemo(() => (items ?? []).filter((m) => !pendingGone.has(m.path)), [items, pendingGone]);
  const counts = useMemo(
    () => ({
      all: visible.length,
      unused: visible.filter((m) => m.usedBy.length === 0).length,
      used: visible.filter((m) => m.usedBy.length > 0).length,
      videos: visible.filter(isVideo).length,
    }),
    [visible],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visible.filter(
      (m) =>
        (!q || m.name.toLowerCase().includes(q)) &&
        (filter === "all" || (filter === "unused" && m.usedBy.length === 0) || (filter === "used" && m.usedBy.length > 0) || (filter === "videos" && isVideo(m))),
    );
  }, [visible, query, filter]);

  const chosen = useMemo(() => visible.filter((m) => selected.has(m.path)), [visible, selected]);
  const toggle = (m: MediaItem) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(m.path)) n.delete(m.path);
      else n.add(m.path);
      return n;
    });

  /** Unused files: leave the list now, really delete when the Undo toast runs out. */
  const softDelete = useCallback(
    (files: MediaItem[]) => {
      const paths = files.map((f) => f.path);
      setPendingGone((s) => new Set([...s, ...paths]));
      setSelected((s) => new Set([...s].filter((p) => !paths.includes(p))));
      const unhide = (list: string[]) => setPendingGone((s) => new Set([...s].filter((p) => !list.includes(p))));
      const restore = () => unhide(paths);
      // The delete runs when the toast expires. The toast store is module-level, so it can also run after this
      // panel unmounted; that is safe: api.remove(force=false) is admin-gated and refuses files still in use.
      toast({
        text: files.length === 1 ? t("panel.deleted", { name: files[0].name }) : t("panel.deletedMany", { count: files.length }),
        undo: restore,
        onExpire: () => {
          void (async () => {
            const failed: MediaItem[] = [];
            for (const f of files) {
              try {
                const res = await api.remove(bucket, f.path, false);
                if (!res.success) failed.push(f);
              } catch {
                failed.push(f);
              }
            }
            // Only the files that are really still there come back; the deleted ones leave the list for good.
            const failedPaths = failed.map((f) => f.path);
            const goneNow = paths.filter((p) => !failedPaths.includes(p));
            if (goneNow.length) setItems((cur) => cur.filter((x) => !goneNow.includes(x.path)));
            unhide(paths);
            if (failed.length) toast({ kind: "error", text: t("panel.deleteFailed", { names: failed.map((f) => f.name).join(", ") }) });
          })();
        },
      });
    },
    [api, bucket, setItems, t],
  );

  const requestDelete = (files: MediaItem[]) => {
    if (files.some((f) => f.usedBy.length > 0)) setConfirm(files);
    else softDelete(files);
  };

  const hardDelete = async (files: MediaItem[]) => {
    setDeleting(true);
    let ok = 0;
    let lastError = "";
    for (const f of files) {
      try {
        const res = await api.remove(bucket, f.path, true);
        if (res.success) ok += 1;
        else lastError = res.error;
      } catch {
        lastError = t("networkError");
      }
    }
    setDeleting(false);
    setConfirm(null);
    if (ok) {
      const gone = new Set(files.map((f) => f.path));
      setItems((cur) => cur.filter((x) => !gone.has(x.path)));
      setSelected(new Set());
      setOpen(null);
      notify.ok(t("panel.deletedPermanently", { count: ok }));
    }
    if (ok < files.length) notify.fail(t("panel.deleteFailed", { names: lastError }));
  };

  const dateOf = (iso: string) => fmtDate(iso, locale);
  const empty = items !== null && visible.length === 0;

  return (
    <PanelFrame
      id="media"
      labelledBy={labelledBy}
      hidden={hidden}
      title={t("panel.title")}
      sub={t("panel.sub")}
      actions={
        <div className="adm-panel-acts">
          <button type="button" className="lbf-textbtn adm-add" onClick={() => void refresh()} disabled={list.loading} aria-busy={list.loading}>
            {list.loading ? t("library.loading") : t("panel.refresh")}
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={() => fileInput.current?.click()}>
            {t("panel.upload")}
          </button>
          <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" accept={acceptFor(false)} multiple onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void addFiles(files);
          }} />
        </div>
      }
    >
      <MediaStyles />
      <div className="adm-lib" data-over={over ? "true" : "false"} {...drop}>
        {over && (
          <div className="adm-drop-veil" aria-hidden="true">
            <PhotoIcon />
            <span>{t("panel.dropHere", { storage: t(`buckets.${bucket}`) })}</span>
          </div>
        )}

        <div className="adm-seg" role="group" aria-label={t("panel.bucketLabel")}>
          {BUCKETS.map((b) => (
            <button key={b} type="button" className="adm-seg-btn" aria-pressed={bucket === b} onClick={() => pickBucket(b)}>
              {t(`buckets.${b}`)}
            </button>
          ))}
        </div>

        <UploadQueue uploader={uploader} />

        <div className="adm-lib-tools">
          <div className="lbf-field adm-lib-search">
            <label className="lbf-label" htmlFor={searchId}>
              {t("library.search")}
            </label>
            <input id={searchId} className="lbf-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          </div>
          <div className="adm-chips" role="group" aria-label={t("library.filter")}>
            {(["all", "unused", "used", "videos"] as Filter[]).map((f) => (
              <button key={f} type="button" className="adm-chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {t(`library.filters.${f}`)} <span className="adm-chip-n">{formatNumber(counts[f], locale)}</span>
              </button>
            ))}
          </div>
          <div className="adm-lib-size">
            <label className="lbf-label" htmlFor={sizeId}>
              {t("panel.size")}
            </label>
            <input id={sizeId} type="range" min={7} max={18} step={0.5} value={size} onChange={(e) => changeSize(Number(e.target.value))} />
          </div>
        </div>

        {list.error ? (
          <div className="adm-empty" role="alert">
            <p className="adm-empty-title">{t("library.errorTitle")}</p>
            <p className="adm-empty-text">{list.error}</p>
            <button type="button" className="lbf-textbtn" onClick={() => void refresh()}>
              {t("retry")}
            </button>
          </div>
        ) : items === null ? (
          <div className="adm-grid" aria-busy="true" style={{ ["--card" as string]: `${size}rem` }}>
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="adm-card-skel" />
            ))}
          </div>
        ) : empty ? (
          <div className="adm-empty adm-empty-drop">
            <PhotoIcon />
            <p className="adm-empty-title">{t("library.emptyTitle")}</p>
            <p className="adm-empty-text">{t("panel.emptyText")}</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="adm-empty">
            <p className="adm-empty-title">{t("library.noMatchTitle")}</p>
            <p className="adm-empty-text">{t("library.noMatchText")}</p>
          </div>
        ) : (
          <>
            <p className="adm-cmeta" role="status">
              {t("panel.count", { shown: shown.length, total: visible.length })}
            </p>
            <ul className="adm-grid" style={{ ["--card" as string]: `${size}rem` }} aria-label={t("library.files")}>
              {shown.map((m) => {
                const on = selected.has(m.path);
                const uses = m.usedBy.map((u) => labelOf(u).text);
                return (
                  <li key={m.path} className="adm-cardw" data-selected={on ? "true" : "false"} data-any={selected.size ? "true" : "false"}>
                    <button type="button" className="adm-card" onClick={() => (selected.size ? toggle(m) : setOpen(m))} aria-label={`${t("panel.open")}: ${m.name}`}>
                      <span className="adm-card-img">
                        {isVideo(m) ? <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" /> : <img src={m.url} alt="" loading="lazy" decoding="async" />}
                        {isVideo(m) && <span className="adm-thumb-kind">{t("kindVideo")}</span>}
                      </span>
                      <span className="adm-card-name" dir="ltr">
                        {m.name}
                      </span>
                      <span className="adm-card-use" data-used={uses.length ? "true" : "false"}>
                        {uses.length ? (uses.length === 1 ? uses[0] : t("library.usedInN", { count: uses.length })) : t("library.unusedBadge")}
                      </span>
                    </button>
                    <button type="button" className="adm-card-sel" role="checkbox" aria-checked={on} onClick={() => toggle(m)} aria-label={`${t("panel.select")}: ${m.name}`}>
                      <CheckIcon />
                    </button>
                  </li>
                );
              })}
            </ul>
            {list.hasMore && (
              <div className="adm-more-row">
                <button type="button" className="lbf-textbtn" onClick={() => void list.loadMore()} disabled={list.loadingMore} aria-busy={list.loadingMore}>
                  {list.loadingMore ? t("library.loading") : t("library.loadMore")}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {chosen.length > 0 && (
        <div className="adm-selbar" role="region" aria-label={t("panel.selection")}>
          <span className="adm-selbar-n" aria-live="polite">
            {t("panel.selected", { count: chosen.length })}
            {chosen.some((m) => m.usedBy.length > 0) && <span className="adm-selbar-warn"> · {t("panel.someUsed", { count: chosen.filter((m) => m.usedBy.length > 0).length })}</span>}
          </span>
          <span className="adm-selbar-acts">
            <button type="button" className="lbf-textbtn" onClick={() => setSelected(new Set(shown.map((m) => m.path)))}>
              {t("panel.selectAll")}
            </button>
            <button type="button" className="lbf-textbtn" onClick={() => setSelected(new Set())}>
              {t("panel.clearSelection")}
            </button>
            <button type="button" className="adm-btn adm-btn-danger" onClick={() => requestDelete(chosen)}>
              {t("panel.deleteSelected", { count: chosen.length })}
            </button>
          </span>
        </div>
      )}

      {open && (
        <FileSheet
          key={open.path}
          item={open}
          bucket={bucket}
          onClose={() => setOpen(null)}
          onDelete={(m) => {
            if (m.usedBy.length) setConfirm([m]);
            else {
              setOpen(null);
              softDelete([m]);
            }
          }}
          onReplaced={() => void refresh()}
          dateOf={dateOf}
          notify={notify}
        />
      )}

      {confirm && (
        <ConfirmSheet
          title={confirm.length === 1 ? t("confirm.titleOne", { name: confirm[0].name }) : t("confirm.titleMany", { count: confirm.length })}
          confirmLabel={t("confirm.delete", { count: confirm.length })}
          cancelLabel={t("confirm.keep")}
          busy={deleting}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void hardDelete(confirm)}
        >
          <p>{t("confirm.body")}</p>
          <ul className="adm-confirm-list">
            {confirm
              .filter((f) => f.usedBy.length)
              .map((f) => (
                <li key={f.path}>
                  <b dir="ltr">{f.name}</b>
                  <span>{f.usedBy.map((u) => labelOf(u).text).join(" · ")}</span>
                </li>
              ))}
          </ul>
          <p className="adm-confirm-note">{t("confirm.noUndo")}</p>
        </ConfirmSheet>
      )}
    </PanelFrame>
  );
}

/* ------------------------------------------------------------------------------------------ */

function FileSheet({
  item,
  bucket,
  onClose,
  onDelete,
  onReplaced,
  dateOf,
  notify,
}: {
  item: MediaItem;
  bucket: Bucket;
  onClose: () => void;
  onDelete: (m: MediaItem) => void;
  onReplaced: () => void;
  dateOf: (iso: string) => string;
  notify: Notify;
}) {
  const t = useTranslations("adminMedia");
  const locale = useLocale();
  const api = useMediaApi();
  const labelOf = useUseLabels();
  const replaceInput = useRef<HTMLInputElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [working, setWorking] = useState(false);
  const [oldFile, setOldFile] = useState<MediaItem | null>(null);
  const [offerDelete, setOfferDelete] = useState(false);
  const [removing, setRemoving] = useState(false);
  const video = isVideo(item);
  const current = item;

  const uploader = useUploader({ bucket, maxDimension: 2560 });

  const replaceWith = async (file: File) => {
    setWorking(true);
    try {
      const [url] = await uploader.upload([file]);
      if (!url) return;
      const res = await api.replace(bucket, current.url, url);
      if (!res.success) {
        notify.fail(t("replace.failed", { error: res.error }));
        return;
      }
      notify.ok(t("replace.done", { count: res.data?.updated ?? 0 }));
      setOldFile(current);
      setOfferDelete(true);
      onReplaced();
    } catch {
      notify.fail(t("replace.failed", { error: t("networkError") }));
    } finally {
      setWorking(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notify.fail(t("detail.copyFailed"));
    }
  };

  const deleteOld = async () => {
    if (!oldFile) return;
    setRemoving(true);
    try {
      const res = await api.remove(bucket, oldFile.path, false);
      if (res.success) notify.ok(t("replace.oldDeleted"));
      else notify.fail(t("panel.deleteFailed", { names: res.error }));
    } catch {
      notify.fail(t("panel.deleteFailed", { names: t("networkError") }));
    }
    setRemoving(false);
    setOfferDelete(false);
    onReplaced();
    onClose();
  };

  return (
    <MediaDialog
      title={current.name}
      onClose={() => !working && onClose()}
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-quiet adm-danger" onClick={() => onDelete(current)} disabled={working}>
            {t("sheet.delete")}
          </button>
          <div className="adm-mdl-foot-acts">
            <button type="button" className="lbf-textbtn" onClick={onClose} disabled={working}>
              {t("close")}
            </button>
          </div>
        </>
      }
    >
      <div className="adm-sheet">
        <div className="adm-sheet-prev">
          {video ? <video src={current.url} controls muted playsInline /> : <img src={current.url} alt="" onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />}
        </div>
        <div className="adm-sheet-side">
          <dl className="adm-facts">
            <div>
              <dt>{t("sheet.file")}</dt>
              <dd>
                <bdi>{current.name}</bdi>
              </dd>
            </div>
            {current.size > 0 && (
              <div>
                <dt>{t("sheet.size")}</dt>
                <dd>
                  <bdi>{fmtSize(current.size, locale)}</bdi>
                </dd>
              </div>
            )}
            {dims && (
              <div>
                <dt>{t("sheet.dimensions")}</dt>
                <dd>
                  <bdi>
                    {dims.w} × {dims.h}
                  </bdi>
                </dd>
              </div>
            )}
            {current.createdAt && dateOf(current.createdAt) && (
              <div>
                <dt>{t("sheet.uploaded")}</dt>
                <dd>{dateOf(current.createdAt)}</dd>
              </div>
            )}
          </dl>

          <div className="adm-sheet-uses">
            <h4 className="adm-group-title">{current.usedBy.length ? t("sheet.usedBy", { count: current.usedBy.length }) : t("sheet.notUsed")}</h4>
            {current.usedBy.length > 0 ? (
              <ul>
                {current.usedBy.map((u, i) => {
                  const l = labelOf(u);
                  return (
                    <li key={`${u}-${i}`}>
                      <a href={`#${l.section}`} onClick={onClose}>
                        {l.text}
                      </a>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="lbf-hint">{t("sheet.notUsedHint")}</p>
            )}
          </div>

          <div className="adm-sheet-acts">
            <button type="button" className="adm-btn adm-btn-primary" onClick={() => replaceInput.current?.click()} disabled={working} aria-busy={working}>
              {working ? t("replace.working") : t("sheet.replace")}
            </button>
            <button type="button" className="adm-btn" onClick={() => void copy()}>
              {copied ? t("detail.copied") : t("detail.copy")}
            </button>
            <a className="adm-btn" href={current.url} target="_blank" rel="noopener noreferrer">
              {t("detail.open")}
              <span className="sr-only"> ({t("newTab")})</span>
            </a>
            <input ref={replaceInput} type="file" className="sr-only" tabIndex={-1} aria-hidden="true" accept={acceptFor(false)} onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void replaceWith(f);
            }} />
          </div>
          {current.usedBy.length > 0 && <p className="lbf-hint">{t("sheet.replaceHint", { count: current.usedBy.length })}</p>}
          <UploadQueue uploader={uploader} compact />
        </div>
      </div>

      {offerDelete && oldFile && (
        <ConfirmSheet
          title={t("replace.oldTitle")}
          confirmLabel={t("replace.oldDelete")}
          cancelLabel={t("replace.oldKeep")}
          busy={removing}
          onCancel={() => {
            setOfferDelete(false);
            onClose();
          }}
          onConfirm={() => void deleteOld()}
        >
          <p>{t("replace.oldBody", { name: oldFile.name })}</p>
          <p className="adm-confirm-note">{t("confirm.noUndo")}</p>
        </ConfirmSheet>
      )}
    </MediaDialog>
  );
}
