"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type MutableRefObject, type ReactNode } from "react";
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
import { Badge, ListEditor, PanelFrame, TextField } from "./forms";
import { ImageField } from "./ImageField";
import { useAdminActions } from "./actions-seam";
import type { Go } from "./Dashboard";
import type { Notify } from "./parts";
import { SaveBar } from "./ux";

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

/** What went wrong, in words a person can act on. The raw validator sentence is never shown. */
type ErrKind = "required" | "url" | "email" | "long" | "key" | "unique" | "generic";
function kindOf(message: string): ErrKind {
  if (/is required/.test(message)) return "required";
  if (/valid URL|http:\/\//.test(message)) return "url";
  if (/valid email/.test(message)) return "email";
  if (/too long/.test(message)) return "long";
  if (/may only use/.test(message)) return "key";
  if (/unique/.test(message)) return "unique";
  return "generic";
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
  /** Friendly error text for a scalar field, or undefined. */
  fieldError: (field: string) => string | undefined;
  /** 1-based list row with the error. */
  errorIndex: number | null;
  /** Friendly error text for a list row field (1-based row), or undefined. */
  rowError: (row: number, field: string) => string | undefined;
};

/** What a card hands the panel so one Save bar can save them all. */
interface CardHandle {
  save: () => Promise<boolean>;
  discard: () => void;
  focusFirstError: () => void;
}
type Registry = MutableRefObject<Map<SettingKey, CardHandle>>;

function SettingCard<K extends SettingKey>({
  k,
  title,
  sub,
  value,
  stored,
  notify,
  onDirty,
  registry,
  extra,
  children,
}: {
  k: K;
  title: string;
  sub: string;
  value: Settings[K];
  stored: boolean;
  notify: Notify;
  onDirty: (k: SettingKey, dirty: boolean) => void;
  registry: Registry;
  extra?: ReactNode;
  children: (api: CardApi<K>) => ReactNode;
}) {
  const t = useTranslations("admin");
  const actions = useAdminActions();
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const root = useRef<HTMLElement>(null);
  const [draft, setDraft] = useState<Settings[K]>(value);
  const [synced, setSynced] = useState(JSON.stringify(value));
  const [attempted, setAttempted] = useState(false);
  const [serverErr, setServerErr] = useState<Located | null>(null);

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
    setServerErr(null);
  };

  const needles = SCALAR_NEEDLES[k] ?? LIST_NEEDLES;
  const isList = !(k in SCALAR_NEEDLES);

  // Validate as the person types; "required" waits until they try to save, so a fresh row is not scolded.
  const live = dirty ? validateSetting(k, draft) : null;
  const liveErr: Located | null = live && !live.ok ? locate(live.error, needles) : null;
  const shown: Located | null = serverErr ?? (liveErr && (attempted || kindOf(liveErr.message) !== "required") ? liveErr : null);
  const friendly = (loc: Located) => t(`settings.err.${kindOf(loc.message)}`);

  const placed = !!shown && shown.field !== null && (RENDERED[k] ?? []).includes(shown.field) && (isList ? shown.index !== null : true);

  const focusFirstError = useCallback(() => {
    requestAnimationFrame(() => {
      const el = root.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      (el ?? root.current)?.scrollIntoView({ block: "center" });
      el?.focus({ preventScroll: true });
    });
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    setAttempted(true);
    const v = validateSetting(k, draft);
    if (!v.ok) {
      focusFirstError();
      return false;
    }
    try {
      const res = await actions.saveSettings(k, v.value);
      if (res.success) {
        setDraft(v.value);
        setAttempted(false);
        startRefresh(() => router.refresh());
        return true;
      }
      setServerErr(locate(res.error, needles));
      focusFirstError();
      return false;
    } catch {
      notify.fail(t("saveFailed"));
      return false;
    }
  }, [actions, draft, focusFirstError, k, needles, notify, router, t]);

  const discard = useCallback(() => {
    setDraft(value);
    setServerErr(null);
    setAttempted(false);
  }, [value]);

  useEffect(() => {
    registry.current.set(k, { save, discard, focusFirstError });
    const map = registry.current;
    return () => void map.delete(k);
  }, [registry, k, save, discard, focusFirstError]);

  const useStandard = () => {
    const before = draft;
    set(JSON.parse(JSON.stringify(SETTING_DEFAULTS[k])) as Settings[K]);
    notify.ok(t("settings.standardApplied", { name: title }), { undo: () => set(before) });
  };

  return (
    <section className="adm-group adm-setcard" ref={root} aria-labelledby={`adm-set-${k}`} id={`adm-set-card-${k}`} data-dirty={dirty ? "true" : "false"}>
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
      <div className="adm-form">
        {extra}
        {children({
          draft,
          set,
          fieldError: (field) => (shown && !isList && shown.field === field ? friendly(shown) : undefined),
          errorIndex: isList && shown ? shown.index : null,
          rowError: (row, field) => (isList && shown && shown.index === row && shown.field === field ? friendly(shown) : undefined),
        })}
        <p className="lbf-error" role="alert">
          {shown && !placed ? friendly(shown) : ""}
        </p>
        <div className="ux-setcard-foot">
          <button type="button" className="ux-link" onClick={useStandard}>
            {t("settings.loadDefaults")}
          </button>
        </div>
      </div>
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
  go,
}: {
  settings: Settings;
  stored: string[];
  projectSlugs: string[];
  notify: Notify;
  hidden: boolean;
  labelledBy: string;
  onDirty: (dirty: boolean) => void;
  go?: Go;
}) {
  const t = useTranslations("admin");
  const registry = useRef(new Map<SettingKey, CardHandle>()) as Registry;
  const [dirtyKeys, setDirtyKeys] = useState<Record<string, boolean>>({});
  const reportDirty = useCallback((k: SettingKey, d: boolean) => setDirtyKeys((o) => (o[k] === d ? o : { ...o, [k]: d })), []);
  const dirtyList = Object.keys(dirtyKeys).filter((k) => dirtyKeys[k]) as SettingKey[];
  const anyDirty = dirtyList.length > 0;
  useEffect(() => onDirty(anyDirty), [anyDirty, onDirty]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  const cardProps = { notify, onDirty: reportDirty, registry };
  const isStored = (k: SettingKey) => stored.includes(k);
  const jump = (k: SettingKey) => {
    const el = document.getElementById(`adm-set-card-${k}`);
    el?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el?.querySelector<HTMLElement>("input,textarea")?.focus({ preventScroll: true });
  };
  const KEYS: SettingKey[] = ["studio", "socials", "payments", "contact", "seo", "series", "heroVideos"];

  const saveAll = useCallback(async () => {
    setSaving(true);
    try {
      let allOk = true;
      for (const k of KEYS) {
        const h = registry.current.get(k);
        if (!h || !dirtyKeys[k]) continue;
        if (!(await h.save())) {
          allOk = false;
          break;
        }
      }
      if (allOk) setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
    // KEYS is a constant list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyKeys]);

  const discardAll = () => dirtyList.forEach((k) => registry.current.get(k)?.discard());

  return (
    <PanelFrame id="settings" labelledBy={labelledBy} hidden={hidden} title={t("settings.title")} sub={t("settings.sub")}>
      <nav className="adm-jump ux-jump" aria-label={t("settings.jump")}>
        {KEYS.map((k) => (
          <button key={k} type="button" className="ux-chip" onClick={() => jump(k)}>
            {t(`settings.cards.${k}.title`)}
            {dirtyKeys[k] && <span className="ux-bar-dot" aria-hidden="true" />}
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
            <TextField label={t("settings.studio.url")} required type="url" dir="ltr" placeholder="https://" hint={t("settings.studio.urlHint")} value={draft.url} onChange={(v) => set({ ...draft, url: v })} error={fieldError("url")} />
            <TextField label={t("settings.studio.email")} type="email" dir="ltr" placeholder="hello@yourstudio.com" hint={t("settings.studio.emailHint")} value={draft.email} onChange={(v) => set({ ...draft, email: v })} error={fieldError("email")} />
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
                <TextField label={t("settings.socials.href")} required type="url" dir="ltr" placeholder="https://instagram.com/yourstudio" value={it.href} onChange={(v) => patch({ href: v })} error={rowError(i + 1, "href")} />
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
                <TextField label={t("settings.payments.label")} hint={t("settings.payments.labelHint")} value={it.label ?? ""} onChange={(v) => patch({ label: v })} error={rowError(i + 1, "label")} maxLength={80} />
                <TextField label={t("settings.payments.href")} required type="url" dir="ltr" placeholder="https://" value={it.href} onChange={(v) => patch({ href: v })} error={rowError(i + 1, "href")} />
                <TextField label={t("settings.payments.key")} required dir="ltr" hint={t("settings.payments.keyHint")} value={it.key} onChange={(v) => patch({ key: v })} placeholder="worldwide" error={rowError(i + 1, "key")} />
              </div>
            )}
          />
        )}
      </SettingCard>

      <SettingCard k="contact" title={t("settings.cards.contact.title")} sub={t("settings.cards.contact.sub")} value={settings.contact} stored={isStored("contact")} {...cardProps}>
        {({ draft, set, fieldError }) => (
          <TextField label={t("settings.contact.email")} type="email" dir="ltr" placeholder="you@yourstudio.com" hint={t("settings.contact.hint")} value={draft.notificationEmail} onChange={(v) => set({ notificationEmail: v })} error={fieldError("notificationEmail")} />
        )}
      </SettingCard>

      <SettingCard k="seo" title={t("settings.cards.seo.title")} sub={t("settings.cards.seo.sub")} value={settings.seo} stored={isStored("seo")} {...cardProps}>
        {({ draft, set, fieldError }) => (
          <>
            <TextField label={t("settings.seo.title")} hint={t("settings.seo.titleHint")} value={draft.title} onChange={(v) => set({ ...draft, title: v })} error={fieldError("title")} maxLength={120} />
            <TextField label={t("settings.seo.description")} hint={t("settings.seo.descriptionHint")} multiline rows={3} value={draft.description} onChange={(v) => set({ ...draft, description: v })} error={fieldError("description")} maxLength={400} />
            <ImageField
              bucket="projects"
              imagesOnly
              aspect="1200/630"
              label={t("settings.seo.ogImage")}
              description={t("settings.seo.ogHint")}
              hints={{ recommended: { width: 1200, height: 630 } }}
              error={fieldError("ogImage")}
              value={draft.ogImage}
              onChange={(url) => set({ ...draft, ogImage: url })}
            />
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

      <SettingCard
        k="heroVideos"
        title={t("settings.cards.heroVideos.title")}
        sub={t("settings.cards.heroVideos.sub")}
        value={settings.heroVideos}
        stored={isStored("heroVideos")}
        extra={
          go ? (
            <p className="adm-note ux-crosslink">
              {t("settings.heroVideos.cross")}{" "}
              <button type="button" className="ux-link" onClick={() => go("images")}>
                {t("settings.heroVideos.crossGo")}
              </button>
            </p>
          ) : undefined
        }
        {...cardProps}
      >
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
                  <ImageField
                    bucket="hero"
                    aspect="16/9"
                    label={t("settings.heroVideos.src")}
                    description={t("settings.heroVideos.srcHint")}
                    error={rowError(i + 1, "src")}
                    value={it.src}
                    onChange={(url) => patch({ src: url })}
                  />
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

      <SaveBar
        dirty={anyDirty}
        saving={saving}
        savedAt={savedAt}
        summary={t("settings.unsavedGroups", { count: dirtyList.length })}
        saveLabel={t("saveChanges")}
        onSave={saveAll}
        onDiscard={discardAll}
        active={!hidden}
        label={t("settings.saveBar")}
      />
    </PanelFrame>
  );
}
