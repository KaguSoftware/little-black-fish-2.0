import type { Locale } from "@/i18n/routing";

type Bilingual<K extends string> = { [P in `${K}_en` | `${K}_fa`]?: string | null };

/** Picks `<field>_<locale>`, falling back to the other language when that one is empty. */
export function pick<K extends string>(row: Bilingual<K>, field: K, locale: Locale | string): string {
  const own = row[`${field}_${locale === "fa" ? "fa" : "en"}` as keyof Bilingual<K>];
  const other = row[`${field}_${locale === "fa" ? "en" : "fa"}` as keyof Bilingual<K>];
  return (own?.trim() || other?.trim() || "") as string;
}

/** Same as pick, but no cross-language fallback (null when this locale's field is empty). */
export function pickStrict<K extends string>(row: Bilingual<K>, field: K, locale: Locale | string): string | null {
  const v = row[`${field}_${locale === "fa" ? "fa" : "en"}` as keyof Bilingual<K>];
  return v?.trim() ? v.trim() : null;
}

/** Persian digits on fa. */
export function formatNumber(n: number, locale: Locale | string) {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(n);
}
