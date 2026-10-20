"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getYouTubeId, youTubeThumb } from "@/shared/data/youtube";
import { isVideoUrl } from "@/shared/data/storage";

/* ---------- Notices: one quiet line under the tabs, polite for success, an alert for errors. ---------- */

export type Notice = { kind: "ok" | "error"; text: string; id: number } | null;
export interface Notify {
  ok: (text: string) => void;
  fail: (text: string) => void;
}

export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0);

  const show = useCallback((kind: "ok" | "error", text: string) => {
    window.clearTimeout(timer.current);
    seq.current += 1;
    setNotice({ kind, text, id: seq.current });
    if (kind === "ok") timer.current = window.setTimeout(() => setNotice(null), 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const notify = useMemo<Notify>(
    () => ({ ok: (t) => show("ok", t), fail: (t) => show("error", t) }),
    [show],
  );
  const clear = useCallback(() => setNotice(null), []);
  return { notice, notify, clear };
}

export function NoticeLine({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const t = useTranslations("admin");
  return (
    <div className="adm-notice">
      <div role="status" aria-live="polite">
        {notice?.kind === "ok" && (
          <span key={notice.id} className="adm-notice-line" data-kind="ok">
            {notice.text}
          </span>
        )}
      </div>
      <div role="alert">
        {notice?.kind === "error" && (
          <span key={notice.id} className="adm-notice-line" data-kind="error">
            <span>{notice.text}</span>
            <button type="button" className="lbf-textbtn" onClick={onDismiss}>
              {t("dismiss")}
            </button>
          </span>
        )}
      </div>
    </div>
  );
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
