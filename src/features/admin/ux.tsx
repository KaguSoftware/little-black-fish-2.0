"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ConfirmSheet } from "./MediaDialog";
import { Icon, type IconName } from "./icons-ux";

/* ---------- Confirmation: one sheet for every irreversible action ---------- */

export interface ConfirmOptions {
  title: string;
  /** Names the consequence in plain words. */
  body: ReactNode;
  confirm: string;
  cancel?: string;
}

/** `const { ask, sheet } = useConfirm()`; render `{sheet}`; `if (await ask({...})) …`. Replaces window.confirm. */
export function useConfirm() {
  const t = useTranslations("admin");
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const done = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const sheet = state ? (
    <ConfirmSheet
      title={state.title}
      confirmLabel={state.confirm}
      cancelLabel={state.cancel ?? t("keepEditing")}
      onConfirm={() => done(true)}
      onCancel={() => done(false)}
    >
      {state.body}
    </ConfirmSheet>
  ) : null;
  return { ask, sheet };
}

/* ---------- Save bar: the one explicit-save pattern ---------- */

/**
 * Sticky bar for forms that save explicitly: "Unsaved changes" + Discard + Save. After a save it
 * flips to "All changes saved" for a moment (completion feedback) and leaves. Ctrl/Cmd+S saves
 * while `active`.
 */
export function SaveBar({
  dirty,
  saving,
  savedAt,
  summary,
  saveLabel,
  onSave,
  onDiscard,
  active = true,
  label,
}: {
  dirty: boolean;
  saving: boolean;
  /** Changes whenever a save completes; flashes the "Saved" state. */
  savedAt?: number;
  summary: string;
  saveLabel: string;
  onSave: () => void;
  onDiscard: () => void;
  active?: boolean;
  label: string;
}) {
  const t = useTranslations("admin");
  const [flash, setFlash] = useState(false);
  const [seenAt, setSeenAt] = useState(0);
  // A new completed save shows the "saved" state (set during render, not in an effect).
  if (savedAt && savedAt !== seenAt) {
    setSeenAt(savedAt);
    setFlash(true);
  }
  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(false), 2400);
    return () => window.clearTimeout(id);
  }, [flash, seenAt]);

  useEffect(() => {
    if (!active || !dirty) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!saving) onSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, dirty, saving, onSave]);

  if (!active || (!dirty && !flash)) return null;
  const showSaved = !dirty && flash;
  return (
    <div className="ux-bar" role="region" aria-label={label} data-state={showSaved ? "saved" : saving ? "saving" : "dirty"}>
      <p className="ux-bar-text" role="status">
        {showSaved ? (
          <>
            <Icon name="check" className="ux-bar-ico" />
            {t("savedAll")}
          </>
        ) : (
          <>
            <span className="ux-bar-dot" aria-hidden="true" />
            <strong>{saving ? t("saving") : t("unsavedChanges")}</strong>
            <span className="ux-bar-sum">{summary}</span>
          </>
        )}
      </p>
      {!showSaved && (
        <div className="ux-bar-acts">
          <button type="button" className="ux-btn" onClick={onDiscard} disabled={saving}>
            {t("discard")}
          </button>
          <button type="button" className="ux-btn" data-primary="true" onClick={onSave} disabled={saving} aria-busy={saving}>
            {saving ? t("saving") : saveLabel}
            <kbd className="ux-kbd" aria-hidden="true">
              {t("kbdSave")}
            </kbd>
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Switch: instant-apply on/off ---------- */

export function Switch({
  on,
  onChange,
  label,
  onText,
  offText,
  busy,
  disabled,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
  onText: string;
  offText: string;
  busy?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className="ux-switch"
      onClick={() => onChange(!on)}
      disabled={disabled}
      aria-busy={busy}
    >
      <span className="ux-switch-track" aria-hidden="true">
        <span className="ux-switch-thumb" />
      </span>
      <span className="ux-switch-text" aria-hidden="true">
        {on ? onText : offText}
      </span>
    </button>
  );
}

/* ---------- Empty state: one sentence and one button ---------- */

export function EmptyState({ icon, title, text, action }: { icon?: IconName; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="ux-empty">
      {icon && (
        <span className="ux-empty-ico" aria-hidden="true">
          <Icon name={icon} />
        </span>
      )}
      <p className="ux-empty-title">{title}</p>
      <p className="ux-empty-text">{text}</p>
      {action}
    </div>
  );
}
