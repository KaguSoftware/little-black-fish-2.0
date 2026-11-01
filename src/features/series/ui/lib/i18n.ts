/** Locale helpers for the series overlays. UI strings live in messages/<locale>/series.json. */

import type { TellerId } from "@/shared/content/types";

type SeriesT = { has: (key: string) => boolean; (key: string): string };

/** The teller's name in this locale: messages "names.<id>" when present, else the English source. */
export function tellerName(tr: SeriesT, id: TellerId, fallback: string): string {
  return tr.has(`names.${id}`) ? tr(`names.${id}`) : fallback;
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** "02" → "۰۲" on fa; unchanged otherwise. */
export function localDigits(s: string, locale: string): string {
  return locale === "fa" ? s.replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]) : s;
}

/** True when the text contains Arabic-script letters (Persian). Such text must never be split per letter. */
export function hasArabicScript(text: string): boolean {
  return /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(text);
}
