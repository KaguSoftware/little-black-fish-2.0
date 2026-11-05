"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { getYouTubeId, youTubeThumb } from "@/shared/data/youtube";
import { isVideoUrl } from "@/shared/data/storage";
import { ToastStack, toast } from "./toast";

/* ---------- Notices: toasts (see toast.tsx). `notify.ok/fail` keep working; `undo` is the new option. ---------- */

export interface NotifyOptions {
  /** Shows an Undo button on the toast (about 8 s). */
  undo?: () => void;
  /** ms; 0 = stay until dismissed. */
  duration?: number;
  /** Runs when the toast ends without Undo (use it to commit a deferred action). */
  onExpire?: () => void;
}
export interface Notify {
  ok: (text: string, options?: NotifyOptions) => void;
  fail: (text: string, options?: NotifyOptions) => void;
}

/** Kept for existing callers: `notice` is unused state now; toasts live in the shared store. */
export type Notice = null;

const NOTIFY: Notify = {
  ok: (text, o) => void toast({ kind: "ok", text, ...o }),
  fail: (text, o) => void toast({ kind: "error", text, ...o }),
};

export function useNotice() {
  // Toasts outlive section switches (an Undo must stay reachable), so clear() no longer closes them.
  const clear = useCallback(() => {}, []);
  return { notice: null as Notice, notify: NOTIFY, clear };
}

/** Renders the toast stack (bottom-center). Props are kept for compatibility with older callers. */
export function NoticeLine(_props: { notice?: Notice; onDismiss?: () => void }) {
  void _props;
  return <ToastStack />;
}

/* ---------- Thumbnails ---------- */

export type ThumbKind = "image" | "video" | "youtube";

/** Image/video URL first, then the YouTube poster. */
export function resolveThumb(mediaUrl?: string | null, youtubeUrl?: string | null): { src: string; kind: ThumbKind } | null {
  const url = mediaUrl?.trim();
  if (url) return { src: url, kind: isVideoUrl(url) ? "video" : "image" };
  const id = getYouTubeId(youtubeUrl);
  return id ? { src: youTubeThumb(id), kind: "youtube" } : null;
}

export function Thumb({ thumb, off }: { thumb: { src: string; kind: ThumbKind } | null; off?: boolean }) {
  const t = useTranslations("admin");
  return (
    <span className="adm-thumb" data-off={off ? "true" : "false"} aria-hidden="true">
      {!thumb ? (
        <span className="adm-thumb-none">{t("noImage")}</span>
      ) : thumb.kind === "video" ? (
        <video src={`${thumb.src}#t=0.1`} muted playsInline preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb.src} alt="" loading="lazy" decoding="async" />
      )}
      {thumb && thumb.kind !== "image" && (
        <span className="adm-thumb-kind">{thumb.kind === "video" ? t("kindVideo") : t("kindYouTube")}</span>
      )}
    </span>
  );
}

/* ---------- Icons (stroke, currentColor, 1em) ---------- */

const ICON = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const GripIcon = () => (
  <svg {...ICON}>
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth={2.6} />
  </svg>
);
export const UpIcon = () => (
  <svg {...ICON}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </svg>
);
export const DownIcon = () => (
  <svg {...ICON}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);
/** Points toward the start of the line (left in LTR, right in RTL). */
export const StartIcon = () => (
  <svg {...ICON} style={{ transform: "scaleX(var(--adm-flip,1))" }}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const EndIcon = () => (
  <svg {...ICON} style={{ transform: "scaleX(var(--adm-flip,1))" }}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);
