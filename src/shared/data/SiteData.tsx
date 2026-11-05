"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { buildRoster, rosterEntry, setActiveRoster, type RosterEntry, type RosterTeller } from "@/shared/content/roster";
import { TELLER_IDS } from "@/shared/content/characters";
import { SETTING_DEFAULTS, type ArchiveSettings, type HeroVideo, type WallImage, type SeriesSettings, type SocialLink, type StudioSettings } from "./settingsSchema";

/** Admin-editable site data handed to client components by the locale layout (server). */
export interface SiteData {
  studio: StudioSettings;
  socials: SocialLink[];
  series: SeriesSettings;
  heroVideos: HeroVideo[];
  /** Custom lantern wall; [] = the built-in stills. */
  wall: WallImage[];
  archive: ArchiveSettings;
  /** Visible voices, in admin order, with their look (see content/roster.ts). May be empty. */
  roster: RosterEntry[];
  /** Series chapters switched off in /admin (ids). */
  hiddenChapters: string[];
}

export const SITE_DATA_DEFAULT: SiteData = {
  studio: SETTING_DEFAULTS.studio,
  socials: SETTING_DEFAULTS.socials,
  series: SETTING_DEFAULTS.series,
  heroVideos: SETTING_DEFAULTS.heroVideos,
  wall: [],
  archive: SETTING_DEFAULTS.archive,
  roster: TELLER_IDS.map((id) => rosterEntry(id)),
  hiddenChapters: [],
};

const Ctx = createContext<SiteData>(SITE_DATA_DEFAULT);

export function SiteDataProvider({ value, children }: { value: SiteData; children: ReactNode }) {
  // Non-React code (director, runtime, lantern) reads the registry. Client only: the server
  // handles concurrent requests, a module-level roster there would leak between them.
  if (typeof window !== "undefined") setActiveRoster(value.roster);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSiteData = () => useContext(Ctx);

/** The visible voices (ordered, overrides applied). Empty when all are hidden. */
export function useRoster(): RosterTeller[] {
  const { roster } = useSiteData();
  return useMemo(() => buildRoster(roster), [roster]);
}
