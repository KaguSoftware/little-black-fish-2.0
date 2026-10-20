import type { StillId } from "./types";

/**
 * Site-wide content. Bracketed values are PLACEHOLDERS until the studio sends
 * real content. House style: no em dashes.
 */
export const SITE = {
  studio: "Little Black Fish",
  /** Optional personal credit for later. */
  artistName: undefined as string | undefined,
  tagline: "Animator. Maker of small, strange worlds.", // PLACEHOLDER
  seriesTitle: "[SERIES TITLE]",
  seriesUrl: "#watch", // PLACEHOLDER: link to the series
  seriesYear: "[YEAR]",
  email: "[EMAIL]",
  socials: [
    { label: "Instagram", href: "#" }, // PLACEHOLDER
    { label: "Vimeo", href: "#" }, // PLACEHOLDER
    { label: "Letterboxd", href: "#" }, // PLACEHOLDER
  ],
  year: "[YEAR]",
} as const;

export interface Project {
  slug: string;
  title: string;
  year: string;
  role: string;
  /** Still used as the project's image until real project images arrive. */
  still: StillId;
  href: string;
  featured?: boolean;
}

export const PROJECTS: readonly Project[] = [
  { slug: "series", title: "[SERIES TITLE]", year: "[YEAR]", role: "Animated series", still: "s20", href: "/projects/series", featured: true },
  { slug: "p1", title: "[PROJECT 1]", year: "[YEAR]", role: "Short film", still: "s04", href: "#" },
  { slug: "p2", title: "[PROJECT 2]", year: "[YEAR]", role: "Music video", still: "s16", href: "#" },
  { slug: "p3", title: "[PROJECT 3]", year: "[YEAR]", role: "Title sequence", still: "s12", href: "#" },
  { slug: "p4", title: "[PROJECT 4]", year: "[YEAR]", role: "Commission", still: "s21", href: "#" },
  { slug: "p5", title: "[PROJECT 5]", year: "[YEAR]", role: "Installation", still: "s03", href: "#" },
  { slug: "p6", title: "[PROJECT 6]", year: "[YEAR]", role: "Short film", still: "s13", href: "#" },
] as const;
