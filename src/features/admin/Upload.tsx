"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import { getSupabaseClient } from "@/shared/supabase/browser";
import { isVideoUrl, type Bucket } from "@/shared/data/storage";

const MAX_BYTES = 100 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime";
const ACCEPT_LIST = ACCEPT.split(",");
const COMPRESSIBLE = ["image/png", "image/jpeg", "image/webp"];

type State = "idle" | "compressing" | "uploading" | "done" | "error";

interface Props {
  bucket: Bucket;
  label: string;
  hint?: string;
  /**
   * "single": the field holds one URL (editable by hand) with a preview.
   * "add": each upload (or pasted URL) is handed to onChange and the field clears (gallery).
   */
  mode?: "single" | "add";
  value?: string | null;
  onChange: (url: string) => void;
  /** Restrict to images (gallery). */
  imagesOnly?: boolean;
}

async function compressImage(file: File): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  const blob = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 2560,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.85,
  });
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

/**
 * Upload to Supabase Storage from the browser with the admin's session. Images are compressed
 * to WebP first; videos go up as-is. Also accepts a pasted URL.
 */
export function Upload({ bucket, label, hint, mode = "single", value, onChange, imagesOnly }: Props) {
  const t = useTranslations("admin");
  const id = useId();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState("");
  const [over, setOver] = useState(false);
  const [draft, setDraft] = useState("");
  const [localPreview, setLocalPreview] = useState<{ src: string; video: boolean } | null>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  const accept = imagesOnly ? ACCEPT_LIST.filter((a) => a.startsWith("image/")).join(",") : ACCEPT;
  const busy = state === "compressing" || state === "uploading";

  async function handleFile(original: File) {
    if (busy) return;
    if (!accept.split(",").includes(original.type)) {
      setState("error");
      setMessage(imagesOnly ? t("upload.wrongTypeImage") : t("upload.wrongType"));
      return;
    }
    if (original.size > MAX_BYTES) {
      setState("error");
      setMessage(t("upload.tooBig"));
      return;
    }

    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(original);
    setLocalPreview({ src: objectUrl.current, video: original.type.startsWith("video/") });

    try {
      let file = original;
      if (COMPRESSIBLE.includes(original.type)) {
        setState("compressing");
        setMessage(t("upload.compressing"));
        file = await compressImage(original);
      }
      setState("uploading");
      setMessage(t("upload.uploading"));

      const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const storage = getSupabaseClient().storage.from(bucket);
      const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const url = storage.getPublicUrl(path).data.publicUrl;

      onChange(url);
      setState("done");
      setMessage(mode === "add" ? t("upload.added") : t("upload.done"));
      if (mode === "add") setLocalPreview(null);
    } catch (err) {
      setState("error");
      setMessage(t("upload.failed", { error: err instanceof Error ? err.message : String(err) }));
      setLocalPreview(null);
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const addDraft = () => {
    const url = draft.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setState("error");
      setMessage(t("upload.badUrl"));
      return;
    }
    onChange(url);
    setDraft("");
    setState("done");
    setMessage(t("upload.added"));
  };

  const preview = localPreview ?? (mode === "single" && value ? { src: value, video: isVideoUrl(value) } : null);

  return (
    <div
      className="adm-up adm-up-zone"
      data-over={over ? "true" : "false"}
      onDragOver={(e) => {
        e.preventDefault();
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
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
            aria-describedby={`${id}-status${hint ? ` ${id}-hint` : ""}`}
          />
        ) : (
          <>
            <input
              id={`${id}-url`}
              className="lbf-input"
              type="url"
              dir="ltr"
              inputMode="url"
              placeholder={t("upload.pastePlaceholder")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
              aria-describedby={`${id}-status${hint ? ` ${id}-hint` : ""}`}
            />
            <button type="button" className="lbf-textbtn" onClick={addDraft} disabled={!draft.trim()}>
              {t("upload.addUrl")}
            </button>
          </>
        )}
        <span className="adm-up-file lbf-textbtn" aria-disabled={busy}>
          {t("upload.choose")}
          <input
            type="file"
            accept={accept}
            disabled={busy}
            aria-label={`${t("upload.choose")}: ${label}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
        </span>
      </div>

      {hint && (
        <span className="lbf-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}

      {preview && (
        <div className="adm-up-preview" data-busy={busy ? "true" : "false"}>
          {preview.video ? (
            <video src={preview.src} autoPlay muted loop playsInline />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.src} alt="" />
          )}
        </div>
      )}

      <span className="adm-up-status" id={`${id}-status`} data-state={state} role={state === "error" ? "alert" : "status"}>
        {state === "idle" ? (imagesOnly ? t("upload.idleImage") : t("upload.idle")) : message}
      </span>
    </div>
  );
}
