"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { changePassword } from "@/shared/actions/admin/auth";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/shared/actions/admin/password";
import { TextField } from "./forms";

const KNOWN = new Set(["wrongCurrent", "tooShort", "tooLong", "same", "mismatch"]);

/** Change-your-own-password form for the Account section. */
export function PasswordForm() {
  const t = useTranslations("admin.account.password");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ field: "current" | "next" | "confirm" | "form"; text: string } | null>(null);
  const [done, setDone] = useState(false);

  const fieldOf = (code: string) =>
    code === "wrongCurrent" ? "current" : code === "mismatch" ? "confirm" : KNOWN.has(code) ? "next" : "form";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    setDone(false);
    setPending(true);
    try {
      const res = await changePassword(current, next, confirm);
      if (res.success) {
        setCurrent("");
        setNext("");
        setConfirm("");
        setDone(true);
      } else {
        setError({
          field: fieldOf(res.error),
          text: KNOWN.has(res.error) ? t(`errors.${res.error}`, { min: PASSWORD_MIN, max: PASSWORD_MAX }) : res.error,
        });
      }
    } catch {
      setError({ field: "form", text: t("errors.failed") });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="adm-pw" onSubmit={onSubmit} aria-busy={pending}>
      <h3 className="adm-group-h">{t("title")}</h3>
      <p className="adm-hint-line">{t("hint", { min: PASSWORD_MIN })}</p>
      <TextField
        label={t("current")}
        type="password"
        autoComplete="current-password"
        dir="ltr"
        required
        value={current}
        onChange={setCurrent}
        error={error?.field === "current" ? error.text : undefined}
      />
      <TextField
        label={t("new")}
        type="password"
        autoComplete="new-password"
        dir="ltr"
        required
        value={next}
        onChange={setNext}
        hint={t("rules", { min: PASSWORD_MIN })}
        error={error?.field === "next" ? error.text : undefined}
      />
      <TextField
        label={t("confirm")}
        type="password"
        autoComplete="new-password"
        dir="ltr"
        required
        value={confirm}
        onChange={setConfirm}
        error={error?.field === "confirm" ? error.text : undefined}
      />
      {error?.field === "form" && (
        <p role="alert" className="adm-pw-msg" data-kind="error">
          {error.text}
        </p>
      )}
      {done && (
        <p role="status" className="adm-pw-msg" data-kind="ok">
          {t("done")}
        </p>
      )}
      <button type="submit" className="lbf-cta" disabled={pending || !current || !next || !confirm}>
        <span>{pending ? t("saving") : t("submit")}</span>
      </button>
    </form>
  );
}
