/** Lowercase; every run of non-[a-z0-9] becomes "-"; trim dashes. */
export function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
