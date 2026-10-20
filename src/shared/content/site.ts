import type { StillId } from "./types";

/**
 * Site-wide content. Bracketed values are PLACEHOLDERS until the studio sends
 * real content. House style: no em dashes.
 */
export const SITE = {
  studio: "Little Black Fish",
  studioFull: "Little Black Fish Studios",
  /** Optional personal credit for later. */
  artistName: undefined as string | undefined,
  tagline: "Creative storytelling from cinema to animation.",
  city: "Tehran",
  /** Live site: littleblackfishstudios.com (has EN and FA versions). */
  url: "https://www.littleblackfishstudios.com",
  seriesTitle: "Shahnameh",
  seriesUrl: "#watch", // PLACEHOLDER: link to the series
  seriesYear: "[YEAR]",
  email: "[EMAIL]", // PLACEHOLDER: live site only has a contact form, no public address
  contact: {
    heading: "Have a project in mind? Let's talk.",
    cta: "Start a project",
  },
  socials: [
    { label: "Instagram", href: "https://www.instagram.com/littleblackfishstudio/" },
    { label: "YouTube", href: "https://www.youtube.com/@Littleblackfishstudio" },
  ],
  /** Ways to support the Shahnameh series (from the live /support page). */
  support: [
    { label: "Support in Dollars", note: "Card, any amount", href: "https://lbfstudios.gumroad.com/coffee" },
    { label: "Support in Rial", note: "Iranian bank card, desired amount", href: "https://tlcard.ir/charge/7603/8565" },
  ],
  year: "2026",
} as const;

/** About copy, from the live /about page. Superseded by messages/<locale>/about.json; kept for existing imports. */
export const ABOUT = {
  headline: "We Build Worlds.",
  sections: [
    {
      paragraphs: [
        "Little Black Fish is an independent creative studio for storytelling, image and world-building. A place to shape stories, characters and worlds that have their own language and identity.",
        "We come from narrative, image, performance and imagination. Cinema, animation, photography, painting, performance and new technologies are not destinations for us; they are media through which an idea can take shape. We do not choose the form in advance. Every world finds its own language and tools.",
      ],
    },
    {
      title: "Worlds you can enter",
      paragraphs: [
        "Years of experience across different fields of art and storytelling have brought us, today, to a shared point: building worlds that you can enter, believe in and remember.",
        "Every project begins with a simple idea. The name Little Black Fish comes from one. A little black fish decides to leave the familiar path. It does not know what waits at the end of the road, and it does not wait to be ready before setting out. It moves with what it has, to see what it has not yet seen and to reach a place it does not yet know.",
        "Our way of working is close to this idea. We are not after repeating familiar forms. Every project is an opportunity to discover its own logic, language and identity, from narrative and character to image, motion, space and the tools needed to build its world.",
      ],
    },
    {
      title: "Slightly farther than familiar waters",
      paragraphs: [
        "Technology is a tool for us, not an identity. Tools change; what remains is the vision, the story and the world that has been built.",
        "A project may begin with an image, a character, a text or even a question. What matters to us is that its starting point has the capacity to keep growing, into a larger world with its own logic, memory and identity, one that can go beyond its origin.",
        "Shahnameh: Land of Crown and Legend is one of these experiences: a contemporary encounter with a world that existed centuries before us, and a renewed attempt to find a fresh language for seeing and experiencing it.",
        "Little Black Fish was created to make something that does not yet have a ready-made example.",
      ],
    },
  ],
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
  { slug: "series", title: SITE.seriesTitle, year: "[YEAR]", role: "Animated series", still: "s20", href: "/projects/series", featured: true },
  { slug: "p1", title: "[PROJECT 1]", year: "[YEAR]", role: "Short film", still: "s04", href: "#" },
  { slug: "p2", title: "[PROJECT 2]", year: "[YEAR]", role: "Music video", still: "s16", href: "#" },
  { slug: "p3", title: "[PROJECT 3]", year: "[YEAR]", role: "Title sequence", still: "s12", href: "#" },
  { slug: "p4", title: "[PROJECT 4]", year: "[YEAR]", role: "Commission", still: "s21", href: "#" },
  { slug: "p5", title: "[PROJECT 5]", year: "[YEAR]", role: "Installation", still: "s03", href: "#" },
  { slug: "p6", title: "[PROJECT 6]", year: "[YEAR]", role: "Short film", still: "s13", href: "#" },
] as const;
