/**
 * The team, shown on /about. Bracketed values are PLACEHOLDERS until the studio sends
 * real content. Text fields come in both languages; `photo` is a path under /public
 * (3:4 portrait, e.g. /team/name.webp) or null for the monogram stand-in; `instagram`
 * is the bare handle, without the @. House style: no em dashes.
 */
export interface TeamMember {
  id: string;
  name: { en: string; fa: string };
  /** Job title. */
  title: { en: string; fa: string };
  /** What they did on the project, one or two short sentences. */
  role: { en: string; fa: string };
  photo: string | null;
  instagram: string | null;
}

export const TEAM: readonly TeamMember[] = [
  {
    id: "member-1",
    name: { en: "[MEMBER 1]", fa: "[عضو ۱]" },
    title: { en: "[TITLE]", fa: "[سمت]" },
    role: { en: "[Contribution to the project]", fa: "[نقش در پروژه]" },
    photo: null,
    instagram: null,
  },
  {
    id: "member-2",
    name: { en: "[MEMBER 2]", fa: "[عضو ۲]" },
    title: { en: "[TITLE]", fa: "[سمت]" },
    role: { en: "[Contribution to the project]", fa: "[نقش در پروژه]" },
    photo: null,
    instagram: null,
  },
  {
    id: "member-3",
    name: { en: "[MEMBER 3]", fa: "[عضو ۳]" },
    title: { en: "[TITLE]", fa: "[سمت]" },
    role: { en: "[Contribution to the project]", fa: "[نقش در پروژه]" },
    photo: null,
    instagram: null,
  },
];

export const instagramUrl = (handle: string) => `https://www.instagram.com/${handle}/`;
