"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, useRef } from "react";
import { useTranslations } from "next-intl";
import { FIELD_CSS } from "@/shared/ui/fields";
import { formatNumber, pick } from "@/shared/data/localize";
import { CHARACTER_DEFAULTS } from "@/shared/data/defaults";
import type { AdminData } from "@/shared/actions/admin/types";
import { signOut } from "@/shared/actions/admin/auth";
import { ADMIN_CSS } from "./styles";
import { ADMIN_CSS_NAV } from "./styles-nav";
import { ADMIN_CSS_UX } from "./styles-ux";
import { NoticeLine, resolveThumb, useNotice } from "./parts";
import { CollectionPanel } from "./CollectionPanel";
import { ProjectEditor } from "./ProjectEditor";
import { CategoryEditor } from "./CategoryEditor";
import { SubmissionsPanel } from "./SubmissionsPanel";
import { PasswordForm } from "./PasswordForm";
import { Dashboard, type Go, type SectionId } from "./Dashboard";
import { ContentEditor, humanPath, type ContentRequest } from "./ContentEditor";
import { SettingsPanel } from "./SettingsPanel";
import { TeamEditor } from "./TeamEditor";
import { SeriesPanel } from "./SeriesPanel";
import { MediaPanel } from "./MediaPanel";
import { SiteImagesPanel } from "./SiteImages";
import { PanelFrame } from "./forms";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { MediaDialog } from "./MediaDialog";
import { Icon, type IconName } from "./icons-ux";
import { useAdminActions } from "./actions-seam";
import { useConfirm } from "./ux";

/** Sidebar order. Single-item groups show no heading. */
const GROUPS: { id: string; items: SectionId[] }[] = [
  { id: "overview", items: ["dashboard"] },
  { id: "edit", items: ["content", "images", "projects", "categories", "team", "series"] },
  { id: "inbox", items: ["inbox"] },
  { id: "manage", items: ["settings", "media", "account"] },
];
const SECTIONS = GROUPS.flatMap((g) => g.items);
const isSection = (v: string): v is SectionId => (SECTIONS as readonly string[]).includes(v);
/** Old hashes keep working; the retired hero slides point at the Photos section where the films live. */
const normalizeHash = (h: string) => (h === "submissions" ? "inbox" : h === "hero" ? "images" : h);
/** DOM id suffix of each section's panel (the collection panels are named after their table). */
const PANEL_ID: Partial<Record<SectionId, string>> = {
  projects: "projects",
  categories: "categories",
  team: "team_members",
  inbox: "submissions",
};
const panelId = (s: SectionId) => PANEL_ID[s] ?? s;
const ICONS: Record<SectionId, IconName> = {
  dashboard: "home",
  content: "text",
  images: "photo",
  media: "folder",
  projects: "film",
  categories: "tag",
  team: "people",
  series: "voice",
  inbox: "mail",
  settings: "settings",
  account: "user",
};
const SETTING_KEYS = ["studio", "socials", "payments", "contact", "seo", "series", "heroVideos"] as const;
/** The bottom bar on phones: the four things done most, then everything else. */
const TABS: SectionId[] = ["dashboard", "content", "projects", "inbox"];

/** Runs `fn` once `selector` exists and is on screen (panels mount and un-hide a frame after we ask). */
function whenReady(selector: string, fn: (el: HTMLElement) => void, tries = 45) {
  const el = document.querySelector<HTMLElement>(selector);
  if (el && !el.closest("[hidden]")) return fn(el);
  if (tries > 0) requestAnimationFrame(() => whenReady(selector, fn, tries - 1));
}

/** The whole admin: a plain-language sidebar (a bottom bar on phones), quick find, and mounted-once panels. */
export function AdminPanel({ data, locale }: { data: AdminData; locale: "en" | "fa" }) {
  const t = useTranslations("admin");
  const actions = useAdminActions();
  // The section follows the hash (#content, #inbox…) so a reload keeps your place.
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [chosen, setChosen] = useState<SectionId | null>(null);
  const normalized = normalizeHash(hash);
  const tab: SectionId = chosen ?? (isSection(normalized) ? normalized : "dashboard");
  const { notify } = useNotice();
  const { ask, sheet } = useConfirm();

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
  const onCategoriesDirty = useMemo(() => setDirty("categories"), [setDirty]);
  const onTeamDirty = useMemo(() => setDirty("team"), [setDirty]);
  const onSeriesDirty = useMemo(() => setDirty("series"), [setDirty]);
  const dirtyIds = (Object.keys(dirty) as SectionId[]).filter((s) => dirty[s]);
  const anyDirty = dirtyIds.length > 0;
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const choose = useCallback((next: SectionId, focus = true) => {
    setChosen(next);
    window.history.replaceState(window.history.state, "", `#${next}`);
    if (focus) {
      // The panel root takes focus so keyboard and screen-reader users land on the new content.
      requestAnimationFrame(() => document.getElementById(`adm-panel-${panelId(next)}`)?.focus({ preventScroll: false }));
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const go: Go = useCallback(
    (s, opts) => {
      choose(s);
      if (opts?.click) whenReady(opts.click, (el) => el.click());
      if (opts?.focus) whenReady(opts.focus, (el) => el.focus());
    },
    [choose],
  );

  // Back/forward and manual hash edits: drop the explicit choice so the hash wins again.
  useEffect(() => {
    const onHash = () => setChosen(null);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  /* ----- Quick find ----- */
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [contentReq, setContentReq] = useState<ContentRequest | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "/" && !mod && !typing && !document.querySelector("dialog[open]")) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Submissions state lives here so the nav's unread count updates optimistically.
  const [readOverride, setReadOverride] = useState<Record<string, boolean>>({});
  const [removedSubs, setRemovedSubs] = useState<Set<string>>(() => new Set());

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
  const voicesShown = useMemo(() => {
    const by = new Map(data.seriesCharacters.map((r) => [r.slug, r]));
    return CHARACTER_DEFAULTS.filter((d) => (by.get(d.slug) ?? d).visible).length;
  }, [data.seriesCharacters]);
  const counts: Partial<Record<SectionId, number>> = {
    projects: data.projects.length,
    categories: data.categories.length,
    team: data.teamMembers.length,
    inbox: unread,
  };
  const stats = {
    projects: { total: data.projects.length, published: data.projects.filter((p) => p.published).length },
    team: data.teamMembers.length,
    voices: { shown: voicesShown, total: CHARACTER_DEFAULTS.length },
    unread,
    totalMessages: subs.length,
    copyEdits: data.content.filter((c) => c.enOverridden || c.faOverridden).length,
  };
  const projectSlugs = useMemo(() => data.projects.map((p) => p.slug), [data.projects]);
  const num = (n: number) => formatNumber(n, locale);

  const nsList = useMemo(() => [...new Set(data.content.map((c) => c.namespace))], [data.content]);
  const nsLabel = useCallback((n: string) => (t.has(`content.ns.${n}`) ? t(`content.ns.${n}`) : n), [t]);

  const paletteItems = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [];
    for (const s of SECTIONS) {
      items.push({
        id: `go:${s}`,
        group: "go",
        title: t(`nav.items.${s}`),
        hint: t(`nav.desc.${s}`),
        keywords: t(`nav.keywords.${s}`),
        icon: ICONS[s],
        run: () => go(s),
      });
    }
    const act = (id: string, title: string, icon: IconName, run: () => void, keywords = "") =>
      items.push({ id: `do:${id}`, group: "do", title, keywords, icon, run, hint: t("palette.quickAction") });
    act("project", t("palette.actions.project"), "plus", () => go("projects", { click: "#adm-add-projects" }), "new create add work film");
    act("person", t("palette.actions.person"), "plus", () => go("team", { click: "#adm-add-team_members" }), "new team member add staff");
    act("category", t("palette.actions.category"), "plus", () => go("categories", { click: "#adm-add-categories" }), "new group add");
    act("messages", t("palette.actions.messages"), "mail", () => go("inbox"), "reply answer inbox contact");
    act("photo", t("palette.actions.photo"), "photo", () => go("images"), "picture image change replace");
    act("link", t("palette.actions.link"), "link", () => go("settings"), "instagram social email contact address");
    act("password", t("palette.actions.password"), "user", () => go("account"), "account sign in security");
    act("signout", t("palette.actions.signout"), "signout", () => document.getElementById("adm-signout")?.click(), "log out leave");

    for (const n of nsList) {
      items.push({
        id: `page:${n}`,
        group: "page",
        title: nsLabel(n),
        hint: t("palette.pageHint"),
        keywords: "page text copy words",
        icon: "page",
        run: () => {
          setContentReq({ n: Date.now(), ns: n });
          go("content");
        },
      });
    }
    for (const k of SETTING_KEYS) {
      items.push({
        id: `set:${k}`,
        group: "setting",
        title: t(`settings.cards.${k}.title`),
        hint: t(`settings.cards.${k}.sub`),
        keywords: t(`settings.keywords.${k}`),
        icon: "settings",
        run: () => {
          go("settings");
          whenReady(`#adm-set-card-${k}`, (el) => {
            el.scrollIntoView({ block: "start" });
            el.querySelector<HTMLElement>("input,textarea")?.focus({ preventScroll: true });
          });
        },
      });
    }
    for (const p of data.projects) {
      const title = pick(p, "title", locale);
      items.push({
        id: `project:${p.id}`,
        group: "project",
        title: title || t("untitled"),
        hint: t("palette.editProject"),
        keywords: `${p.title_en} ${p.title_fa} ${p.slug}`,
        icon: "film",
        run: () => go("projects", { click: `#adm-edit-${p.id}` }),
      });
    }
    for (const c of data.categories) {
      items.push({
        id: `cat:${c.id}`,
        group: "project",
        title: pick(c, "name", locale),
        hint: t("palette.editCategory"),
        keywords: `${c.name_en} ${c.name_fa}`,
        icon: "tag",
        run: () => go("categories", { click: `#adm-edit-${c.id}` }),
      });
    }
    for (const m of data.teamMembers) {
      items.push({
        id: `person:${m.id}`,
        group: "person",
        title: pick(m, "name", locale),
        hint: t("palette.editPerson"),
        keywords: `${m.name_en} ${m.name_fa} ${m.title_en} ${m.title_fa}`,
        icon: "people",
        run: () => go("team", { click: `#adm-edit-${m.id}` }),
      });
    }
    const stored = new Map(data.seriesCharacters.map((r) => [r.slug, r]));
    for (const d of CHARACTER_DEFAULTS) {
      const r = stored.get(d.slug) ?? d;
      items.push({
        id: `voice:${d.slug}`,
        group: "voice",
        title: pick(r, "name", locale),
        hint: t("palette.editVoice"),
        keywords: `${r.name_en} ${r.name_fa} voice teller character`,
        icon: "voice",
        run: () => go("series", { click: `#adm-edit-${d.slug}` }),
      });
    }
    return items;
  }, [t, go, nsList, nsLabel, data.projects, data.categories, data.teamMembers, data.seriesCharacters, locale]);

  /**
   * "Support › Small heading above" instead of "support.eyebrow": the page, the part of it, then a plain word for the
   * field. Persian never shows English path words: an unknown word is simply left out.
   */
  const friendlyHint = useCallback(
    (namespace: string, path: string) => {
      const segs = path.split(".").filter((s) => !/^\d+$/.test(s));
      const out: string[] = [nsLabel(namespace)];
      const first = segs[0];
      if (segs.length > 1 && first && t.has(`content.parts.${first}`)) out.push(t(`content.parts.${first}`));
      const leaf = segs[segs.length - 1];
      if (leaf) {
        const word = t.has(`content.words.${leaf}`) ? t(`content.words.${leaf}`) : locale === "fa" ? "" : humanPath(leaf);
        if (word && !out.includes(word)) out.push(word);
      }
      return out.join(" › ");
    },
    [t, nsLabel, locale],
  );

  const textItems = useCallback(
    (q: string[]): PaletteItem[] => {
      const out: PaletteItem[] = [];
      for (const e of data.content) {
        const hay = `${e.key} ${e.en} ${e.fa}`.toLowerCase();
        if (!q.every((tok) => hay.includes(tok))) continue;
        const shown = (locale === "fa" ? e.fa || e.en : e.en || e.fa).replace(/\s+/g, " ");
        out.push({
          id: `text:${e.key}`,
          group: "text",
          title: shown.length > 90 ? shown.slice(0, 90) + "…" : shown || friendlyHint(e.namespace, e.path),
          hint: friendlyHint(e.namespace, e.path),
          icon: "text",
          run: () => {
            setContentReq({ n: Date.now(), focusKey: e.key });
            go("content");
          },
        });
        if (out.length >= 8) break;
      }
      return out;
    },
    [data.content, go, locale, friendlyHint],
  );

  /* ----- Sign out: asks only when something unsaved would be lost, and names it ----- */
  const signOutForm = useRef<HTMLFormElement>(null);
  const confirmedOut = useRef(false);
  const onSignOut = async (e: React.FormEvent<HTMLFormElement>) => {
    if (confirmedOut.current || !anyDirty) return;
    e.preventDefault();
    const names = dirtyIds.map((s) => t(`nav.items.${s}`)).join(", ");
    const ok = await ask({
      title: t("account.leaveTitle"),
      body: <p>{t("account.leaveBody", { places: names })}</p>,
      confirm: t("account.leaveConfirm"),
      cancel: t("keepEditing"),
    });
    if (ok) {
      confirmedOut.current = true;
      signOutForm.current?.requestSubmit();
    }
  };

  const labelFor = (id: SectionId) => t(`nav.items.${id}`);

  return (
    <main id="main" className="adm">
      <style>{FIELD_CSS}</style>
      <style>{ADMIN_CSS}</style>
      <style>{ADMIN_CSS_NAV}</style>
      <style>{ADMIN_CSS_UX}</style>

      <a
        className="ux-skip"
        href="#adm-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(`adm-panel-${panelId(tab)}`)?.focus();
        }}
      >
        {t("skip")}
      </a>

      <header className="ux-head">
        <div className="ux-head-title">
          <h1 className="adm-h1">{t("heading")}</h1>
          <p className="adm-lede">{t("lede")}</p>
        </div>
        <button
          type="button"
          className="ux-search"
          onClick={() => setPaletteOpen(true)}
          aria-haspopup="dialog"
          aria-keyshortcuts="Control+K Meta+K"
        >
          <Icon name="search" className="ux-search-ico" />
          <span className="ux-search-text">{t("palette.trigger")}</span>
          <kbd className="ux-kbd" aria-hidden="true">
            {t("kbdFind")}
          </kbd>
        </button>
        <div className="ux-head-acts">
          <form ref={signOutForm} action={signOut.bind(null, locale)} onSubmit={onSignOut}>
            <button type="submit" id="adm-signout" className="ux-btn" data-quiet="true">
              <Icon name="signout" className="ux-btn-ico" />
              {t("signOut")}
            </button>
          </form>
        </div>
      </header>

      <div className="adm-shell">
        <aside className="adm-side">
          <nav className="adm-nav" aria-label={t("nav.label")}>
            {GROUPS.map((g) => (
              <div className="adm-nav-group" key={g.id}>
                {g.items.length > 1 && (
                  <p className="adm-nav-title" id={`adm-nav-${g.id}`}>
                    {t(`nav.groups.${g.id}`)}
                  </p>
                )}
                <ul aria-labelledby={g.items.length > 1 ? `adm-nav-${g.id}` : undefined} aria-label={g.items.length > 1 ? undefined : t(`nav.groups.${g.id}`)} className="adm-nav-list">
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
                          <Icon name={ICONS[id]} className="adm-nav-ico" />
                          <span className="adm-nav-label">{labelFor(id)}</span>
                          {dirty[id] && (
                            <span className="adm-nav-dirty" title={t("nav.unsaved")}>
                              <span className="sr-only">{t("nav.unsaved")}</span>
                            </span>
                          )}
                          {count !== undefined && (id === "inbox" ? count > 0 : true) && (
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

        <div className="adm-content" id="adm-content">
          <NoticeLine />

          <Dashboard stats={stats} audit={data.audit} locale={locale} hidden={tab !== "dashboard"} labelledBy="adm-tab-dashboard" go={go} />

          <CollectionPanel
            table="projects"
            rows={data.projects}
            notify={notify}
            hidden={tab !== "projects"}
            labelledBy="adm-tab-projects"
            text={{
              title: t("nav.items.projects"),
              sub: t("nav.desc.projects"),
              add: t("projects.add"),
              emptyTitle: t("projects.emptyTitle"),
              emptyText: t("projects.emptyText"),
              off: t("projects.off"),
              turnOn: t("projects.turnOn"),
              turnOff: t("projects.turnOff"),
              // Only a project with uploaded gallery pictures asks first: those pictures are gone for good once the Undo window ends.
              confirmDelete: (p) => (p.gallery_urls?.length ? t("projects.confirmDelete", { title: pick(p, "title", locale), count: p.gallery_urls.length }) : null),
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
            onToggle={actions.setProjectPublished}
            onDelete={actions.deleteProject}
            renderEditor={({ row, active, close, saved }) => (
              <ProjectEditor row={row} published={active} categories={data.categories} onClose={close} onSaved={saved} />
            )}
          />

          <CollectionPanel
            table="categories"
            rows={data.categories}
            notify={notify}
            hidden={tab !== "categories"}
            labelledBy="adm-tab-categories"
            showThumb={false}
            text={{
              title: t("nav.items.categories"),
              sub: t("nav.desc.categories"),
              add: t("categories.add"),
              emptyTitle: t("categories.emptyTitle"),
              emptyText: t("categories.emptyText"),
              off: t("categories.off"),
              turnOn: t("categories.turnOn"),
              turnOff: t("categories.turnOff"),
              confirmDelete: () => null,
            }}
            isActive={(c) => c.visible}
            view={(c) => ({
              title: pick(c, "name", locale),
              meta: [locale === "fa" ? c.name_en : c.name_fa, t("categories.projectCount", { count: projectCount.get(c.id) ?? 0 })].filter(Boolean),
            })}
            onDirty={onCategoriesDirty}
            onToggle={actions.setCategoryVisible}
            onDelete={actions.deleteCategory}
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
              request={contentReq}
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
              go={go}
            />
          )}

          {visited.has("media") && <MediaPanel notify={notify} hidden={tab !== "media"} labelledBy="adm-tab-media" />}

          {visited.has("images") && (
            <SiteImagesPanel data={data} locale={locale} hidden={tab !== "images"} labelledBy="adm-tab-images" notify={notify} />
          )}

          <SubmissionsPanel
            rows={data.submissions}
            readOverride={readOverride}
            setReadOverride={setReadOverride}
            removed={removedSubs}
            setRemoved={setRemovedSubs}
            notify={notify}
            hidden={tab !== "inbox"}
            labelledBy="adm-tab-inbox"
          />

          <PanelFrame id="account" labelledBy="adm-tab-account" hidden={tab !== "account"} title={t("nav.items.account")} sub={t("nav.desc.account")} viewPath={null}>
            <PasswordForm />
            <section className="ux-signout" aria-labelledby="adm-signout-h">
              <h3 className="adm-group-h" id="adm-signout-h">
                {t("account.signOutTitle")}
              </h3>
              <p className="adm-hint-line">{t("account.signOutText")}</p>
              <button type="button" className="ux-btn" onClick={() => document.getElementById("adm-signout")?.click()}>
                <Icon name="signout" className="ux-btn-ico" />
                {t("signOut")}
              </button>
            </section>
          </PanelFrame>
        </div>
      </div>

      {/* Phones: a thumb-height tab bar with the four everyday places, and "More". */}
      <nav className="ux-tabbar" aria-label={t("nav.label")}>
        {TABS.map((id) => (
          <button key={id} type="button" className="ux-tab" aria-current={tab === id ? "page" : undefined} onClick={() => choose(id)}>
            <span className="ux-tab-ico">
              <Icon name={ICONS[id]} />
              {id === "inbox" && unread > 0 && <span className="ux-tab-badge">{num(unread)}</span>}
              {dirty[id] && <span className="ux-tab-dirty" aria-hidden="true" />}
            </span>
            <span className="ux-tab-label">{t(`nav.short.${id}`)}</span>
          </button>
        ))}
        <button type="button" className="ux-tab" aria-haspopup="dialog" aria-current={!TABS.includes(tab) ? "page" : undefined} onClick={() => setMoreOpen(true)}>
          <span className="ux-tab-ico">
            <Icon name="more" />
          </span>
          <span className="ux-tab-label">{t("nav.short.more")}</span>
        </button>
      </nav>

      {moreOpen && (
        <MediaDialog title={t("nav.allSections")} onClose={() => setMoreOpen(false)} size="narrow">
          <ul className="ux-more">
            {SECTIONS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="ux-more-item"
                  aria-current={tab === id ? "page" : undefined}
                  onClick={() => {
                    setMoreOpen(false);
                    window.setTimeout(() => choose(id), 0);
                  }}
                >
                  <span className="ux-more-ico" aria-hidden="true">
                    <Icon name={ICONS[id]} />
                  </span>
                  <span className="ux-more-text">
                    <span className="ux-more-title">{labelFor(id)}</span>
                    <span className="ux-more-sub">{t(`nav.desc.${id}`)}</span>
                  </span>
                  {counts[id] !== undefined && id === "inbox" && unread > 0 && <span className="ux-tab-badge">{num(unread)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </MediaDialog>
      )}

      {paletteOpen && <CommandPalette items={paletteItems} textItems={textItems} onClose={() => setPaletteOpen(false)} />}
      {sheet}
    </main>
  );
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const readHash = () => window.location.hash.slice(1);
