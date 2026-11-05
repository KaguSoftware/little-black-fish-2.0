/* eslint-disable @next/next/no-img-element -- admin previews are arbitrary user-supplied URLs */
"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { isVideoUrl, type Bucket } from "@/shared/data/storage";
import { ImagePicker } from "./ImagePicker";
import { MediaStyles } from "./MediaStyles";
import { PhotoIcon, UploadQueue, isHttpUrl, useHintText, useUseLabels } from "./media-lib";
import { useMediaApi } from "./media-api";
import { onPasteImages, useFileDrop, useUploader, type UploadHints } from "./uploader";
import { toast } from "./toast";

export interface ImageFieldProps {
  /** Public URL, "" or null when the slot is empty. */
  value: string | null | undefined;
  onChange: (url: string) => void;
  bucket: Bucket;
  /** CSS aspect-ratio of the preview ("16/9", "1/1", 0.75). Default "16/9". */
  aspect?: string | number;
  /** How the site crops it. Default "cover". */
  fit?: "cover" | "contain";
  hints?: UploadHints;
  label: string;
  /** Focus point as [x, y] percent (0..100). Shows the focus picker under Details. */
  focus?: [number, number] | null;
  onFocusChange?: (focus: [number, number] | null) => void;
  /** Alt text. Shows the alt input under Details. */
  alt?: string;
  onAltChange?: (alt: string) => void;
  imagesOnly?: boolean;
  disabled?: boolean;
  /** Long edge for uploads made here (default 2560). */
  maxDimension?: number;
  /** Extra line under the label (what this image is for). */
  description?: string;
  /** Validation message from the parent form. */
  error?: string;
  /** Empty means "use the built-in picture": Remove becomes "Use built-in". */
  builtIn?: boolean;
  /**
   * Framing mode (the Framing dialog): the focus picker IS the preview, so it is shown at once and the
   * separate preview and the Details toggle are left out. Falls back to normal for videos / no focus handler.
   */
  defaultDetails?: boolean;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** One image slot: add, replace (button or drop a file on it), remove with Undo, details one level deeper. */
export function ImageField({
  value,
  onChange,
  bucket,
  aspect = "16/9",
  fit = "cover",
  hints,
  label,
  focus,
  onFocusChange,
  alt,
  onAltChange,
  imagesOnly,
  disabled,
  maxDimension,
  description,
  error,
  builtIn,
  defaultDetails,
}: ImageFieldProps) {
  const t = useTranslations("adminMedia");
  const api = useMediaApi();
  const labelOf = useUseLabels();
  const id = useId();
  const url = (value ?? "").trim();
  const video = isVideoUrl(url);
  const [picking, setPicking] = useState(false);
  const [details, setDetails] = useState(!!defaultDetails);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [broken, setBroken] = useState(false);
  const [uses, setUses] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const [announce, setAnnounce] = useState("");

  const uploader = useUploader({
    bucket,
    imagesOnly,
    maxDimension,
    hints,
    onUploaded: (u) => {
      onChange(u);
      setAnnounce(t("field.added"));
    },
  });
  const take = useCallback((files: File[]) => void uploader.upload(files.slice(0, 1)), [uploader]);
  const { over, props: drop } = useFileDrop(take, disabled);
  const hintLine = useHintText(hints);

  // Finished uploads without warnings leave the queue by themselves; warnings stay until dismissed.
  const { items, clearFinished } = uploader;
  useEffect(() => {
    if (!items.some((i) => i.state === "done" && i.warnings.length === 0)) return;
    const timer = window.setTimeout(() => {
      if (items.every((i) => i.state !== "done" || i.warnings.length === 0)) clearFinished();
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [items, clearFinished]);

  useEffect(() => {
    // New value: re-measure; re-check usage if Details is open.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNatural(null);
    setBroken(false);
    setUses(null);
  }, [url]);

  useEffect(() => {
    if (!details || !url || !/\/storage\/v1\//.test(url)) return;
    let live = true;
    void api.usage(bucket, url).then((r) => {
      if (live && r.success && r.data) setUses(r.data);
    }).catch(() => {});
    return () => {
      live = false;
    };
  }, [details, url, api, bucket]);

  const remove = () => {
    const previous = url;
    onChange("");
    setDetails(false);
    setAnnounce(t(builtIn ? "field.backToBuiltIn" : "field.removed", { label }));
    toast({
      text: t(builtIn ? "field.backToBuiltIn" : "field.removed", { label }),
      undo: () => {
        onChange(previous);
        setAnnounce(t("field.restored", { label }));
      },
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ kind: "error", text: t("detail.copyFailed") });
    }
  };

  const busy = uploader.active > 0;
  const live = items.find((i) => i.state === "compressing" || i.state === "uploading" || i.state === "queued");
  const ratio = typeof aspect === "number" ? String(aspect) : aspect;
  const [ra, rb] = ratio.split("/").map(Number);
  const r = rb ? ra / rb : ra || 16 / 9;
  // Never taller than ~22rem: narrow the box instead so the aspect ratio holds.
  const maxWidth = `min(100%, ${(22 * r).toFixed(1)}rem)`;
  const pos = focus ? `${clamp(focus[0])}% ${clamp(focus[1])}%` : "50% 50%";
  const small = hints?.minWidth && natural && natural.w < hints.minWidth;
  const framing = !!defaultDetails && !!url && !video && !!onFocusChange;
  const hasDetails = !!url && !framing;

  /* focus point picker */
  const fpRef = useRef<HTMLDivElement>(null);
  const setFocusFromPointer = (e: PointerEvent) => {
    const r = fpRef.current?.getBoundingClientRect();
    if (!r || !onFocusChange) return;
    onFocusChange([Math.round(clamp(((e.clientX - r.left) / r.width) * 100)), Math.round(clamp(((e.clientY - r.top) / r.height) * 100))]);
  };
  const nudge = (e: KeyboardEvent) => {
    if (!onFocusChange) return;
    const step = e.shiftKey ? 10 : 1;
    const [x, y] = focus ?? [50, 50];
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (e.key === "Home" || e.key === "Escape") return;
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    onFocusChange([clamp(x + m[0]), clamp(y + m[1])]);
  };

  return (
    <div className="adm-if lbf-field" data-framing={framing ? "true" : "false"} data-over={over ? "true" : "false"} data-disabled={disabled ? "true" : "false"} onPaste={onPasteImages(take, disabled)} {...drop}>
      <MediaStyles />
      <span className="lbf-label" id={`${id}-label`}>
        {label}
      </span>
      {description && (
        <span className="lbf-hint" id={`${id}-desc`}>
          {description}
        </span>
      )}

      {!url ? (
        <button
          type="button"
          className="adm-zone"
          style={{ aspectRatio: ratio, maxWidth }}
          data-over={over ? "true" : "false"}
          disabled={disabled || busy}
          onClick={() => setPicking(true)}
          aria-labelledby={`${id}-label ${id}-add`}
          aria-describedby={description ? `${id}-desc` : undefined}
        >
          <PhotoIcon />
          <span className="adm-zone-title" id={`${id}-add`}>
            {over ? t("drop.release") : t("field.add")}
          </span>
          <span className="adm-zone-sub">{t("field.addSub")}</span>
          {hintLine && <span className="adm-zone-hint">{hintLine}</span>}
          {live && <ProgressRing value={live.progress} />}
        </button>
      ) : framing ? null : (
        <div className="adm-if-box" style={{ aspectRatio: ratio, maxWidth }} data-fit={fit} data-busy={busy ? "true" : "false"}>
          {video ? (
            <video src={url} autoPlay muted loop playsInline onLoadedMetadata={(e) => setNatural({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })} />
          ) : (
            <img
              src={url}
              alt=""
              style={{ objectFit: fit, objectPosition: fit === "cover" ? pos : undefined }}
              onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => setBroken(true)}
            />
          )}
          {broken && <span className="adm-if-broken">{t("field.broken")}</span>}
          {over && (
            <span className="adm-if-drop" aria-hidden="true">
              {t("drop.replace")}
            </span>
          )}
          {live && (
            <span className="adm-if-prog">
              <ProgressRing value={live.progress} />
            </span>
          )}
        </div>
      )}

      {url && (
        <div className="adm-if-acts">
          <button type="button" className="adm-btn" onClick={() => setPicking(true)} disabled={disabled || busy}>
            {t("field.replace")}
          </button>
          <button type="button" className="adm-btn adm-btn-quiet" onClick={remove} disabled={disabled || busy}>
            {t(builtIn ? "field.useBuiltIn" : "field.remove")}
          </button>
          {hasDetails && (
            <button type="button" className="adm-btn adm-btn-quiet adm-if-more" aria-expanded={details} aria-controls={`${id}-details`} onClick={() => setDetails((d) => !d)}>
              {t("field.details")}
              <span className="adm-caret" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {url && natural && (
        <p className="adm-if-meta" data-warn={small ? "true" : "false"}>
          {t("field.size", { width: natural.w, height: natural.h })}
          {small ? ` · ${t("hint.tooSmallShort", { min: hints?.minWidth ?? 0 })}` : hintLine ? ` · ${hintLine}` : ""}
        </p>
      )}

      <UploadQueue uploader={uploader} compact />
      {error && (
        <span className="lbf-error" role="alert">
          {error}
        </span>
      )}

      {url && (details || framing) && (
        <div className="adm-if-details" id={`${id}-details`}>
          {onAltChange && (
            <div className="lbf-field">
              <label className="lbf-label" htmlFor={`${id}-alt`}>
                {t("detail.alt")}
              </label>
              <input id={`${id}-alt`} className="lbf-input" value={alt ?? ""} onChange={(e) => onAltChange(e.target.value)} disabled={disabled} />
              <span className="lbf-hint">{t("detail.altHint")}</span>
            </div>
          )}
          {onFocusChange && !video && (
            <div className="lbf-field">
              <span className="lbf-label" id={`${id}-fp-l`}>
                {t("detail.focus")}
              </span>
              <div className="adm-fp">
                <div
                  ref={fpRef}
                  className="adm-fp-img"
                  role="group"
                  aria-labelledby={`${id}-fp-l`}
                  onPointerDown={(e) => {
                    if (disabled) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setFocusFromPointer(e);
                  }}
                  onPointerMove={(e) => e.buttons === 1 && !disabled && setFocusFromPointer(e)}
                >
                  <img
                    src={url}
                    alt=""
                    draggable={false}
                    onLoad={(e) => framing && setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  />
                  <button
                    type="button"
                    className="adm-fp-dot"
                    style={{ left: `${focus?.[0] ?? 50}%`, top: `${focus?.[1] ?? 50}%` }}
                    aria-label={t("detail.focusDot", { x: Math.round(focus?.[0] ?? 50), y: Math.round(focus?.[1] ?? 50) })}
                    onKeyDown={nudge}
                    onPointerDown={(e) => e.stopPropagation()}
                    disabled={disabled}
                  />
                </div>
                <div className="adm-fp-side">
                  <span className="lbf-hint">{t("detail.focusHint")}</span>
                  <button type="button" className="adm-btn adm-btn-quiet" onClick={() => onFocusChange(null)} disabled={!focus || disabled}>
                    {t("detail.focusReset")}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="adm-if-tools">
            <button type="button" className="adm-btn adm-btn-quiet" onClick={() => void copy()}>
              {copied ? t("detail.copied") : t("detail.copy")}
            </button>
            {isHttpUrl(url) && (
              <a className="lbf-textbtn" href={url} target="_blank" rel="noopener noreferrer">
                {t("detail.open")}
                <span className="sr-only"> ({t("newTab")})</span>
              </a>
            )}
          </div>
          {uses && (
            <p className="adm-if-uses">
              {uses.length === 0 ? t("detail.usedNone") : t("detail.usedIn", { count: uses.length })}
              {uses.length > 0 && <span> {uses.map((u) => labelOf(u).text).join(" · ")}</span>}
            </p>
          )}
        </div>
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>

      {picking && (
        <ImagePicker
          bucket={bucket}
          imagesOnly={imagesOnly}
          hints={hints}
          maxDimension={maxDimension}
          title={url ? t("field.replaceTitle", { label }) : t("field.pickTitle", { label })}
          onClose={() => setPicking(false)}
          onPick={(urls) => {
            setPicking(false);
            if (urls[0]) {
              onChange(urls[0]);
              setAnnounce(t("field.added"));
            }
          }}
        />
      )}
    </div>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg className="adm-ring" viewBox="0 0 36 36" width="36" height="36" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="2.5" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0.04, value))} transform="rotate(-90 18 18)" />
    </svg>
  );
}
