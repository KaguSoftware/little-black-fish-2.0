"use client";

import { memo, useCallback, useDeferredValue, useEffect, useId, useMemo, useState, useTransition, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatNumber } from "@/shared/data/localize";
import type { ContentEntry } from "@/shared/actions/admin/types";
import { resetContent, saveContent } from "@/shared/actions/admin/content";
import type { ContentLocale } from "@/shared/data/types";
import { Badge, PanelFrame } from "./forms";
import type { Notify } from "./parts";

const NS_ORDER = ["home", "about", "contact", "support", "series", "footer", "nav", "archive", "category", "project", "login", "common"];
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
  common: "/",
};

const PAGE = 40;
const SEARCH_CAP = 60;
const CHUNK = 500;

const dk = (loc: ContentLocale, key: string) => `${loc}:${key}`;
const isLong = (s: string) => s.length > 80 || s.includes("\n");
const tokens = (s: string) => (s.match(/\{[^{}]*\}|<\/?[a-z][a-z0-9]*>/gi) ?? []).sort().join("|");

type Overlay = Record<string, { value: string; overridden: boolean }>;

/** Everything on the public site that is plain text, both languages side by side. */
export function ContentEditor({
  entries,
  notify,
  hidden,
  labelledBy,
  onDirty,
}: {
  entries: ContentEntry[];
  notify: Notify;
  hidden: boolean;
  labelledBy: string;
  onDirty: (dirty: boolean) => void;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const searchId = useId();

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
  /** Key of the row holding focus: the "Modified only" filter must not drop it while it is edited. */
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [busyReset, setBusyReset] = useState<string | null>(null);
  const [limit, setLimit] = useState(SEARCH_CAP);

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
    setDrafts((d) => {
      const copy = { ...d };
      copy[k] = value;
      return copy;
    });
  }, []);

  // Drop a draft that equals the effective text again (done at render of Row via revert, and here on change).
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

  const reset = useCallback(
    async (e: ContentEntry, loc: ContentLocale) => {
      if (!window.confirm(t("content.confirmReset"))) return;
      const k = dk(loc, e.key);
      setBusyReset(k);
      try {
        const res = await resetContent(e.key, loc);
        if (res.success) {
          setOverlay((o) => ({ ...o, [k]: { value: loc === "en" ? e.enDefault : e.faDefault, overridden: false } }));
          revert(e, loc);
          notify.ok(t("content.resetDone"));
          startRefresh(() => router.refresh());
        } else notify.fail(t("saveFailed", { error: res.error }));
      } catch {
        notify.fail(t("saveFailed", { error: t("networkError") }));
      } finally {
        setBusyReset(null);
      }
    },
    [notify, revert, router, t],
  );

  const byKey = useMemo(() => new Map(entries.map((e) => [e.key, e])), [entries]);

  const saveAll = async () => {
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
        const res = await saveContent(chunk);
        if (!res.success) {
          notify.fail(t("saveFailed", { error: res.error }));
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
      if (done === pending.length) notify.ok(t("content.saved", { count: done }));
      if (done > 0) startRefresh(() => router.refresh());
    } catch {
      notify.fail(t("saveFailed", { error: t("networkError") }));
    } finally {
      setSaving(false);
    }
  };

  const discardAll = () => {
    if (window.confirm(t("content.confirmDiscardAll", { count: draftCount }))) setDrafts({});
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
    // drafts intentionally read at filter time only for the modified-only view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, searching, activeNs, q, modifiedOnly, overridden, effective, modifiedOnly ? drafts : null, focusKey]);

  const groups = useMemo(() => {
    if (searching) return [];
    const m = new Map<string, ContentEntry[]>();
    for (const e of visible) {
      const g = e.path.includes(".") ? e.path.slice(0, e.path.indexOf(".")) : "";
      (m.get(g) ?? m.set(g, []).get(g)!).push(e);
    }
    return [...m.entries()].map(([name, list]) => ({ name, list }));
  }, [visible, searching]);

  const modifiedByNs = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) if (overridden(e, "en") || overridden(e, "fa")) m.set(e.namespace, (m.get(e.namespace) ?? 0) + 1);
    return m;
  }, [entries, overridden]);

  const toggleGroup = (id: string) =>
    setOpen((s) => {
      const copy = new Set(s);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });

  const locale = useLocale();
  const num = (n: number) => formatNumber(n, locale);

  const renderRow = (e: ContentEntry, showNs: boolean) => (
    <ContentRow
      key={e.key}
      entry={e}
      showNs={showNs}
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

  return (
    <PanelFrame id="content" labelledBy={labelledBy} hidden={hidden} title={t("content.title")} sub={t("content.sub")}>
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

      <div className="adm-chips" role="group" aria-label={t("content.namespaces")}>
        {namespaces.map((n) => {
          const mod = modifiedByNs.get(n.name) ?? 0;
          const sel = !searching && n.name === activeNs;
          return (
            <button
              key={n.name}
              type="button"
              className="adm-chip"
              aria-pressed={sel}
              onClick={() => {
                setNs(n.name);
                setQuery("");
              }}
            >
              {t.has(`content.ns.${n.name}`) ? t(`content.ns.${n.name}`) : n.name}
              <span className="adm-chip-n">
                {num(n.count)}
                {mod > 0 && <span className="adm-chip-mod"> · {t("content.modifiedCount", { count: mod })}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="adm-cmeta" role="status" aria-live="polite">
        <span>
          {searching
            ? t("content.results", { count: visible.length })
            : t("content.inNamespace", { count: visible.length })}
        </span>
        {!searching && activeNs && (
          <Link href={LIVE_PATH[activeNs] ?? "/"} target="_blank" rel="noopener" className="lbf-textbtn">
            {t("content.viewLive")}
            <span className="sr-only"> ({t("opensNewTab")})</span>
          </Link>
        )}
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
            <button type="button" className="lbf-textbtn adm-more" onClick={() => setLimit((l) => l + SEARCH_CAP)}>
              {t("content.showMore", { count: visible.length - limit })}
            </button>
          )}
        </div>
      ) : (
        <div className="adm-cgroups">
          {groups.map((g) => {
            const gid = `${activeNs}|${g.name}`;
            const isOpen = open.has(gid);
            const mods = g.list.filter((e) => overridden(e, "en") || overridden(e, "fa")).length;
            const unsaved = g.list.filter((e) => dk("en", e.key) in drafts || dk("fa", e.key) in drafts).length;
            return (
              <section key={gid} className="adm-cgroup" data-open={isOpen ? "true" : "false"}>
                <h3 className="adm-cgroup-h">
                  <button type="button" className="adm-cgroup-btn" aria-expanded={isOpen} onClick={() => toggleGroup(gid)}>
                    <span className="adm-cgroup-caret" aria-hidden="true" />
                    <span className="adm-cgroup-name" dir="ltr">
                      {g.name || t("content.general")}
                    </span>
                    <span className="adm-cgroup-n">
                      {num(g.list.length)}
                      {mods > 0 && ` · ${t("content.modifiedCount", { count: mods })}`}
                      {unsaved > 0 && ` · ${t("content.unsavedCount", { count: unsaved })}`}
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

      {draftCount > 0 && (
        <div className="adm-savebar" role="region" aria-label={t("content.saveBar")}>
          <span className="adm-bar-text">{saving ? t("saving") : t("content.unsaved", { count: draftCount })}</span>
          <span className="adm-bar-acts">
            <button type="button" className="lbf-textbtn" onClick={discardAll} disabled={saving}>
              {t("content.discardAll")}
            </button>
            <button type="button" className="lbf-cta" onClick={saveAll} disabled={saving}>
              <span>{t("content.saveN", { count: draftCount })}</span>
            </button>
          </span>
        </div>
      )}
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
        <button type="button" className="lbf-textbtn adm-more" onClick={() => setShown((s) => s + PAGE)}>
          {t("content.showMore", { count: list.length - shown })}
        </button>
      )}
    </div>
  );
}

interface RowProps {
  entry: ContentEntry;
  showNs: boolean;
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
          <span className="sr-only"> — {e.key}</span>
        </label>
        {long ? <textarea {...common} rows={Math.min(8, Math.max(3, Math.ceil(value.length / 60)))} /> : <input {...common} type="text" />}
        <div className="adm-cmeta-line" id={`${inputId}-meta`}>
          {mod && <Badge tone="accent">{t("content.modified")}</Badge>}
          {draft && <Badge tone="warn">{t("content.unsavedBadge")}</Badge>}
          {draft && (
            <button type="button" className="lbf-textbtn" onClick={() => p.onRevert(e, loc)}>
              {t("content.undo")}
              <span className="sr-only">: {e.key}</span>
            </button>
          )}
          {mod && (
            <button type="button" className="lbf-textbtn" onClick={() => p.onReset(e, loc)} disabled={busy} aria-busy={busy}>
              {busy ? t("content.resetting") : t("content.reset")}
              <span className="sr-only">: {e.key}</span>
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
    <article className="adm-crow" data-ckey={e.key} data-modified={modified ? "true" : "false"} data-unsaved={unsaved ? "true" : "false"}>
      <p className="adm-ckey" dir="ltr">
        {p.showNs ? e.key : e.path}
      </p>
      <div className="adm-pair adm-cpair">
        {lane("en")}
        {lane("fa")}
      </div>
    </article>
  );
});
