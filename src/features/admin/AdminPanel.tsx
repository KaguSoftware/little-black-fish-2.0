"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { FIELD_CSS } from "@/shared/ui/fields";
import { formatNumber, pick } from "@/shared/data/localize";
import type { AdminData } from "@/shared/actions/admin/types";
import { signOut } from "@/shared/actions/admin/auth";
import { deleteProject, setProjectPublished } from "@/shared/actions/admin/projects";
import { deleteHeroSlide, setHeroSlideActive } from "@/shared/actions/admin/hero";
import { deleteCategory, setCategoryVisible } from "@/shared/actions/admin/categories";
import { ADMIN_CSS } from "./styles";
import { NoticeLine, resolveThumb, useNotice } from "./parts";
import { CollectionPanel } from "./CollectionPanel";
import { ProjectEditor } from "./ProjectEditor";
import { HeroEditor } from "./HeroEditor";
import { CategoryEditor } from "./CategoryEditor";
import { SubmissionsPanel } from "./SubmissionsPanel";

const TABS = ["projects", "hero", "categories", "submissions"] as const;
type Tab = (typeof TABS)[number];
const isTab = (v: string): v is Tab => (TABS as readonly string[]).includes(v);

/** The whole admin: four tabs (kept mounted so unsaved order or an open editor survive a switch). */
export function AdminPanel({ data, locale }: { data: AdminData; locale: "en" | "fa" }) {
  const t = useTranslations("admin");
  // The tab follows the hash (#hero, #submissions…) so a reload keeps your place.
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const [chosen, setChosen] = useState<Tab | null>(null);
  const tab: Tab = chosen ?? (isTab(hash) ? hash : "projects");
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ projects: null, hero: null, categories: null, submissions: null });
  const { notice, notify, clear } = useNotice();

  // Submissions state lives here so the tab's unread count updates optimistically.
  const [readOverride, setReadOverride] = useState<Record<string, boolean>>({});
  const [removedSubs, setRemovedSubs] = useState<Set<string>>(() => new Set());
  const [subBusy, setSubBusy] = useState<Record<string, boolean>>({});

  const choose = (next: Tab, focus = false) => {
    setChosen(next);
    clear();
    window.history.replaceState(window.history.state, "", `#${next}`);
    if (focus) tabRefs.current[next]?.focus();
  };

  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const rtl = locale === "fa";
    let next: number | null = null;
    if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) next = (i + 1) % TABS.length;
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    choose(TABS[next], true);
  };

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
  const counts: Record<Tab, number> = {
    projects: data.projects.length,
    hero: data.heroSlides.length,
    categories: data.categories.length,
    submissions: unread,
  };
  const num = (n: number) => formatNumber(n, locale);

  return (
    <main id="main" className="adm">
      <style>{FIELD_CSS}</style>
      <style>{ADMIN_CSS}</style>

      <header className="adm-head">
        <div>
          <h1 className="adm-h1">{t("heading")}</h1>
          <p className="adm-lede">{t("lede")}</p>
        </div>
        <form className="adm-signout" action={signOut.bind(null, locale)}>
          <button type="submit" className="lbf-textbtn">
            {t("signOut")}
          </button>
        </form>
      </header>

      <div className="adm-tabs" role="tablist" aria-label={t("tabsLabel")} onKeyDown={onTabKey}>
        {TABS.map((key) => {
          const selected = tab === key;
          const lit = key === "submissions" && counts.submissions > 0;
          return (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[key] = el;
              }}
              type="button"
              role="tab"
              id={`adm-tab-${key}`}
              aria-selected={selected}
              aria-controls={key === "submissions" ? "adm-panel-submissions" : `adm-panel-${tableOf(key)}`}
              tabIndex={selected ? 0 : -1}
              className="adm-tab"
              onClick={() => choose(key)}
            >
              {t(`tabs.${key}`)}
              <span className="adm-tab-count" data-lit={lit ? "true" : "false"}>
                {num(counts[key])}
                {key === "submissions" && <span className="sr-only"> {t("unread")}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <NoticeLine notice={notice} onDismiss={clear} />

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
        onToggle={setCategoryVisible}
        onDelete={deleteCategory}
        renderEditor={({ row, close, saved }) => <CategoryEditor row={row} onClose={close} onSaved={saved} />}
      />

      <SubmissionsPanel
        rows={data.submissions}
        readOverride={readOverride}
        setReadOverride={setReadOverride}
        removed={removedSubs}
        markRemoved={(id) => setRemovedSubs((s) => new Set(s).add(id))}
        busy={subBusy}
        setBusy={(id, on) => setSubBusy((b) => ({ ...b, [id]: on }))}
        notify={notify}
        hidden={tab !== "submissions"}
        labelledBy="adm-tab-submissions"
      />
    </main>
  );
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
const readHash = () => window.location.hash.slice(1);

function tableOf(tab: Exclude<Tab, "submissions">) {
  return tab === "hero" ? "hero_slides" : tab;
}
