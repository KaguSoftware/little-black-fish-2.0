/**
 * Site settings: typed shapes, code defaults and per-key validation. Isomorphic (the admin UI
 * can import defaults/validators; the server action re-validates anyway).
 */
import { SITE } from "@/shared/content/site";
import { TELLER_IDS } from "@/shared/content/characters";
import { HERO_VIDEOS } from "./hero";
import { PAYMENT_LINKS } from "./support";
import { isOptimisable } from "@/shared/lib/imageUrl";

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
  /** Still shown on its wall plate before/instead of the film. "" = the plate's own still. */
  poster?: string;
}

/** One picture on the home lantern wall. */
export interface WallImage {
  /** Site-relative path (/plates/s09.webp is a built-in still) or http(s) URL. */
  src: string;
  /** Where the subject is, percent [x, y] from the top-left: the tall crop is centred on it. */
  focus?: [number, number];
  /** 1..3: tighter crop on a subject that sits small in the frame. */
  zoom?: number;
  alt?: string;
}

/** The archive's pinned Series row. */
export interface ArchiveSettings {
  /** "" = the built-in still (s20). */
  pinnedImage: string;
  pinnedFocus?: [number, number];
  pinnedAlt?: string;
}

export type ChapterPlates = { world?: string; day?: string; did?: string; others?: string };
export const PLATE_CHAPTERS = ["world", "day", "did", "others"] as const;

/**
 * Per-voice look, keyed by teller slug (TellerId). Every field is optional: missing = the code
 * default (portrait /portraits/{id}.webp, accent/stage hue from characters.ts).
 */
export interface TellerLook {
  /** Uploaded portrait: site-relative path or http(s) URL. */
  portrait?: string;
  /** Focus point on the portrait in percent [x, y] (object-position). */
  focus?: [number, number];
  /** Accent colour override, OKLCH [l 0.2..0.95, c 0..0.37, h 0..360]. */
  accent?: [number, number, number];
  /** Stage tint hue override (degrees), used for every chapter. */
  stageHue?: number;
  /** Frame shown for this voice in the home "reel": site-relative path or http(s) URL. */
  reel?: string;
  /** Backdrop image per chapter on the series page. Missing chapter = the built-in plate. */
  plates?: ChapterPlates;
}
export type TellersSettings = Record<string, TellerLook>;

export interface Settings {
  studio: StudioSettings;
  socials: SocialLink[];
  payments: PaymentLink[];
  contact: ContactSettings;
  seo: SeoSettings;
  series: SeriesSettings;
  heroVideos: HeroVideo[];
  tellers: TellersSettings;
  /** Home lantern wall. [] = the built-in stills. */
  wall: WallImage[];
  archive: ArchiveSettings;
  /** Focus point per team member id, percent [x, y]. */
  teamFocus: Record<string, [number, number]>;
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
  "tellers",
  "wall",
  "archive",
  "teamFocus",
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
  tellers: {},
  wall: [],
  archive: { pinnedImage: "" },
  teamFocus: {},
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

/** A picture the site shows through its image optimiser: a site path, or a file in this site's storage. */
function imageUrlOrPath(v: unknown, field: string, required = false): Result<string> {
  const s = urlOrPath(v, field, required);
  if (!s.ok || !s.value) return s;
  if (s.value.startsWith("#") || !isOptimisable(s.value)) {
    return bad(`${field} must be a picture uploaded here (pick it from the library or upload it), not a link to another website`);
  }
  return s;
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

function num(v: unknown, field: string, min: number, max: number): Result<number> {
  if (typeof v !== "number" || !Number.isFinite(v)) return bad(`${field} must be a number`);
  if (v < min || v > max) return bad(`${field} must be between ${min} and ${max}`);
  return ok(Math.round(v * 1000) / 1000);
}

function tuple(v: unknown, field: string, ranges: [number, number][]): Result<number[]> {
  if (!Array.isArray(v) || v.length !== ranges.length) return bad(`${field} is invalid`);
  const out: number[] = [];
  for (let i = 0; i < ranges.length; i++) {
    const r = num(v[i], field, ranges[i][0], ranges[i][1]);
    if (!r.ok) return r;
    out.push(r.value);
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
  tellers(v) {
    if (!isObj(v)) return bad("tellers is invalid");
    const out: TellersSettings = {};
    for (const [slug, raw] of Object.entries(v)) {
      if (!(TELLER_IDS as string[]).includes(slug)) return bad(`Unknown voice "${slug}"`);
      if (!isObj(raw)) return bad(`${slug} look is invalid`);
      const look: TellerLook = {};
      const portrait = urlOrPath(raw.portrait, `${slug} portrait`);
      if (!portrait.ok) return portrait;
      if (portrait.value) look.portrait = portrait.value;
      if (raw.focus != null) {
        const f = tuple(raw.focus, `${slug} focus point`, [[0, 100], [0, 100]]);
        if (!f.ok) return f;
        look.focus = f.value as [number, number];
      }
      const reel = imageUrlOrPath(raw.reel, `${slug} reel frame`);
      if (!reel.ok) return reel;
      if (reel.value) look.reel = reel.value;
      if (raw.plates != null) {
        if (!isObj(raw.plates)) return bad(`${slug} backdrops are invalid`);
        const plates: ChapterPlates = {};
        for (const c of PLATE_CHAPTERS) {
          const u = imageUrlOrPath(raw.plates[c], `${slug} ${c} backdrop`);
          if (!u.ok) return u;
          if (u.value) plates[c] = u.value;
        }
        if (Object.keys(plates).length) look.plates = plates;
      }
      if (raw.accent != null) {
        const a = tuple(raw.accent, `${slug} accent`, [[0.2, 0.95], [0, 0.37], [0, 360]]);
        if (!a.ok) return a;
        look.accent = a.value as [number, number, number];
      }
      if (raw.stageHue != null) {
        const h = num(raw.stageHue, `${slug} stage hue`, 0, 360);
        if (!h.ok) return h;
        look.stageHue = h.value;
      }
      if (Object.keys(look).length) out[slug] = look;
    }
    return ok(out);
  },
  heroVideos: (v) =>
    list<HeroVideo>(v, "Hero videos", 12, (it, l) => {
      const base = fields<HeroVideo>({
        src: urlOrPath(it.src, `${l} file`, true),
        title: str(it.title, `${l} title`, 120, true),
        project: str(it.project, `${l} project`, 120),
      });
      if (!base.ok) return base;
      const poster = imageUrlOrPath(it.poster, `${l} poster`);
      if (!poster.ok) return poster;
      return ok(poster.value ? { ...base.value, poster: poster.value } : base.value);
    }),
  wall: (v) =>
    list<WallImage>(v, "Wall images", 40, (it, l) => {
      const src = imageUrlOrPath(it.src, `${l} image`, true);
      if (!src.ok) return src;
      const out: WallImage = { src: src.value };
      if (it.focus != null) {
        const f = tuple(it.focus, `${l} focus point`, [[0, 100], [0, 100]]);
        if (!f.ok) return f;
        out.focus = f.value as [number, number];
      }
      if (it.zoom != null) {
        const z = num(it.zoom, `${l} zoom`, 1, 3);
        if (!z.ok) return z;
        if (z.value !== 1) out.zoom = z.value;
      }
      const alt = str(it.alt, `${l} description`, 300);
      if (!alt.ok) return alt;
      if (alt.value) out.alt = alt.value;
      return ok(out);
    }),
  archive(v) {
    if (!isObj(v)) return bad("archive is invalid");
    const img = imageUrlOrPath(v.pinnedImage, "Pinned image");
    if (!img.ok) return img;
    const out: ArchiveSettings = { pinnedImage: img.value };
    if (v.pinnedFocus != null) {
      const f = tuple(v.pinnedFocus, "Pinned image focus point", [[0, 100], [0, 100]]);
      if (!f.ok) return f;
      out.pinnedFocus = f.value as [number, number];
    }
    const alt = str(v.pinnedAlt, "Pinned image description", 300);
    if (!alt.ok) return alt;
    if (alt.value) out.pinnedAlt = alt.value;
    return ok(out);
  },
  teamFocus(v) {
    if (!isObj(v)) return bad("teamFocus is invalid");
    const out: Record<string, [number, number]> = {};
    const entries = Object.entries(v);
    if (entries.length > 200) return bad("teamFocus has too many entries");
    for (const [id, raw] of entries) {
      if (!id || id.length > 80) return bad("teamFocus has an invalid member id");
      const f = tuple(raw, "Team focus point", [[0, 100], [0, 100]]);
      if (!f.ok) return f;
      out[id] = f.value as [number, number];
    }
    return ok(out);
  },
};

export const isSettingKey = (k: unknown): k is SettingKey =>
  typeof k === "string" && (SETTING_KEYS as readonly string[]).includes(k);

/** Validates + normalizes (trims) the value for one settings key. */
export function validateSetting<K extends SettingKey>(key: K, value: unknown): Result<Settings[K]> {
  return VALIDATORS[key](value) as Result<Settings[K]>;
}
