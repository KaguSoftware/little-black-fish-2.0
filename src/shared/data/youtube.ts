const YOUTUBE_RE =
  /(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/shorts\/|\/live\/|\/user\/\S+|\/ytscreeningroom\?v=))([\w\-]{11})/;

/** Stored URLs include youtu.be/…?si=…, /shorts/… and stray whitespace: always go through this. */
export const getYouTubeId = (url?: string | null) => (url ? (url.trim().match(YOUTUBE_RE)?.[1] ?? null) : null);

/** 320×180 */
export const youTubeThumb = (id: string) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
/** 1280×720 */
export const youTubeMaxRes = (id: string) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;

export const youTubeEmbed = (id: string) =>
  `https://www.youtube.com/embed/${id}?vq=hd1080&hd=1&rel=0&modestbranding=1&iv_load_policy=3`;
