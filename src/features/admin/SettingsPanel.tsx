"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  SETTING_DEFAULTS,
  validateSetting,
  type HeroVideo,
  type PaymentLink,
  type SettingKey,
  type Settings,
  type SocialLink,
} from "@/shared/data/settingsSchema";
import { saveSettings } from "@/shared/actions/admin/settings";
import { Badge, ListEditor, PanelFrame, TextField } from "./forms";
import { Upload } from "./Upload";
import type { Notify } from "./parts";

interface Located {
  message: string;
  field: string | null;
  index: number | null;
}

/** The validators speak in sentences ("Social links #2 label is required"): find the field and row. */
function locate(message: string, needles: [string, string][]): Located {
  const idx = /#(\d+)/.exec(message);
  // List rows: the word right after "#N" names the field ("Social links #2 URL is not a valid URL").
  const word = /#\d+ (\w+)/.exec(message)?.[1];
  const hit = idx ? needles.find(([n]) => n.trim() === word) : needles.find(([n]) => message.includes(n));
  return { message, field: hit ? hit[1] : null, index: idx ? Number(idx[1]) : null };
}

const SCALAR_NEEDLES: Record<string, [string, string][]> = {
  studio: [
    ["Full studio name", "fullName"],
    ["Studio name", "name"],
    ["Tagline", "tagline"],
    ["City", "city"],
    ["Site URL", "url"],
    ["Public email", "email"],
  ],
  contact: [["Notification email", "notificationEmail"]],
  seo: [
    ["SEO title", "title"],
    ["SEO description", "description"],
    ["OG image", "ogImage"],
  ],
  series: [
    ["Series title", "title"],
    ["Series year", "year"],
    ["Series URL", "url"],
  ],
};
const LIST_NEEDLES: [string, string][] = [
  ["label", "label"],
  ["URL", "href"],
  ["key", "key"],
  ["file", "src"],
  ["title", "title"],
  ["project", "project"],
];
/** Fields that actually render an inline error, per card. */
const RENDERED: Record<string, string[]> = {
  studio: ["name", "fullName", "tagline", "city", "url", "email"],
  contact: ["notificationEmail"],
  seo: ["title", "description", "ogImage"],
  series: ["title", "year", "url"],
  socials: ["label", "href"],
  payments: ["key", "label", "href"],
  heroVideos: ["src", "title", "project"],
};

type CardApi<K extends SettingKey> = {
  draft: Settings[K];
  set: (v: Settings[K]) => void;
  /** Error text for a scalar field, or undefined. */
  fieldError: (field: string) => string | undefined;
  /** 1-based list row with the error. */
  errorIndex: number | null;
  /** Error text for a list row field (1-based row), or undefined. */
  rowError: (row: number, field: string) => string | undefined;
};

function SettingCard<K extends SettingKey>({
  k,
  title,
  sub,
  value,
  stored,
  notify,
  onDirty,
  children,
}: {
  k: K;
  title: string;
  sub: string;
  value: Settings[K];
  stored: boolean;
  notify: Notify;
  onDirty: (k: SettingKey, dirty: boolean) => void;
  children: (api: CardApi<K>) => ReactNode;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const root = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<Settings[K]>(value);
  const [synced, setSynced] = useState(JSON.stringify(value));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Located | null>(null);

  // A new server value (after our own save + refresh) replaces the form.
  const serverJson = JSON.stringify(value);
  if (serverJson !== synced) {
    setSynced(serverJson);
    setDraft(value);
  }

  const dirty = JSON.stringify(draft) !== serverJson;
  useEffect(() => onDirty(k, dirty), [k, dirty, onDirty]);

  const set = (v: Settings[K]) => {
    setDraft(v);
    setErr(null);
  };

  const focusBad = () =>
    requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  const needles = SCALAR_NEEDLES[k] ?? LIST_NEEDLES;

  const submit = async () => {
    if (saving) return;
    const v = validateSetting(k, draft);
    if (!v.ok) {
      setErr(locate(v.error, needles));
      focusBad();
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await saveSettings(k, v.value);
      if (res.success) {
        setDraft(v.value);
        notify.ok(t("settings.saved", { name: title }));
        startRefresh(() => router.refresh());
      } else {
        setErr(locate(res.error, needles));
        focusBad();
      }
    } catch {
      setErr({ message: t("networkError"), field: null, index: null });
    } finally {
      setSaving(false);
    }
  };

  const isList = !(k in SCALAR_NEEDLES);
  const placed =
    !!err && err.field !== null && (RENDERED[k] ?? []).includes(err.field) && (isList ? err.index !== null : true);

  return (
    <section className="adm-group adm-setcard" ref={root} aria-labelledby={`adm-set-${k}`} id={`adm-set-card-${k}`}>
      <div className="adm-setcard-head">
        <div>
          <h3 className="adm-group-h" id={`adm-set-${k}`}>
            {title}
          </h3>
          <p className="adm-sub">{sub}</p>
        </div>
        <span className="adm-setcard-badges">
          {!stored && !dirty && <Badge>{t("settings.usingDefault")}</Badge>}
          {dirty && <Badge tone="warn">{t("content.unsavedBadge")}</Badge>}
        </span>
      </div>
      <form
        className="adm-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {children({
          draft,
          set,
          fieldError: (field) => (err && !isList && err.field === field ? err.message : undefined),
          errorIndex: isList && err ? err.index : null,
          rowError: (row, field) => (isList && err && err.index === row && err.field === field ? err.message : undefined),
        })}
        <div className="adm-form-foot">
          <button
            type="button"
            className="lbf-textbtn"
            onClick={() => {
              if (window.confirm(t("settings.confirmDefaults"))) set(JSON.parse(JSON.stringify(SETTING_DEFAULTS[k])) as Settings[K]);
            }}
            disabled={saving}
          >
            {t("settings.loadDefaults")}
          </button>
          <div className="adm-form-foot-acts">
            <button type="button" className="lbf-textbtn" onClick={() => set(value)} disabled={saving || !dirty}>
              {t("discard")}
            </button>
            <button type="submit" className="lbf-cta" disabled={saving || !dirty}>
              <span>{saving ? t("saving") : t("settings.save")}</span>
            </button>
          </div>
        </div>
        <p className="lbf-error" role="alert">
          {err && !placed ? err.message : ""}
        </p>
      </form>
    </section>
  );
}

export function SettingsPanel({
  settings,
  stored,
  projectSlugs,
  notify,
  hidden,
  labelledBy,
  onDirty,
}: {
  settings: Settings;
  stored: string[];
  projectSlugs: string[];
  notify: Notify;
  hidden: boolean;
  labelledBy: string;
  onDirty: (dirty: boolean) => void;
}) {
  const t = useTranslations("admin");
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
  const reportDirty = useCallback((k: SettingKey, d: boolean) => setDirtyKeys((o) => (o[k] === d ? o : { ...o, [k]: d })), []);
  const anyDirty = Object.values(dirtyKeys).some(Boolean);
  useEffect(() => onDirty(anyDirty), [anyDirty, onDirty]);

  const cardProps = { notify, onDirty: reportDirty };
  const isStored = (k: SettingKey) => stored.includes(k);
  const jump = (k: SettingKey) => {
    const el = document.getElementById(`adm-set-card-${k}`);
    el?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el?.querySelector<HTMLElement>("input,textarea")?.focus({ preventScroll: true });
  };
  const KEYS: SettingKey[] = ["studio", "socials", "payments", "contact", "seo", "series", "heroVideos"];

  return (
    <PanelFrame id="settings" labelledBy={labelledBy} hidden={hidden} title={t("settings.title")} sub={t("settings.sub")}>
      <nav className="adm-jump" aria-label={t("settings.jump")}>
        {KEYS.map((k) => (
          <button key={k} type="button" className="lbf-textbtn" onClick={() => jump(k)}>
            {t(`settings.cards.${k}.title`)}
          </button>
        ))}
      </nav>

      <SettingCard k="studio" title={t("settings.cards.studio.title")} sub={t("settings.cards.studio.sub")} value={settings.studio} stored={isStored("studio")} {...cardProps}>
        {({ draft, set, fieldError }) => (
          <div className="adm-pair">
            <TextField label={t("settings.studio.name")} required value={draft.name} onChange={(v) => set({ ...draft, name: v })} error={fieldError("name")} />
            <TextField label={t("settings.studio.fullName")} required value={draft.fullName} onChange={(v) => set({ ...draft, fullName: v })} error={fieldError("fullName")} />
            <TextField label={t("settings.studio.tagline")} value={draft.tagline} onChange={(v) => set({ ...draft, tagline: v })} error={fieldError("tagline")} />
            <TextField label={t("settings.studio.city")} value={draft.city} onChange={(v) => set({ ...draft, city: v })} error={fieldError("city")} />
            <TextField label={t("settings.studio.url")} required type="url" dir="ltr" placeholder="https://" hint={`${t("settings.studio.urlHint")} ${t("settings.studio.urlEnvHint")}`} value={draft.url} onChange={(v) => set({ ...draft, url: v })} error={fieldError("url")} />
            <TextField label={t("settings.studio.email")} type="email" dir="ltr" hint={t("settings.studio.emailHint")} value={draft.email} onChange={(v) => set({ ...draft, email: v })} error={fieldError("email")} />
          </div>
        )}
      </SettingCard>

      <SettingCard k="socials" title={t("settings.cards.socials.title")} sub={t("settings.cards.socials.sub")} value={settings.socials} stored={isStored("socials")} {...cardProps}>
        {({ draft, set, errorIndex, rowError }) => (
          <ListEditor<SocialLink>
            items={draft}
            onChange={set}
            max={12}
            makeEmpty={() => ({ label: "", href: "" })}
            addLabel={t("settings.socials.add")}
            emptyText={t("settings.socials.empty")}
            itemTitle={(n) => t("settings.socials.item", { n })}
            errorIndex={errorIndex}
            renderItem={(it, i, patch) => (
              <div className="adm-pair">
                <TextField label={t("settings.socials.label")} required value={it.label} onChange={(v) => patch({ label: v })} placeholder="Instagram" error={rowError(i + 1, "label")} />
                <TextField label={t("settings.socials.href")} required type="url" dir="ltr" placeholder="https://" value={it.href} onChange={(v) => patch({ href: v })} error={rowError(i + 1, "href")} />
              </div>
            )}
          />
        )}
      </SettingCard>

      <SettingCard k="payments" title={t("settings.cards.payments.title")} sub={t("settings.cards.payments.sub")} value={settings.payments} stored={isStored("payments")} {...cardProps}>
        {({ draft, set, errorIndex, rowError }) => (
          <ListEditor<PaymentLink>
            items={draft}
            onChange={set}
            max={6}
            makeEmpty={() => ({ key: "", label: "", href: "" })}
            addLabel={t("settings.payments.add")}
            emptyText={t("settings.payments.empty")}
            itemTitle={(n) => t("settings.payments.item", { n })}
            errorIndex={errorIndex}
            renderItem={(it, i, patch) => (
              <div className="adm-pair">
                <TextField label={t("settings.payments.key")} required dir="ltr" hint={t("settings.payments.keyHint")} value={it.key} onChange={(v) => patch({ key: v })} placeholder="worldwide" error={rowError(i + 1, "key")} />
                <TextField label={t("settings.payments.label")} hint={t("settings.payments.labelHint")} value={it.label ?? ""} onChange={(v) => patch({ label: v })} error={rowError(i + 1, "label")} maxLength={80} />
                <TextField label={t("settings.payments.href")} required type="url" dir="ltr" placeholder="https://" value={it.href} onChange={(v) => patch({ href: v })} error={rowError(i + 1, "href")} />
              </div>
            )}
          />
        )}
      </SettingCard>

      <SettingCard k="contact" title={t("settings.cards.contact.title")} sub={t("settings.cards.contact.sub")} value={settings.contact} stored={isStored("contact")} {...cardProps}>
        {({ draft, set, fieldError }) => (
          <TextField label={t("settings.contact.email")} type="email" dir="ltr" hint={t("settings.contact.hint")} value={draft.notificationEmail} onChange={(v) => set({ notificationEmail: v })} error={fieldError("notificationEmail")} />
        )}
      </SettingCard>

      <SettingCard k="seo" title={t("settings.cards.seo.title")} sub={t("settings.cards.seo.sub")} value={settings.seo} stored={isStored("seo")} {...cardProps}>
        {({ draft, set, fieldError }) => (
          <>
            <TextField label={t("settings.seo.title")} hint={t("settings.seo.titleHint")} value={draft.title} onChange={(v) => set({ ...draft, title: v })} error={fieldError("title")} maxLength={120} />
            <TextField label={t("settings.seo.description")} hint={t("settings.seo.descriptionHint")} multiline rows={3} value={draft.description} onChange={(v) => set({ ...draft, description: v })} error={fieldError("description")} maxLength={400} />
            <Upload bucket="projects" imagesOnly label={t("settings.seo.ogImage")} hint={t("settings.seo.ogHint")} error={fieldError("ogImage")} value={draft.ogImage} onChange={(url) => set({ ...draft, ogImage: url })} />
          </>
        )}
      </SettingCard>

      <SettingCard k="series" title={t("settings.cards.series.title")} sub={t("settings.cards.series.sub")} value={settings.series} stored={isStored("series")} {...cardProps}>
        {({ draft, set, fieldError }) => (
          <div className="adm-pair">
            <TextField label={t("settings.series.title")} required value={draft.title} onChange={(v) => set({ ...draft, title: v })} error={fieldError("title")} />
            <TextField label={t("settings.series.year")} value={draft.year} onChange={(v) => set({ ...draft, year: v })} error={fieldError("year")} />
            <TextField label={t("settings.series.url")} required dir="ltr" hint={t("settings.series.urlHint")} value={draft.url} onChange={(v) => set({ ...draft, url: v })} error={fieldError("url")} />
          </div>
        )}
      </SettingCard>

      <SettingCard k="heroVideos" title={t("settings.cards.heroVideos.title")} sub={t("settings.cards.heroVideos.sub")} value={settings.heroVideos} stored={isStored("heroVideos")} {...cardProps}>
        {({ draft, set, errorIndex, rowError }) => (
          <>
            <datalist id="adm-project-slugs">
              {projectSlugs.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <ListEditor<HeroVideo>
              items={draft}
              onChange={set}
              max={12}
              makeEmpty={() => ({ src: "", title: "", project: "" })}
              addLabel={t("settings.heroVideos.add")}
              emptyText={t("settings.heroVideos.empty")}
              itemTitle={(n) => t("settings.heroVideos.item", { n })}
              errorIndex={errorIndex}
              renderItem={(it, i, patch) => (
                <>
                  <Upload bucket="hero" label={t("settings.heroVideos.src")} hint={t("settings.heroVideos.srcHint")} error={rowError(i + 1, "src")} value={it.src} onChange={(url) => patch({ src: url })} />
                  <div className="adm-pair">
                    <TextField label={t("settings.heroVideos.title")} required value={it.title} onChange={(v) => patch({ title: v })} error={rowError(i + 1, "title")} />
                    <TextField label={t("settings.heroVideos.project")} dir="ltr" list="adm-project-slugs" hint={t("settings.heroVideos.projectHint")} value={it.project} onChange={(v) => patch({ project: v })} error={rowError(i + 1, "project")} maxLength={120} />
                  </div>
                </>
              )}
            />
          </>
        )}
      </SettingCard>
    </PanelFrame>
  );
}
