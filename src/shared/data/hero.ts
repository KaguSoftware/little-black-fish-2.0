/**
 * Home hero videos. To save Supabase bandwidth they are served as static files
 * (re-encoded copies of the two active hero_slides), not from the hero bucket.
 * The admin panel still manages hero_slides; this list is what the home page plays.
 */
export const HERO_VIDEOS = [
  { src: "/videos/hero-1.mp4", title: "Gilgamesh", project: "gilgamesh" },
  { src: "/videos/hero-2.mp4", title: "Arcus", project: "arcus" },
] as const;
