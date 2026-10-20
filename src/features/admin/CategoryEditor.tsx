"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { CategoryRow } from "@/shared/data/types";
import { createCategory, updateCategory } from "@/shared/actions/admin/categories";
import { EditorShell, Field } from "./EditorShell";

export function CategoryEditor({
  row,
  onClose,
  onSaved,
}: {
  row: CategoryRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations("admin");
  const [nameEn, setNameEn] = useState(row?.name_en ?? "");
  const [nameFa, setNameFa] = useState(row?.name_fa ?? "");
  const [errors, setErrors] = useState<{ nameEn?: string; nameFa?: string }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const e: typeof errors = {};
    if (!nameEn.trim()) e.nameEn = t("err.required");
    if (!nameFa.trim()) e.nameFa = t("err.required");
    setErrors(e);
    if (e.nameEn || e.nameFa) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.adm-editor [aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const input = { nameEn: nameEn.trim(), nameFa: nameFa.trim() };
      const res = row ? await updateCategory(row.id, input) : await createCategory(input);
      if (res.success) onSaved(row ? t("categories.saved") : t("categories.created"));
      else setError(t("saveFailed", { error: res.error }));
    } catch {
      setError(t("saveFailed", { error: t("networkError") }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorShell
      title={row ? t("categories.editTitle") : t("categories.newTitle")}
      submitLabel={row ? t("update") : t("categories.create")}
      saving={saving}
      error={error}
      dirty={nameEn !== (row?.name_en ?? "") || nameFa !== (row?.name_fa ?? "")}
      onCancel={onClose}
      onSubmit={submit}
    >
      <div className="adm-pair">
        <Field label={t("categories.nameEn")} required error={errors.nameEn}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              className="lbf-input"
              dir="ltr"
              placeholder="Commercial"
              value={nameEn}
              onChange={(e) => {
                setNameEn(e.target.value);
                setErrors((x) => ({ ...x, nameEn: undefined }));
              }}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              aria-required
            />
          )}
        </Field>
        <Field label={t("categories.nameFa")} required error={errors.nameFa}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              className="lbf-input"
              dir="rtl"
              lang="fa"
              placeholder="تجاری"
              value={nameFa}
              onChange={(e) => {
                setNameFa(e.target.value);
                setErrors((x) => ({ ...x, nameFa: undefined }));
              }}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              aria-required
            />
          )}
        </Field>
      </div>
    </EditorShell>
  );
}
