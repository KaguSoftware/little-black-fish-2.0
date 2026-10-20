"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { getYouTubeId } from "@/shared/data/youtube";
import type { HeroSlideRow } from "@/shared/data/types";
import type { HeroSlideInput } from "@/shared/actions/admin/types";
import { createHeroSlide, updateHeroSlide } from "@/shared/actions/admin/hero";
import { EditorShell, Field } from "./EditorShell";
import { Upload } from "./Upload";

interface Form {
  imageUrl: string;
  youtubeUrl: string;
  titleEn: string;
  titleFa: string;
  subtitleEn: string;
  subtitleFa: string;
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function HeroEditor({
  row,
  onClose,
  onSaved,
}: {
  row: HeroSlideRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations("admin");
  const initial = useMemo<Form>(
    () => ({
      imageUrl: row?.image_url ?? "",
      youtubeUrl: row?.youtube_url ?? "",
      titleEn: row?.title_en ?? "",
      titleFa: row?.title_fa ?? "",
      subtitleEn: row?.subtitle_en ?? "",
      subtitleFa: row?.subtitle_fa ?? "",
    }),
    [row],
  );
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<{ media?: string; youtubeUrl?: string }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Form, v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors({});
  };

  async function submit() {
    const e: typeof errors = {};
    if (!f.imageUrl.trim() && !f.youtubeUrl.trim()) e.media = t("hero.needMedia");
    if (f.youtubeUrl.trim() && !getYouTubeId(f.youtubeUrl)) e.youtubeUrl = t("err.youtube");
    setErrors(e);
    if (e.youtubeUrl) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.adm-editor [aria-invalid="true"]')?.focus());
      return;
    }
    if (e.media) return;

    const input: HeroSlideInput = {
      imageUrl: orNull(f.imageUrl),
      youtubeUrl: orNull(f.youtubeUrl),
      titleEn: orNull(f.titleEn),
      titleFa: orNull(f.titleFa),
      subtitleEn: orNull(f.subtitleEn),
      subtitleFa: orNull(f.subtitleFa),
    };
    setSaving(true);
    setError(null);
    try {
      const res = row ? await updateHeroSlide(row.id, input) : await createHeroSlide(input);
      if (res.success) onSaved(row ? t("hero.saved") : t("hero.created"));
      else setError(t("saveFailed", { error: res.error }));
    } catch {
      setError(t("saveFailed", { error: t("networkError") }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorShell
      title={row ? t("hero.editTitle") : t("hero.newTitle")}
      submitLabel={row ? t("update") : t("hero.create")}
      saving={saving}
      error={error ?? errors.media ?? null}
      dirty={JSON.stringify(f) !== JSON.stringify(initial)}
      onCancel={onClose}
      onSubmit={submit}
    >
      <p className="adm-note">{t("hero.staticNote")}</p>

      <Upload
        bucket="hero"
        label={t("hero.media")}
        hint={t("hero.mediaHint")}
        value={f.imageUrl}
        onChange={(url) => set("imageUrl", url)}
      />

      <Field label={t("youtubeUrl")} hint={t("hero.youtubeHint")} error={errors.youtubeUrl}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            className="lbf-input"
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder="https://youtube.com/watch?v=…"
            value={f.youtubeUrl}
            onChange={(e) => set("youtubeUrl", e.target.value)}
            aria-invalid={invalid}
            aria-describedby={describedBy}
          />
        )}
      </Field>

      <div className="adm-group">
        <p className="adm-group-title">{t("hero.textOptional")}</p>
        <div className="adm-pair">
          {(
            [
              ["titleEn", t("titleEn"), "ltr"],
              ["titleFa", t("titleFa"), "rtl"],
              ["subtitleEn", t("hero.subtitleEn"), "ltr"],
              ["subtitleFa", t("hero.subtitleFa"), "rtl"],
            ] as const
          ).map(([key, label, dir]) => (
            <Field key={key} label={label}>
              {({ id }) => (
                <input
                  id={id}
                  className="lbf-input"
                  dir={dir}
                  lang={dir === "rtl" ? "fa" : "en"}
                  value={f[key]}
                  onChange={(e) => set(key, e.target.value)}
                />
              )}
            </Field>
          ))}
        </div>
      </div>
    </EditorShell>
  );
}
