"use client";

import { useId, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber, pick } from "@/shared/data/localize";
import { getYouTubeId } from "@/shared/data/youtube";
import type { CategoryRow, ProjectRow } from "@/shared/data/types";
import type { ProjectInput } from "@/shared/actions/admin/types";
import { createProject, updateProject } from "@/shared/actions/admin/projects";
import { EditorShell, Field } from "./EditorShell";
import { Upload } from "./Upload";
import { EndIcon, StartIcon } from "./parts";

const SUPPORT_TEXT = ["Title", "Intro", "Body", "Closing"] as const;
type SupportKey = `support${(typeof SUPPORT_TEXT)[number]}${"En" | "Fa"}`;

interface Form {
  titleEn: string;
  titleFa: string;
  descriptionEn: string;
  descriptionFa: string;
  mediaType: "youtube" | "gallery";
  youtubeUrl: string;
  imageUrl: string;
  galleryUrls: string[];
  categoryId: string;
  published: boolean;
  supportEnabled: boolean;
  supportTitleEn: string;
  supportTitleFa: string;
  supportIntroEn: string;
  supportIntroFa: string;
  supportBodyEn: string;
  supportBodyFa: string;
  supportClosingEn: string;
  supportClosingFa: string;
  supportEpisodesDone: string;
  supportEpisodesTotal: string;
}

const s = (v?: string | null) => v ?? "";
const n = (v?: number | null) => (v === null || v === undefined ? "" : String(v));

function fromRow(row: ProjectRow | null, published: boolean): Form {
  return {
    titleEn: s(row?.title_en),
    titleFa: s(row?.title_fa),
    descriptionEn: s(row?.description_en),
    descriptionFa: s(row?.description_fa),
    mediaType: row?.media_type === "gallery" ? "gallery" : "youtube",
    youtubeUrl: s(row?.youtube_url),
    imageUrl: s(row?.image_url),
    galleryUrls: row?.gallery_urls ?? [],
    categoryId: s(row?.category_id),
    published,
    supportEnabled: !!row?.support_enabled,
    supportTitleEn: s(row?.support_title_en),
    supportTitleFa: s(row?.support_title_fa),
    supportIntroEn: s(row?.support_intro_en),
    supportIntroFa: s(row?.support_intro_fa),
    supportBodyEn: s(row?.support_body_en),
    supportBodyFa: s(row?.support_body_fa),
    supportClosingEn: s(row?.support_closing_en),
    supportClosingFa: s(row?.support_closing_fa),
    supportEpisodesDone: n(row?.support_episodes_done),
    supportEpisodesTotal: n(row?.support_episodes_total),
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);
const isCount = (v: string) => v.trim() === "" || /^\d+$/.test(v.trim());

function toInput(f: Form): ProjectInput {
  return {
    titleEn: f.titleEn.trim(),
    titleFa: f.titleFa.trim(),
    descriptionEn: orNull(f.descriptionEn),
    descriptionFa: orNull(f.descriptionFa),
    mediaType: f.mediaType,
    youtubeUrl: orNull(f.youtubeUrl),
    imageUrl: orNull(f.imageUrl),
    galleryUrls: f.galleryUrls,
    categoryId: f.categoryId || null,
    published: f.published,
    supportEnabled: f.supportEnabled,
    supportTitleEn: orNull(f.supportTitleEn),
    supportTitleFa: orNull(f.supportTitleFa),
    // Body keeps its inner blank lines; only the ends are trimmed.
    supportIntroEn: orNull(f.supportIntroEn),
    supportIntroFa: orNull(f.supportIntroFa),
    supportBodyEn: orNull(f.supportBodyEn),
    supportBodyFa: orNull(f.supportBodyFa),
    supportClosingEn: orNull(f.supportClosingEn),
    supportClosingFa: orNull(f.supportClosingFa),
    supportEpisodesDone: f.supportEpisodesDone.trim() === "" ? null : f.supportEpisodesDone.trim(),
    supportEpisodesTotal: f.supportEpisodesTotal.trim() === "" ? null : f.supportEpisodesTotal.trim(),
  };
}

/** Keys that follow each image when it moves (url + occurrence, so duplicates stay unique). */
function galleryKeys(urls: string[]): [string, string][] {
  const seen = new Map<string, number>();
  return urls.map((url) => {
    const k = seen.get(url) ?? 0;
    seen.set(url, k + 1);
    return [url, `${url}#${k}`];
  });
}

interface Props {
  row: ProjectRow | null;
  /** Current published state (after any optimistic toggle in the list). Update writes it. */
  published: boolean;
  categories: CategoryRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function ProjectEditor({ row, published, categories, onClose, onSaved }: Props) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const initial = useMemo(() => fromRow(row, row ? published : false), [row, published]);
  const [f, setF] = useState<Form>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saving, setSaving] = useState(false);
  const episodesHintId = useId();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const moveImage = (i: number, d: -1 | 1) =>
    setF((p) => {
      const g = [...p.galleryUrls];
      const j = i + d;
      if (j < 0 || j >= g.length) return p;
      [g[i], g[j]] = [g[j], g[i]];
      return { ...p, galleryUrls: g };
    });

  async function submit() {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!f.titleEn.trim()) e.titleEn = t("err.required");
    if (!f.titleFa.trim()) e.titleFa = t("err.required");
    if (f.youtubeUrl.trim() && !getYouTubeId(f.youtubeUrl)) e.youtubeUrl = t("err.youtube");
    if (!isCount(f.supportEpisodesDone)) e.supportEpisodesDone = t("err.count");
    if (!isCount(f.supportEpisodesTotal)) e.supportEpisodesTotal = t("err.count");
    setErrors(e);
    if (Object.keys(e).length) {
      if ((e.supportEpisodesDone || e.supportEpisodesTotal) && !f.supportEnabled) set("supportEnabled", true);
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.adm-editor [aria-invalid="true"]')?.focus());
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const input = toInput(f);
      const res = row ? await updateProject(row.id, input) : await createProject(input);
      if (res.success) onSaved(row ? t("projects.saved") : t("projects.created"));
      else setError(t("saveFailed", { error: res.error }));
    } catch {
      setError(t("saveFailed", { error: t("networkError") }));
    } finally {
      setSaving(false);
    }
  }

  const supportLabel = (field: (typeof SUPPORT_TEXT)[number], lang: "En" | "Fa") =>
    `${t(`projects.support${field}`)} (${lang === "En" ? t("langEn") : t("langFa")})`;

  return (
    <EditorShell
      title={row ? t("projects.editTitle") : t("projects.newTitle")}
      submitLabel={row ? t("update") : t("projects.create")}
      saving={saving}
      error={error}
      dirty={dirty}
      onCancel={onClose}
      onSubmit={submit}
      footStart={
        <label className="lbf-check">
          <input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} />
          <span>{row ? t("projects.published") : t("projects.publishNow")}</span>
        </label>
      }
    >
      <div className="adm-pair">
        <Field label={t("titleEn")} required error={errors.titleEn}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              className="lbf-input"
              dir="ltr"
              value={f.titleEn}
              onChange={(e) => set("titleEn", e.target.value)}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              aria-required
            />
          )}
        </Field>
        <Field label={t("titleFa")} required error={errors.titleFa}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              className="lbf-input"
              dir="rtl"
              lang="fa"
              value={f.titleFa}
              onChange={(e) => set("titleFa", e.target.value)}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              aria-required
            />
          )}
        </Field>
      </div>

      <div className="adm-pair">
        <Field label={t("descriptionEn")}>
          {({ id }) => (
            <textarea
              id={id}
              className="lbf-input"
              dir="ltr"
              rows={4}
              value={f.descriptionEn}
              onChange={(e) => set("descriptionEn", e.target.value)}
            />
          )}
        </Field>
        <Field label={t("descriptionFa")}>
          {({ id }) => (
            <textarea
              id={id}
              className="lbf-input"
              dir="rtl"
              lang="fa"
              rows={4}
              value={f.descriptionFa}
              onChange={(e) => set("descriptionFa", e.target.value)}
            />
          )}
        </Field>
      </div>

      <Field label={t("projects.category")} hint={categories.length === 0 ? t("projects.noCategories") : undefined}>
        {({ id, describedBy }) => (
          <select
            id={id}
            className="lbf-input"
            value={f.categoryId}
            onChange={(e) => set("categoryId", e.target.value)}
            aria-describedby={describedBy}
          >
            <option value="">{t("projects.uncategorized")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {pick(c, "name", locale)}
                {c.visible ? "" : ` (${t("categories.off")})`}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="adm-group">
        <fieldset className="adm-seg">
          <legend className="lbf-label">{t("projects.mediaType")}</legend>
          {(["youtube", "gallery"] as const).map((m) => (
            <label key={m} className="adm-seg-opt">
              <input
                type="radio"
                name="adm-media-type"
                value={m}
                checked={f.mediaType === m}
                onChange={() => set("mediaType", m)}
              />
              {m === "youtube" ? t("projects.mediaYouTube") : t("projects.mediaGallery")}
            </label>
          ))}
        </fieldset>

        <div className="adm-collapse" data-open={f.mediaType === "youtube" ? "true" : "false"}>
          <Field label={t("youtubeUrl")} error={errors.youtubeUrl}>
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
        </div>

        <Upload
          bucket="projects"
          label={t("projects.cover")}
          hint={f.mediaType === "youtube" ? t("projects.coverHintYouTube") : t("projects.coverHintGallery")}
          value={f.imageUrl}
          onChange={(url) => set("imageUrl", url)}
          imagesOnly
        />

        <div className="adm-collapse lbf-field" data-open={f.mediaType === "gallery" ? "true" : "false"}>
          <span className="lbf-label" id="adm-gallery-label">
            {t("projects.gallery")}
            {f.galleryUrls.length > 0 && ` (${formatNumber(f.galleryUrls.length, locale)})`}
          </span>
          {f.galleryUrls.length === 0 ? (
            <span className="lbf-hint">{t("projects.galleryEmpty")}</span>
          ) : (
            <ol className="adm-gallery" aria-labelledby="adm-gallery-label">
              {galleryKeys(f.galleryUrls).map(([url, key], i) => {
                const pos = formatNumber(i + 1, locale);
                return (
                  <li key={key} className="adm-gal-item">
                    <div className="adm-gal-img">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={t("projects.galleryImage", { n: pos })} loading="lazy" />
                      <span className="adm-gal-idx" aria-hidden="true">
                        {pos}
                      </span>
                    </div>
                    <div className="adm-gal-acts">
                      <span className="adm-move">
                        <button
                          type="button"
                          className="adm-icon"
                          onClick={() => moveImage(i, -1)}
                          disabled={i === 0}
                          aria-label={t("projects.moveEarlier", { n: pos })}
                        >
                          <StartIcon />
                        </button>
                        <button
                          type="button"
                          className="adm-icon"
                          onClick={() => moveImage(i, 1)}
                          disabled={i === f.galleryUrls.length - 1}
                          aria-label={t("projects.moveLater", { n: pos })}
                        >
                          <EndIcon />
                        </button>
                      </span>
                      <button
                        type="button"
                        className="lbf-textbtn adm-danger"
                        onClick={() => set("galleryUrls", f.galleryUrls.filter((_, j) => j !== i))}
                      >
                        {t("remove")}
                        <span className="sr-only"> {t("projects.galleryImage", { n: pos })}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <Upload
            bucket="projects"
            mode="add"
            label={t("projects.addImage")}
            onChange={(url) => setF((p) => ({ ...p, galleryUrls: [...p.galleryUrls, url] }))}
            imagesOnly
          />
        </div>
      </div>

      <div className="adm-group">
        <label className="lbf-check">
          <input type="checkbox" checked={f.supportEnabled} onChange={(e) => set("supportEnabled", e.target.checked)} />
          <span>{t("projects.supportEnabled")}</span>
        </label>

        {/* Hidden with CSS, not unmounted: unticking keeps the text for later. */}
        <div className="adm-collapse adm-form" data-open={f.supportEnabled ? "true" : "false"}>
          <p className="adm-note">{t("projects.supportNote")}</p>
          {SUPPORT_TEXT.map((field) => (
            <div className="adm-pair" key={field}>
              {(["En", "Fa"] as const).map((lang) => {
                const key = `support${field}${lang}` as SupportKey;
                const dir = lang === "Fa" ? "rtl" : "ltr";
                return (
                  <Field
                    key={key}
                    label={supportLabel(field, lang)}
                    hint={field === "Body" ? t("projects.supportBodyHint") : undefined}
                  >
                    {({ id, describedBy }) =>
                      field === "Title" ? (
                        <input
                          id={id}
                          className="lbf-input"
                          dir={dir}
                          lang={lang === "Fa" ? "fa" : "en"}
                          value={f[key]}
                          onChange={(e) => set(key, e.target.value)}
                          aria-describedby={describedBy}
                        />
                      ) : (
                        <textarea
                          id={id}
                          className="lbf-input"
                          dir={dir}
                          lang={lang === "Fa" ? "fa" : "en"}
                          rows={field === "Body" ? 10 : 2}
                          style={field === "Body" ? undefined : { minHeight: "4.5rem" }}
                          value={f[key]}
                          onChange={(e) => set(key, e.target.value)}
                          aria-describedby={describedBy}
                        />
                      )
                    }
                  </Field>
                );
              })}
            </div>
          ))}
          <div className="adm-pair">
            {(["supportEpisodesDone", "supportEpisodesTotal"] as const).map((key) => (
              <Field
                key={key}
                label={key === "supportEpisodesDone" ? t("projects.episodesDone") : t("projects.episodesTotal")}
                error={errors[key]}
              >
                {({ id, describedBy, invalid }) => (
                  <input
                    id={id}
                    className="lbf-input"
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    dir="ltr"
                    value={f[key]}
                    onChange={(e) => set(key, e.target.value)}
                    aria-invalid={invalid}
                    aria-describedby={[describedBy, episodesHintId].filter(Boolean).join(" ")}
                  />
                )}
              </Field>
            ))}
          </div>
          <p className="lbf-hint" id={episodesHintId} style={{ margin: "-0.6rem 0 0" }}>
            {t("projects.episodesHint")}
          </p>
        </div>
      </div>
    </EditorShell>
  );
}
