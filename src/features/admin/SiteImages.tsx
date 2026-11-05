/* eslint-disable @next/next/no-img-element -- admin previews are arbitrary user-supplied URLs */
"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { ActionResult } from "@/shared/data/types";
import type { AdminData } from "@/shared/actions/admin/types";
import { TELLER_IDS } from "@/shared/content/characters";
import { pick } from "@/shared/data/localize";
import { PLATE_CHAPTERS, SETTING_DEFAULTS, type SettingKey, type Settings } from "@/shared/data/settingsSchema";
import type { TeamMemberRow } from "@/shared/data/types";
import { ImageField } from "./ImageField";
import { FilmsEditor, WallEditor } from "./ImageLists";
import { ImagePicker } from "./ImagePicker";
import { MediaDialog } from "./MediaDialog";
import { useMediaApi } from "./media-api";
import { MediaStyles } from "./MediaStyles";
import { PhotoIcon } from "./media-lib";
import { PanelFrame } from "./forms";
import { SAME, builtInOf, readSlot, storageUrls, writeSlot, type Focus, type SlotId, type SlotValue } from "./images-model";
import { useOrphanOffer } from "./orphans";
import type { Notify } from "./parts";
import { toast } from "./toast";

/**
 * "Images" section: every picture on the site, grouped by the page it appears on. Each picture is a
 * card (thumbnail, what it is, whether it is customised). Press Replace (or click the thumbnail) to
 * change it: pick or upload, and it is saved at once with an Undo toast. Lists (wall, hero films) reorder by dragging.
 * The export name and props are a stable contract.
 */
export interface SiteImagesPanelProps {
  data: AdminData;
  locale: "en" | "fa";
  hidden: boolean;
  labelledBy: string;
  notify: Notify;
}

type GroupId = "home" | "series" | "archive" | "about" | "projects" | "site" | "code";
const GROUPS: { id: GroupId; path: string | null }[] = [
  { id: "home", path: "/" },
  { id: "series", path: "/projects/series" },
  { id: "archive", path: "/archive" },
  { id: "about", path: "/about" },
  { id: "projects", path: "/projects" },
  { id: "site", path: null },
  { id: "code", path: null },
];

interface Card {
  id: SlotId;
  group: GroupId;
  /** Sub-heading inside the group (a voice or "Reel frames"). */
  section: string;
  label: string;
  hint?: string;
  aspect: string;
  /** Shape the site crops it to when that differs from the thumbnail (framing dialog). */
  frameAspect?: string;
  focusable: boolean;
  /** Has alt text (archive pin). */
  alt?: boolean;
  /** Current picture for team cards (their photo lives in team_members). */
  photo?: string;
  noun: string;
}

const norm = (s: string) => s.toLocaleLowerCase();

export function SiteImagesPanel({ data, locale, hidden, labelledBy }: SiteImagesPanelProps) {
  const t = useTranslations("adminMedia");
  const offer = useOrphanOffer();
  const api = useMediaApi();

  /* ---- local, optimistic copy of what this section edits ---- */
  const [settings, setSettings] = useState<Settings>(data.settings);
  const [team, setTeam] = useState<TeamMemberRow[]>(data.teamMembers);
  const [seen, setSeen] = useState({ s: data.settings, t: data.teamMembers });
  // Saves in flight or queued. While any exist the optimistic copy is newer than `data`, so a refresh must not replace it.
  const [pending, setPending] = useState(0);
  if (seen.s !== data.settings || seen.t !== data.teamMembers) {
    setSeen({ s: data.settings, t: data.teamMembers });
    if (pending === 0) {
      setSettings(data.settings);
      setTeam(data.teamMembers);
    }
  }
  const ref = useRef({ settings, team });
  useEffect(() => {
    ref.current = { settings, team };
  });
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  /** Runs saves one after the other and counts them (see `pending`). */
  const enqueue = useCallback(
    (job: () => Promise<ActionResult>): Promise<ActionResult> => {
      setPending((n) => n + 1);
      const run = queue.current
        .then(job)
        .catch((): ActionResult => ({ success: false, error: t("networkError") }))
        .finally(() => setPending((n) => n - 1));
      queue.current = run;
      return run;
    },
    [t],
  );

  const persist = useCallback(<K extends SettingKey>(key: K, value: Settings[K]) => {
    ref.current = { ...ref.current, settings: { ...ref.current.settings, [key]: value } };
    setSettings((s) => ({ ...s, [key]: value }));
    return enqueue(() => api.saveSetting(key, value));
  }, [enqueue, api]);

  /**
   * Saves a whole settings key that belongs to one list (wall, hero films). No Undo here (the lists
   * have their own toasts); the old files are offered for deletion later.
   */
  const change = useCallback(
    async <K extends SettingKey>(key: K, next: Settings[K]) => {
      const prev = ref.current.settings[key];
      if (SAME(prev, next)) return;
      const freed = [...storageUrls(prev)].filter((u) => !storageUrls(next).has(u));
      const res = await persist(key, next);
      if (!res.success) {
        void persist(key, prev);
        toast({ kind: "error", text: t("images.saveFailed", { error: res.error }) });
        return;
      }
      if (freed.length) window.setTimeout(() => void offer(freed), 9000);
    },
    [persist, offer, t],
  );

  /**
   * Saves one picture slot. Some keys hold many slots (`tellers` has every voice), so the patch is
   * applied onto the CURRENT value, and Undo / failure rollback re-apply only this slot's previous
   * fields onto whatever is current then, never a stale snapshot of the whole key.
   */
  const changeSlot = useCallback(
    async (id: SlotId, patch: Partial<SlotValue>, text: string) => {
      const before = readSlot(ref.current.settings, id);
      const w = writeSlot(ref.current.settings, id, patch);
      if (!w) return;
      const prev = ref.current.settings[w.key];
      if (SAME(prev, w.value)) return;
      const freed = [...storageUrls(prev)].filter((u) => !storageUrls(w.value).has(u));
      const revert = (): Promise<ActionResult> => {
        const clearing = patch.src === "";
        const back: Partial<SlotValue> = {};
        if (patch.src !== undefined) back.src = before.src;
        if (patch.focus !== undefined || clearing) back.focus = before.focus;
        if (patch.alt !== undefined || clearing) back.alt = before.alt;
        const r = writeSlot(ref.current.settings, id, back);
        return r ? persist(r.key, r.value as never) : Promise.resolve({ success: true });
      };
      const res = await persist(w.key, w.value as never);
      if (!res.success) {
        void revert();
        toast({ kind: "error", text: t("images.saveFailed", { error: res.error }) });
        return;
      }
      toast({
        text,
        undo: () => {
          void revert().then((r) => {
            if (!r.success) toast({ kind: "error", text: t("images.saveFailed", { error: r.error }) });
          });
        },
        onExpire: freed.length ? () => void offer(freed) : undefined,
      });
    },
    [persist, offer, t],
  );

  /** `teamFocus` is shared with the team editor: always read it fresh, change one member, save. */
  const changeTeamFocus = useCallback(
    async (memberId: string, focus: Focus | null, text: string) => {
      const before = ref.current.settings.teamFocus[memberId] ?? null;
      if (SAME(before, focus)) return;
      const put = (m: Record<string, Focus>, f: Focus | null) => {
        const n = { ...m };
        if (f) n[memberId] = f;
        else delete n[memberId];
        return n;
      };
      const write = (f: Focus | null) => {
        ref.current = { ...ref.current, settings: { ...ref.current.settings, teamFocus: put(ref.current.settings.teamFocus, f) } };
        setSettings((s) => ({ ...s, teamFocus: put(s.teamFocus, f) }));
        return enqueue(async () => {
          const fresh = await api.readSetting?.("teamFocus").catch(() => null);
          const base = fresh && fresh.success && fresh.data ? fresh.data : ref.current.settings.teamFocus;
          return api.saveSetting("teamFocus", put(base, f));
        });
      };
      const res = await write(focus);
      if (!res.success) {
        void write(before);
        toast({ kind: "error", text: t("images.saveFailed", { error: res.error }) });
        return;
      }
      toast({
        text,
        undo: () => {
          void write(before).then((r) => {
            if (!r.success) toast({ kind: "error", text: t("images.saveFailed", { error: r.error }) });
          });
        },
      });
    },
    [enqueue, api, t],
  );

  const setPhoto = useCallback(
    async (row: TeamMemberRow, photoUrl: string, text: string) => {
      const prev = row.photo_url ?? "";
      const apply = (url: string) => setTeam((rows) => rows.map((r) => (r.id === row.id ? { ...r, photo_url: url || null } : r)));
      // keepOldFile: the old file must still exist if the person presses Undo; it is offered for deletion afterwards.
      const send = (url: string) => {
        const r = ref.current.team.find((x) => x.id === row.id) ?? row;
        return api
          .updateTeam(
            row.id,
            {
              nameEn: r.name_en,
              nameFa: r.name_fa,
              titleEn: r.title_en,
              titleFa: r.title_fa,
              roleEn: r.role_en,
              roleFa: r.role_fa,
              instagram: r.instagram,
              photoUrl: url || null,
            },
            { keepOldFile: true },
          )
          .catch(() => ({ success: false as const, error: t("networkError") }));
      };
      apply(photoUrl);
      const res = await send(photoUrl);
      if (!res.success) {
        apply(prev);
        toast({ kind: "error", text: t("images.saveFailed", { error: res.error }) });
        return;
      }
      toast({
        text,
        undo: () => {
          apply(prev);
          void send(prev).then((r) => {
            if (!r.success) toast({ kind: "error", text: t("images.saveFailed", { error: r.error }) });
          });
        },
        onExpire: prev && prev !== photoUrl ? () => void offer([prev]) : undefined,
      });
    },
    [t, api, offer],
  );

  /* ---- the cards ---- */
  const voiceName = useCallback(
    (id: string) => {
      const row = data.seriesCharacters.find((c) => c.slug === id);
      return row ? pick(row, "name", locale) : id;
    },
    [data.seriesCharacters, locale],
  );

  const cards = useMemo<Card[]>(() => {
    const out: Card[] = [];
    for (const id of TELLER_IDS) {
      const name = voiceName(id);
      out.push({ id: `voice:${id}:reel`, group: "home", section: t("images.reelFrames"), label: name, hint: t("images.reelHint"), aspect: "16/9", focusable: false, noun: t("images.noun.reel", { name }) });
    }
    for (const id of TELLER_IDS) {
      const name = voiceName(id);
      out.push({ id: `voice:${id}:portrait`, group: "series", section: name, label: t("images.portrait"), hint: t("images.portraitHint"), aspect: "16/9", frameAspect: "3/4", focusable: true, noun: t("images.noun.portrait", { name }) });
      for (const c of PLATE_CHAPTERS) {
        out.push({ id: `voice:${id}:plate:${c}`, group: "series", section: name, label: t(`images.chapter.${c}`), hint: t("images.plateHint"), aspect: "16/9", focusable: false, noun: t("images.noun.plate", { name, chapter: t(`images.chapter.${c}`) }) });
      }
    }
    out.push({ id: "archive:pinned", group: "archive", section: "", label: t("images.archive.label"), hint: t("images.archive.hint"), aspect: "16/9", focusable: true, alt: true, noun: t("images.archive.label") });
    for (const m of team) {
      const name = pick(m, "name", locale);
      out.push({ id: `team:${m.id}`, group: "about", section: "", label: name, hint: undefined, aspect: "3/4", focusable: true, photo: m.photo_url ?? "", noun: t("images.noun.team", { name }) });
    }
    out.push({ id: "seo:og", group: "site", section: "", label: t("images.og.label"), hint: t("images.og.hint"), aspect: "1200/630", focusable: false, noun: t("images.og.label") });
    return out;
  }, [team, locale, t, voiceName]);

  const valueOf = useCallback(
    (c: Card): SlotValue => {
      const v = readSlot(settings, c.id);
      return c.photo !== undefined ? { ...v, src: c.photo } : v;
    },
    [settings],
  );

  /** Apply a change of one picture / its framing, with the right toast. */
  const apply = useCallback(
    async (c: Card, patch: Partial<SlotValue>, kind: "set" | "reset" | "frame") => {
      const text = kind === "reset" ? t("images.toast.reset", { name: c.noun }) : kind === "frame" ? t("images.toast.frame", { name: c.noun }) : t("images.toast.set", { name: c.noun });
      if (c.photo !== undefined) {
        const row = ref.current.team.find((r) => `team:${r.id}` === c.id);
        if (patch.src !== undefined && row) await setPhoto(row, patch.src, patch.src ? text : t("images.toast.removed", { name: c.noun }));
        if (patch.focus !== undefined && row) await changeTeamFocus(row.id, patch.focus, text);
        return;
      }
      await changeSlot(c.id, patch, patch.src === "" && !builtInOf(c.id) ? t("images.toast.removed", { name: c.noun }) : text);
    },
    [changeSlot, changeTeamFocus, setPhoto, t],
  );

  /* ---- toolbar state ---- */
  const [query, setQuery] = useState("");
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [open, setOpen] = useState<Set<GroupId>>(new Set(["home"]));
  const q = norm(query.trim());
  const searching = q.length > 0 || onlyCustom;

  const customised = (c: Card) => {
    const v = valueOf(c);
    return !!v.src || (c.focusable && !!v.focus);
  };
  const wallOn = settings.wall.length > 0;
  const filmsOn = !SAME(settings.heroVideos, SETTING_DEFAULTS.heroVideos);
  const totals = useMemo(() => {
    const own = cards.filter((c) => c.group !== "about" || c.photo !== undefined);
    return { total: own.length + 2, custom: own.filter(customised).length + (wallOn ? 1 : 0) + (filmsOn ? 1 : 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, settings, wallOn, filmsOn]);

  const groupLabel = (id: GroupId) => t(`images.groups.${id}`);
  const matches = (c: Card) => {
    if (onlyCustom && !customised(c)) return false;
    if (!q) return true;
    return norm(`${c.label} ${c.section} ${groupLabel(c.group)} ${c.hint ?? ""}`).includes(q);
  };

  const [pickFor, setPickFor] = useState<Card | null>(null);
  const [frameFor, setFrameFor] = useState<Card | null>(null);

  const toggle = (id: GroupId) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const textMatch = (words: string) => !q || norm(words).includes(q);

  const views = GROUPS.map((g) => {
    const list = cards.filter((c) => c.group === g.id);
    const home = g.id === "home";
    const shown = list.filter(matches);
    const showWall = home && (!onlyCustom || wallOn) && textMatch(`${t("images.wall.label")} ${groupLabel("home")}`);
    const showFilms = home && (!onlyCustom || filmsOn) && textMatch(`${t("images.films.label")} ${groupLabel("home")}`);
    const fixed = g.id === "projects" || g.id === "code";
    const any = fixed ? !onlyCustom && textMatch(groupLabel(g.id)) : shown.length > 0 || showWall || showFilms;
    return {
      g,
      list,
      shown,
      showWall,
      showFilms,
      any,
      customCount: list.filter(customised).length + (home ? (wallOn ? 1 : 0) + (filmsOn ? 1 : 0) : 0),
      totalCount: list.length + (home ? 2 : 0),
    };
  }).filter((v) => !searching || v.any);

  const renderCards = (list: Card[]) => (
    <ul className="si-grid">
      {list.map((c) => (
        <SlotCard
          key={c.id}
          card={c}
          value={valueOf(c)}
          onChange={() => setPickFor(c)}
          onFrame={() => setFrameFor(c)}
          onReset={() => void apply(c, c.focusable ? { src: "", focus: null } : { src: "" }, "reset")}
        />
      ))}
    </ul>
  );

  const bySection = (list: Card[]) => {
    const map = new Map<string, Card[]>();
    for (const c of list) map.set(c.section, [...(map.get(c.section) ?? []), c]);
    return [...map.entries()];
  };

  return (
    <PanelFrame id="images" labelledBy={labelledBy} hidden={hidden} title={t("images.title")} sub={t("images.sub")}>
      <MediaStyles />
      <div className="si-bar">
        <p className="si-summary" aria-live="polite">
          <strong>{t("images.summary", { custom: totals.custom, total: totals.total })}</strong>
          <span>{t("images.summaryHint")}</span>
        </p>
        <div className="si-filters">
          <div className="si-search">
            <label className="sr-only" htmlFor="si-q">
              {t("images.search")}
            </label>
            <input id="si-q" type="search" className="lbf-input" placeholder={t("images.search")} value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
          </div>
          <label className="si-check">
            <input type="checkbox" checked={onlyCustom} onChange={(e) => setOnlyCustom(e.target.checked)} />
            <span>{t("images.onlyCustom")}</span>
          </label>
        </div>
      </div>

      <div className="si-groups">
        {views.map(({ g, list, shown, customCount, totalCount, showWall, showFilms }) => {
          const isOpen = searching || open.has(g.id);
          const panelId = `si-g-${g.id}`;
          return (
            <section key={g.id} className="si-group" data-open={isOpen ? "true" : "false"} aria-labelledby={`${panelId}-h`}>
              <div className="si-group-head">
                <h3 className="si-group-h" id={`${panelId}-h`}>
                  <button type="button" className="si-group-btn" aria-expanded={isOpen} aria-controls={panelId} onClick={() => toggle(g.id)} disabled={searching}>
                    <span className="adm-caret" aria-hidden="true" />
                    {groupLabel(g.id)}
                  </button>
                </h3>
                {g.id !== "code" && g.id !== "projects" && (
                  <span className="si-group-count">{t("images.groupCount", { custom: customCount, total: totalCount })}</span>
                )}
                {g.path && (
                  <Link href={g.path} target="_blank" rel="noopener" className="lbf-textbtn si-view">
                    {t("images.viewOnSite")}
                    <span className="sr-only"> ({t("newTab")})</span>
                  </Link>
                )}
              </div>
              {isOpen && (
                <div className="si-group-body" id={panelId}>
                  <p className="si-group-sub">{t(`images.groupSub.${g.id}`)}</p>
                  {showWall && (
                    <div className="si-block">
                      <WallEditor wall={settings.wall} onChange={(next) => void change("wall", next)} />
                    </div>
                  )}
                  {showFilms && (
                    <div className="si-block">
                      <FilmsEditor films={settings.heroVideos} onChange={(next) => void change("heroVideos", next)} />
                    </div>
                  )}
                  {g.id === "projects" ? (
                    <ProjectCovers projects={data.projects} locale={locale} />
                  ) : g.id === "code" ? (
                    <ReadOnly />
                  ) : (
                    bySection(shown).map(([section, items]) => (
                      <div key={section} className="si-block">
                        {section && <h4 className="si-section">{section}</h4>}
                        {renderCards(items)}
                      </div>
                    ))
                  )}
                  {g.id === "about" && list.length === 0 && <p className="si-empty">{t("images.emptyTeam")}</p>}
                </div>
              )}
            </section>
          );
        })}
        {views.length === 0 && (
            <div className="si-none" role="status">
              <p>{t("images.noMatch")}</p>
              <button
                type="button"
                className="adm-btn"
                onClick={() => {
                  setQuery("");
                  setOnlyCustom(false);
                }}
              >
                {t("images.clearFilters")}
              </button>
            </div>
          )}
      </div>

      {pickFor && (
        <ImagePicker
          bucket="projects"
          imagesOnly
          title={t("field.pickTitle", { label: pickFor.noun })}
          hints={pickFor.id === "seo:og" ? { recommended: { width: 1200, height: 630 }, minWidth: 1000 } : undefined}
          onClose={() => setPickFor(null)}
          onPick={(urls) => {
            const c = pickFor;
            setPickFor(null);
            if (urls[0]) void apply(c, { src: urls[0] }, "set");
          }}
        />
      )}
      {frameFor && (
        <FrameDialog
          key={frameFor.id}
          card={frameFor}
          value={valueOf(frameFor)}
          onClose={() => setFrameFor(null)}
          onDone={(patch) => {
            const c = frameFor;
            setFrameFor(null);
            if (Object.keys(patch).length) void apply(c, patch, "frame");
          }}
        />
      )}
    </PanelFrame>
  );
}

/* ------------------------------------------------------------------ */

function SlotCard({ card, value, onChange, onFrame, onReset }: { card: Card; value: SlotValue; onChange: () => void; onFrame: () => void; onReset: () => void }) {
  const t = useTranslations("adminMedia");
  const builtIn = builtInOf(card.id);
  const src = value.src || builtIn || "";
  const custom = !!value.src;
  const id = useId();
  const [broken, setBroken] = useState(false);
  const [seenSrc, setSeenSrc] = useState(src);
  if (seenSrc !== src) {
    setSeenSrc(src);
    setBroken(false);
  }
  const status = custom ? t("images.status.custom") : builtIn ? t("images.status.builtIn") : t("images.status.empty");
  const canReset = custom || (card.group === "series" && card.focusable && !!value.focus);
  return (
    <li className="si-card" data-custom={custom ? "true" : "false"} data-empty={src ? "false" : "true"}>
      <button type="button" className="si-thumb" style={{ aspectRatio: card.aspect }} onClick={onChange} aria-labelledby={`${id}-n`} aria-describedby={`${id}-s`}>
        {src && !broken ? (
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            style={value.focus ? { objectPosition: `${value.focus[0]}% ${value.focus[1]}%` } : undefined}
            onError={() => setBroken(true)}
          />
        ) : (
          <span className="si-thumb-none">
            <PhotoIcon />
            <span>{broken ? t("field.broken") : t("images.add")}</span>
          </span>
        )}
        <span className="si-thumb-act" aria-hidden="true">
          {src ? t("images.change") : t("images.add")}
        </span>
      </button>
      <div className="si-meta">
        <p className="si-name" id={`${id}-n`}>
          {card.label}
        </p>
        <p className="si-status" id={`${id}-s`} data-custom={custom ? "true" : "false"}>
          {status}
        </p>
      </div>
      <div className="si-acts">
        <button type="button" className="adm-btn si-main" onClick={onChange}>
          {src ? t("images.change") : t("images.add")}
          <span className="sr-only"> ({card.noun})</span>
        </button>
        {((card.focusable && src) || canReset) && (
          <div className="si-acts-row">
            {card.focusable && src && (
              <button type="button" className="adm-btn adm-btn-quiet" onClick={onFrame}>
                {t("images.framing")}
                <span className="sr-only"> ({card.noun})</span>
              </button>
            )}
            {canReset && (
              <button type="button" className="adm-btn adm-btn-quiet" onClick={onReset}>
                {builtIn ? t("images.reset") : t("images.remove")}
                <span className="sr-only"> ({card.noun})</span>
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Focus point and description of one picture; saved once, when the person presses Done. */
function FrameDialog({ card, value, onClose, onDone }: { card: Card; value: SlotValue; onClose: () => void; onDone: (patch: Partial<SlotValue>) => void }) {
  const t = useTranslations("adminMedia");
  const builtIn = builtInOf(card.id);
  const [src, setSrc] = useState(value.src);
  const [focus, setFocus] = useState<Focus | null>(value.focus);
  const [alt, setAlt] = useState(value.alt);
  const done = () => {
    const patch: Partial<SlotValue> = {};
    if (src !== value.src) patch.src = src;
    if (!SAME(focus, value.focus)) patch.focus = focus;
    if (card.alt && alt !== value.alt) patch.alt = alt;
    onDone(patch);
  };
  return (
    <MediaDialog
      title={t("images.frameTitle", { label: card.noun })}
      onClose={onClose}
      size="narrow"
      footer={
        <>
          <button type="button" className="adm-btn adm-btn-quiet" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={done} data-autofocus>
            {t("images.done")}
          </button>
        </>
      }
    >
      <ImageField
        label={card.noun}
        value={src || builtIn || ""}
        onChange={(u) => setSrc(u)}
        bucket="projects"
        imagesOnly
        aspect={card.frameAspect ?? card.aspect}
        focus={focus}
        onFocusChange={setFocus}
        alt={card.alt ? alt : undefined}
        onAltChange={card.alt ? setAlt : undefined}
        builtIn={!!builtIn}
        defaultDetails
      />
    </MediaDialog>
  );
}

function ProjectCovers({ projects, locale }: { projects: AdminData["projects"]; locale: "en" | "fa" }) {
  const t = useTranslations("adminMedia");
  if (!projects.length) return <p className="si-empty">{t("images.emptyProjects")}</p>;
  return (
    <ul className="si-grid si-grid-ro">
      {projects.map((p) => {
        const name = pick(p, "title", locale);
        const gallery = p.gallery_urls?.length ?? 0;
        return (
          <li key={p.id} className="si-card" data-custom="false" data-empty={p.image_url ? "false" : "true"}>
            <a className="si-thumb" style={{ aspectRatio: "16/9" }} href="#projects" aria-label={t("images.editProject", { name })}>
              {p.image_url ? <img src={p.image_url} alt="" loading="lazy" decoding="async" /> : (
                <span className="si-thumb-none">
                  <PhotoIcon />
                  <span>{t("images.noCover")}</span>
                </span>
              )}
              <span className="si-thumb-act" aria-hidden="true">
                {t("images.editInProjects")}
              </span>
            </a>
            <div className="si-meta">
              <p className="si-name">{name}</p>
              <p className="si-status">{gallery ? t("images.coverGallery", { count: gallery }) : t("images.coverOnly")}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const CODE_ITEMS = ["favicon", "logo", "models", "textures", "seal"] as const;
function ReadOnly(): ReactNode {
  const t = useTranslations("adminMedia");
  return (
    <ul className="si-ro">
      {CODE_ITEMS.map((k) => (
        <li key={k}>
          <p className="si-name">{t(`images.code.${k}.name`)}</p>
          <p className="si-status">{t(`images.code.${k}.why`)}</p>
        </li>
      ))}
    </ul>
  );
}

