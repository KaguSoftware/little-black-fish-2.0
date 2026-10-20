"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { submitContact, type ContactField, type ContactState } from "@/shared/actions/contact";

const INITIAL: ContactState = {
  status: "idle",
  values: { name: "", email: "", phone: "", message: "" },
  fieldErrors: {},
};

/** Unicode first-strong isolate, so a Latin name or email sits cleanly inside Persian text. */
const isolate = (s: string) => `\u2068${s}\u2069`;

/**
 * The proposal form. Each "round" is a fresh form; sending another message after a
 * success remounts it, which resets the action state.
 */
export function ContactForm() {
  const [round, setRound] = useState(0);
  return <ContactRound key={round} again={round > 0} onAgain={() => setRound((r) => r + 1)} />;
}

function ContactRound({ again, onAgain }: { again: boolean; onAgain: () => void }) {
  const t = useTranslations("contact");
  const [state, formAction, pending] = useActionState(submitContact, INITIAL);
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  // Focus: the first invalid field after a failed send, the confirmation after a good one,
  // and the first field when the visitor chose to send another.
  useEffect(() => {
    if (state.status === "success") doneRef.current?.focus();
    else if (state.status === "invalid") formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);
  useEffect(() => {
    if (again) formRef.current?.querySelector<HTMLElement>("input")?.focus();
  }, [again]);

  if (state.status === "success") {
    return (
      <section className="ct-done ct-rise" aria-labelledby={`${id}-done`}>
        <h2 className="ct-done-h" id={`${id}-done`} ref={doneRef} tabIndex={-1}>
          {t("success.title")}
        </h2>
        <p className="ct-done-p">
          {t("success.body", { name: isolate(state.values.name), email: isolate(state.values.email) })}
        </p>
        <button type="button" className="lbf-textbtn" onClick={onAgain}>
          {t("success.again")}
        </button>
      </section>
    );
  }

  const field = (name: ContactField) => {
    const err = state.fieldErrors[name];
    return {
      id: `${id}-${name}`,
      name,
      required: true,
      defaultValue: state.values[name],
      "aria-invalid": err ? true : undefined,
      "aria-describedby": err ? `${id}-${name}-err` : undefined,
      className: "lbf-input",
    } as const;
  };
  const error = (name: ContactField) => {
    const err = state.fieldErrors[name];
    return err ? (
      <span className="lbf-error" id={`${id}-${name}-err`}>
        {t(`errors.${err}`)}
      </span>
    ) : null;
  };

  return (
    <form ref={formRef} action={formAction} className="ct-form" noValidate aria-label={t("formLabel")}>
      <label className="lbf-field ct-rise" style={{ ["--i" as string]: 2 }}>
        <span className="lbf-label">{t("fields.name")}</span>
        <input {...field("name")} type="text" autoComplete="name" />
        {error("name")}
      </label>

      <label className="lbf-field ct-rise" style={{ ["--i" as string]: 3 }}>
        <span className="lbf-label">{t("fields.email")}</span>
        <input {...field("email")} type="email" inputMode="email" autoComplete="email" dir="ltr" spellCheck={false} />
        {error("email")}
      </label>

      <label className="lbf-field ct-wide ct-rise" style={{ ["--i" as string]: 4 }}>
        <span className="lbf-label">{t("fields.phone")}</span>
        <input
          {...field("phone")}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          placeholder={t("placeholders.phone")}
        />
        {error("phone")}
      </label>

      <label className="lbf-field ct-wide ct-rise" style={{ ["--i" as string]: 5 }}>
        <span className="lbf-label">{t("fields.message")}</span>
        <textarea {...field("message")} rows={7} />
        {error("message")}
      </label>

      <div className="ct-foot ct-wide ct-rise" style={{ ["--i" as string]: 6 }}>
        <button type="submit" className="lbf-cta" disabled={pending}>
          <span>{pending ? t("sending") : t("submit")}</span>
        </button>
        <p className="ct-req">{t("allRequired")}</p>
      </div>

      <p className="ct-alert ct-wide" role="alert">
        {state.status === "error" ? t("errors.generic") : ""}
      </p>
    </form>
  );
}
