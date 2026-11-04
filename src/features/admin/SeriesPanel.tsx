"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { pick } from "@/shared/data/localize";
import { CHAPTER_DEFAULTS, CHARACTER_DEFAULTS } from "@/shared/data/defaults";
import type { NarrationMap, SeriesChapterRow, SeriesCharacterRow } from "@/shared/data/types";
import {
  setSeriesCharacterVisible,
  updateSeriesChapter,
  updateSeriesCharacter,
} from "@/shared/actions/admin/series";
import { CollectionPanel } from "./CollectionPanel";
import { EditorShell } from "./EditorShell";
import { PanelFrame, TextField } from "./forms";
import type { Notify } from "./parts";

type WithId<T extends { slug: string }> = T & { id: string };
const NARRATION_KEYS = ["hello", "world", "day", "did", "others"] as const;

/** Rows from the database, with the code defaults filling any slug that was never stored. */
function merge<T extends { slug: string; order: number }>(defaults: T[], stored: T[]): { rows: WithId<T>[]; storedSlugs: Set<string> } {
  const by = new Map(stored.map((r) => [r.slug, r]));
  const rows = defaults.map((d) => ({ ...(by.get(d.slug) ?? d), id: d.slug }));
  return { rows, storedSlugs: new Set(by.keys()) };
}

export function SeriesPanel({
  chapters,
  characters,
  locale,
  notify,
  hidden,
  labelledBy,
  onDirty,
}: {
  chapters: SeriesChapterRow[];
  characters: SeriesCharacterRow[];
  locale: "en" | "fa";
  notify: Notify;
  hidden: boolean;
  labelledBy: string;
  onDirty?: (dirty: boolean) => void;
}) {
  const t = useTranslations("admin");
  const [dirtyParts, setDirtyParts] = useState({ chapters: false, characters: false });
  const onChaptersDirty = useCallback((d: boolean) => setDirtyParts((o) => (o.chapters === d ? o : { ...o, chapters: d })), []);
  const onCharactersDirty = useCallback((d: boolean) => setDirtyParts((o) => (o.characters === d ? o : { ...o, characters: d })), []);
  const anyDirty = dirtyParts.chapters || dirtyParts.characters;
  useEffect(() => onDirty?.(anyDirty), [anyDirty, onDirty]);
  const [part, setPart] = useState<"chapters" | "characters">("chapters");
  const ch = useMemo(() => merge(CHAPTER_DEFAULTS, chapters), [chapters]);
  const cs = useMemo(() => merge(CHARACTER_DEFAULTS, characters), [characters]);
  const unstored = (part === "chapters" ? ch : cs).storedSlugs.size < (part === "chapters" ? ch : cs).rows.length;

  return (
    <PanelFrame id="series" labelledBy={labelledBy} hidden={hidden} title={t("series.title")} sub={t("series.sub")}>
      <div className="adm-seg" role="group" aria-label={t("series.partLabel")}>
        {(["chapters", "characters"] as const).map((p) => (
          <button key={p} type="button" className="adm-seg-btn" aria-pressed={part === p} onClick={() => setPart(p)}>
            {t(`series.parts.${p}`)}
          </button>
        ))}
      </div>
      {unstored && <p className="adm-note">{t("series.unstoredNote")}</p>}
      <p className="adm-note">{t(part === "chapters" ? "series.chaptersNote" : "series.charactersNote")}</p>

      <CollectionPanel
        table="series_chapters"
        rows={ch.rows}
        notify={notify}
        hidden={part !== "chapters"}
        labelledBy={labelledBy}
        showThumb={false}
        canAdd={false}
        headingTag="h3"
        text={{
          title: t("series.parts.chapters"),
          sub: t("series.chaptersSub"),
          add: "",
          emptyTitle: t("series.emptyTitle"),
          emptyText: t("series.emptyText"),
          off: t("series.off"),
          turnOn: t("series.turnOn"),
          turnOff: t("series.turnOff"),
          confirmDelete: () => "",
        }}
        isActive={() => true}
        view={(r) => ({
          title: `${pick(r, "word", locale)} · ${pick(r, "title", locale)}`,
          meta: [ch.storedSlugs.has(r.slug) ? "" : t("series.default"), r.slug].filter(Boolean),
        })}
        onDirty={onChaptersDirty}
        renderEditor={({ row, close, saved }) => (row ? <ChapterForm row={row} onClose={close} onSaved={saved} /> : null)}
      />

      <CollectionPanel
        table="series_characters"
        rows={cs.rows}
        notify={notify}
        hidden={part !== "characters"}
        labelledBy={labelledBy}
        showThumb={false}
        canAdd={false}
        headingTag="h3"
        text={{
          title: t("series.parts.characters"),
          sub: t("series.charactersSub"),
          add: "",
          emptyTitle: t("series.emptyTitle"),
          emptyText: t("series.emptyText"),
          off: t("series.off"),
          turnOn: t("series.turnOn"),
          turnOff: t("series.turnOff"),
          confirmDelete: () => "",
        }}
        isActive={(r) => r.visible}
        view={(r) => ({
          title: pick(r, "name", locale),
          meta: [pick(r, "role", locale), cs.storedSlugs.has(r.slug) ? "" : t("series.default")].filter(Boolean),
        })}
        onToggle={setSeriesCharacterVisible}
        onDirty={onCharactersDirty}
        renderEditor={({ row, close, saved }) => (row ? <CharacterForm row={row} onClose={close} onSaved={saved} /> : null)}
      />
    </PanelFrame>
  );
}

function ChapterForm({ row, onClose, onSaved }: { row: SeriesChapterRow; onClose: () => void; onSaved: (m: string) => void }) {
  const t = useTranslations("admin");
  const initial = useMemo(
    () => ({ wordEn: row.word_en, wordFa: row.word_fa, titleEn: row.title_en, titleFa: row.title_fa }),
    [row],
  );
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof initial, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof initial) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors({});
  };

  async function submit() {
    const e: typeof errors = {};
    (Object.keys(f) as (keyof typeof f)[]).forEach((k) => {
      if (!f[k].trim()) e[k] = t("err.required");
    });
    setErrors(e);
    if (Object.keys(e).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.adm-editor [aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await updateSeriesChapter(row.slug, {
        wordEn: f.wordEn.trim(),
        wordFa: f.wordFa.trim(),
        titleEn: f.titleEn.trim(),
        titleFa: f.titleFa.trim(),
      });
      if (res.success) onSaved(t("series.chapterSaved"));
      else setError(t("saveFailed", { error: res.error }));
    } catch {
      setError(t("saveFailed", { error: t("networkError") }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorShell
      title={t("series.editChapter", { slug: row.slug })}
      submitLabel={t("update")}
      saving={saving}
      error={error}
      dirty={JSON.stringify(f) !== JSON.stringify(initial)}
      onCancel={onClose}
      onSubmit={submit}
    >
      <div className="adm-pair">
        <TextField label={t("series.wordEn")} required dir="ltr" hint={t("series.wordHint")} value={f.wordEn} onChange={set("wordEn")} error={errors.wordEn} />
        <TextField label={t("series.wordFa")} required dir="rtl" value={f.wordFa} onChange={set("wordFa")} error={errors.wordFa} />
        <TextField label={t("titleEn")} required dir="ltr" value={f.titleEn} onChange={set("titleEn")} error={errors.titleEn} />
        <TextField label={t("titleFa")} required dir="rtl" value={f.titleFa} onChange={set("titleFa")} error={errors.titleFa} />
      </div>
    </EditorShell>
  );
}

function CharacterForm({ row, onClose, onSaved }: { row: SeriesCharacterRow; onClose: () => void; onSaved: (m: string) => void }) {
  const t = useTranslations("admin");
  const builtIn = useMemo(() => CHARACTER_DEFAULTS.find((c) => c.slug === row.slug), [row.slug]);
  const initial = useMemo(
    () => ({
      nameEn: row.name_en,
      nameFa: row.name_fa,
      roleEn: row.role_en,
      roleFa: row.role_fa,
      moodEn: row.mood_en,
      moodFa: row.mood_fa,
      narrationEn: { ...(row.narration_en ?? {}) } as NarrationMap,
      narrationFa: { ...(row.narration_fa ?? {}) } as NarrationMap,
    }),
    [row],
  );
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState<{ nameEn?: string; nameFa?: string }>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: "nameEn" | "nameFa" | "roleEn" | "roleFa" | "moodEn" | "moodFa") => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setErrors({});
  };
  const setLine = (loc: "En" | "Fa", key: (typeof NARRATION_KEYS)[number], v: string) =>
    setF((p) =>
      loc === "En"
        ? { ...p, narrationEn: { ...p.narrationEn, [key]: v } }
        : { ...p, narrationFa: { ...p.narrationFa, [key]: v } },
    );

  const clean = (m: NarrationMap) => {
    const out: Record<string, string> = {};
    for (const k of NARRATION_KEYS) {
      const v = m[k]?.trim();
      if (v) out[k] = v;
    }
    return out;
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
    setSaving(true);
    setError(null);
    try {
      const res = await updateSeriesCharacter(row.slug, {
        nameEn: f.nameEn.trim(),
        nameFa: f.nameFa.trim(),
        roleEn: f.roleEn.trim() || null,
        roleFa: f.roleFa.trim() || null,
        moodEn: f.moodEn.trim() || null,
        moodFa: f.moodFa.trim() || null,
        narrationEn: clean(f.narrationEn),
        narrationFa: clean(f.narrationFa),
      });
      if (res.success) onSaved(t("series.characterSaved"));
      else setError(t("saveFailed", { error: res.error }));
    } catch {
      setError(t("saveFailed", { error: t("networkError") }));
    } finally {
      setSaving(false);
    }
  }

  const lineKeys = NARRATION_KEYS.filter((k) => k !== "others" || row.narration_en?.others || row.narration_fa?.others || builtIn?.narration_en.others || builtIn?.narration_fa.others);

  return (
    <EditorShell
      title={t("series.editCharacter", { slug: row.slug })}
      submitLabel={t("update")}
      saving={saving}
      error={error}
      dirty={JSON.stringify(f) !== JSON.stringify(initial)}
      onCancel={onClose}
      onSubmit={submit}
    >
      <div className="adm-pair">
        <TextField label={t("series.nameEn")} required dir="ltr" value={f.nameEn} onChange={set("nameEn")} error={errors.nameEn} />
        <TextField label={t("series.nameFa")} required dir="rtl" value={f.nameFa} onChange={set("nameFa")} error={errors.nameFa} />
        <TextField label={t("series.roleEn")} dir="ltr" value={f.roleEn} onChange={set("roleEn")} />
        <TextField label={t("series.roleFa")} dir="rtl" value={f.roleFa} onChange={set("roleFa")} />
        <TextField label={t("series.moodEn")} dir="ltr" value={f.moodEn} onChange={set("moodEn")} />
        <TextField label={t("series.moodFa")} dir="rtl" value={f.moodFa} onChange={set("moodFa")} />
      </div>

      <div className="adm-group">
        <p className="adm-group-title">{t("series.narration")}</p>
        <p className="adm-hint-line">{t("series.narrationHint")}</p>
        {lineKeys.map((k) => (
          <div className="adm-pair" key={k}>
            <TextField
              label={t("series.line", { chapter: t(`series.lineNames.${k}`), lang: t("langEn") })}
              dir="ltr"
              multiline
              rows={3}
              placeholder={builtIn?.narration_en[k] ?? ""}
              value={f.narrationEn[k] ?? ""}
              onChange={(v) => setLine("En", k, v)}
            />
            <TextField
              label={t("series.line", { chapter: t(`series.lineNames.${k}`), lang: t("langFa") })}
              dir="rtl"
              multiline
              rows={3}
              placeholder={builtIn?.narration_fa[k] ?? ""}
              value={f.narrationFa[k] ?? ""}
              onChange={(v) => setLine("Fa", k, v)}
            />
          </div>
        ))}
      </div>
    </EditorShell>
  );
}
