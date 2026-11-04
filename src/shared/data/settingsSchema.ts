/**
 * Site settings: typed shapes, code defaults and per-key validation. Isomorphic (the admin UI
 * can import defaults/validators; the server action re-validates anyway).
 */
import { SITE } from "@/shared/content/site";
import { HERO_VIDEOS } from "./hero";
import { PAYMENT_LINKS } from "./support";

export interface StudioSettings {
  name: string;
  fullName: string;
  tagline: string;
  city: string;
  /** Absolute http(s) URL of the live site. */
  url: string;
  /** Public contact address shown in the footer / series page. "" = none. */
  email: string;
}
export interface SocialLink {
  label: string;
  href: string;
}
export interface PaymentLink {
  /** Stable id: "worldwide" and "iran" are the two methods the support page knows. */
  key: string;
  /** Optional override of the localized label from messages/support.json. */
  label?: string;
  href: string;
}
export interface ContactSettings {
  /** Where contact-form notifications go. "" = fall back to env ADMIN_CONTACT_EMAIL. */
  notificationEmail: string;
}
export interface SeoSettings {
  /** "" = use messages common.studio / common.description. */
  title: string;
  description: string;
  /** Absolute http(s) URL or site-relative path; "" = none. */
  ogImage: string;
}
export interface SeriesSettings {
  title: string;
  year: string;
  /** http(s) URL, or "#watch"-style/relative link. */
  url: string;
}
export interface HeroVideo {
  /** Site-relative path (/videos/hero-1.mp4) or http(s) URL. */
  src: string;
  title: string;
  /** Slug of the project the video links to. */
  project: string;
}

export interface Settings {
  studio: StudioSettings;
  socials: SocialLink[];
  payments: PaymentLink[];
  contact: ContactSettings;
  seo: SeoSettings;
  series: SeriesSettings;
  heroVideos: HeroVideo[];
}
export type SettingKey = keyof Settings;
export const SETTING_KEYS = [
  "studio",
  "socials",
  "payments",
  "contact",
  "seo",
  "series",
  "heroVideos",
] as const satisfies readonly SettingKey[];

const PAYMENT_LABELS: Record<string, string> = { worldwide: "Support in Dollars", iran: "Support in Rial" };

export const SETTING_DEFAULTS: Settings = {
  studio: {
    name: SITE.studio,
    fullName: SITE.studioFull,
    tagline: SITE.tagline,
    city: SITE.city,
    url: SITE.url,
    email: "",
  },
  socials: SITE.socials.map((s) => ({ label: s.label, href: s.href })),
  payments: Object.entries(PAYMENT_LINKS).map(([key, href]) => ({ key, label: PAYMENT_LABELS[key], href })),
  contact: { notificationEmail: "" },
  seo: { title: "", description: "", ogImage: "" },
  series: { title: SITE.seriesTitle, year: SITE.seriesYear, url: SITE.seriesUrl },
  heroVideos: HERO_VIDEOS.map((v) => ({ src: v.src, title: v.title, project: v.project })),
};

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const bad = (error: string): Result<never> => ({ ok: false, error });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function str(v: unknown, field: string, max = 300, required = false): Result<string> {
  if (v == null) v = "";
  if (typeof v !== "string") return bad(`${field} must be text`);
  const s = v.trim();
  if (required && !s) return bad(`${field} is required`);
  if (s.length > max) return bad(`${field} is too long (max ${max})`);
  return ok(s);
}

/** Backslashes and ASCII control characters: URL parsers silently strip/normalise them ("/\host" acts like "//host"). */
export function hasUnsafeChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x5c || c <= 0x1f || c === 0x7f) return true; // backslash, C0 controls, DEL
  }
  return false;
}

/** http(s) absolute URL. */
function httpUrl(v: unknown, field: string, required = false): Result<string> {
  const s = str(v, field, 2000, required);
  if (!s.ok || !s.value) return s;
  if (hasUnsafeChars(s.value)) return bad(`${field} contains backslashes or control characters`);
  try {
    const u = new URL(s.value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return bad(`${field} must start with http:// or https://`);
  } catch {
    return bad(`${field} is not a valid URL`);
  }
  return s;
}

/** http(s) URL, or a site-relative path ("/x"), or an in-page anchor ("#x"). Never javascript: etc. */
function urlOrPath(v: unknown, field: string, required = false): Result<string> {
  const s = str(v, field, 2000, required);
  if (!s.ok || !s.value) return s;
  if (hasUnsafeChars(s.value)) return bad(`${field} contains backslashes or control characters`);
  if ((s.value.startsWith("/") && !s.value.startsWith("//")) || s.value.startsWith("#")) return s;
  return httpUrl(s.value, field);
}

function email(v: unknown, field: string): Result<string> {
  const s = str(v, field, 254);
  if (!s.ok || !s.value) return s;
  return EMAIL_RE.test(s.value) ? s : bad(`${field} is not a valid email address`);
}

function list<T>(
  v: unknown,
  field: string,
  max: number,
  each: (item: Record<string, unknown>, label: string) => Result<T>,
): Result<T[]> {
  if (!Array.isArray(v)) return bad(`${field} must be a list`);
  if (v.length > max) return bad(`${field} has too many items (max ${max})`);
  const out: T[] = [];
  for (let i = 0; i < v.length; i++) {
    const item: unknown = v[i];
    if (!isObj(item)) return bad(`${field} #${i + 1} is invalid`);
    const r = each(item, `${field} #${i + 1}`);
    if (!r.ok) return r;
    out.push(r.value);
  }
  return ok(out);
}

function fields<T extends object>(parts: { [K in keyof T]: Result<T[K]> }): Result<T> {
  const out = {} as T;
  for (const k of Object.keys(parts) as (keyof T)[]) {
    const r = parts[k];
    if (!r.ok) return r;
    out[k] = r.value;
  }
  return ok(out);
}

const VALIDATORS: { [K in SettingKey]: (v: unknown) => Result<Settings[K]> } = {
  studio(v) {
    if (!isObj(v)) return bad("studio is invalid");
    return fields<StudioSettings>({
      name: str(v.name, "Studio name", 80, true),
      fullName: str(v.fullName, "Full studio name", 120, true),
      tagline: str(v.tagline, "Tagline", 300),
      city: str(v.city, "City", 80),
      url: httpUrl(v.url, "Site URL", true),
      email: email(v.email, "Public email"),
    });
  },
  socials: (v) =>
    list<SocialLink>(v, "Social links", 12, (it, l) =>
      fields<SocialLink>({ label: str(it.label, `${l} label`, 60, true), href: httpUrl(it.href, `${l} URL`, true) }),
    ),
  payments: (v) => {
    const r = list<PaymentLink>(v, "Payment links", 6, (it, l) => {
      const key = str(it.key, `${l} key`, 32, true);
      if (key.ok && !/^[a-z0-9-]+$/.test(key.value)) return bad(`${l} key may only use a-z, 0-9 and -`);
      const label = str(it.label, `${l} label`, 80);
      const p = fields<{ key: string; href: string }>({ key, href: httpUrl(it.href, `${l} URL`, true) });
      if (!p.ok) return p;
      if (!label.ok) return label;
      return ok(label.value ? { ...p.value, label: label.value } : p.value);
    });
    if (r.ok && new Set(r.value.map((p) => p.key)).size !== r.value.length) return bad("Payment link keys must be unique");
    return r;
  },
  contact(v) {
    if (!isObj(v)) return bad("contact is invalid");
    return fields<ContactSettings>({ notificationEmail: email(v.notificationEmail, "Notification email") });
  },
  seo(v) {
    if (!isObj(v)) return bad("seo is invalid");
    return fields<SeoSettings>({
      title: str(v.title, "SEO title", 120),
      description: str(v.description, "SEO description", 400),
      ogImage: urlOrPath(v.ogImage, "OG image"),
    });
  },
  series(v) {
    if (!isObj(v)) return bad("series is invalid");
    return fields<SeriesSettings>({
      title: str(v.title, "Series title", 120, true),
      year: str(v.year, "Series year", 20),
      url: urlOrPath(v.url, "Series URL", true),
    });
  },
  heroVideos: (v) =>
    list<HeroVideo>(v, "Hero videos", 12, (it, l) =>
      fields<HeroVideo>({
        src: urlOrPath(it.src, `${l} file`, true),
        title: str(it.title, `${l} title`, 120, true),
        project: str(it.project, `${l} project`, 120),
      }),
    ),
};

export const isSettingKey = (k: unknown): k is SettingKey =>
  typeof k === "string" && (SETTING_KEYS as readonly string[]).includes(k);

/** Validates + normalizes (trims) the value for one settings key. */
export function validateSetting<K extends SettingKey>(key: K, value: unknown): Result<Settings[K]> {
  return VALIDATORS[key](value) as Result<Settings[K]>;
}
