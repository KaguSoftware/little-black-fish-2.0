import { pick, pickStrict } from "@/shared/data/localize";
import type { ProjectRow } from "@/shared/data/types";

/**
 * Title and intro for /support, shared by the page and its metadata.
 * Title: support_title, then the project title, then the studio title.
 * Intro: support_intro, else the studio intro.
 */
export function resolveSupport(
  project: ProjectRow | null,
  locale: string,
  studio: { title: string; intro: string },
) {
  if (!project) return studio;
  return {
    title: pickStrict(project, "support_title", locale) ?? (pick(project, "title", locale) || studio.title),
    intro: pickStrict(project, "support_intro", locale) ?? studio.intro,
  };
}
