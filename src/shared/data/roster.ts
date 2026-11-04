import "server-only";

import { rosterFrom, type RosterEntry } from "@/shared/content/roster";
import { getSeriesContent } from "./series";
import { getSettings } from "./settings";

/**
 * The visible voices, ordered as set in /admin (series_characters.order / visible), merged with the
 * per-voice look in site_settings "tellers". Never throws: when the database is unreachable or
 * empty everything falls back to the six code defaults. May legitimately return [] (all hidden).
 */
export async function getRoster(): Promise<RosterEntry[]> {
  const [series, settings] = await Promise.all([getSeriesContent(), getSettings()]);
  return rosterFrom(series.characters, settings.tellers);
}
