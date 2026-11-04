import "server-only";

import { createAnonClient } from "@/shared/supabase/server";
import type { TeamMember } from "@/shared/content/team";
import { cachedRead, TAGS, warn } from "./cached";
import { TEAM_DEFAULTS } from "./defaults";
import type { TeamMemberRow } from "./types";

const read = cachedRead(TAGS.team, async (): Promise<TeamMemberRow[]> => {
  const { data, error } = await createAnonClient()
    .from("team_members")
    .select("*")
    .order("order")
    .order("created_at");
  if (error) throw error;
  return (data ?? []) as TeamMemberRow[];
});

export const toTeamMember = (r: TeamMemberRow): TeamMember => ({
  id: r.id,
  name: { en: r.name_en, fa: r.name_fa },
  title: { en: r.title_en, fa: r.title_fa },
  role: { en: r.role_en, fa: r.role_fa },
  photo: r.photo_url || null,
  instagram: r.instagram || null,
});

/**
 * Visible team members in order, in the same shape as content/team.ts TEAM.
 * Falls back to TEAM only when the read fails; an empty table is legitimate (the admin removed
 * or hid everyone) and yields [].
 */
export async function getTeam(): Promise<TeamMember[]> {
  try {
    return (await read()).filter((r) => r.visible).map(toTeamMember);
  } catch (e) {
    warn("team_members", e);
    return TEAM_DEFAULTS.map(toTeamMember);
  }
}
