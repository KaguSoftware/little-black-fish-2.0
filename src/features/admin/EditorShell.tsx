"use client";

import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";

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

/** The inline editor frame: focusable heading, form body, a foot with Cancel + a Redaction CTA. */
export function EditorShell({ title, submitLabel, saving, error, dirty, onCancel, onSubmit, footStart, children }: Props) {
  const t = useTranslations("admin");
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = heading.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const top = el.getBoundingClientRect().top;
    if (top < 64 || top > window.innerHeight * 0.6) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    }
  }, []);

  const cancel = () => {
    if (dirty && !window.confirm(t("discardChanges"))) return;
    onCancel();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!saving) onSubmit();
  };

  return (
    <section
      aria-labelledby={headingId}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          cancel();
        }
      }}
    >
      <div className="adm-editor-head">
        <h3 className="adm-editor-title" id={headingId} ref={heading} tabIndex={-1} style={{ scrollMarginTop: "6rem" }}>
          {title}
        </h3>
        <button type="button" className="lbf-textbtn" onClick={cancel}>
          {t("close")}
        </button>
      </div>
      <form className="adm-form" onSubmit={submit} noValidate>
        {children}
        <div className="adm-form-foot">
          {footStart}
          <div className="adm-form-foot-acts">
            <button type="button" className="lbf-textbtn" onClick={cancel} disabled={saving}>
              {t("cancel")}
            </button>
            <button type="submit" className="lbf-cta" disabled={saving}>
              <span>{saving ? t("saving") : submitLabel}</span>
            </button>
          </div>
        </div>
        <p className="lbf-error" role="alert">
          {error}
        </p>
      </form>
    </section>
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
