"use client";

import { createContext, useContext, useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { CloseIcon } from "./media-lib";
import { useConfirm } from "./ux";

/** A collection panel provides this so any open editor can report unsaved edits upward. */
export const EditorDirtyContext = createContext<(dirty: boolean) => void>(() => {});

interface Props {
  title: string;
  submitLabel: string;
  saving: boolean;
  error: string | null;
  dirty: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  footStart?: ReactNode;
  children: ReactNode;
}

/**
 * The editor frame, shown as a modal dialog. Close is always the X at the top end; Cancel and the
 * filled Save are always at the bottom end. Closing with edits asks first and says what is lost.
 */
export function EditorShell({ title, submitLabel, saving, error, dirty, onCancel, onSubmit, footStart, children }: Props) {
  const t = useTranslations("admin");
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const reportDirty = useContext(EditorDirtyContext);
  useEffect(() => {
    reportDirty(dirty);
    return () => reportDirty(false);
  }, [dirty, reportDirty]);

  const dialog = useRef<HTMLDialogElement>(null);
  // Mounting the editor opens the modal (the list unmounts it to close it).
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (!d.open) d.showModal();
    heading.current?.focus({ preventScroll: true });
  }, []);

  /** A press that STARTED on the backdrop: a text selection dragged out of the box must not close it. */
  const downOnBackdrop = useRef(false);

  const { ask, sheet } = useConfirm();
  const cancel = async () => {
    if (dirty) {
      const discard = await ask({
        title: t("discardTitle"),
        body: <p>{t("discardBody", { title })}</p>,
        confirm: t("discardChangesBtn"),
        cancel: t("keepEditing"),
      });
      if (!discard) return;
    }
    onCancel();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saving) onSubmit();
  };

  return (
    <>
      <dialog
        ref={dialog}
        className="adm-modal"
        aria-labelledby={headingId}
        onCancel={(e) => {
          // Esc: route through the same unsaved-changes check as Close.
          e.preventDefault();
          if (!saving) void cancel();
        }}
        onPointerDown={(e) => {
          downOnBackdrop.current = e.target === dialog.current;
        }}
        onClick={(e) => {
          if (e.target === dialog.current && downOnBackdrop.current && !saving) void cancel();
          downOnBackdrop.current = false;
        }}
      >
        <div className="adm-editor-head">
          <h3 className="adm-editor-title" id={headingId} ref={heading} tabIndex={-1}>
            {title}
          </h3>
          <button type="button" className="ux-x" onClick={() => void cancel()} aria-label={t("close")} title={t("close")}>
            <CloseIcon />
          </button>
        </div>
        <form
          className="adm-form"
          onSubmit={submit}
          noValidate
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (!saving) onSubmit();
            }
          }}
        >
          <div className="adm-form-body">{children}</div>
          <div className="adm-form-foot">
            {footStart}
            {dirty && !saving && (
              <span className="ux-foot-dirty" role="status">
                <span className="ux-bar-dot" aria-hidden="true" />
                {t("unsavedChanges")}
              </span>
            )}
            <div className="adm-form-foot-acts">
              <button type="button" className="ux-btn" onClick={() => void cancel()} disabled={saving}>
                {t("cancel")}
              </button>
              <button type="submit" className="ux-btn" data-primary="true" disabled={saving} aria-busy={saving}>
                {saving ? t("saving") : submitLabel}
                <kbd className="ux-kbd" aria-hidden="true">
                  {t("kbdEnter")}
                </kbd>
              </button>
            </div>
            <p className="lbf-error adm-form-error" role="alert">
              {error}
            </p>
          </div>
        </form>
      </dialog>
      {sheet}
    </>
  );
}

/** Field helper: label + control + hint + error, with ids wired up. */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}) {
  const t = useTranslations("admin");
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="lbf-field">
      <label className="lbf-label" htmlFor={id}>
        {label}
        {required && <span className="adm-req"> ({t("required")})</span>}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {hint && (
        <span className="lbf-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="lbf-error" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  );
}
