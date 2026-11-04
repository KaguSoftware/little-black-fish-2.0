"use client";

import { createContext, useContext, type ReactNode } from "react";
import { SETTING_DEFAULTS, type HeroVideo, type SeriesSettings, type SocialLink, type StudioSettings } from "./settingsSchema";

/** Admin-editable site data handed to client components by the locale layout (server). */
export interface SiteData {
  studio: StudioSettings;
  socials: SocialLink[];
  series: SeriesSettings;
  heroVideos: HeroVideo[];
  /** Series characters / chapters switched off in /admin (ids). */
  hiddenTellers: string[];
  hiddenChapters: string[];
}

export const SITE_DATA_DEFAULT: SiteData = {
  studio: SETTING_DEFAULTS.studio,
  socials: SETTING_DEFAULTS.socials,
  series: SETTING_DEFAULTS.series,
  heroVideos: SETTING_DEFAULTS.heroVideos,
  hiddenTellers: [],
  hiddenChapters: [],
};

const Ctx = createContext<SiteData>(SITE_DATA_DEFAULT);

export function SiteDataProvider({ value, children }: { value: SiteData; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSiteData = () => useContext(Ctx);
