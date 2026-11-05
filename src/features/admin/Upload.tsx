/* eslint-disable @next/next/no-img-element -- admin previews are arbitrary user-supplied URLs */
"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { isVideoUrl, type Bucket } from "@/shared/data/storage";
import { MediaStyles } from "./MediaStyles";
import { UploadQueue, isHttpUrl, useHintText } from "./media-lib";
import { acceptFor, onPasteImages, useFileDrop, useUploader, type UploadHints } from "./uploader";

interface Props {
  bucket: Bucket;
  label: string;
  hint?: string;
  /** Validation error from the parent form; shown as an alert and marks the URL input invalid. */
  error?: string;
  /**
   * "single": the field holds one URL (editable by hand) with a preview.
   * "add": each upload (or pasted URL) is handed to onChange and the field clears (gallery).
   */
  mode?: "single" | "add";
  value?: string | null;
  onChange: (url: string) => void;
  /** Restrict to images (gallery). */
  imagesOnly?: boolean;
  /** Long edge after the WebP re-encode. Default 2560. */
  maxDimension?: number;
  /** Non-blocking size / aspect guidance. */
  hints?: UploadHints;
}

/**
 * Compatible wrapper over the v2 pipeline (useUploader): drag files onto it, paste an image
 * (Ctrl+V while it has focus), choose several files in "add" mode, per-file progress with
 * Cancel / Retry. Images are compressed to WebP first; videos go up as-is. Also accepts a URL.
 * New screens should prefer ImageField / ImageListField.
 */
export function Upload({ bucket, label, hint, error, mode = "single", value, onChange, imagesOnly, maxDimension, hints }: Props) {
  const t = useTranslations("adminMedia");
  const id = useId();
  const [draft, setDraft] = useState("");
  const [urlError, setUrlError] = useState("");
  const uploader = useUploader({ bucket, imagesOnly, maxDimension, hints, onUploaded: (url) => onChange(url) });
  const hintLine = useHintText(hints);

  const take = (files: File[]) => {
    setUrlError("");
    void uploader.upload(mode === "single" ? files.slice(0, 1) : files);
  };
  const { over, props: drop } = useFileDrop(take);

  const addDraft = () => {
    const url = draft.trim();
    if (!isHttpUrl(url)) {
      setUrlError(t("link.invalid"));
      return;
    }
    setUrlError("");
    onChange(url);
    setDraft("");
  };

  const describedBy = [`${id}-hint`, error ? `${id}-err` : "", urlError ? `${id}-uerr` : ""].filter(Boolean).join(" ");
  const preview = mode === "single" && value ? { src: value, video: isVideoUrl(value) } : null;

  return (
    <div className="adm-up adm-up-zone" data-over={over ? "true" : "false"} onPaste={onPasteImages(take)} {...drop}>
      <MediaStyles />
      <label className="lbf-label" htmlFor={`${id}-url`}>
        {label}
      </label>
      <div className="adm-up-row">
        {mode === "single" ? (
          <input
            id={`${id}-url`}
            className="lbf-input"
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder="https://"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        ) : (
          <>
            <input
              id={`${id}-url`}
              className="lbf-input"
              type="url"
              dir="ltr"
              inputMode="url"
              placeholder={t("link.placeholder")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
              aria-invalid={error || urlError ? true : undefined}
              aria-describedby={describedBy}
            />
            <button type="button" className="lbf-textbtn" onClick={addDraft} disabled={!draft.trim()}>
              {t("link.add")}
            </button>
          </>
        )}
        <span className="adm-up-file lbf-textbtn">
          {mode === "add" ? t("upload.chooseMany") : t("upload.choose")}
          <input
            type="file"
            accept={acceptFor(imagesOnly)}
            multiple={mode === "add"}
            aria-label={`${mode === "add" ? t("upload.chooseMany") : t("upload.choose")}: ${label}`}
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) take(files);
            }}
          />
        </span>
      </div>

      <span className="lbf-hint" id={`${id}-hint`}>
        {[hint, hintLine, over ? "" : mode === "add" ? t("upload.dropMany") : t("upload.dropOne")].filter(Boolean).join(" · ")}
      </span>

      {preview && (
        <div className="adm-up-preview" data-busy={uploader.active > 0 ? "true" : "false"}>
          {preview.video ? (
            <video src={preview.src} autoPlay muted loop playsInline />
          ) : (
            <img src={preview.src} alt="" />
          )}
        </div>
      )}

      <UploadQueue uploader={uploader} compact />

      {(error || urlError) && (
        <span className="lbf-error" id={error ? `${id}-err` : `${id}-uerr`} role="alert">
          {error || urlError}
        </span>
      )}
    </div>
  );
}
