"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { isVideoUrl, type Bucket } from "@/shared/data/storage";
import { formatNumber } from "@/shared/data/localize";
import type { MediaItem } from "@/shared/actions/admin/types";
import { deleteMedia, listMedia } from "@/shared/actions/admin/media";
import { Badge, PanelFrame } from "./forms";
import type { Notify } from "./parts";
import { Upload } from "./Upload";

const BUCKETS: Bucket[] = ["projects", "hero"];
/** listMedia asks storage for at most this many files (newest first). */
const LIST_CAP = 1000;

function fmtSize(n: number, locale: string) {
  const f = (v: number, d: number) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: d }).format(v);
  if (n >= 1024 * 1024) return `${f(n / 1024 / 1024, 1)} MB`;
  if (n >= 1024) return `${f(n / 1024, 0)} KB`;
  return `${f(n, 0)} B`;
}

export function MediaPanel({ notify, hidden, labelledBy }: { notify: Notify; hidden: boolean; labelledBy: string }) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const searchId = useId();
  const [bucket, setBucket] = useState<Bucket>("projects");
  const [loadedItems, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<Bucket | null>(null);
  // Files of another bucket are never shown: until this bucket has loaded the list reads as loading.
  const items = loaded === bucket ? loadedItems : null;
  const [query, setQuery] = useState("");
  const [onlyUnused, setOnlyUnused] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Only the newest request may write results: a slower, older one must not overwrite them.
  const requestId = useRef(0);
  const load = useCallback(
    async (b: Bucket) => {
      const mine = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await listMedia(b);
        if (mine !== requestId.current) return;
        if (res.success) setItems(res.data ?? []);
        else setError(res.error);
      } catch {
        if (mine === requestId.current) setError(t("networkError"));
      } finally {
        if (mine === requestId.current) {
          setLoading(false);
          setLoaded(b);
        }
      }
    },
    [t],
  );

  // Load lazily: only once the panel is shown, and again when the bucket changes.
  useEffect(() => {
    if (hidden || loaded === bucket || loading) return;
    const timer = window.setTimeout(() => void load(bucket), 0);
    return () => window.clearTimeout(timer);
  }, [hidden, bucket, loaded, loading, load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!onlyUnused || m.usedBy.length === 0));
  }, [items, query, onlyUnused]);
  const unusedCount = (items ?? []).filter((m) => m.usedBy.length === 0).length;

  const copy = async (m: MediaItem) => {
    try {
      await navigator.clipboard.writeText(m.url);
      setCopied(m.path);
      notify.ok(t("media.copied"));
      window.setTimeout(() => setCopied((c) => (c === m.path ? null : c)), 2000);
    } catch {
      notify.fail(t("media.copyFailed"));
    }
  };

  const remove = async (m: MediaItem) => {
    const used = m.usedBy.length > 0;
    const msg = used ? t("media.confirmDeleteUsed", { name: m.name, users: m.usedBy.join(", ") }) : t("media.confirmDelete", { name: m.name });
    if (!window.confirm(msg)) return;
    setBusy(m.path);
    try {
      const res = await deleteMedia(bucket, m.path, used);
      if (res.success) {
        setItems((list) => (list ?? []).filter((x) => x.path !== m.path));
        notify.ok(t("media.deleted", { name: m.name }));
      } else notify.fail(t("deleteFailed", { error: res.error }));
    } catch {
      notify.fail(t("deleteFailed", { error: t("networkError") }));
    } finally {
      setBusy(null);
    }
  };

  const date = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString(locale === "fa" ? "fa-IR" : "en-US", { year: "numeric", month: "short", day: "numeric" }) : "";

  return (
    <PanelFrame
      id="media"
      labelledBy={labelledBy}
      hidden={hidden}
      title={t("media.title")}
      sub={t("media.sub")}
      actions={
        <button type="button" className="lbf-textbtn adm-add" onClick={() => void load(bucket)} disabled={loading} aria-busy={loading}>
          {loading ? t("media.refreshing") : t("media.refresh")}
        </button>
      }
    >
      <div className="adm-seg" role="group" aria-label={t("media.bucketLabel")}>
        {BUCKETS.map((b) => (
          <button key={b} type="button" className="adm-seg-btn" aria-pressed={bucket === b} onClick={() => setBucket(b)}>
            {t(`media.buckets.${b}`)}
          </button>
        ))}
      </div>

      <div className="adm-media-up">
        <Upload bucket={bucket} mode="add" label={t("media.upload")} hint={t("media.uploadHint")} onChange={() => void load(bucket)} />
      </div>

      <div className="adm-ctools">
        <div className="lbf-field adm-csearch">
          <label className="lbf-label" htmlFor={searchId}>
            {t("media.search")}
          </label>
          <input id={searchId} className="lbf-input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <label className="lbf-check">
          <input type="checkbox" checked={onlyUnused} onChange={(e) => setOnlyUnused(e.target.checked)} />
          <span>{t("media.onlyUnused", { count: formatNumber(unusedCount, locale) })}</span>
        </label>
      </div>

      <div role="status" aria-live="polite" className="adm-cmeta">
        <span>{items ? t("media.count", { count: shown.length, total: items.length }) : ""}</span>
      </div>
      {items && items.length >= LIST_CAP && <p className="adm-note">{t("media.capNote", { max: LIST_CAP })}</p>}

      {error ? (
        <div className="adm-empty" role="alert">
          <p className="adm-empty-title">{t("media.errorTitle")}</p>
          <p className="adm-empty-text">{error}</p>
          <button type="button" className="lbf-textbtn" onClick={() => void load(bucket)}>
            {t("media.retry")}
          </button>
        </div>
      ) : items === null ? (
        <div aria-busy="true">
          <div className="adm-skel" />
          <div className="adm-skel" />
          <div className="adm-skel" />
        </div>
      ) : shown.length === 0 ? (
        <div className="adm-empty">
          <p className="adm-empty-title">{items.length === 0 ? t("media.emptyTitle") : t("media.noMatchTitle")}</p>
          <p className="adm-empty-text">{items.length === 0 ? t("media.emptyText") : t("media.noMatchText")}</p>
        </div>
      ) : (
        <ul className="adm-media">
          {shown.map((m) => {
            const video = m.mimeType.startsWith("video/") || isVideoUrl(m.url);
            const used = m.usedBy.length > 0;
            return (
              <li key={m.path} className="adm-media-item">
                <div className="adm-media-thumb">
                  {video ? (
                    <video src={`${m.url}#t=0.1`} muted playsInline preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" loading="lazy" decoding="async" />
                  )}
                  {video && <span className="adm-thumb-kind">{t("kindVideo")}</span>}
                </div>
                <p className="adm-media-name" dir="ltr" title={m.name}>
                  {m.name}
                </p>
                <p className="adm-row-meta">
                  <span>{fmtSize(m.size, locale)}</span>
                  <span>{date(m.createdAt)}</span>
                </p>
                <div className="adm-media-use">
                  {used ? (
                    <Badge tone="accent">{t("media.usedBy", { users: m.usedBy.join(", ") })}</Badge>
                  ) : (
                    <Badge tone="warn">{t("media.unreferenced")}</Badge>
                  )}
                </div>
                <div className="adm-media-acts">
                  <button type="button" className="lbf-textbtn" onClick={() => void copy(m)}>
                    {copied === m.path ? t("media.copiedShort") : t("media.copyUrl")}
                    <span className="sr-only">: {m.name}</span>
                  </button>
                  <a className="lbf-textbtn" href={m.url} target="_blank" rel="noopener noreferrer">
                    {t("media.open")}
                    <span className="sr-only">
                      : {m.name} ({t("opensNewTab")})
                    </span>
                  </a>
                  <button type="button" className="lbf-textbtn adm-danger" onClick={() => void remove(m)} disabled={busy === m.path} aria-busy={busy === m.path}>
                    {busy === m.path ? t("deleting") : t("delete")}
                    <span className="sr-only">: {m.name}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PanelFrame>
  );
}
