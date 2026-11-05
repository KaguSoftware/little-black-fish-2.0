/* eslint-disable @next/next/no-img-element -- admin previews are arbitrary user-supplied URLs */
"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { flushSync } from "react-dom";
import { animate } from "motion";
import { useLocale, useTranslations } from "next-intl";
import { isVideoUrl, type Bucket } from "@/shared/data/storage";
import { formatNumber } from "@/shared/data/localize";
import { ImagePicker } from "./ImagePicker";
import { MediaStyles } from "./MediaStyles";
import { PhotoIcon, PlusIcon, CloseIcon, SwapIcon, TrashIcon, UploadQueue, useHintText } from "./media-lib";
import { useFileDrop, useUploader, type UploadHints } from "./uploader";
import { toast } from "./toast";

export interface ImageListFieldProps {
  value: string[];
  onChange: (urls: string[]) => void;
  bucket: Bucket;
  /** Most images allowed. Extra files are ignored with a message. */
  max?: number;
  label: string;
  hints?: UploadHints;
  imagesOnly?: boolean;
  /** Adds a "Set as cover" action to each thumbnail; the parent decides what cover means. */
  onSetCover?: (url: string) => void;
  /** Highlights the current cover. */
  coverUrl?: string | null;
  disabled?: boolean;
  maxDimension?: number;
  description?: string;
}

/* ---- tiny spring helper: every tile keeps its own x/y/scale and re-targets from where it is now ---- */
interface Pose {
  x: number;
  y: number;
  s: number;
  stop?: () => void;
}
const poses = new WeakMap<HTMLElement, Pose>();
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const paint = (el: HTMLElement, p: Pose) => {
  el.style.transform = p.x || p.y || p.s !== 1 ? `translate3d(${p.x}px,${p.y}px,0) scale(${p.s})` : "";
};
function setPose(el: HTMLElement, to: { x: number; y: number; s?: number }) {
  const p = poses.get(el) ?? { x: 0, y: 0, s: 1 };
  p.stop?.();
  p.x = to.x;
  p.y = to.y;
  p.s = to.s ?? p.s;
  p.stop = undefined;
  poses.set(el, p);
  paint(el, p);
}
function springTo(el: HTMLElement, to: { x: number; y: number; s?: number }, onDone?: () => void) {
  if (reduced()) {
    setPose(el, to);
    onDone?.();
    return;
  }
  const p = poses.get(el) ?? { x: 0, y: 0, s: 1 };
  p.stop?.();
  const from = { x: p.x, y: p.y, s: p.s };
  const goal = { x: to.x, y: to.y, s: to.s ?? p.s };
  const ctl = animate(0, 1, {
    type: "spring",
    bounce: 0,
    duration: 0.38,
    onUpdate: (v: number) => {
      p.x = from.x + (goal.x - from.x) * v;
      p.y = from.y + (goal.y - from.y) * v;
      p.s = from.s + (goal.s - from.s) * v;
      paint(el, p);
    },
    onComplete: () => {
      p.x = goal.x;
      p.y = goal.y;
      p.s = goal.s;
      p.stop = undefined;
      paint(el, p);
      onDone?.();
    },
  });
  p.stop = () => ctl.stop();
  poses.set(el, p);
}
const clearPose = (el: HTMLElement) => {
  poses.get(el)?.stop?.();
  poses.delete(el);
  el.style.transform = "";
};
const rubber = (over: number, dim: number) => (over * dim * 0.55) / (dim + 0.55 * Math.abs(over));

interface DragState {
  key: string;
  from: number;
  to: number;
  sx: number;
  sy: number;
  rects: DOMRect[];
  box: DOMRect;
  keys: string[];
  urls: string[];
  active: boolean;
  timer?: number;
  touch: boolean;
  settling?: boolean;
}

export function ImageListField({ value, onChange, bucket, max, label, hints, imagesOnly = true, onSetCover, coverUrl, disabled, maxDimension, description }: ImageListFieldProps) {
  const t = useTranslations("adminMedia");
  const locale = useLocale();
  const id = useId();
  const [picking, setPicking] = useState(false);
  /** Index of the picture being replaced (its picker is open). */
  const [replacing, setReplacing] = useState<number | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const hintLine = useHintText(hints);

  const drag = useRef<DragState | null>(null);
  /** A drag ends with a click on the same tile; that click must not open the picker. */
  const suppressClick = useRef(false);
  /** After a move the moved tile keeps keyboard focus (its old button may be gone). */
  const pendingFocus = useRef<string | null>(null);
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  });

  /* stable per-item keys (the same URL may appear twice) */
  const keys = useMemo(() => {
    const seen = new Map<string, number>();
    return value.map((u) => {
      const n = (seen.get(u) ?? 0) + 1;
      seen.set(u, n);
      return `${u}#${n}`;
    });
  }, [value]);
  const keysRef = useRef(keys);
  useEffect(() => {
    keysRef.current = keys;
  });

  const room = max === undefined ? Infinity : Math.max(0, max - value.length);
  const append = useCallback(
    (urls: string[]) => {
      if (!urls.length) return;
      const cur = latest.current;
      const space = max === undefined ? urls.length : Math.max(0, max - cur.length);
      const take = urls.slice(0, space);
      if (take.length < urls.length) toast({ kind: "info", text: t("list.maxReached", { max: max ?? 0 }) });
      if (take.length) {
        latest.current = [...cur, ...take];
        onChange(latest.current);
        setAnnounce(t("list.added", { count: take.length }));
      }
    },
    [max, onChange, t],
  );

  const uploader = useUploader({ bucket, imagesOnly, maxDimension, hints });
  const { clearFinished } = uploader;
  const addFiles = useCallback(
    async (files: File[]) => {
      if (disabled) return;
      if (room === 0) {
        toast({ kind: "info", text: t("list.maxReached", { max: max ?? 0 }) });
        return;
      }
      const urls = await uploader.upload(files.slice(0, Number.isFinite(room) ? room : files.length));
      append(urls);
    },
    [append, disabled, max, room, t, uploader],
  );
  const { over, props: drop } = useFileDrop((f) => void addFiles(f), disabled);

  // Uploads that finished cleanly leave the queue.
  const { items: upItems } = uploader;
  useEffect(() => {
    if (!upItems.some((i) => i.state === "done" && !i.warnings.length)) return;
    const timer = window.setTimeout(() => clearFinished(), 900);
    return () => window.clearTimeout(timer);
  }, [upItems, clearFinished]);

  /* ---------- layout animation for non-drag changes (remove, move first, keyboard) ---------- */
  const listRef = useRef<HTMLUListElement>(null);
  const els = useRef(new Map<string, HTMLElement>());
  const prevPos = useRef(new Map<string, { l: number; t: number }>());
  const skipFlip = useRef(false);
  useLayoutEffect(() => {
    const next = new Map<string, { l: number; t: number }>();
    els.current.forEach((el, k) => next.set(k, { l: el.offsetLeft, t: el.offsetTop }));
    if (!skipFlip.current && !drag.current) {
      next.forEach((pos, k) => {
        const old = prevPos.current.get(k);
        const el = els.current.get(k);
        if (old && el && (old.l !== pos.l || old.t !== pos.t)) {
          setPose(el, { x: old.l - pos.l, y: old.t - pos.t });
          springTo(el, { x: 0, y: 0 });
        }
      });
    }
    skipFlip.current = false;
    prevPos.current = next;
    const f = pendingFocus.current;
    if (f) {
      pendingFocus.current = null;
      els.current.get(f)?.querySelector<HTMLElement>(".adm-ili-grab")?.focus({ preventScroll: false });
    }
  });

  /* ---------- pointer drag ---------- */
  const layoutOthers = useCallback((d: DragState) => {
    d.keys.forEach((k, i) => {
      if (i === d.from) return;
      const el = els.current.get(k);
      if (!el) return;
      let p = i;
      if (d.from < d.to && i > d.from && i <= d.to) p = i - 1;
      else if (d.to < d.from && i >= d.to && i < d.from) p = i + 1;
      springTo(el, { x: d.rects[p].left - d.rects[i].left, y: d.rects[p].top - d.rects[i].top });
    });
  }, []);

  const begin = useCallback((d: DragState) => {
    d.active = true;
    suppressClick.current = true;
    const list = listRef.current;
    d.box = list ? list.getBoundingClientRect() : d.box;
    d.rects = d.keys.map((k) => els.current.get(k)!.getBoundingClientRect());
    setDragKey(d.key);
    const el = els.current.get(d.key);
    if (el) setPose(el, { x: 0, y: 0, s: 1.04 });
  }, []);

  const onTouchMove = useRef((e: TouchEvent) => {
    if (drag.current?.active) e.preventDefault();
  });
  useEffect(() => {
    const h = onTouchMove.current;
    window.addEventListener("touchmove", h, { passive: false });
    return () => window.removeEventListener("touchmove", h);
  }, []);

  /** Order changes apply at once; this is the safety net (the same Undo that removing a picture has). */
  const orderToast = useCallback(
    (before: string[]) => {
      toast({
        text: t("list.orderToast"),
        undo: () => {
          latest.current = before;
          onChange(before);
          setAnnounce(t("list.restored"));
        },
      });
    },
    [onChange, t],
  );

  const finish = useCallback(
    (commit: boolean) => {
      const d = drag.current;
      if (!d) return;
      window.clearTimeout(d.timer);
      if (!d.active) {
        drag.current = null;
        return;
      }
      if (d.settling) return;
      d.settling = true;
      const el = els.current.get(d.key);
      const to = commit ? d.to : d.from;
      const done = () => {
        const next = d.urls.slice();
        const [moved] = next.splice(d.from, 1);
        next.splice(to, 0, moved);
        skipFlip.current = true;
        if (to !== d.from) {
          latest.current = next;
          flushSync(() => onChange(next));
        }
        els.current.forEach((e2) => clearPose(e2));
        drag.current = null;
        setDragKey(null);
        if (to !== d.from) {
          setAnnounce(t("list.dropped", { position: to + 1, total: next.length }));
          orderToast(d.urls);
        }
      };
      if (!el) return done();
      if (!commit) {
        d.to = d.from;
        layoutOthers(d);
      }
      springTo(el, { x: d.rects[to].left - d.rects[d.from].left, y: d.rects[to].top - d.rects[d.from].top, s: 1 }, done);
    },
    [layoutOthers, onChange, t, orderToast],
  );

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>, index: number) => {
    if (disabled || e.button !== 0 || drag.current) return;
    suppressClick.current = false;
    const key = keys[index];
    const d: DragState = {
      key,
      from: index,
      to: index,
      sx: e.clientX,
      sy: e.clientY,
      rects: [],
      box: new DOMRect(),
      keys: keys.slice(),
      urls: value.slice(),
      active: false,
      touch: e.pointerType === "touch",
    };
    drag.current = d;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (d.touch) d.timer = window.setTimeout(() => begin(d), 220);
  };

  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || e.currentTarget !== els.current.get(d.key)?.querySelector(".adm-ili-grab")) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.active) {
      const dist = Math.hypot(dx, dy);
      if (d.touch) {
        if (dist > 10) {
          window.clearTimeout(d.timer);
          drag.current = null; // it is a scroll
        }
        return;
      }
      if (dist < 5) return;
      begin(d);
    }
    const el = els.current.get(d.key)!;
    // 1:1 with the pointer (grab offset kept by using deltas), with rubber-band outside the field.
    const r0 = d.rects[d.from];
    let x = dx;
    let y = dy;
    const pad = 12;
    const left = r0.left + dx - (d.box.left - pad);
    const right = d.box.right + pad - (r0.right + dx);
    const top = r0.top + dy - (d.box.top - pad);
    const bottom = d.box.bottom + pad - (r0.bottom + dy);
    if (left < 0) x = dx - left + rubber(left, r0.width);
    if (right < 0) x = dx + right - rubber(right, r0.width);
    if (top < 0) y = dy - top + rubber(top, r0.height);
    if (bottom < 0) y = dy + bottom - rubber(bottom, r0.height);
    setPose(el, { x, y, s: 1.04 });

    const cx = r0.left + r0.width / 2 + x;
    const cy = r0.top + r0.height / 2 + y;
    let best = d.to;
    let bestD = Infinity;
    d.rects.forEach((r, i) => {
      const dist = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
      if (dist < bestD) {
        bestD = dist;
        best = i;
      }
    });
    if (best !== d.to) {
      d.to = best;
      layoutOthers(d);
      setAnnounce(t("list.overPosition", { position: best + 1, total: d.keys.length }));
    }
  };

  /* ---------- keyboard ---------- */
  const columns = () => {
    const list = listRef.current;
    if (!list) return 1;
    const tiles = Array.from(list.querySelectorAll<HTMLElement>(".adm-ili"));
    if (!tiles.length) return 1;
    const top = tiles[0].offsetTop;
    return Math.max(1, tiles.filter((x) => x.offsetTop === top).length);
  };
  const moveTo = (from: number, to: number, notice = false) => {
    const before = value.slice();
    const next = value.slice();
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    latest.current = next;
    pendingFocus.current = keys[from];
    onChange(next);
    setAnnounce(t("list.moved", { position: to + 1, total: next.length }));
    if (notice) orderToast(before);
  };
  const origOrder = useRef<string[] | null>(null);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    const key = keys[index];
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (lifted === key) {
        setLifted(null);
        const before = origOrder.current;
        origOrder.current = null;
        setAnnounce(t("list.dropped", { position: index + 1, total: value.length }));
        if (before && before.some((u, i) => u !== value[i])) orderToast(before);
      } else {
        origOrder.current = value.slice();
        setLifted(key);
        setAnnounce(t("list.grabbed", { position: index + 1, total: value.length }));
      }
      return;
    }
    if (lifted !== key) return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (origOrder.current) {
        latest.current = origOrder.current;
        onChange(origOrder.current);
      }
      origOrder.current = null;
      setLifted(null);
      setAnnounce(t("list.cancelled"));
      return;
    }
    const rtl = document.dir === "rtl";
    const step: Record<string, number> = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1, ArrowUp: -columns(), ArrowDown: columns() };
    if (e.key === "Home") step.Home = -index;
    if (e.key === "End") step.End = value.length - 1 - index;
    const s = step[e.key];
    if (s === undefined) return;
    e.preventDefault();
    const to = Math.min(value.length - 1, Math.max(0, index + s));
    if (to !== index) moveTo(index, to);
  };

  /* ---------- remove with Undo ---------- */
  const removeAt = (index: number) => {
    const url = value[index];
    const next = value.filter((_, i) => i !== index);
    latest.current = next;
    onChange(next);
    setAnnounce(t("list.removed", { count: next.length }));
    toast({
      text: t("list.removedToast"),
      undo: () => {
        const cur = latest.current.slice();
        cur.splice(Math.min(index, cur.length), 0, url);
        latest.current = cur;
        onChange(cur);
        setAnnounce(t("list.restored"));
      },
    });
  };

  /** Swaps one picture for another; it keeps its place in the list. */
  const replaceAt = (index: number, url: string) => {
    const old = latest.current[index];
    if (old === undefined || old === url) return;
    const next = latest.current.slice();
    next[index] = url;
    latest.current = next;
    onChange(next);
    setAnnounce(t("list.replacedAnnounce", { position: index + 1 }));
    toast({
      text: t("list.replacedToast", { position: index + 1 }),
      undo: () => {
        const cur = latest.current.slice();
        if (cur[index] !== url) return;
        cur[index] = old;
        latest.current = cur;
        onChange(cur);
        setAnnounce(t("list.restored"));
      },
    });
  };

  const activeUploads = uploader.items.filter((i) => i.state === "queued" || i.state === "compressing" || i.state === "uploading");
  const problems = { ...uploader, items: uploader.items.filter((i) => i.state === "error" || i.state === "canceled" || (i.state === "done" && i.warnings.length)) };
  const countText = max !== undefined ? t("list.countOf", { count: value.length, max: max }) : t("list.count", { count: value.length });

  return (
    <div className="adm-il lbf-field" data-over={over ? "true" : "false"} {...drop}>
      <MediaStyles />
      <div className="adm-il-head">
        <div>
          <span className="lbf-label" id={`${id}-label`}>
            {label}
          </span>
          <span className="adm-il-count" aria-live="polite">
            {countText}
          </span>
        </div>
        <button type="button" className="adm-btn" onClick={() => setPicking(true)} disabled={disabled || room === 0}>
          <PlusIcon /> {t("list.add")}
        </button>
      </div>
      {description && <span className="lbf-hint">{description}</span>}

      {value.length === 0 && activeUploads.length === 0 ? (
        <button type="button" className="adm-zone adm-zone-wide" data-over={over ? "true" : "false"} onClick={() => setPicking(true)} disabled={disabled} aria-labelledby={`${id}-label`}>
          <PhotoIcon />
          <span className="adm-zone-title">{over ? t("drop.release") : t("list.emptyTitle")}</span>
          <span className="adm-zone-sub">{t("list.emptySub")}</span>
          {hintLine && <span className="adm-zone-hint">{hintLine}</span>}
        </button>
      ) : (
        <>
          <ul ref={listRef} className="adm-ilist" aria-labelledby={`${id}-label`} data-dragging={dragKey ? "true" : "false"}>
            {value.map((url, i) => {
              const key = keys[i];
              const isLifted = lifted === key;
              return (
                <li
                  key={key}
                  className="adm-ili"
                  data-dragging={dragKey === key ? "true" : "false"}
                  data-lifted={isLifted ? "true" : "false"}
                  data-cover={coverUrl === url ? "true" : "false"}
                  ref={(el) => {
                    if (el) els.current.set(key, el);
                    else els.current.delete(key);
                  }}
                >
                  <div className="adm-ili-frame">
                    <button
                      type="button"
                      className="adm-ili-grab"
                      aria-pressed={isLifted}
                      aria-label={t("list.itemLabel", { position: i + 1, total: value.length })}
                      aria-describedby={`${id}-help`}
                      title={t("list.tileTip")}
                      disabled={disabled}
                      onClick={() => {
                        if (suppressClick.current) {
                          suppressClick.current = false;
                          return;
                        }
                        setReplacing(i);
                      }}
                      onPointerDown={(e) => onPointerDown(e, i)}
                      onPointerMove={onPointerMove}
                      onPointerUp={() => finish(true)}
                      onPointerCancel={() => finish(false)}
                      onLostPointerCapture={() => drag.current?.active === true && finish(true)}
                      onKeyDown={(e) => onKey(e, i)}
                      onBlur={() => {
                        if (lifted === key) {
                          setLifted(null);
                          origOrder.current = null;
                        }
                      }}
                      onContextMenu={(e) => drag.current?.touch && e.preventDefault()}
                    >
                      {isVideoUrl(url) ? <video src={`${url}#t=0.1`} muted playsInline preload="metadata" /> : <img src={url} alt="" draggable={false} loading="lazy" decoding="async" />}
                    </button>
                    <span className="adm-ili-n" aria-hidden="true">
                      {formatNumber(i + 1, locale)}
                    </span>
                    {coverUrl === url && <span className="adm-ili-cover">{t("list.cover")}</span>}
                  </div>
                  <div className="adm-ili-acts">
                    <div className="adm-ili-row">
                      <button type="button" className="adm-ili-act" data-main="true" onClick={() => setReplacing(i)} disabled={disabled}>
                        <SwapIcon /> {t("list.replace")}
                        <span className="sr-only"> ({i + 1})</span>
                      </button>
                      <button type="button" className="adm-ili-act adm-ili-rm" onClick={() => removeAt(i)} disabled={disabled} aria-label={t("list.remove", { position: i + 1 })} title={t("list.removeTip")}>
                        <TrashIcon />
                      </button>
                    </div>
                    {(i > 0 || (onSetCover && coverUrl !== url)) && (
                      <div className="adm-ili-row">
                        {i > 0 && (
                          <button type="button" className="adm-ili-act" onClick={() => moveTo(i, 0, true)} disabled={disabled}>
                            {t("list.moveFirst")}
                            <span className="sr-only"> ({i + 1})</span>
                          </button>
                        )}
                        {onSetCover && coverUrl !== url && (
                          <button type="button" className="adm-ili-act" onClick={() => onSetCover(url)} disabled={disabled}>
                            {t("list.setCover")}
                            <span className="sr-only"> ({i + 1})</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {activeUploads.map((u) => (
              <li key={`up-${u.id}`} className="adm-ili adm-ili-up" aria-label={u.name}>
                <div className="adm-ili-frame">
                  <span className="adm-ili-grab" aria-hidden="true">
                    {u.preview && !u.video ? <img src={u.preview} alt="" /> : <PhotoIcon />}
                  </span>
                  <span className="adm-ili-bar" role="progressbar" aria-label={u.name} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.progress * 100)}>
                    <span style={{ transform: `scaleX(${u.progress})` }} />
                  </span>
                  <button type="button" className="adm-ili-x" onClick={() => uploader.cancel(u.id)} aria-label={`${t("upload.cancel")}: ${u.name}`}>
                    <CloseIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="lbf-hint adm-il-help" id={`${id}-help`}>
            {t("list.help")}
          </p>
        </>
      )}
      <UploadQueue uploader={problems} compact />

      {over && (
        <div className="adm-drop-veil adm-drop-veil-soft" aria-hidden="true">
          <PhotoIcon />
          <span>{t("drop.many")}</span>
        </div>
      )}
      <span className="sr-only" role="status" aria-live="assertive">
        {announce}
      </span>

      {replacing !== null && (
        <ImagePicker
          bucket={bucket}
          imagesOnly={imagesOnly}
          hints={hints}
          maxDimension={maxDimension}
          title={t("list.replaceTitle", { position: replacing + 1 })}
          onClose={() => setReplacing(null)}
          onPick={(urls) => {
            const at = replacing;
            setReplacing(null);
            if (urls[0]) replaceAt(at, urls[0]);
          }}
        />
      )}
      {picking && (
        <ImagePicker
          bucket={bucket}
          multiple
          imagesOnly={imagesOnly}
          hints={hints}
          maxDimension={maxDimension}
          title={t("list.pickTitle", { label })}
          onClose={() => setPicking(false)}
          onPick={(urls) => {
            setPicking(false);
            append(urls);
          }}
        />
      )}
    </div>
  );
}
