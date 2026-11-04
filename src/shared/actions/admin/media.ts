"use server";

import { createServiceClient } from "@/shared/supabase/server";
import type { ActionResult } from "@/shared/data/types";
import { adminUser, audit, BUCKETS, collectReferences, fail, findReferences, refresh, UNAUTHORIZED, type StorageBucket } from "./lib";
import type { MediaItem } from "./types";

const isBucket = (b: unknown): b is StorageBucket => (BUCKETS as readonly unknown[]).includes(b);

/**
 * Files in a bucket (top level; Upload.tsx writes `<uuid>-<name>` at the root), newest first,
 * each with the places that still reference it. Uploads themselves happen in the browser.
 */
export async function listMedia(bucket: StorageBucket): Promise<ActionResult<MediaItem[]>> {
  if (!(await adminUser())) return UNAUTHORIZED;
  try {
    if (!isBucket(bucket)) return { success: false, error: "Unknown bucket" };
    const supabase = createServiceClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (error) return fail("media list", error, "Failed to list files");

    const used = await collectReferences();

    const items: MediaItem[] = (data ?? [])
      .filter((f) => f.id) // folders have no id
      .map((f) => {
        const url = supabase.storage.from(bucket).getPublicUrl(f.name).data.publicUrl;
        return {
          name: f.name,
          path: f.name,
          url,
          size: (f.metadata?.size as number | undefined) ?? 0,
          mimeType: (f.metadata?.mimetype as string | undefined) ?? "",
          createdAt: f.created_at ?? "",
          usedBy: used.get(url) ?? [],
        };
      });
    return { success: true, data: items };
  } catch (error) {
    return fail("media list", error, "Failed to list files");
  }
}

/**
 * Deletes one file. Refuses while the file is still referenced (listed in the error) unless
 * `force` is true.
 */
export async function deleteMedia(bucket: StorageBucket, path: string, force = false): Promise<ActionResult> {
  const user = await adminUser();
  if (!user) return UNAUTHORIZED;
  try {
    if (!isBucket(bucket)) return { success: false, error: "Unknown bucket" };
    if (typeof path !== "string" || !path || path.includes("..") || path.startsWith("/")) {
      return { success: false, error: "Invalid path" };
    }
    const supabase = createServiceClient();
    const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    if (!force) {
      const refs = await findReferences(url);
      if (refs.length > 0) return { success: false, error: `Still in use by: ${refs.join(", ")}` };
    }
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) return fail("media delete", error, "Failed to delete file");

    await audit(user, "media.delete", `${bucket}/${path}`);
    refresh();
    return { success: true };
  } catch (error) {
    return fail("media delete", error, "Failed to delete file");
  }
}
