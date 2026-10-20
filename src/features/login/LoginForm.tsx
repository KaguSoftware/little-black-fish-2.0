"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { getSupabaseClient } from "@/shared/supabase/browser";

/** Email + password against Supabase Auth. Only role=admin accounts are let through. */
export function LoginForm({ forbidden }: { forbidden: boolean }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(forbidden ? t("forbidden") : null);

  const invalid = error !== null && error === t("invalid");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setError(null);
    setPending(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.code === "invalid_credentials" ? t("invalid") : signInError.message || t("failed"));
        setPending(false);
        return;
      }
      if (data.user?.app_metadata?.role !== "admin") {
        // A real account without admin rights: do not leave a useless session behind.
        await supabase.auth.signOut();
        setError(t("forbidden"));
        setPending(false);
        return;
      }
      // Stay pending through the navigation.
      router.push("/admin");
      router.refresh();
    } catch {
      setError(t("failed"));
      setPending(false);
    }
  }

  return (
    <form className="lg-form" onSubmit={onSubmit} aria-busy={pending}>
      <label className="lbf-field">
        <span className="lbf-label">{t("email")}</span>
        <input
          className="lbf-input"
          type="email"
          name="email"
          dir="ltr"
          required
          autoComplete="username"
          inputMode="email"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={error ? "lg-alert" : undefined}
        />
      </label>

      <label className="lbf-field">
        <span className="lbf-label">{t("password")}</span>
        <input
          className="lbf-input"
          type="password"
          name="password"
          dir="ltr"
          required
          autoComplete="current-password"
          aria-invalid={invalid || undefined}
          aria-describedby={error ? "lg-alert" : undefined}
        />
      </label>

      <p className="lg-alert" id="lg-alert" role="alert">
        {error ?? ""}
      </p>

      <div className="lg-actions">
        <button className="lbf-cta" type="submit" disabled={pending}>
          <span>{pending ? t("pending") : t("submit")}</span>
        </button>
        <Link className="lg-back" href="/">
          {t("back")}
        </Link>
      </div>
    </form>
  );
}
