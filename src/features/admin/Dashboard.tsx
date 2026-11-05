"use client";

import { useTranslations } from "next-intl";
import { formatNumber } from "@/shared/data/localize";
import type { AdminAuditRow } from "@/shared/data/types";
import { PanelFrame } from "./forms";
import { Icon, type IconName } from "./icons-ux";

export type SectionId =
  | "dashboard"
  | "projects"
  | "categories"
  | "team"
  | "content"
  | "series"
  | "settings"
  | "media"
  | "images"
  | "inbox"
  | "account";

/** Navigate to a section, optionally pressing a button or focusing an element once it is on screen. */
export type Go = (s: SectionId, opts?: { click?: string; focus?: string }) => void;

/** Every audit action we can say in plain words (anything else shows as "Made a change"). */
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
  "series.character.look",
  "series_chapters.show",
  "series_chapters.hide",
  "series_characters.show",
  "series_characters.hide",
  "media.delete",
  "media.replace",
  "projects.create",
  "projects.update",
  "projects.delete",
  "projects.publish",
  "projects.unpublish",
  "account.password",
]);

export interface DashboardStats {
  projects: { total: number; published: number };
  team: number;
  voices: { shown: number; total: number };
  unread: number;
  totalMessages: number;
  copyEdits: number;
}

const rtfCache = new Map<string, Intl.RelativeTimeFormat>();
function ago(iso: string, locale: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const tag = locale === "fa" ? "fa-IR" : "en-US";
  let rtf = rtfCache.get(tag);
  if (!rtf) rtfCache.set(tag, (rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto" })));
  if (abs < 60) return rtf.format(0, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return new Date(iso).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" });
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
  go: Go;
}) {
  const t = useTranslations("admin");
  const num = (n: number) => formatNumber(n, locale);

  const tasks: { id: string; icon: IconName; title: string; text: string; run: () => void; badge?: string }[] = [
    { id: "text", icon: "text", title: t("dashboard.tasks.text.title"), text: t("dashboard.tasks.text.text"), run: () => go("content") },
    { id: "photo", icon: "photo", title: t("dashboard.tasks.photo.title"), text: t("dashboard.tasks.photo.text"), run: () => go("images") },
    {
      id: "project",
      icon: "plus",
      title: t("dashboard.tasks.project.title"),
      text: t("dashboard.tasks.project.text"),
      run: () => go("projects", { click: "#adm-add-projects" }),
    },
    {
      id: "messages",
      icon: "mail",
      title: t("dashboard.tasks.messages.title"),
      text: stats.unread > 0 ? t("dashboard.tasks.messages.unread", { count: stats.unread }) : t("dashboard.tasks.messages.none"),
      run: () => go("inbox"),
      badge: stats.unread > 0 ? num(stats.unread) : undefined,
    },
    { id: "link", icon: "link", title: t("dashboard.tasks.link.title"), text: t("dashboard.tasks.link.text"), run: () => go("settings") },
  ];

  const glance: { id: SectionId; label: string; value: string; note: string; lit?: boolean }[] = [
    { id: "projects", label: t("nav.items.projects"), value: num(stats.projects.total), note: t("dashboard.published", { count: stats.projects.published }) },
    { id: "team", label: t("nav.items.team"), value: num(stats.team), note: t("dashboard.onAbout") },
    { id: "series", label: t("nav.items.series"), value: num(stats.voices.shown), note: t("dashboard.ofVoices", { count: stats.voices.total }) },
    { id: "inbox", label: t("dashboard.unreadMessages"), value: num(stats.unread), note: t("dashboard.ofTotal", { count: stats.totalMessages }), lit: stats.unread > 0 },
    { id: "content", label: t("dashboard.copyEdits"), value: num(stats.copyEdits), note: t("dashboard.copyEditsNote") },
  ];

  /** Raw keys and slugs are jargon: say a plain name or nothing. */
  const target = (a: AdminAuditRow): string | null => {
    if (!a.target) return null;
    if (a.action.startsWith("content.") || a.action.startsWith("series.")) return null;
    if (a.action === "settings.save") return t.has(`settings.cards.${a.target}.title`) ? t(`settings.cards.${a.target}.title`) : null;
    return a.target;
  };

  return (
    <PanelFrame id="dashboard" labelledBy={labelledBy} hidden={hidden} title={t("dashboard.title")} sub={t("dashboard.sub")}>
      <section aria-labelledby="adm-dash-do" className="ux-dash-block">
        <h3 className="ux-h3" id="adm-dash-do">
          {t("dashboard.what")}
        </h3>
        <ul className="ux-launch">
          {tasks.map((k) => (
            <li key={k.id}>
              <button type="button" className="ux-task" onClick={k.run}>
                <span className="ux-task-ico" aria-hidden="true">
                  <Icon name={k.icon} />
                </span>
                <span className="ux-task-text">
                  <span className="ux-task-title">{k.title}</span>
                  <span className="ux-task-sub">{k.text}</span>
                </span>
                {k.badge && (
                  <span className="ux-task-badge" aria-hidden="true">
                    {k.badge}
                  </span>
                )}
                <Icon name="chevron" className="ux-task-go" />
              </button>
            </li>
          ))}
        </ul>
        <p className="ux-hint-kbd">
          {t.rich("dashboard.findTip", { k: () => <kbd className="ux-kbd">{t("kbdFind")}</kbd> })}
        </p>
      </section>

      <section aria-labelledby="adm-dash-glance" className="ux-dash-block">
        <h3 className="ux-h3" id="adm-dash-glance">
          {t("dashboard.glance")}
        </h3>
        <ul className="ux-glance">
          {glance.map((c) => (
            <li key={c.id}>
              <button type="button" className="ux-stat" onClick={() => go(c.id)} data-lit={c.lit ? "true" : "false"}>
                <span className="ux-stat-v">{c.value}</span>
                <span className="ux-stat-l">{c.label}</span>
                <span className="ux-stat-n">{c.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="adm-dash-recent" className="ux-dash-block">
        <h3 className="ux-h3" id="adm-dash-recent">
          {t("dashboard.recent")}
        </h3>
        {audit.length === 0 ? (
          <p className="adm-hint-line">{t("dashboard.recentEmpty")}</p>
        ) : (
          <ol className="ux-recent">
            {audit.slice(0, 10).map((a) => (
              <li key={a.id} className="ux-recent-item">
                <span className="ux-recent-what">
                  {KNOWN_ACTIONS.has(a.action) ? t(`dashboard.actions.${a.action.replace(/\./g, "_")}`) : t("dashboard.actions.other")}
                  {target(a) && (
                    <span className="ux-recent-target" dir="auto">
                      {" "}
                      · {target(a)}
                    </span>
                  )}
                </span>
                <time className="ux-recent-when" dateTime={a.at} title={new Date(a.at).toLocaleString(locale === "fa" ? "fa-IR" : "en-US")} suppressHydrationWarning>
                  {ago(a.at, locale)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </section>
    </PanelFrame>
  );
}
