"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MediaStyles } from "./MediaStyles";
import { CloseIcon } from "./media-lib";

/**
 * Modal shell shared by the picker, the file sheet and the confirm sheet. Same conventions as
 * EditorShell: native <dialog>, Esc and backdrop click close it, focus returns to whatever opened
 * it, full-screen sheet on phones. Mount it to open it, unmount it to close it.
 */
export function MediaDialog({
  title,
  onClose,
  children,
  footer,
  size = "wide",
  tone,
  closeLabel,
  describedBy,
  paste,
  tall,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "wide" | "narrow";
  tone?: "danger";
  closeLabel?: string;
  describedBy?: string;
  /** Marks this dialog as the owner of paste events (see usePasteImages). */
  paste?: React.RefObject<HTMLDialogElement | null>;
  /** Keep a steady tall height (tabbed content that would otherwise jump). */
  tall?: boolean;
}) {
  const t = useTranslations("adminMedia");
  const headingId = useId();
  const own = useRef<HTMLDialogElement | null>(null);
  const dialog = paste ?? own;
  const down = useRef(false);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const opener = document.activeElement as HTMLElement | null;
    if (!d.open) d.showModal();
    d.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
    return () => {
      // Leave modal state first (a modal blocks focus elsewhere), then return focus to the opener.
      try {
        if (d.open) d.close();
      } catch {}
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    };
  }, [dialog]);

  return (
    <dialog
      ref={dialog}
      className="adm-modal adm-mdl"
      data-size={size}
      data-tone={tone}
      data-tall={tall ? "true" : undefined}
      aria-labelledby={headingId}
      aria-describedby={describedBy}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onPointerDown={(e) => {
        down.current = e.target === dialog.current;
      }}
      onClick={(e) => {
        if (e.target === dialog.current && down.current) close.current();
        down.current = false;
      }}
    >
      <MediaStyles />
      <div className="adm-editor-head adm-mdl-head">
        <h3 className="adm-editor-title" id={headingId}>
          {title}
        </h3>
        <button type="button" className="adm-mdl-x" onClick={() => close.current()} aria-label={closeLabel ?? t("close")}>
          <CloseIcon />
        </button>
      </div>
      <div className="adm-mdl-body">{children}</div>
      {footer && <div className="adm-mdl-foot">{footer}</div>}
    </dialog>
  );
}

/**
 * The only dialog for irreversible actions. It names what will break (`children`), puts focus on
 * the safe button, and uses a plain verb on the destructive one.
 */
export function ConfirmSheet({
  title,
  children,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <MediaDialog
      title={title}
      size="narrow"
      tone="danger"
      onClose={() => !busy && onCancel()}
      footer={
        <>
          <span className="adm-mdl-foot-note" />
          <div className="adm-mdl-foot-acts">
            <button type="button" className="adm-btn adm-btn-quiet" onClick={onCancel} disabled={busy} data-autofocus>
              {cancelLabel}
            </button>
            <button type="button" className="adm-btn adm-btn-danger" onClick={onConfirm} disabled={busy} aria-busy={busy}>
              {confirmLabel}
            </button>
          </div>
        </>
      }
    >
      <div className="adm-confirm">{children}</div>
    </MediaDialog>
  );
}
