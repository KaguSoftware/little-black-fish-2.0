"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { pick } from "@/shared/data/localize";
import { getPathname } from "@/i18n/navigation";
import { TELLER_BY_ID } from "@/shared/content/characters";
import { tellerPortrait } from "@/shared/content/characters";
import type { TellerId } from "@/shared/content/types";
import type { TellerLook, TellersSettings } from "@/shared/data/settingsSchema";
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
import { VoiceLookEditor, type LookState } from "./VoiceLook";

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
  tellers,
  locale,
  notify,
  hidden,
  labelledBy,
  onDirty,
}: {
  chapters: SeriesChapterRow[];
  characters: SeriesCharacterRow[];
  /** Per-voice look overrides (site_settings "tellers"). */
  tellers: TellersSettings;
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
  const [part, setPart] = useState<"chapters" | "characters">("characters");
  const ch = useMemo(() => merge(CHAPTER_DEFAULTS, chapters), [chapters]);
  const cs = useMemo(() => merge(CHARACTER_DEFAULTS, characters), [characters]);
  const unstored = (part === "chapters" ? ch : cs).storedSlugs.size < (part === "chapters" ? ch : cs).rows.length;

  return (
    <PanelFrame id="series" labelledBy={labelledBy} hidden={hidden} title={t("series.title")} sub={t("series.sub")}>
      <div className="adm-seg" role="group" aria-label={t("series.partLabel")}>
        {(["characters", "chapters"] as const).map((p) => (
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

      {part === "characters" && <VoicesSummary rows={cs.rows} locale={locale} />}

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
        renderEditor={({ row, close, saved }) => (row ? <CharacterForm row={row} look={tellers[row.slug]} onClose={close} onSaved={saved} /> : null)}
      />
    </PanelFrame>
  );
}

/** Live count of voices on the site (from the stored rows) with the consequences of 0 and 1. */
function VoicesSummary({ rows, locale }: { rows: WithId<SeriesCharacterRow>[]; locale: "en" | "fa" }) {
  const t = useTranslations("admin");
  const shown = rows.filter((r) => r.visible).length;
  return (
    <div className="adm-note" role="status" aria-live="polite">
      <strong>{t("series.voices.count", { count: shown })}</strong> · {t("series.voices.of", { total: rows.length })}
      {shown === 0 && <p style={{ margin: "0.4rem 0 0", color: "var(--danger, #e5484d)" }}>{t("series.voices.zero")}</p>}
      {shown === 1 && <p style={{ margin: "0.4rem 0 0" }}>{t("series.voices.one")}</p>}
      <p style={{ margin: "0.4rem 0 0" }}>
        {t("series.voices.order")}{" "}
        <a className="lbf-textbtn" href={getPathname({ href: "/projects/series", locale })} target="_blank" rel="noreferrer">
          {t("series.voices.preview")}
          <span className="sr-only"> ({t("series.voices.previewFor")})</span>
        </a>
      </p>
    </div>
  );
}

const lookToState = (l: TellerLook | undefined): LookState => ({
  portrait: l?.portrait ?? "",
  focus: l?.focus ?? null,
  accent: l?.accent ?? null,
  stageHue: l?.stageHue ?? null,
});
function stateToLook(s: LookState): TellerLook | null {
  const out: TellerLook = {};
  if (s.portrait) out.portrait = s.portrait;
  if (s.focus) out.focus = s.focus;
  if (s.accent) out.accent = [s.accent[0], s.accent[1], s.accent[2]];
  if (s.stageHue != null) out.stageHue = s.stageHue;
  return Object.keys(out).length ? out : null;
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

function CharacterForm({
  row,
  look,
  onClose,
  onSaved,
}: {
  row: SeriesCharacterRow;
  look: TellerLook | undefined;
  onClose: () => void;
  onSaved: (m: string) => void;
}) {
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
      look: lookToState(look),
    }),
    [row, look],
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
        look: stateToLook(f.look),
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
        <VoiceLookEditor
          value={f.look}
          onChange={(look) => setF((p) => ({ ...p, look }))}
          defaults={{
            accent: TELLER_BY_ID[row.slug as TellerId].accent,
            stageHue: TELLER_BY_ID[row.slug as TellerId].stageHue.default,
          }}
          portraitDefault={tellerPortrait(row.slug as TellerId)}
        />
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
