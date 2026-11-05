"use client";

import { useId, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/shared/actions/admin/password";
import { Field } from "./EditorShell";
import { useAdminActions } from "./actions-seam";
import { Icon } from "./icons-ux";

const KNOWN = new Set(["wrongCurrent", "tooShort", "tooLong", "same", "mismatch"]);

/** 0 (empty) to 4: length first, then a mix of letters, digits and symbols. */
function strength(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  let s = 0;
  if (p.length >= PASSWORD_MIN) s++;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  else if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s += p.length >= 12 ? 1 : 0;
  return Math.max(1, Math.min(4, s)) as 1 | 2 | 3 | 4;
}

/** A password input with a Show/Hide button that sits inside the field, at its end. */
function PasswordInput({
  id,
  describedBy,
  invalid,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  describedBy?: string;
  invalid: boolean;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const t = useTranslations("admin.account.password");
  const [shown, setShown] = useState(false);
  return (
    <div className="ux-pwfield">
      <input
        id={id}
        className="lbf-input"
        type={shown ? "text" : "password"}
        dir="ltr"
        value={value}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        aria-required
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="button" className="ux-pwtoggle" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-controls={id}>
        <Icon name={shown ? "eyeoff" : "eye"} />
        <span>{shown ? t("hide") : t("show")}</span>
      </button>
    </div>
  );
}

/** Change-your-own-password form for My account. */
export function PasswordForm() {
  const t = useTranslations("admin.account.password");
  const actions = useAdminActions();
  const meterId = useId();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ field: "current" | "next" | "confirm" | "form"; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const fieldOf = (code: string) => (code === "wrongCurrent" ? "current" : code === "mismatch" ? "confirm" : KNOWN.has(code) ? "next" : "form");

  // Checked as they type, so the button only wakes up when the form can succeed.
  const liveNext =
    next && next.length < PASSWORD_MIN
      ? t("errors.tooShort", { min: PASSWORD_MIN })
      : next.length > PASSWORD_MAX
        ? t("errors.tooLong", { max: PASSWORD_MAX })
        : next && current && next === current
          ? t("errors.same")
          : undefined;
  const liveConfirm = confirm && next && confirm !== next ? t("errors.mismatch") : undefined;
  const valid = !!current && !!next && !!confirm && !liveNext && !liveConfirm;
  const score = strength(next);

  const edit = (set: (v: string) => void) => (v: string) => {
    set(v);
    setError(null);
    setDone(false);
  };

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || !valid) return;
    setError(null);
    setDone(false);
    setPending(true);
    try {
      const res = await actions.changePassword(current, next, confirm);
      if (res.success) {
        setCurrent("");
        setNext("");
        setConfirm("");
        setDone(true);
      } else {
        setError({
          field: fieldOf(res.error),
          text: KNOWN.has(res.error) ? t(`errors.${res.error}`, { min: PASSWORD_MIN, max: PASSWORD_MAX }) : t("errors.failed"),
        });
      }
    } catch {
      setError({ field: "form", text: t("errors.failed") });
    } finally {
      setPending(false);
    }
  }

  const fieldErr = (f: "current" | "next" | "confirm", live?: string) => (error?.field === f ? error.text : live);

  return (
    <form className="adm-pw" onSubmit={onSubmit} aria-busy={pending} noValidate>
      <h3 className="adm-group-h">{t("title")}</h3>
      <p className="adm-hint-line ux-pw-intro">{t("hint", { min: PASSWORD_MIN })}</p>
      {done && (
        <p role="status" className="ux-pw-done">
          <Icon name="check" />
          {t("done")}
        </p>
      )}
      <Field label={t("current")} required error={fieldErr("current")}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} describedBy={describedBy} invalid={invalid} value={current} onChange={edit(setCurrent)} autoComplete="current-password" />
        )}
      </Field>
      <Field label={t("new")} required hint={fieldErr("next", liveNext) ? undefined : t("rules", { min: PASSWORD_MIN })} error={fieldErr("next", liveNext)}>
        {({ id, describedBy, invalid }) => (
          <>
            <PasswordInput id={id} describedBy={[describedBy, meterId].filter(Boolean).join(" ")} invalid={invalid} value={next} onChange={edit(setNext)} autoComplete="new-password" />
            <div className="ux-meter" id={meterId} data-score={score} aria-live="polite">
              <span className="ux-meter-bars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="ux-meter-text">{score === 0 ? t("strength.idle") : t(`strength.${score}`)}</span>
            </div>
          </>
        )}
      </Field>
      <Field label={t("confirm")} required error={fieldErr("confirm", liveConfirm)}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} describedBy={describedBy} invalid={invalid} value={confirm} onChange={edit(setConfirm)} autoComplete="new-password" />
        )}
      </Field>
      {error?.field === "form" && (
        <p role="alert" className="adm-pw-msg" data-kind="error">
          {error.text}
        </p>
      )}
      <button type="submit" className="ux-btn" data-primary="true" disabled={pending || !valid} aria-busy={pending}>
        {pending ? t("saving") : t("submit")}
      </button>
    </form>
  );
}
