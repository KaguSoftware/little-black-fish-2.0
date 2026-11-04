import "server-only";

import { unstable_cache } from "next/cache";

/**
 * Cache tags for the admin-editable content. Admin actions invalidate them with
 * updateTag() (read-your-writes) plus revalidatePath("/[locale]", "layout") so ISR pages rebuild.
 * (cacheComponents is off in next.config.ts, so `use cache` is unavailable: unstable_cache it is.)
 */
export const TAGS = {
  content: "site-content",
  settings: "site-settings",
  team: "team",
  series: "series",
} as const;
export type CacheTag = (typeof TAGS)[keyof typeof TAGS];

/** Safety net: even if an invalidation is missed, data refreshes within 5 minutes. */
const REVALIDATE_SECONDS = 300;

/**
 * Cached read keyed by `tag` + the call arguments. `read` must THROW on failure (a failed read
 * is then not cached); callers catch and fall back to code defaults.
 */
export function cachedRead<A extends unknown[], T>(tag: CacheTag, read: (...args: A) => Promise<T>) {
  return unstable_cache(read, [tag], { tags: [tag], revalidate: REVALIDATE_SECONDS });
}

export function warn(label: string, e: unknown) {
  console.warn(`[fallback] ${label}: ${e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e)}`);
}
