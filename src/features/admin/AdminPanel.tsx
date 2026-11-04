"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { FIELD_CSS } from "@/shared/ui/fields";
import { formatNumber, pick } from "@/shared/data/localize";
import type { AdminData } from "@/shared/actions/admin/types";
import { signOut } from "@/shared/actions/admin/auth";
import { deleteProject, setProjectPublished } from "@/shared/actions/admin/projects";
import { deleteHeroSlide, setHeroSlideActive } from "@/shared/actions/admin/hero";
import { deleteCategory, setCategoryVisible } from "@/shared/actions/admin/categories";
import { ADMIN_CSS } from "./styles";
import { ADMIN_CSS_NAV } from "./styles-nav";
import { NoticeLine, resolveThumb, useNotice } from "./parts";
import { CollectionPanel } from "./CollectionPanel";
import { ProjectEditor } from "./ProjectEditor";
import { HeroEditor } from "./HeroEditor";
import { CategoryEditor } from "./CategoryEditor";
import { SubmissionsPanel } from "./SubmissionsPanel";
import { PasswordForm } from "./PasswordForm";
import { Dashboard, type SectionId } from "./Dashboard";
import { ContentEditor } from "./ContentEditor";
import { SettingsPanel } from "./SettingsPanel";
import { TeamEditor } from "./TeamEditor";
import { SeriesPanel } from "./SeriesPanel";
import { MediaPanel } from "./MediaPanel";
import { PanelFrame } from "./forms";

const GROUPS: { id: string; items: SectionId[] }[] = [
  { id: "overview", items: ["dashboard"] },
  { id: "work", items: ["projects", "categories", "hero", "team"] },
  { id: "pages", items: ["content"] },
  { id: "series", items: ["series"] },
  { id: "site", items: ["settings", "media"] },
  { id: "inbox", items: ["inbox"] },
  { id: "account", items: ["account"] },
];
const SECTIONS = GROUPS.flatMap((g) => g.items);
const isSection = (v: string): v is SectionId => (SECTIONS as readonly string[]).includes(v);
/** Old hashes keep working. */
const normalizeHash = (h: string) => (h === "submissions" ? "inbox" : h);
/** DOM id suffix of each section's panel (the collection panels are named after their table). */
const PANEL_ID: Partial<Record<SectionId, string>> = {
  projects: "projects",
  hero: "hero_slides",
  categories: "categories",
  team: "team_members",
  inbox: "submissions",
};
const panelId = (s: SectionId) => PANEL_ID[s] ?? s;

/** The whole admin: a grouped sidebar (a select on narrow screens) over mounted-once panels. */
export function AdminPanel({ data, locale }: { data: AdminData; locale: "en" | "fa" }) {
  const t = useTranslations("admin");
  // The section follows the hash (#hero, #inbox…) so a reload keeps your place.
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [chosen, setChosen] = useState<SectionId | null>(null);
  const normalized = normalizeHash(hash);
  const tab: SectionId = chosen ?? (isSection(normalized) ? normalized : "dashboard");
  const { notice, notify, clear } = useNotice();

  // Panels mount on first visit and then stay mounted (unsaved edits survive a switch).
  const [visited, setVisited] = useState<Set<SectionId>>(() => new Set());
  if (!visited.has(tab)) setVisited((v) => new Set(v).add(tab));

  // Sections with unsaved edits: nav dot, sign-out guard, and the browser's leave warning.
  const [dirty, setDirtyMap] = useState<Partial<Record<SectionId, boolean>>>({});
  const setDirty = useCallback(
    (s: SectionId) => (d: boolean) => setDirtyMap((o) => (o[s] === d ? o : { ...o, [s]: d })),
    [],
  );
  const onContentDirty = useMemo(() => setDirty("content"), [setDirty]);
  const onSettingsDirty = useMemo(() => setDirty("settings"), [setDirty]);
  const onProjectsDirty = useMemo(() => setDirty("projects"), [setDirty]);
  const onHeroDirty = useMemo(() => setDirty("hero"), [setDirty]);
  const onCategoriesDirty = useMemo(() => setDirty("categories"), [setDirty]);
  const onTeamDirty = useMemo(() => setDirty("team"), [setDirty]);
  const onSeriesDirty = useMemo(() => setDirty("series"), [setDirty]);
  const anyDirty = Object.values(dirty).some(Boolean);
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const choose = useCallback(
    (next: SectionId, focus = true) => {
      setChosen(next);
      clear();
      window.history.replaceState(window.history.state, "", `#${next}`);
      if (focus) {
        // The panel root takes focus so keyboard and screen-reader users land on the new content.
        requestAnimationFrame(() => document.getElementById(`adm-panel-${panelId(next)}`)?.focus({ preventScroll: false }));
      }
    },
    [clear],
  );

  // Back/forward and manual hash edits: drop the explicit choice so the hash wins again.
  useEffect(() => {
    const onHash = () => setChosen(null);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Submissions state lives here so the nav's unread count updates optimistically.
  const [readOverride, setReadOverride] = useState<Record<string, boolean>>({});
  const [removedSubs, setRemovedSubs] = useState<Set<string>>(() => new Set());
  const [subBusy, setSubBusy] = useState<Record<string, boolean>>({});

  const categoryName = useMemo(() => {
    const m = new Map(data.categories.map((c) => [c.id, pick(c, "name", locale)]));
    return (id: string | null) => (id ? (m.get(id) ?? null) : null);
  }, [data.categories, locale]);

  const projectCount = useMemo(() => {
    const m = new Map<string, number>();
    data.projects.forEach((p) => p.category_id && m.set(p.category_id, (m.get(p.category_id) ?? 0) + 1));
    return m;
  }, [data.projects]);

  const subs = data.submissions.filter((s) => !removedSubs.has(s.id));
  // Drop optimistic read flags once the server agrees.
  const staleRead = Object.keys(readOverride).filter((id) => {
    const r = subs.find((x) => x.id === id);
    return !r || r.read === readOverride[id];
  });
  if (staleRead.length) {
    setReadOverride((o) => {
      const copy = { ...o };
      staleRead.forEach((id) => delete copy[id]);
      return copy;
    });
  }
  const unread = subs.filter((s) => !(readOverride[s.id] ?? s.read)).length;
  const counts: Partial<Record<SectionId, number>> = {
    projects: data.projects.length,
    hero: data.heroSlides.length,
    categories: data.categories.length,
    team: data.teamMembers.length,
    inbox: unread,
  };
  const stats = {
    projects: { total: data.projects.length, published: data.projects.filter((p) => p.published).length },
    categories: data.categories.length,
    hero: { total: data.heroSlides.length, active: data.heroSlides.filter((s) => s.active).length },
    team: data.teamMembers.length,
    unread,
    totalMessages: subs.length,
    copyEdits: data.content.filter((c) => c.enOverridden || c.faOverridden).length,
    settingsCustomized: data.settingsStored.length,
  };
  const projectSlugs = useMemo(() => data.projects.map((p) => p.slug), [data.projects]);
  const num = (n: number) => formatNumber(n, locale);

  return (
    <main id="main" className="adm">
      <style>{FIELD_CSS}</style>
      <style>{ADMIN_CSS}</style>
      <style>{ADMIN_CSS_NAV}</style>

      <header className="adm-head">
        <div>
          <h1 className="adm-h1">{t("heading")}</h1>
          <p className="adm-lede">{t("lede")}</p>
        </div>
      </header>

      <div className="adm-shell">
        <aside className="adm-side">
          <div className="adm-jumpsel lbf-field">
            <label className="lbf-label" htmlFor="adm-jump">
              {t("nav.jump")}
            </label>
            <select id="adm-jump" className="lbf-input" value={tab} onChange={(e) => choose(e.target.value as SectionId, false)}>
              {GROUPS.map((g) => (
                <optgroup key={g.id} label={t(`nav.groups.${g.id}`)}>
                  {g.items.map((id) => (
                    <option key={id} value={id}>
                      {t(`nav.items.${id}`)}
                      {id === "inbox" && unread > 0 ? ` (${num(unread)} ${t("unread")})` : ""}
                      {dirty[id] ? ` • ${t("nav.unsaved")}` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <nav className="adm-nav" aria-label={t("nav.label")}>
            {GROUPS.map((g) => (
              <div className="adm-nav-group" key={g.id}>
                <p className="adm-nav-title" id={`adm-nav-${g.id}`}>
                  {t(`nav.groups.${g.id}`)}
                </p>
                <ul aria-labelledby={`adm-nav-${g.id}`} className="adm-nav-list">
                  {g.items.map((id) => {
                    const selected = tab === id;
                    const count = counts[id];
                    const lit = id === "inbox" && unread > 0;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          id={`adm-tab-${id}`}
                          className="adm-nav-item"
                          aria-current={selected ? "page" : undefined}
                          onClick={() => choose(id)}
                        >
                          <span>{t(`nav.items.${id}`)}</span>
                          {dirty[id] && (
                            <span className="adm-nav-dirty" title={t("nav.unsaved")}>
                              <span className="sr-only">{t("nav.unsaved")}</span>
                            </span>
                          )}
                          {count !== undefined && (
                            <span className="adm-tab-count" data-lit={lit ? "true" : "false"}>
                              {num(count)}
                              {id === "inbox" && <span className="sr-only"> {t("unread")}</span>}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <div className="adm-content">
      <NoticeLine notice={notice} onDismiss={clear} />

      <Dashboard
        stats={stats}
        audit={data.audit}
        locale={locale}
        hidden={tab !== "dashboard"}
        labelledBy="adm-tab-dashboard"
        go={choose}
      />

      <CollectionPanel
        table="projects"
        rows={data.projects}
        notify={notify}
        hidden={tab !== "projects"}
        labelledBy="adm-tab-projects"
        text={{
          title: t("tabs.projects"),
          sub: t("projects.sub"),
          add: t("projects.add"),
          emptyTitle: t("projects.emptyTitle"),
          emptyText: t("projects.emptyText"),
          off: t("projects.off"),
          turnOn: t("projects.turnOn"),
          turnOff: t("projects.turnOff"),
          confirmDelete: (p) => t("projects.confirmDelete", { title: pick(p, "title", locale) }),
        }}
        isActive={(p) => p.published}
        view={(p) => {
          const gallery = p.gallery_urls?.length ?? 0;
          const cat = categoryName(p.category_id);
          return {
            title: pick(p, "title", locale),
            thumb: resolveThumb(p.image_url || (p.media_type === "gallery" ? p.gallery_urls?.[0] : null), p.youtube_url),
            meta: [
              cat ?? t("projects.uncategorized"),
              p.media_type === "gallery" ? t("projects.galleryCount", { count: gallery }) : t("projects.mediaYouTube"),
              ...(p.support_enabled ? [t("projects.onSupport")] : []),
            ],
          };
        }}
        onDirty={onProjectsDirty}
        onToggle={setProjectPublished}
        onDelete={deleteProject}
        renderEditor={({ row, active, close, saved }) => (
          <ProjectEditor row={row} published={active} categories={data.categories} onClose={close} onSaved={saved} />
        )}
      />

      <CollectionPanel
        table="hero_slides"
        rows={data.heroSlides}
        notify={notify}
        hidden={tab !== "hero"}
        labelledBy="adm-tab-hero"
        text={{
          title: t("tabs.hero"),
          sub: t("hero.sub"),
          add: t("hero.add"),
          emptyTitle: t("hero.emptyTitle"),
          emptyText: t("hero.emptyText"),
          off: t("hero.off"),
          turnOn: t("hero.turnOn"),
          turnOff: t("hero.turnOff"),
          confirmDelete: () => t("hero.confirmDelete"),
        }}
        isActive={(s) => s.active}
        view={(s) => {
          const thumb = resolveThumb(s.image_url, s.youtube_url);
          const sub = pick(s, "subtitle", locale);
          return {
            title: pick(s, "title", locale) || t("hero.untitled"),
            thumb,
            meta: [
              thumb ? t(`hero.kind.${thumb.kind}`) : t("noImage"),
              ...(sub ? [sub] : []),
            ],
          };
        }}
        onDirty={onHeroDirty}
        onToggle={setHeroSlideActive}
        onDelete={deleteHeroSlide}
        renderEditor={({ row, close, saved }) => <HeroEditor row={row} onClose={close} onSaved={saved} />}
      />

      <CollectionPanel
        table="categories"
        rows={data.categories}
        notify={notify}
        hidden={tab !== "categories"}
        labelledBy="adm-tab-categories"
        showThumb={false}
        text={{
          title: t("tabs.categories"),
          sub: t("categories.sub"),
          add: t("categories.add"),
          emptyTitle: t("categories.emptyTitle"),
          emptyText: t("categories.emptyText"),
          off: t("categories.off"),
          turnOn: t("categories.turnOn"),
          turnOff: t("categories.turnOff"),
          confirmDelete: (c) => t("categories.confirmDelete", { name: pick(c, "name", locale) }),
        }}
        isActive={(c) => c.visible}
        view={(c) => ({
          title: pick(c, "name", locale),
          meta: [
            locale === "fa" ? c.name_en : c.name_fa,
            t("categories.projectCount", { count: projectCount.get(c.id) ?? 0 }),
          ].filter(Boolean),
        })}
        onDirty={onCategoriesDirty}
        onToggle={setCategoryVisible}
        onDelete={deleteCategory}
        renderEditor={({ row, close, saved }) => <CategoryEditor row={row} onClose={close} onSaved={saved} />}
      />

      <TeamEditor rows={data.teamMembers} locale={locale} notify={notify} hidden={tab !== "team"} labelledBy="adm-tab-team" onDirty={onTeamDirty} />

      {visited.has("content") && (
        <ContentEditor
          entries={data.content}
          notify={notify}
          hidden={tab !== "content"}
          labelledBy="adm-tab-content"
          onDirty={onContentDirty}
        />
      )}

      {visited.has("series") && (
        <SeriesPanel
          chapters={data.seriesChapters}
          characters={data.seriesCharacters}
          tellers={data.settings.tellers}
          locale={locale}
          notify={notify}
          hidden={tab !== "series"}
          labelledBy="adm-tab-series"
          onDirty={onSeriesDirty}
        />
      )}

      {visited.has("settings") && (
        <SettingsPanel
          settings={data.settings}
          stored={data.settingsStored}
          projectSlugs={projectSlugs}
          notify={notify}
          hidden={tab !== "settings"}
          labelledBy="adm-tab-settings"
          onDirty={onSettingsDirty}
        />
      )}

      {visited.has("media") && <MediaPanel notify={notify} hidden={tab !== "media"} labelledBy="adm-tab-media" />}

      <SubmissionsPanel
        rows={data.submissions}
        readOverride={readOverride}
        setReadOverride={setReadOverride}
        removed={removedSubs}
        markRemoved={(id) => setRemovedSubs((s) => new Set(s).add(id))}
        busy={subBusy}
        setBusy={(id, on) => setSubBusy((b) => ({ ...b, [id]: on }))}
        notify={notify}
        hidden={tab !== "inbox"}
        labelledBy="adm-tab-inbox"
      />

      <PanelFrame id="account" labelledBy="adm-tab-account" hidden={tab !== "account"} title={t("nav.items.account")} sub={t("account.sub")}>
        <PasswordForm />
        <form
          className="adm-account"
          action={signOut.bind(null, locale)}
          onSubmit={(e) => {
            if (anyDirty && !window.confirm(t("account.confirmUnsaved"))) e.preventDefault();
          }}
        >
          <button type="submit" className="lbf-cta">
            <span>{t("signOut")}</span>
          </button>
        </form>
      </PanelFrame>
        </div>
      </div>
    </main>
  );
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const readHash = () => window.location.hash.slice(1);
