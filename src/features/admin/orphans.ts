"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { storagePath } from "@/shared/data/storage";
import { bucketOf } from "./images-model";
import { useMediaApi } from "./media-api";
import { toast } from "./toast";

/**
 * Orphan hygiene. After a picture was replaced or removed, `offer(urls)` checks which of the old
 * files nothing uses any more and, if any, shows ONE quiet toast "No longer used. Delete the
 * file?" The person decides; nothing is deleted without that click.
 */
export function useOrphanOffer() {
  const api = useMediaApi();
  const t = useTranslations("adminMedia");
  return useCallback(
    async (urls: Iterable<string>) => {
      const free: { url: string; bucket: "projects" | "hero"; path: string }[] = [];
      for (const url of new Set(urls)) {
        const bucket = bucketOf(url);
        const path = bucket ? storagePath(url, bucket) : null;
        if (!bucket || !path) continue;
        try {
          const r = await api.usage(bucket, url);
          if (r.success && r.data && r.data.length === 0) free.push({ url, bucket, path });
        } catch {
          /* unknown usage: never offer */
        }
      }
      if (!free.length) return;
      toast({
        kind: "info",
        text: t("orphan.text", { count: free.length }),
        actionLabel: t("orphan.delete", { count: free.length }),
        duration: 14000,
        undo: () => {
          void (async () => {
            let failed = 0;
            for (const f of free) {
              try {
                const r = await api.remove(f.bucket, f.path, false);
                if (!r.success) failed++;
              } catch {
                failed++;
              }
            }
            toast(failed ? { kind: "error", text: t("orphan.failed") } : { text: t("orphan.done", { count: free.length }) });
          })();
        },
      });
    },
    [api, t],
  );
}
