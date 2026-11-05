"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { pick } from "@/shared/data/localize";
import type { TeamMemberRow } from "@/shared/data/types";
import type { TeamMemberInput } from "@/shared/actions/admin/types";
import { createTeamMember, deleteTeamMember, setTeamMemberVisible, updateTeamMember } from "@/shared/actions/admin/team";
import { CollectionPanel } from "./CollectionPanel";
import { EditorShell } from "./EditorShell";
import { TextField } from "./forms";
import { resolveThumb, type Notify } from "./parts";
import { ImageField } from "./ImageField";
import { getAdminSetting, saveSettings } from "@/shared/actions/admin/settings";


interface Form {
  nameEn: string;
  nameFa: string;
  titleEn: string;
  titleFa: string;
  roleEn: string;
  roleFa: string;
  photoUrl: string;
  instagram: string;
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function TeamEditor({
  rows,
  locale,
  notify,
  hidden,
  labelledBy,
  onDirty,
}: {
  rows: TeamMemberRow[];
  locale: "en" | "fa";
  notify: Notify;
  hidden: boolean;
  labelledBy: string;
  onDirty?: (dirty: boolean) => void;
}) {
  const t = useTranslations("admin");
  return (
    <CollectionPanel
      table="team_members"
      rows={rows}
      notify={notify}
      hidden={hidden}
      labelledBy={labelledBy}
      text={{
        title: t("nav.items.team"),
        sub: t("team.sub"),
        add: t("team.add"),
        emptyTitle: t("team.emptyTitle"),
        emptyText: t("team.emptyText"),
        off: t("team.off"),
        turnOn: t("team.turnOn"),
        turnOff: t("team.turnOff"),
        confirmDelete: () => null,
      }}
      isActive={(m) => m.visible}
      view={(m) => ({
        title: pick(m, "name", locale),
        thumb: resolveThumb(m.photo_url),
        meta: [pick(m, "title", locale), pick(m, "role", locale), m.instagram ? `@${m.instagram}` : ""].filter(Boolean),
      })}
      onDirty={onDirty}
      onToggle={setTeamMemberVisible}
      onDelete={deleteTeamMember}
      renderEditor={({ row, close, saved }) => <TeamForm row={row} onClose={close} onSaved={saved} />}
    />
  );
}

function TeamForm({
  row,
  onClose,
  onSaved,
}: {
  row: TeamMemberRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations("admin");
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [startFocus, setStartFocus] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!row) return;
    let live = true;
    void getAdminSetting("teamFocus")
      .then((r) => {
        if (!live || !r.success || !r.data) return;
        const f = r.data[row.id] ?? null;
        setFocus(f);
        setStartFocus(f);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [row]);
  const initial = useMemo<Form>(
    () => ({
      nameEn: row?.name_en ?? "",
      nameFa: row?.name_fa ?? "",
      titleEn: row?.title_en ?? "",
      titleFa: row?.title_fa ?? "",
      roleEn: row?.role_en ?? "",
      roleFa: row?.role_fa ?? "",
      photoUrl: row?.photo_url ?? "",
      instagram: row?.instagram ?? "",
    }),
    [row],
  );
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<{ nameEn?: string; nameFa?: string }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Form) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors({});
  };

  async function submit() {
    const e: typeof errors = {};
    if (!f.nameEn.trim()) e.nameEn = t("err.required");
    if (!f.nameFa.trim()) e.nameFa = t("err.required");
    setErrors(e);
    if (e.nameEn || e.nameFa) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.adm-editor [aria-invalid="true"]')?.focus());
      return;
    }
    const input: TeamMemberInput = {
      nameEn: f.nameEn.trim(),
      nameFa: f.nameFa.trim(),
      titleEn: orNull(f.titleEn),
      titleFa: orNull(f.titleFa),
      roleEn: orNull(f.roleEn),
      roleFa: orNull(f.roleFa),
      photoUrl: orNull(f.photoUrl),
      instagram: orNull(f.instagram),
    };
    setSaving(true);
    setError(null);
    try {
      const res = row ? await updateTeamMember(row.id, input) : await createTeamMember(input);
      if (res.success) {
        const id = row ? row.id : (res.data as { id: string } | undefined)?.id;
        if (id && JSON.stringify(focus) !== JSON.stringify(startFocus)) {
          // The focus map is shared by all members: read it fresh, change one entry.
          const cur = await getAdminSetting("teamFocus");
          if (cur.success && cur.data) {
            const next = { ...cur.data };
            if (focus) next[id] = focus;
            else delete next[id];
            await saveSettings("teamFocus", next);
          }
        }
        onSaved(row ? t("team.saved") : t("team.created"));
      }
      else setError(t("saveFailed", { error: res.error }));
    } catch {
      setError(t("saveFailed", { error: t("networkError") }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorShell
      title={row ? t("team.editTitle") : t("team.newTitle")}
      submitLabel={row ? t("update") : t("team.create")}
      saving={saving}
      error={error}
      dirty={JSON.stringify(f) !== JSON.stringify(initial) || JSON.stringify(focus) !== JSON.stringify(startFocus)}
      onCancel={onClose}
      onSubmit={submit}
    >
      <ImageField
        label={t("team.photo")}
        description={t("team.photoHint")}
        value={f.photoUrl}
        onChange={set("photoUrl")}
        bucket="projects"
        imagesOnly
        aspect="3/4"
        focus={focus}
        onFocusChange={setFocus}
        hints={{ recommended: { width: 900, height: 1200, ratio: "3:4" }, minWidth: 600 }}
      />
      <div className="adm-pair">
        <TextField label={t("team.nameEn")} required dir="ltr" value={f.nameEn} onChange={set("nameEn")} error={errors.nameEn} />
        <TextField label={t("team.nameFa")} required dir="rtl" value={f.nameFa} onChange={set("nameFa")} error={errors.nameFa} />
        <TextField label={t("team.titleEn")} dir="ltr" value={f.titleEn} onChange={set("titleEn")} />
        <TextField label={t("team.titleFa")} dir="rtl" value={f.titleFa} onChange={set("titleFa")} />
        <TextField label={t("team.roleEn")} dir="ltr" value={f.roleEn} onChange={set("roleEn")} />
        <TextField label={t("team.roleFa")} dir="rtl" value={f.roleFa} onChange={set("roleFa")} />
      </div>
      <TextField label={t("team.instagram")} dir="ltr" placeholder="@handle" hint={t("team.instagramHint")} value={f.instagram} onChange={set("instagram")} />
    </EditorShell>
  );
}
