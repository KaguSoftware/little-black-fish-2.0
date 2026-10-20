export type Bucket = "projects" | "hero";

export const isSupabaseStorageUrl = (url?: string | null): url is string =>
  !!url && url.includes(".supabase.co/storage/");

/** Path inside the bucket: everything after /object/public/<bucket>/. */
export function storagePath(url: string, bucket: Bucket): string | null {
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
}

const VIDEO_RE = /\.(mp4|webm|ogg|mov)(\?|$)/i;
export const isVideoUrl = (url?: string | null) => !!url && VIDEO_RE.test(url);
