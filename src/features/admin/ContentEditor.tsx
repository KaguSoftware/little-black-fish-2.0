"use client";

import { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/shared/data/localize";
import type { ContentEntry } from "@/shared/actions/admin/types";
import type { ContentLocale } from "@/shared/data/types";
import { Badge, PanelFrame } from "./forms";
import type { Notify } from "./parts";
import { useAdminActions } from "./actions-seam";
import { Icon } from "./icons-ux";
import { SaveBar } from "./ux";
import { LangSwitch, useEditLang } from "./LangSwitch";

const NS_ORDER = ["home", "about", "contact", "support", "series", "footer", "nav", "archive", "category", "project", "login", "errors", "common"];
/** Where each namespace is visible on the public site. */
const LIVE_PATH: Record<string, string> = {
  home: "/",
  about: "/about",
  contact: "/contact",
  support: "/support",
  series: "/",
  footer: "/",
  nav: "/",
  archive: "/projects",
  category: "/projects",
  project: "/projects",
  login: "/login",
  errors: "/this-page-does-not-exist",
  common: "/",
};

const PAGE = 40;
const SEARCH_CAP = 60;
const CHUNK = 500;

const dk = (loc: ContentLocale, key: string) => `${loc}:${key}`;
const isLong = (s: string) => s.length > 80 || s.includes("\n");
const tokens = (s: string) => (s.match(/\{[^{}]*\}|<\/?[a-z][a-z0-9]*>/gi) ?? []).sort().join("|");
const groupOf = (path: string) => (path.includes(".") ? path.slice(0, path.indexOf(".")) : "");

/** "heroTitle" / "hero_title" -> "Hero title"; list positions become 1-based "#2". */
function humanize(seg: string): string {
  if (/^\d+$/.test(seg)) return "#" + (Number(seg) + 1);
  const words = seg
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
export const humanPath = (path: string) => path.split(".").map(humanize).join(" › ");

type Overlay = Record<string, { value: string; overridden: boolean }>;

/** Asks the editor to show a page, or to jump to one text (from the quick find or the dashboard). */
export interface ContentRequest {
  n: number;
  ns?: string;
  query?: string;
  focusKey?: string;
}

/** Everything on the public site that is plain text, both languages side by side, page by page. */
export function ContentEditor({
  entries,
  notify,
  hidden,
  labelledBy,
  onDirty,
  request,
}: {
  entries: ContentEntry[];
  notify: Notify;
  hidden: boolean;
  labelledBy: string;
  onDirty: (dirty: boolean) => void;
  request?: ContentRequest | null;
}) {
  const t = useTranslations("admin");
  const actions = useAdminActions();
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const searchId = useId();
  const [lang, setLang] = useEditLang();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [overlay, setOverlay] = useState<Overlay>({});
  const [overlayFor, setOverlayFor] = useState(entries);
  // Fresh server data supersedes the optimistic overlay.
  if (overlayFor !== entries) {
    setOverlayFor(entries);
    setOverlay({});
  }

  const [ns, setNs] = useState<string>("");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [modifiedOnly, setModifiedOnly] = useState(false);
  /** Key of the row holding focus: the "edited only" filter must not drop it while it is edited. */
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<Map<string, boolean>>(() => new Map());
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [busyReset, setBusyReset] = useState<string | null>(null);
  const [pageBusy, setPageBusy] = useState(false);
  const [limit, setLimit] = useState(SEARCH_CAP);
  const [seenReq, setSeenReq] = useState(0);
  const [focusTarget, setFocusTarget] = useState<string | null>(null);

  const byKey = useMemo(() => new Map(entries.map((e) => [e.key, e])), [entries]);

  // A jump from the quick find / dashboard: show that page (or that exact text).
  if (request && request.n !== seenReq) {
    setSeenReq(request.n);
    const target = request.focusKey ? byKey.get(request.focusKey) : undefined;
    const nextNs = target?.namespace ?? request.ns;
    if (nextNs) setNs(nextNs);
    setQuery(request.query ?? "");
    setModifiedOnly(false);
    if (target) {
      setOpenMap((m) => new Map(m).set(`${target.namespace}|${groupOf(target.path)}`, true));
      setFocusTarget(target.key);
    }
  }
  useEffect(() => {
    if (!focusTarget || hidden) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const row = document.querySelector<HTMLElement>(`[data-ckey="${CSS.escape(focusTarget)}"]`);
        if (row) {
          row.scrollIntoView({ block: "center" });
          row.querySelector<HTMLElement>("input,textarea")?.focus({ preventScroll: true });
          row.dataset.found = "true";
          window.setTimeout(() => delete row.dataset.found, 2200);
        }
        setFocusTarget(null);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [focusTarget, hidden]);

  const namespaces = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.namespace, (counts.get(e.namespace) ?? 0) + 1);
    const names = [...counts.keys()].sort((a, b) => {
      const ia = NS_ORDER.indexOf(a);
      const ib = NS_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
    return names.map((name) => ({ name, count: counts.get(name) ?? 0 }));
  }, [entries]);

  const activeNs = ns && namespaces.some((n) => n.name === ns) ? ns : (namespaces[0]?.name ?? "");
  const nsName = useCallback((name: string) => (t.has(`content.ns.${name}`) ? t(`content.ns.${name}`) : humanize(name)), [t]);

  const effective = useCallback(
    (e: ContentEntry, loc: ContentLocale) => {
      const o = overlay[dk(loc, e.key)];
      return o ? o.value : loc === "en" ? e.en : e.fa;
    },
    [overlay],
  );
  const overridden = useCallback(
    (e: ContentEntry, loc: ContentLocale) => {
      const o = overlay[dk(loc, e.key)];
      return o ? o.overridden : loc === "en" ? e.enOverridden : e.faOverridden;
    },
    [overlay],
  );

  const draftCount = Object.keys(drafts).length;
  useEffect(() => onDirty(draftCount > 0), [draftCount, onDirty]);

  const setDraft = useCallback((e: ContentEntry, loc: ContentLocale, value: string) => {
    const k = dk(loc, e.key);
    setDrafts((d) => ({ ...d, [k]: value }));
  }, []);

  // Typing the original text back removes the draft.
  const normalizeDraft = useCallback(
    (e: ContentEntry, loc: ContentLocale, value: string) => {
      const k = dk(loc, e.key);
      if (value === effective(e, loc)) {
        setDrafts((d) => {
          if (!(k in d)) return d;
          const copy = { ...d };
          delete copy[k];
          return copy;
        });
      } else setDraft(e, loc, value);
    },
    [effective, setDraft],
  );

  const revert = useCallback((e: ContentEntry, loc: ContentLocale) => {
    const k = dk(loc, e.key);
    setDrafts((d) => {
      if (!(k in d)) return d;
      const copy = { ...d };
      delete copy[k];
      return copy;
    });
  }, []);

  const defaultOf = (e: ContentEntry, loc: ContentLocale) => (loc === "en" ? e.enDefault : e.faDefault);

  /** Writes values straight to the server (used by Undo of a reset). */
  const restore = useCallback(
    async (items: { e: ContentEntry; loc: ContentLocale; value: string }[]) => {
      try {
        const res = await actions.saveContent(items.map((i) => ({ key: i.e.key, locale: i.loc, value: i.value })));
        if (!res.success) return notify.fail(t("saveFailed"));
        setOverlay((o) => {
          const copy = { ...o };
          for (const i of items) copy[dk(i.loc, i.e.key)] = { value: i.value, overridden: i.value !== defaultOf(i.e, i.loc) };
          return copy;
        });
        startRefresh(() => router.refresh());
      } catch {
        notify.fail(t("saveFailed"));
      }
    },
    [actions, notify, router, t],
  );

  /** Back to the built-in text. Instant, with Undo (nothing is lost: Undo writes the old text back). */
  const resetMany = useCallback(
    async (items: { e: ContentEntry; loc: ContentLocale }[], single: boolean) => {
      if (!items.length) return;
      const prev = items.map((i) => ({ ...i, value: effective(i.e, i.loc) }));
      const first = items[0];
      if (single) setBusyReset(dk(first.loc, first.e.key));
      else setPageBusy(true);
      try {
        for (let i = 0; i < items.length; i += 8) {
          const batch = items.slice(i, i + 8);
          const results = await Promise.all(batch.map((it) => actions.resetContent(it.e.key, it.loc)));
          if (results.some((r) => !r.success)) throw new Error("reset");
        }
        setOverlay((o) => {
          const copy = { ...o };
          for (const i of items) copy[dk(i.loc, i.e.key)] = { value: defaultOf(i.e, i.loc), overridden: false };
          return copy;
        });
        items.forEach((i) => revert(i.e, i.loc));
        notify.ok(single ? t("content.resetDone") : t("content.pageResetDone", { count: items.length }), { undo: () => void restore(prev) });
        startRefresh(() => router.refresh());
      } catch {
        notify.fail(t("saveFailed"));
      } finally {
        setBusyReset(null);
        setPageBusy(false);
      }
    },
    [actions, effective, notify, restore, revert, router, t],
  );

  const reset = useCallback((e: ContentEntry, loc: ContentLocale) => resetMany([{ e, loc }], true), [resetMany]);

  const saveAll = useCallback(async () => {
    const pending = Object.entries(drafts).map(([k, value]) => {
      const loc = k.slice(0, 2) as ContentLocale;
      return { key: k.slice(3), locale: loc, value };
    });
    if (!pending.length) return;
    setSaving(true);
    let done = 0;
    try {
      for (let i = 0; i < pending.length; i += CHUNK) {
        const chunk = pending.slice(i, i + CHUNK);
        const res = await actions.saveContent(chunk);
        if (!res.success) {
          notify.fail(t("saveFailed"));
          break;
        }
        done += chunk.length;
        setOverlay((o) => {
          const copy = { ...o };
          for (const c of chunk) {
            const e = byKey.get(c.key);
            const def = e ? (c.locale === "en" ? e.enDefault : e.faDefault) : "";
            copy[dk(c.locale, c.key)] = { value: c.value, overridden: c.value !== def };
          }
          return copy;
        });
        setDrafts((d) => {
          const copy = { ...d };
          // Only drop a draft that still equals what was saved (typing may continue during the save).
          for (const c of chunk) if (copy[dk(c.locale, c.key)] === c.value) delete copy[dk(c.locale, c.key)];
          return copy;
        });
      }
      if (done === pending.length) setSavedAt(Date.now());
      if (done > 0) startRefresh(() => router.refresh());
    } catch {
      notify.fail(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [actions, byKey, drafts, notify, router, t]);

  const discardAll = () => {
    const prev = drafts;
    const count = Object.keys(prev).length;
    setDrafts({});
    notify.ok(t("content.discarded", { count }), { undo: () => setDrafts(prev) });
  };

  const q = deferredQuery.trim().toLowerCase();
  const searching = q.length > 0;

  const visible = useMemo(() => {
    const pool = searching ? entries : entries.filter((e) => e.namespace === activeNs);
    return pool.filter((e) => {
      if (modifiedOnly && e.key !== focusKey && !(overridden(e, "en") || overridden(e, "fa") || dk("en", e.key) in drafts || dk("fa", e.key) in drafts)) {
        return false;
      }
      if (!searching) return true;
      return (
        e.key.toLowerCase().includes(q) ||
        effective(e, "en").toLowerCase().includes(q) ||
        effective(e, "fa").toLowerCase().includes(q) ||
        e.enDefault.toLowerCase().includes(q) ||
        e.faDefault.toLowerCase().includes(q)
      );
    });
    // drafts intentionally read at filter time only for the edited-only view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, searching, activeNs, q, modifiedOnly, overridden, effective, modifiedOnly ? drafts : null, focusKey]);

  const groups = useMemo(() => {
    if (searching) return [];
    const m = new Map<string, ContentEntry[]>();
    for (const e of visible) {
      const g = groupOf(e.path);
      (m.get(g) ?? m.set(g, []).get(g)!).push(e);
    }
    return [...m.entries()].map(([name, list]) => ({ name, list }));
  }, [visible, searching]);

  const modifiedByNs = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) if (overridden(e, "en") || overridden(e, "fa")) m.set(e.namespace, (m.get(e.namespace) ?? 0) + 1);
    return m;
  }, [entries, overridden]);

  const locale = useLocale() as "en" | "fa";
  const num = (n: number) => formatNumber(n, locale);

  const pageEdited = activeNs ? (modifiedByNs.get(activeNs) ?? 0) : 0;
  const resetPage = () => {
    const items: { e: ContentEntry; loc: ContentLocale }[] = [];
    for (const e of entries) {
      if (e.namespace !== activeNs) continue;
      if (overridden(e, "en")) items.push({ e, loc: "en" });
      if (overridden(e, "fa")) items.push({ e, loc: "fa" });
    }
    void resetMany(items, false);
  };

  const renderRow = (e: ContentEntry, showNs: boolean) => (
    <ContentRow
      key={e.key}
      entry={e}
      label={showNs ? `${nsName(e.namespace)} › ${humanPath(e.path)}` : humanPath(e.path.includes(".") ? e.path.slice(e.path.indexOf(".") + 1) : e.path)}
      showKey={showNs}
      en={drafts[dk("en", e.key)] ?? effective(e, "en")}
      fa={drafts[dk("fa", e.key)] ?? effective(e, "fa")}
      enDraft={dk("en", e.key) in drafts}
      faDraft={dk("fa", e.key) in drafts}
      enMod={overridden(e, "en")}
      faMod={overridden(e, "fa")}
      enBusy={busyReset === dk("en", e.key)}
      faBusy={busyReset === dk("fa", e.key)}
      onChange={normalizeDraft}
      onRevert={revert}
      onReset={reset}
    />
  );

  const partName = (name: string) => (!name ? t("content.general") : t.has(`content.parts.${name}`) ? t(`content.parts.${name}`) : humanize(name));

  return (
    <PanelFrame
      id="content"
      labelledBy={labelledBy}
      hidden={hidden}
      title={t("content.title")}
      sub={t("content.sub")}
      viewPath={!searching && activeNs ? null : "/"}
      editLang={lang}
    >
      <div className="ux-pages" role="group" aria-label={t("content.namespaces")}>
        {namespaces.map((n) => {
          const mod = modifiedByNs.get(n.name) ?? 0;
          const sel = !searching && n.name === activeNs;
          return (
            <button
              key={n.name}
              type="button"
              className="ux-page"
              aria-pressed={sel}
              onClick={() => {
                setNs(n.name);
                setQuery("");
              }}
            >
              <Icon name="page" className="ux-page-ico" />
              <span className="ux-page-name">{nsName(n.name)}</span>
              {mod > 0 && (
                <span className="ux-page-mod" title={t("content.modifiedCount", { count: mod })}>
                  <span className="sr-only">{t("content.modifiedCount", { count: mod })}</span>
                  <span aria-hidden="true">{num(mod)}</span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="adm-ctools">
        <div className="lbf-field adm-csearch">
          <label className="lbf-label" htmlFor={searchId}>
            {t("content.search")}
          </label>
          <input
            id={searchId}
            className="lbf-input"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(SEARCH_CAP);
            }}
            placeholder={t("content.searchPlaceholder")}
            autoComplete="off"
          />
        </div>
        <label className="lbf-check">
          <input type="checkbox" checked={modifiedOnly} onChange={(e) => setModifiedOnly(e.target.checked)} />
          <span>{t("content.modifiedOnly")}</span>
        </label>
      </div>

      {!searching && activeNs && (
        <div className="ux-pagecard">
          <div className="ux-pagecard-text">
            <h3 className="ux-h3">{nsName(activeNs)}</h3>
            <p className="adm-sub">{t.has(`content.nsDesc.${activeNs}`) ? t(`content.nsDesc.${activeNs}`) : t("content.nsDescFallback")}</p>
          </div>
          <div className="ux-acts">
            <Link href={LIVE_PATH[activeNs] ?? "/"} target="_blank" rel="noopener" className="ux-btn" data-quiet="true">
              {t("content.viewLive")}
              <Icon name="external" className="ux-btn-ico" />
              <span className="sr-only"> ({t("opensNewTab")})</span>
            </Link>
            {pageEdited > 0 && (
              <button type="button" className="ux-btn" data-quiet="true" onClick={resetPage} disabled={pageBusy} aria-busy={pageBusy}>
                {pageBusy ? t("content.resetting") : t("content.resetPage", { count: pageEdited })}
              </button>
            )}
          </div>
        </div>
      )}

      <LangSwitch value={lang} onChange={setLang} />

      <div className="adm-cmeta" role="status" aria-live="polite">
        <span>{searching ? t("content.results", { count: visible.length }) : t("content.inNamespace", { count: visible.length })}</span>
      </div>

      <div
        style={{ display: "contents" }}
        onFocus={(ev) => setFocusKey((ev.target as HTMLElement).closest<HTMLElement>("[data-ckey]")?.dataset.ckey ?? null)}
        onBlur={() => setFocusKey(null)}
      >
        {visible.length === 0 ? (
          <div className="adm-empty">
            <p className="adm-empty-title">{searching ? t("content.noResultsTitle") : t("content.emptyTitle")}</p>
            <p className="adm-empty-text">{searching ? t("content.noResultsText") : t("content.emptyText")}</p>
          </div>
        ) : searching ? (
          <div className="adm-crows">
            {visible.slice(0, limit).map((e) => renderRow(e, true))}
            {visible.length > limit && (
              <button type="button" className="ux-btn adm-more" onClick={() => setLimit((l) => l + SEARCH_CAP)}>
                {t("content.showMore", { count: visible.length - limit })}
              </button>
            )}
          </div>
        ) : (
          <div className="adm-cgroups">
            {groups.map((g, gi) => {
              const gid = `${activeNs}|${g.name}`;
              const mods = g.list.filter((e) => overridden(e, "en") || overridden(e, "fa")).length;
              const unsaved = g.list.filter((e) => dk("en", e.key) in drafts || dk("fa", e.key) in drafts).length;
              const isOpen = openMap.get(gid) ?? (groups.length <= 3 || gi === 0 || unsaved > 0);
              const first = effective(g.list[0], locale);
              return (
                <section key={gid} className="adm-cgroup" data-open={isOpen ? "true" : "false"}>
                  <h3 className="adm-cgroup-h">
                    <button
                      type="button"
                      className="adm-cgroup-btn"
                      aria-expanded={isOpen}
                      onClick={() => setOpenMap((m) => new Map(m).set(gid, !isOpen))}
                    >
                      <span className="adm-cgroup-caret" aria-hidden="true" />
                      <span className="ux-cg-name">{partName(g.name)}</span>
                      {!isOpen && first && (
                        <span className="ux-cg-peek" dir="auto">
                          {first.length > 70 ? first.slice(0, 70) + "…" : first}
                        </span>
                      )}
                      <span className="adm-cgroup-n">
                        {mods > 0 && <span className="ux-cg-mod">{t("content.modifiedCount", { count: mods })}</span>}
                        {unsaved > 0 && <span className="ux-cg-uns">{t("content.unsavedCount", { count: unsaved })}</span>}
                        <span>{num(g.list.length)}</span>
                      </span>
                    </button>
                  </h3>
                  {isOpen && <GroupBody list={g.list} render={renderRow} />}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <SaveBar
        dirty={draftCount > 0}
        saving={saving}
        savedAt={savedAt}
        summary={t("content.unsaved", { count: draftCount })}
        saveLabel={t("content.saveN", { count: draftCount })}
        onSave={saveAll}
        onDiscard={discardAll}
        active={!hidden}
        label={t("content.saveBar")}
      />
    </PanelFrame>
  );
}

function GroupBody({ list, render }: { list: ContentEntry[]; render: (e: ContentEntry, showNs: boolean) => ReactNode }) {
  const t = useTranslations("admin");
  const [shown, setShown] = useState(PAGE);
  return (
    <div className="adm-crows">
      {list.slice(0, shown).map((e) => render(e, false))}
      {list.length > shown && (
        <button type="button" className="ux-btn adm-more" onClick={() => setShown((s) => s + PAGE)}>
          {t("content.showMore", { count: list.length - shown })}
        </button>
      )}
    </div>
  );
}

interface RowProps {
  entry: ContentEntry;
  label: string;
  showKey: boolean;
  en: string;
  fa: string;
  enDraft: boolean;
  faDraft: boolean;
  enMod: boolean;
  faMod: boolean;
  enBusy: boolean;
  faBusy: boolean;
  onChange: (e: ContentEntry, loc: ContentLocale, value: string) => void;
  onRevert: (e: ContentEntry, loc: ContentLocale) => void;
  onReset: (e: ContentEntry, loc: ContentLocale) => void;
}

const ContentRow = memo(function ContentRow(p: RowProps) {
  const { entry: e } = p;
  const t = useTranslations("admin");
  const id = useId();
  const long = isLong(e.enDefault) || isLong(e.faDefault) || isLong(e.en) || isLong(e.fa);
  const modified = p.enMod || p.faMod;
  const unsaved = p.enDraft || p.faDraft;

  const lane = (loc: ContentLocale) => {
    const value = loc === "en" ? p.en : p.fa;
    const def = loc === "en" ? e.enDefault : e.faDefault;
    const mod = loc === "en" ? p.enMod : p.faMod;
    const draft = loc === "en" ? p.enDraft : p.faDraft;
    const busy = loc === "en" ? p.enBusy : p.faBusy;
    const dir = loc === "fa" ? "rtl" : "ltr";
    const inputId = `${id}-${loc}`;
    const differs = value !== def;
    const tokenWarn = draft && tokens(value) !== tokens(def);
    const common = {
      id: inputId,
      className: "lbf-input",
      dir,
      lang: loc,
      value,
      "aria-describedby": `${inputId}-meta`,
      onChange: (ev: { target: { value: string } }) => p.onChange(e, loc, ev.target.value),
    } as const;
    return (
      <div className="lbf-field adm-clane" data-draft={draft ? "true" : "false"}>
        <label className="lbf-label" htmlFor={inputId}>
          {loc === "en" ? t("langEn") : t("langFa")}
          <span className="sr-only"> — {p.label}</span>
        </label>
        {long ? <textarea {...common} rows={Math.min(8, Math.max(3, Math.ceil(value.length / 60)))} /> : <input {...common} type="text" />}
        <div className="adm-cmeta-line" id={`${inputId}-meta`}>
          {mod && !draft && <Badge tone="accent">{t("content.modified")}</Badge>}
          {draft && <Badge tone="warn">{t("content.unsavedBadge")}</Badge>}
          {draft && (
            <button type="button" className="ux-link" onClick={() => p.onRevert(e, loc)}>
              {t("content.undo")}
              <span className="sr-only">: {p.label}</span>
            </button>
          )}
          {mod && (
            <button type="button" className="ux-link" onClick={() => p.onReset(e, loc)} disabled={busy} aria-busy={busy}>
              {busy ? t("content.resetting") : t("content.reset")}
              <span className="sr-only">: {p.label}</span>
            </button>
          )}
        </div>
        {tokenWarn && <p className="lbf-error">{t("content.placeholderWarn")}</p>}
        {differs && (
          <p className="adm-cdefault" dir={dir} lang={loc}>
            <span className="adm-cdefault-l">{t("content.default")}</span> {def || t("content.emptyDefault")}
          </p>
        )}
      </div>
    );
  };

  return (
    <article className="adm-crow" data-ckey={e.key} data-modified={modified ? "true" : "false"} data-unsaved={unsaved ? "true" : "false"} title={e.key}>
      <p className="ux-crow-label" dir="auto">
        {p.label}
        {p.showKey && (
          <span className="ux-crow-key" dir="ltr">
            {e.key}
          </span>
        )}
      </p>
      <div className="adm-pair adm-cpair" data-bi="">
        {lane("en")}
        {lane("fa")}
      </div>
    </article>
  );
});
