/* eslint-disable @next/next/no-img-element -- admin previews are arbitrary user-supplied URLs */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Bucket } from "@/shared/data/storage";
import type { MediaItem } from "@/shared/actions/admin/types";
import { useMediaApi } from "./media-api";
import type { Uploader, UploadItem } from "./uploader";

export const PAGE_SIZE = 60;

export function fmtSize(n: number, locale: string) {
  const f = (v: number, d: number) => new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", { maximumFractionDigits: d }).format(v);
  const fa = locale === "fa";
  if (n >= 1024 * 1024) return `${f(n / 1024 / 1024, 1)} ${fa ? "مگابایت" : "MB"}`;
  if (n >= 1024) return `${f(n / 1024, 0)} ${fa ? "کیلوبایت" : "KB"}`;
  return `${f(n, 0)} ${fa ? "بایت" : "B"}`;
}

export function fmtDate(iso: string, locale: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale === "fa" ? "fa-IR" : "en-US", { year: "numeric", month: "short", day: "numeric" });
}

export const isHttpUrl = (s: string) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s.trim());

/** Turns a `MediaItem.usedBy` label into plain words plus the admin section that owns it. */
export function useUseLabels() {
  const t = useTranslations("adminMedia");
  return useCallback(
    (label: string): { text: string; section: string } => {
      let m: RegExpMatchArray | null;
      if ((m = label.match(/^project gallery (.+)$/))) return { text: t("use.gallery", { name: m[1] }), section: "projects" };
      if ((m = label.match(/^project (.+)$/))) return { text: t("use.project", { name: m[1] }), section: "projects" };
      if (label.startsWith("hero slide ")) return { text: t("use.hero"), section: "hero" };
      if ((m = label.match(/^team member (.+)$/))) return { text: t("use.team", { name: m[1] }), section: "team" };
      if ((m = label.match(/^setting (.+)$/))) {
        const path = m[1];
        if (path === "seo.ogImage") return { text: t("use.ogImage"), section: "settings" };
        if (path.startsWith("tellers.")) {
          const [, name = "", field = ""] = path.split(".");
          if (field === "reel") return { text: t("use.reel"), section: "images" };
          if (field === "plates") return { text: t("use.plate"), section: "images" };
          return { text: t("use.voice", { name }), section: "series" };
        }
        if (path.startsWith("heroVideos.")) return { text: path.endsWith(".poster") ? t("use.poster") : t("use.heroVideo"), section: "images" };
        if (path.startsWith("wall.")) return { text: t("use.wall"), section: "images" };
        if (path.startsWith("archive.")) return { text: t("use.archive"), section: "images" };
        return { text: t("use.setting", { path }), section: path.startsWith("images.") ? "images" : "settings" };
      }
      return { text: label, section: "media" };
    },
    [t],
  );
}

/** Paged, searchable-on-the-client list of a bucket. `refresh()` reloads from the first page. */
export function useMediaList(bucket: Bucket, enabled = true) {
  const api = useMediaApi();
  const t = useTranslations("adminMedia");
  const [state, setState] = useState<{ bucket: Bucket | null; items: MediaItem[]; next: number | null; error: string | null }>({
    bucket: null,
    items: [],
    next: null,
    error: null,
  });
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(false);
  const req = useRef(0);

  const fetchPage = useCallback(
    async (offset: number) => {
      const mine = ++req.current;
      try {
        const res = await api.list(bucket, offset, PAGE_SIZE);
        if (mine !== req.current) return;
        if (res.success && res.data) {
          const page = res.data;
          setState((s) => ({
            bucket,
            items: offset === 0 || s.bucket !== bucket ? page.items : [...s.items, ...page.items.filter((n) => !s.items.some((o) => o.path === n.path))],
            next: page.nextOffset,
            error: null,
          }));
        } else setState((s) => ({ ...s, bucket, error: res.success ? t("library.loadFailed") : res.error }));
      } catch {
        if (mine === req.current) setState((s) => ({ ...s, bucket, error: t("library.loadFailed") }));
      } finally {
        if (mine === req.current) {
          setLoading(false);
          setMore(false);
        }
      }
    },
    [api, bucket, t],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    return fetchPage(0);
  }, [fetchPage]);
  const loadMore = useCallback(() => {
    if (state.next === null) return;
    setMore(true);
    return fetchPage(state.next);
  }, [fetchPage, state.next]);

  useEffect(() => {
    if (!enabled || state.bucket === bucket) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, bucket, state.bucket, refresh]);

  const current = state.bucket === bucket;
  const items = useMemo(() => (current ? state.items : null), [current, state.items]);
  const setItems = useCallback((fn: (list: MediaItem[]) => MediaItem[]) => setState((s) => ({ ...s, items: fn(s.items) })), []);
  return { items, error: current ? state.error : null, loading: loading || (enabled && !current && !state.error), loadingMore: more, hasMore: current && state.next !== null, refresh, loadMore, setItems };
}

/* ---------- Icons ---------- */
const I = { width: "1em", height: "1em", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const PhotoIcon = () => (
  <svg {...I}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10.5" r="1.5" />
    <path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4" />
  </svg>
);
export const CheckIcon = () => (
  <svg {...I} strokeWidth={2}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...I}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const PlusIcon = () => (
  <svg {...I}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const SwapIcon = () => (
  <svg {...I}>
    <path d="M5 9h13l-3.5-3.5M19 15H6l3.5 3.5" />
  </svg>
);
export const WarnIcon = () => (
  <svg {...I}>
    <path d="M12 4l9 16H3L12 4zM12 10v4M12 17h.01" />
  </svg>
);
export const LinkIcon = () => (
  <svg {...I}>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" />
  </svg>
);
export const TrashIcon = () => (
  <svg {...I}>
    <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />
  </svg>
);

/* ---------- Upload queue (per-file progress, cancel, retry, warnings) ---------- */

export function UploadQueue({ uploader, compact }: { uploader: Uploader; compact?: boolean }) {
  const t = useTranslations("adminMedia");
  const locale = useLocale();
  const { items } = uploader;
  const hasDone = items.some((i) => i.state === "done");
  if (!items.length) return null;
  return (
    <div className="adm-q" data-compact={compact ? "true" : "false"}>
      <ul className="adm-q-list" aria-label={t("upload.queue")}>
        {items.map((it) => (
          <QueueRow key={it.id} it={it} uploader={uploader} locale={locale} />
        ))}
      </ul>
      {hasDone && (
        <button type="button" className="lbf-textbtn adm-q-clear" onClick={uploader.clearFinished}>
          {t("upload.clearDone")}
        </button>
      )}
    </div>
  );
}

function QueueRow({ it, uploader, locale }: { it: UploadItem; uploader: Uploader; locale: string }) {
  const t = useTranslations("adminMedia");
  const busy = it.state === "queued" || it.state === "compressing" || it.state === "uploading";
  const status =
    it.state === "queued" ? t("upload.queued")
    : it.state === "compressing" ? t("upload.compressing")
    : it.state === "uploading" ? t("upload.uploading", { percent: Math.round(it.progress * 100) })
    : it.state === "done" ? t("upload.done")
    : it.state === "canceled" ? t("upload.canceled")
    : (it.error ?? "");
  return (
    <li className="adm-q-row" data-state={it.state}>
      <span className="adm-q-thumb" aria-hidden="true">
        {it.preview && !it.video ? (
          <img src={it.preview} alt="" />
        ) : (
          <PhotoIcon />
        )}
        {it.state === "done" && (
          <span className="adm-q-check">
            <CheckIcon />
          </span>
        )}
      </span>
      <span className="adm-q-main">
        <span className="adm-q-name" dir="ltr" title={it.name}>
          {it.name}
        </span>
        <span className="adm-q-status" role={it.state === "error" ? "alert" : undefined}>
          {status}
          {it.state !== "error" && it.size > 0 && ` · ${fmtSize(it.size, locale)}`}
        </span>
        {busy && (
          <span className="adm-q-bar" role="progressbar" aria-label={it.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(it.progress * 100)}>
            <span style={{ transform: `scaleX(${it.progress})` }} />
          </span>
        )}
        {it.warnings.map((w) => (
          <span key={w} className="adm-q-warn">
            <WarnIcon /> {w}
          </span>
        ))}
      </span>
      <span className="adm-q-acts">
        {busy && (
          <button type="button" className="lbf-textbtn" onClick={() => uploader.cancel(it.id)}>
            {t("upload.cancel")}
            <span className="sr-only">: {it.name}</span>
          </button>
        )}
        {(it.state === "error" || it.state === "canceled") && (
          <button type="button" className="lbf-textbtn" onClick={() => uploader.retry(it.id)}>
            {t("upload.retry")}
            <span className="sr-only">: {it.name}</span>
          </button>
        )}
        {!busy && (
          <button type="button" className="adm-q-x" onClick={() => uploader.dismiss(it.id)} aria-label={`${t("upload.dismiss")}: ${it.name}`}>
            <CloseIcon />
          </button>
        )}
      </span>
    </li>
  );
}

/** Hint line shown BEFORE upload: "Best at 1600×900 (16:9) or larger." */
export function useHintText(hints?: { recommended?: { width: number; height: number; ratio?: string }; minWidth?: number }) {
  const t = useTranslations("adminMedia");
  const r = hints?.recommended;
  if (r) return t("hint.recommended", { width: r.width, height: r.height, ratio: r.ratio ? ` (${r.ratio})` : "" });
  if (hints?.minWidth) return t("hint.minWidth", { min: hints.minWidth });
  return "";
}
