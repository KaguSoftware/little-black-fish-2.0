"use client";

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import type { Bucket } from "@/shared/data/storage";
import { useMediaApi } from "./media-api";

/**
 * Upload pipeline v2.
 *
 *   const up = useUploader({ bucket: "projects", imagesOnly: true, maxDimension: 2560, hints });
 *   const urls = await up.upload(files);   // resolves with the URLs that succeeded, in input order
 *   up.items                               // queue state: progress, errors, warnings (render with <UploadQueue/>)
 *
 * Images are re-encoded to WebP in the browser (max 1 MB, long edge <= maxDimension, default 2560);
 * videos go up as-is. Up to 3 files upload at once. Hints never block: they add `warnings`.
 */
export const MAX_BYTES = 100 * 1024 * 1024;
export const CONCURRENCY = 3;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
export const acceptFor = (imagesOnly?: boolean) => (imagesOnly ? IMAGE_TYPES : [...IMAGE_TYPES, ...VIDEO_TYPES]).join(",");

export interface UploadHints {
  /** Shown BEFORE upload; the aspect ratio is compared after. */
  recommended?: { width: number; height: number; ratio?: string };
  /** Warn (never block) when the picture is narrower than this. */
  minWidth?: number;
}

export type UploadState = "queued" | "compressing" | "uploading" | "done" | "error" | "canceled";
export interface UploadItem {
  id: number;
  name: string;
  size: number;
  state: UploadState;
  /** 0..1 overall (compression counts for the first 30 %). */
  progress: number;
  url?: string;
  error?: string;
  warnings: string[];
  /** Object URL of the original, for an instant preview. Revoked on dismiss/unmount. */
  preview?: string;
  video: boolean;
}

export interface UploaderOptions {
  bucket: Bucket;
  imagesOnly?: boolean;
  /** Long edge in px after re-encode. Default 2560. */
  maxDimension?: number;
  hints?: UploadHints;
  /** Called once per successfully uploaded file, as soon as it finishes. */
  onUploaded?: (url: string, item: UploadItem) => void;
}

export interface Uploader {
  items: UploadItem[];
  /** Number of files queued or in flight. */
  active: number;
  upload: (files: File[] | FileList) => Promise<string[]>;
  cancel: (id: number) => void;
  /** Puts a failed/canceled file back in the queue; resolves with its URL (null if it fails or is canceled again). */
  retry: (id: number) => Promise<string | null>;
  dismiss: (id: number) => void;
  clearFinished: () => void;
}

async function compressImage(file: File, maxDimension: number, onProgress: (p: number) => void): Promise<File> {
  const { default: imageCompression } = await import("browser-image-compression");
  const blob = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: maxDimension,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.85,
    onProgress: (p) => onProgress(p / 100),
  });
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

export async function imageSize(file: Blob): Promise<{ width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const out = { width: bmp.width, height: bmp.height };
    bmp.close();
    return out;
  } catch {
    return null;
  }
}

const abortError = () => Object.assign(new Error("Canceled"), { name: "AbortError" });

export function useUploader(options: UploaderOptions): Uploader {
  const t = useTranslations("adminMedia");
  const api = useMediaApi();
  const [items, setItems] = useState<UploadItem[]>([]);
  const opts = useRef(options);
  useEffect(() => {
    opts.current = options;
  });
  const files = useRef(new Map<number, File>());
  const aborts = useRef(new Map<number, AbortController>());
  const waiters = useRef(new Map<number, (url: string | null) => void>());
  const queue = useRef<number[]>([]);
  const running = useRef(0);
  const seq = useRef(0);
  const alive = useRef(true);
  const previews = useRef(new Set<string>());

  const finish = useCallback((id: number, url: string | null) => {
    waiters.current.get(id)?.(url);
    waiters.current.delete(id);
  }, []);

  useEffect(() => {
    alive.current = true;
    const urls = previews.current;
    const ctl = aborts.current;
    const waiting = queue.current;
    return () => {
      alive.current = false;
      // Nothing may start after close: drop what is still queued (its waiters get null) and abort what is running.
      waiting.splice(0).forEach((id) => finish(id, null));
      ctl.forEach((c) => c.abort());
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [finish]);

  const patch = useCallback((id: number, p: Partial<UploadItem>) => {
    if (alive.current) setItems((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }, []);

  const messageOf = useCallback(
    (err: unknown) => {
      const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
      if (/network|failed to fetch|load failed/i.test(raw)) return t("upload.errNetwork");
      if (/row-level security|unauthorized|jwt|403|401/i.test(raw)) return t("upload.errAuth");
      if (/exceeded|too large|413/i.test(raw)) return t("upload.errSize");
      return raw ? t("upload.errGeneric", { error: raw }) : t("upload.errUnknown");
    },
    [t],
  );

  const run = useCallback(
    async (id: number) => {
      const original = files.current.get(id);
      if (!original) return finish(id, null);
      const ctl = new AbortController();
      aborts.current.set(id, ctl);
      const o = opts.current;
      try {
        let file = original;
        const isImage = IMAGE_TYPES.includes(original.type);
        if (isImage) {
          patch(id, { state: "compressing", progress: 0, error: undefined });
          file = await compressImage(original, o.maxDimension ?? 2560, (p) => patch(id, { progress: p * 0.3 }));
          if (ctl.signal.aborted) throw abortError();
        }
        const base = isImage ? 0.3 : 0;
        patch(id, { state: "uploading", progress: base });
        const url = await api.upload(file, {
          bucket: o.bucket,
          signal: ctl.signal,
          onProgress: (f) => patch(id, { progress: base + (1 - base) * f }),
        });
        patch(id, { state: "done", progress: 1, url });
        o.onUploaded?.(url, { id, name: original.name, size: original.size, state: "done", progress: 1, url, warnings: [], video: original.type.startsWith("video/") });
        finish(id, url);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") patch(id, { state: "canceled" });
        else patch(id, { state: "error", error: messageOf(err) });
        finish(id, null);
      } finally {
        aborts.current.delete(id);
      }
    },
    [api, finish, messageOf, patch],
  );

  const pump = useCallback(function next() {
    if (!alive.current) return;
    while (running.current < CONCURRENCY && queue.current.length) {
      const id = queue.current.shift()!;
      running.current += 1;
      void run(id).finally(() => {
        running.current -= 1;
        next();
      });
    }
  }, [run]);

  const checkHints = useCallback(
    async (id: number, file: File) => {
      const h = opts.current.hints;
      if (!h || !IMAGE_TYPES.includes(file.type)) return;
      const size = await imageSize(file);
      if (!size) return;
      const warnings: string[] = [];
      if (h.minWidth && size.width < h.minWidth) warnings.push(t("hint.tooSmall", { width: size.width, height: size.height, min: h.minWidth }));
      if (h.recommended) {
        const want = h.recommended.width / h.recommended.height;
        const got = size.width / size.height;
        if (Math.abs(got / want - 1) > 0.25) {
          warnings.push(t("hint.ratioOff", { ratio: h.recommended.ratio ?? `${h.recommended.width}×${h.recommended.height}` }));
        }
      }
      if (warnings.length) patch(id, { warnings });
    },
    [patch, t],
  );

  const upload = useCallback(
    (input: File[] | FileList) => {
      const list = Array.from(input);
      const imagesOnly = opts.current.imagesOnly;
      const allowed = imagesOnly ? IMAGE_TYPES : [...IMAGE_TYPES, ...VIDEO_TYPES];
      const created: UploadItem[] = [];
      const valid: number[] = [];
      const promises = list.map((file) => {
        const id = ++seq.current;
        const item: UploadItem = { id, name: file.name, size: file.size, state: "queued", progress: 0, warnings: [], video: file.type.startsWith("video/") };
        let invalid = "";
        if (!allowed.includes(file.type)) invalid = imagesOnly ? t("upload.wrongTypeImage") : t("upload.wrongType");
        else if (file.size > MAX_BYTES) invalid = t("upload.tooBig");
        created.push(item);
        if (invalid) {
          item.state = "error";
          item.error = invalid;
          return Promise.resolve<string | null>(null);
        }
        item.preview = URL.createObjectURL(file);
        previews.current.add(item.preview);
        files.current.set(id, file);
        valid.push(id);
        return new Promise<string | null>((resolve) => waiters.current.set(id, resolve));
      });
      setItems((cur) => [...cur, ...created]);
      for (const id of valid) {
        void checkHints(id, files.current.get(id)!);
        queue.current.push(id);
      }
      pump();
      return Promise.all(promises).then((urls) => urls.filter((u): u is string => !!u));
    },
    [checkHints, pump, t],
  );

  const cancel = useCallback(
    (id: number) => {
      const qi = queue.current.indexOf(id);
      if (qi >= 0) {
        queue.current.splice(qi, 1);
        patch(id, { state: "canceled" });
        finish(id, null);
      } else aborts.current.get(id)?.abort();
    },
    [finish, patch],
  );

  const retry = useCallback(
    (id: number) => {
      if (!files.current.has(id) || !alive.current) return Promise.resolve(null);
      const done = new Promise<string | null>((resolve) => waiters.current.set(id, resolve));
      patch(id, { state: "queued", progress: 0, error: undefined });
      queue.current.push(id);
      pump();
      return done;
    },
    [patch, pump],
  );

  const revoke = (it: UploadItem | undefined) => {
    if (it?.preview) {
      URL.revokeObjectURL(it.preview);
      previews.current.delete(it.preview);
    }
  };

  const dismiss = useCallback((id: number) => {
    aborts.current.get(id)?.abort();
    setItems((list) => {
      revoke(list.find((x) => x.id === id));
      return list.filter((x) => x.id !== id);
    });
    files.current.delete(id);
  }, []);

  const clearFinished = useCallback(() => {
    setItems((list) => {
      list.filter((x) => x.state === "done").forEach(revoke);
      return list.filter((x) => x.state !== "done");
    });
  }, []);

  const active = items.filter((i) => i.state === "queued" || i.state === "compressing" || i.state === "uploading").length;
  return { items, active, upload, cancel, retry, dismiss, clearFinished };
}

/* ---------- Drag and drop / paste helpers ---------- */

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

/** Props to spread on any element to make it a file drop target. `over` is true while files hover. */
export function useFileDrop(onFiles: (files: File[]) => void, disabled?: boolean) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const props = {
    onDragEnter: (e: DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setOver(true);
    },
    onDragOver: (e: DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setOver(false);
    },
    onDrop: (e: DragEvent) => {
      if (disabled || !hasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setOver(false);
      const dropped = Array.from(e.dataTransfer.files ?? []);
      if (dropped.length) onFiles(dropped);
    },
  };
  return { over, props };
}

/** Image files on the clipboard (a pasted screenshot, a copied image). */
export const clipboardFiles = (e: ClipboardEvent | globalThis.ClipboardEvent): File[] =>
  Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));

/** React onPaste handler: forwards pasted images, leaves pasted text alone. */
export function onPasteImages(onFiles: (files: File[]) => void, disabled?: boolean) {
  return (e: ClipboardEvent) => {
    if (disabled) return;
    const pasted = clipboardFiles(e);
    if (!pasted.length) return;
    e.preventDefault();
    onFiles(pasted);
  };
}

/** Document-level paste while `active`, unless a dialog other than `owner` is open. */
export function usePasteImages(onFiles: (files: File[]) => void, active: boolean, owner?: React.RefObject<HTMLElement | null>) {
  const cb = useRef(onFiles);
  useEffect(() => {
    cb.current = onFiles;
  });
  useEffect(() => {
    if (!active) return;
    const h = (e: globalThis.ClipboardEvent) => {
      const pasted = clipboardFiles(e);
      if (!pasted.length) return;
      const dialogs = document.querySelectorAll("dialog[open]");
      const top = dialogs[dialogs.length - 1];
      // The topmost open dialog owns the paste; with none open, anyone may.
      if (top && top !== owner?.current) return;
      e.preventDefault();
      cb.current(pasted);
    };
    document.addEventListener("paste", h);
    return () => document.removeEventListener("paste", h);
  }, [active, owner]);
}
