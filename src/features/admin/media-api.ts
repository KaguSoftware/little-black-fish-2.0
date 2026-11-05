"use client";

import { createContext, useContext } from "react";
import type { ActionResult } from "@/shared/data/types";
import type { Bucket } from "@/shared/data/storage";
import type { MediaPage } from "@/shared/actions/admin/types";
import { deleteMedia, listMedia, mediaUsage, replaceMedia } from "@/shared/actions/admin/media";
import { getAdminSetting, saveSettings } from "@/shared/actions/admin/settings";
import { updateTeamMember } from "@/shared/actions/admin/team";
import type { TeamMemberInput } from "@/shared/actions/admin/types";
import type { SettingKey, Settings } from "@/shared/data/settingsSchema";
import { getSupabaseClient } from "@/shared/supabase/browser";

/**
 * Everything the media UI needs from the outside world. Components read it from context
 * (`useMediaApi`) so a test harness can swap in mocks; the default talks to the real admin actions
 * and to Supabase Storage.
 */
export interface MediaApi {
  list(bucket: Bucket, offset: number, limit: number): Promise<ActionResult<MediaPage>>;
  remove(bucket: Bucket, path: string, force: boolean): Promise<ActionResult>;
  replace(bucket: Bucket, oldUrl: string, newUrl: string): Promise<ActionResult<{ updated: number }>>;
  usage(bucket: Bucket, url: string): Promise<ActionResult<string[]>>;
  /** Images section: save one settings key / update a team member (swapped for mocks in tests). */
  saveSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<ActionResult>;
  /** Fresh value of one settings key (read-modify-write of shared keys). Optional: mocks may omit it. */
  readSetting?<K extends SettingKey>(key: K): Promise<ActionResult<Settings[K]>>;
  updateTeam(id: string, input: TeamMemberInput, opts?: { keepOldFile?: boolean }): Promise<ActionResult>;
  /** Uploads one (already processed) file and resolves with its public URL. Rejects with Error; AbortError on cancel. */
  upload(file: File, opts: { bucket: Bucket; onProgress: (fraction: number) => void; signal: AbortSignal }): Promise<string>;
}

function abortError() {
  const e = new Error("Canceled");
  e.name = "AbortError";
  return e;
}

/** Browser upload with real progress (XHR); falls back to the SDK (no progress) without a session. */
async function uploadReal(file: File, { bucket, onProgress, signal }: { bucket: Bucket; onProgress: (f: number) => void; signal: AbortSignal }) {
  if (signal.aborted) throw abortError();
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const supabase = getSupabaseClient();
  const storage = supabase.storage.from(bucket);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    onProgress(1);
    return storage.getPublicUrl(path).data.publicUrl;
  }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = `Upload failed (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        message = body.message || body.error || message;
      } catch {}
      reject(new Error(message));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onabort = () => reject(abortError());
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
  onProgress(1);
  return storage.getPublicUrl(path).data.publicUrl;
}

export const realMediaApi: MediaApi = {
  list: (b, o, l) => listMedia(b, o, l),
  remove: (b, p, f) => deleteMedia(b, p, f),
  replace: (b, o, n) => replaceMedia(b, o, n),
  usage: (b, u) => mediaUsage(b, u),
  saveSetting: (k, v) => saveSettings(k, v),
  readSetting: (k) => getAdminSetting(k),
  updateTeam: (id, input, opts) => updateTeamMember(id, input, opts),
  upload: uploadReal,
};

export const MediaApiContext = createContext<MediaApi>(realMediaApi);
export const MediaApiProvider = MediaApiContext.Provider;
export const useMediaApi = () => useContext(MediaApiContext);
