"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { MediaStyles } from "./MediaStyles";

/**
 * Toast stack for the admin. A module-level store, so any component can call `toast()` without a
 * provider; <ToastStack /> (rendered once by NoticeLine) shows them bottom-center.
 *
 *   toast({ text: "Photo removed", undo: () => restore() })   // 8 s, with Undo
 *   toast({ kind: "error", text: "Upload failed" })           // stays until dismissed
 */
export interface ToastInput {
  kind?: "ok" | "error" | "info";
  text: string;
  /** Shows an Undo button. Called at most once; the toast closes. */
  undo?: () => void;
  /** Label of the action button (default "Undo"). */
  actionLabel?: string;
  /** ms before it closes by itself. 0 = stay. Default: errors 0, undo 8000, others 5000. */
  duration?: number;
  /** Called when the toast goes away WITHOUT undo (timeout or dismissed). */
  onExpire?: () => void;
}
export interface Toast extends Required<Pick<ToastInput, "kind" | "text" | "duration">> {
  id: number;
  undo?: () => void;
  actionLabel?: string;
  onExpire?: () => void;
}

const MAX_VISIBLE = 4;
let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(input: ToastInput): number {
  const kind = input.kind ?? "ok";
  const duration = input.duration ?? (kind === "error" ? 0 : input.undo ? 8000 : 5000);
  const id = ++seq;
  toasts = [...toasts, { id, kind, text: input.text, duration, undo: input.undo, actionLabel: input.actionLabel, onExpire: input.onExpire }];
  // Overflow expires the oldest quietly (their onExpire still runs: a pending delete must commit).
  while (toasts.length > MAX_VISIBLE) dismissToast(toasts[0].id);
  emit();
  return id;
}

/** Closes a toast as "expired" (no undo). */
export function dismissToast(id: number) {
  const t = toasts.find((x) => x.id === id);
  if (!t) return;
  toasts = toasts.filter((x) => x.id !== id);
  emit();
  t.onExpire?.();
}

function undoToast(id: number) {
  const t = toasts.find((x) => x.id === id);
  if (!t) return;
  toasts = toasts.filter((x) => x.id !== id);
  emit();
  t.undo?.();
}

export function clearToasts() {
  for (const t of [...toasts]) dismissToast(t.id);
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
const EMPTY: Toast[] = [];

export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
}

function ToastItem({ item }: { item: Toast }) {
  const t = useTranslations("adminMedia");
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!item.duration || paused) return;
    startedAt.current = performance.now();
    const timer = window.setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(800, remaining.current - (performance.now() - startedAt.current));
    };
  }, [item.id, item.duration, paused]);

  return (
    <li
      className="adm-toast"
      data-kind={item.kind}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
      }}
      role={item.kind === "error" ? "alert" : "status"}
    >
      <span className="adm-toast-text">{item.text}</span>
      {item.undo && (
        <button type="button" className="adm-toast-btn" onClick={() => undoToast(item.id)}>
          {item.actionLabel ?? t("toast.undo")}
        </button>
      )}
      <button type="button" className="adm-toast-x" onClick={() => dismissToast(item.id)} aria-label={t("toast.dismiss")}>
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}

export function ToastStack() {
  const list = useToasts();
  const t = useTranslations("adminMedia");
  // A modal dialog makes everything outside it inert, so while one is open the stack renders inside it.
  const [host, setHost] = useState<Element | null>(null);
  useEffect(() => {
    const find = () => {
      const open = document.querySelectorAll("dialog[open]");
      const top = open.length ? open[open.length - 1] : null;
      setHost((cur) => (cur === top ? cur : top));
    };
    find();
    // Only dialog opens/closes/insertions/removals matter; ignore the rest of the page's churn and coalesce per frame.
    const isDialogy = (n: Node) => n.nodeType === 1 && ((n as Element).nodeName === "DIALOG" || !!(n as Element).querySelector?.("dialog"));
    let raf = 0;
    const mo = new MutationObserver((records) => {
      const relevant = records.some((r) => r.type === "attributes" || [...r.addedNodes, ...r.removedNodes].some(isDialogy));
      if (!relevant || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        find();
      });
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    return () => {
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  // Esc inside the stack closes the newest toast.
  const onKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape" && toasts.length) {
      e.stopPropagation();
      dismissToast(toasts[toasts.length - 1].id);
    }
  }, []);
  const stack = (
    <ol className="adm-toasts" aria-label={t("toast.region")} onKeyDown={onKey} data-empty={list.length === 0 ? "true" : "false"}>
      {list.map((item) => (
        <ToastItem key={item.id} item={item} />
      ))}
    </ol>
  );
  return (
    <>
      <MediaStyles />
      {host ? createPortal(stack, host) : stack}
    </>
  );
}
