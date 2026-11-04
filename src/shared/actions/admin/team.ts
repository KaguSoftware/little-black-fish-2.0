"use server";

import { createServiceClient } from "@/shared/supabase/server";
import { TAGS } from "@/shared/data/cached";
import { hasUnsafeChars } from "@/shared/data/settingsSchema";
import { isSupabaseStorageUrl, storagePath } from "@/shared/data/storage";
import type { ActionResult } from "@/shared/data/types";
import { adminUser, audit, BUCKETS, fail, findReferences, refresh, text, UNAUTHORIZED } from "./lib";
import type { TeamMemberInput } from "./types";

/** "@name", "name" or an instagram.com URL to the bare handle; "" for none; null when invalid. */
function handle(v: unknown): string | null {
  const raw = text(v, 200);
  if (!raw) return "";
  const m = raw.match(/instagram\.com\/([^/?#\s]+)/i);
  const h = (m ? m[1] : raw).replace(/^@/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : null;
}

function photo(v: unknown): string | null | undefined {
  const s = text(v, 2000);
  if (!s) return null;
  if (hasUnsafeChars(s)) return undefined;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : undefined;
  } catch {
    return undefined;
  }
}

function toRow(input: TeamMemberInput): { row: Record<string, string | null> } | { error: string } {
  if (!input || typeof input !== "object") return { error: "Invalid member" };
  const nameEn = text(input.nameEn, 120);
  const nameFa = text(input.nameFa, 120);
  if (!nameEn || !nameFa) return { error: "Name is required in both languages" };
  const ig = handle(input.instagram);
  if (ig === null) return { error: "Instagram handle is not valid" };
  const photoUrl = photo(input.photoUrl);
  if (photoUrl === undefined) return { error: "Photo must be an http(s) URL or a site path" };
  return {
    row: {
      name_en: nameEn,
      name_fa: nameFa,
      title_en: text(input.titleEn, 160),
      title_fa: text(input.titleFa, 160),
      role_en: text(input.roleEn, 600),
      role_fa: text(input.roleFa, 600),
      photo_url: photoUrl,
      instagram: ig || null,
    },
  };
}

/** Removes a team photo from storage when nothing else uses it. Failures only log. */
async function cleanupPhoto(url: string | null | undefined) {
  if (!isSupabaseStorageUrl(url)) return;
  try {
    if ((await findReferences(url)).length > 0) return;
    const supabase = createServiceClient();
    for (const bucket of BUCKETS) {
      const path = storagePath(url, bucket);
      if (path) {
        const { error } = await supabase.storage.from(bucket).remove([path]);
        if (error) console.error("[admin/team] remove photo:", error);
        return;
      }
    }
  } catch (e) {
    console.error("[admin/team] remove photo:", e);
  }
}

/** New members go to the end of the running order. */
export async function createTeamMember(input: TeamMemberInput): Promise<ActionResult<{ id: string }>> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    const parsed = toRow(input);
    if ("error" in parsed) return { success: false, error: parsed.error };

    const supabase = createServiceClient();
    const { data: last, error: lastError } = await supabase
      .from("team_members")
      .select("order")
      .order("order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) return fail("team create (order)", lastError, "Failed to add member");
    const order = typeof last?.order === "number" ? last.order + 1 : 0;

    const { data, error } = await supabase
      .from("team_members")
      .insert({ ...parsed.row, order, visible: true })
      .select("id")
      .single();
    if (error) return fail("team create", error, "Failed to add member");

    await audit(user, "team.create", `${parsed.row.name_en} (${data.id})`);
    refresh(TAGS.team);
    return { success: true, data: { id: data.id as string } };
  } catch (error) {
    return fail("team create", error, "Failed to add member");
  }
}

export async function updateTeamMember(id: string, input: TeamMemberInput): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    if (!id) return { success: false, error: "Missing member id" };
    const parsed = toRow(input);
    if ("error" in parsed) return { success: false, error: parsed.error };

    const supabase = createServiceClient();
    const { data: before } = await supabase.from("team_members").select("photo_url").eq("id", id).maybeSingle();
    const { error } = await supabase.from("team_members").update(parsed.row).eq("id", id);
    if (error) return fail("team update", error, "Failed to update member");

    // Row first, file second: a replaced photo is cleaned up only after the new one is saved.
    if (before?.photo_url && before.photo_url !== parsed.row.photo_url) await cleanupPhoto(before.photo_url as string);

    await audit(user, "team.update", `${parsed.row.name_en} (${id})`);
    refresh(TAGS.team);
    return { success: true };
  } catch (error) {
    return fail("team update", error, "Failed to update member");
  }
}

export async function setTeamMemberVisible(id: string, visible: boolean): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    const { error } = await createServiceClient().from("team_members").update({ visible: !!visible }).eq("id", id);
    if (error) return fail("team visible", error, "Failed to update member");
    await audit(user, visible ? "team.show" : "team.hide", id);
    refresh(TAGS.team);
    return { success: true };
  } catch (error) {
    return fail("team visible", error, "Failed to update member");
  }
}

export async function deleteTeamMember(id: string): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    const supabase = createServiceClient();
    const { data: member, error: fetchError } = await supabase
      .from("team_members")
      .select("name_en, photo_url")
      .eq("id", id)
      .single();
    if (fetchError || !member) return { success: false, error: "Member not found" };

    const { error } = await supabase.from("team_members").delete().eq("id", id);
    if (error) return fail("team delete", error, "Failed to delete member");

    await cleanupPhoto(member.photo_url as string | null);
    await audit(user, "team.delete", `${member.name_en} (${id})`);
    refresh(TAGS.team);
    return { success: true };
  } catch (error) {
    return fail("team delete", error, "Failed to delete member");
  }
}
