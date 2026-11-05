/**
 * URL of an admin-chosen image through the Next image optimiser, for places that cannot use
 * next/image (WebGL textures, plain <img>). The width must be one of next.config `images.deviceSizes`
 * and the quality one of `images.qualities`. Hosts the optimiser does not allow (anything but
 * Supabase storage, YouTube thumbnails and same-origin paths; see next.config `images.remotePatterns`) are returned untouched.
 */
export function isOptimisable(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const u = new URL(src);
    if (u.protocol !== "https:") return false;
    if (u.hostname.endsWith(".supabase.co")) return u.pathname.startsWith("/storage/v1/object/public/");
    return u.hostname === "img.youtube.com" && u.pathname.startsWith("/vi/");
  } catch {
    return false;
  }
}

export function optimizedUrl(src: string, width: number, quality: 60 | 75 = 75): string {
  if (!isOptimisable(src)) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`;
}

/** Small display of an admin-uploaded picture (portraits, chips); built-in /paths are already small and stay as they are. */
export function smallImage(src: string, width: 96 | 128 | 256 | 384 | 640): string {
  return src.startsWith("/") ? src : optimizedUrl(src, width, 75);
}

/** A settings value that is an image URL/path (as opposed to a built-in still id like "s09"). */
export const isImageRef = (ref: string): boolean => ref.startsWith("/") || /^https?:\/\//.test(ref);
