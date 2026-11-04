"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/shared/data/localize";
import type { AdminAuditRow } from "@/shared/data/types";
import { PanelFrame } from "./forms";

export type SectionId =
  | "dashboard"
  | "projects"
  | "categories"
  | "hero"
  | "team"
  | "content"
  | "series"
  | "settings"
  | "media"
  | "inbox"
  | "account";

const KNOWN_ACTIONS = new Set([
  "content.save",
  "content.reset",
  "settings.save",
  "team.create",
  "team.update",
  "team.show",
  "team.hide",
  "team.delete",
  "series.chapter.update",
  "series.character.update",
  "series_chapters.show",
  "series_chapters.hide",
  "series_characters.show",
  "series_characters.hide",
  "media.delete",
]);

export interface DashboardStats {
  projects: { total: number; published: number };
  categories: number;
  hero: { total: number; active: number };
  team: number;
  unread: number;
  totalMessages: number;
  copyEdits: number;
  settingsCustomized: number;
}

export function Dashboard({
  stats,
  audit,
  locale,
  hidden,
  labelledBy,
  go,
}: {
  stats: DashboardStats;
  audit: AdminAuditRow[];
  locale: "en" | "fa";
  hidden: boolean;
  labelledBy: string;
  go: (s: SectionId) => void;
}) {
  const t = useTranslations("admin");
  const num = (n: number) => formatNumber(n, locale);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale === "fa" ? "fa-IR" : "en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const cards: { id: SectionId; label: string; value: string; note?: string; lit?: boolean }[] = [
    { id: "projects", label: t("nav.items.projects"), value: num(stats.projects.total), note: t("dashboard.published", { count: stats.projects.published }) },
    { id: "categories", label: t("nav.items.categories"), value: num(stats.categories) },
    { id: "hero", label: t("nav.items.hero"), value: num(stats.hero.total), note: t("dashboard.active", { count: stats.hero.active }) },
    { id: "team", label: t("nav.items.team"), value: num(stats.team) },
    { id: "inbox", label: t("dashboard.unreadMessages"), value: num(stats.unread), note: t("dashboard.ofTotal", { count: stats.totalMessages }), lit: stats.unread > 0 },
    { id: "content", label: t("dashboard.copyEdits"), value: num(stats.copyEdits), note: t("dashboard.copyEditsNote") },
    { id: "settings", label: t("dashboard.settingsCustom"), value: num(stats.settingsCustomized), note: t("dashboard.settingsNote") },
  ];

  const links: SectionId[] = ["projects", "content", "settings", "media", "inbox"];

  return (
    <PanelFrame
      id="dashboard"
      labelledBy={labelledBy}
      hidden={hidden}
      title={t("nav.items.dashboard")}
      sub={t("dashboard.sub")}
      actions={
        <Link href="/" target="_blank" rel="noopener" className="lbf-textbtn adm-add">
          {t("dashboard.viewLive")}
          <span className="sr-only"> ({t("opensNewTab")})</span>
        </Link>
      }
    >
      <ul className="adm-stats">
        {cards.map((c) => (
          <li key={c.id + c.label}>
            <button type="button" className="adm-stat" onClick={() => go(c.id)} data-lit={c.lit ? "true" : "false"}>
              <span className="adm-stat-v">{c.value}</span>
              <span className="adm-stat-l">{c.label}</span>
              {c.note && <span className="adm-stat-n">{c.note}</span>}
            </button>
          </li>
        ))}
      </ul>

      <div className="adm-dash-cols">
        <section aria-labelledby="adm-dash-recent">
          <h3 className="adm-group-h" id="adm-dash-recent">
            {t("dashboard.recent")}
          </h3>
          {audit.length === 0 ? (
            <p className="adm-hint-line">{t("dashboard.recentEmpty")}</p>
          ) : (
            <ol className="adm-audit">
              {audit.slice(0, 15).map((a) => (
                <li key={a.id} className="adm-audit-item">
                  <span className="adm-audit-what">
                    {KNOWN_ACTIONS.has(a.action) ? t(`dashboard.actions.${a.action.replace(/\./g, "_")}`) : a.action}
                    {a.target && (
                      <span className="adm-audit-target" dir="auto">
                        {" "}
                        · {a.target}
                      </span>
                    )}
                  </span>
                  <span className="adm-audit-meta">
                    {a.actor_email && <span dir="ltr">{a.actor_email}</span>}
                    <time dateTime={a.at} suppressHydrationWarning>
                      {fmt(a.at)}
                    </time>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="adm-hint-line">{t("dashboard.auditNote")}</p>
        </section>

        <section aria-labelledby="adm-dash-links">
          <h3 className="adm-group-h" id="adm-dash-links">
            {t("dashboard.quick")}
          </h3>
          <ul className="adm-quick">
            {links.map((l) => (
              <li key={l}>
                <button type="button" className="lbf-textbtn" onClick={() => go(l)}>
                  {t(`dashboard.quickLinks.${l}`)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </PanelFrame>
  );
}
