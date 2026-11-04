/**
 * The roster: the ORDERED list of voices (tellers) that are switched on in /admin, merged with
 * their per-voice look overrides (site_settings "tellers"). Isomorphic and pure.
 *
 * Single source of truth for "who is on the site". Code keeps the models, eyelines, plates and
 * moods (characters.ts); the roster decides which of the six exist, in what order, with which
 * accent / stage hue / portrait. Server: `getRoster()` (src/shared/data/roster.ts) -> SiteData ->
 * `useRoster()` in components. Non-React code (director, runtime) reads the module registry below,
 * which the SiteDataProvider keeps in sync on the client.
 */
import { TELLERS, TELLER_IDS, tellerPortrait } from "./characters";
import type { Oklch, Teller, TellerId } from "./types";
import type { TellerLook } from "../data/settingsSchema";

/** Serializable per-voice data handed to client components. */
export interface RosterEntry {
  id: TellerId;
  /** Accent override, null = the code accent. */
  accent: Oklch | null;
  /** Stage hue override, null = the code stage hues. */
  stageHue: number | null;
  /** Always resolved: the uploaded portrait or /portraits/{id}.webp. */
  portrait: string;
  /** Focus point in percent (object-position). */
  focus: [number, number];
}

/** A teller with the roster overrides applied. */
export interface RosterTeller extends Teller {
  portraitUrl: string;
  portraitFocus: [number, number];
  custom: boolean;
}

export const DEFAULT_FOCUS: [number, number] = [50, 50];
export const CUSTOM_FOCUS: [number, number] = [50, 35];

export const isTellerId = (s: string): s is TellerId => (TELLER_IDS as string[]).includes(s);

export function rosterEntry(id: TellerId, look?: TellerLook | null): RosterEntry {
  return {
    id,
    accent: look?.accent ?? null,
    stageHue: look?.stageHue ?? null,
    portrait: look?.portrait || tellerPortrait(id),
    focus: look?.focus ?? (look?.portrait ? CUSTOM_FOCUS : DEFAULT_FOCUS),
  };
}

/** Visible, ordered characters rows + tellers settings -> roster entries (unknown slugs dropped). */
export function rosterFrom(
  characters: ReadonlyArray<{ slug: string }>,
  looks: Record<string, TellerLook | undefined>,
): RosterEntry[] {
  const seen = new Set<string>();
  const out: RosterEntry[] = [];
  for (const c of characters) {
    if (!isTellerId(c.slug) || seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push(rosterEntry(c.slug, looks[c.slug]));
  }
  return out;
}

function apply(t: Teller, e: RosterEntry): RosterTeller {
  return {
    ...t,
    accent: e.accent ?? t.accent,
    stageHue: e.stageHue == null ? t.stageHue : { default: e.stageHue },
    portraitUrl: e.portrait,
    portraitFocus: e.focus,
    custom: e.portrait !== tellerPortrait(t.id),
  };
}

export function buildRoster(entries: readonly RosterEntry[]): RosterTeller[] {
  const out: RosterTeller[] = [];
  for (const e of entries) {
    const t = TELLERS.find((x) => x.id === e.id);
    if (t) out.push(apply(t, e));
  }
  return out;
}

const ALL_DEFAULT: RosterEntry[] = TELLER_IDS.map((id) => rosterEntry(id));

let visible: RosterTeller[] = buildRoster(ALL_DEFAULT);
let byId = new Map<TellerId, RosterTeller>(visible.map((t) => [t.id, t]));

/** Registry for non-React code. Called by SiteDataProvider on the client with the server's roster. */
export function setActiveRoster(entries: readonly RosterEntry[]) {
  visible = buildRoster(entries);
  byId = new Map(visible.map((t) => [t.id, t]));
}

/** Visible voices in admin order. */
export const activeTellers = (): readonly RosterTeller[] => visible;
export const activeIds = (): TellerId[] => visible.map((t) => t.id);
/** A teller with overrides when visible, else the plain code teller (never undefined). */
export function tellerView(id: TellerId): Teller {
  return byId.get(id) ?? TELLERS.find((t) => t.id === id)!;
}

/** Spelled-out counts 0..12 for the "{count} voices" headline. Falls back to digits beyond. */
const EN_WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const FA_WORDS = ["صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده", "یازده", "دوازده"];
export function countWord(n: number, locale: string, lower = false): string {
  const list = locale === "fa" ? FA_WORDS : EN_WORDS;
  const w = Number.isInteger(n) && n >= 0 && n < list.length ? list[n] : String(n);
  return lower ? w.toLowerCase() : w;
}
