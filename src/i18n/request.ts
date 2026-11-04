import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { getContentOverrides } from "@/shared/data/content";
import { applyOverridesInPlace } from "@/shared/data/contentPaths";
import { getSeriesContent } from "@/shared/data/series";
import { applySeriesMessages } from "@/shared/data/seriesMessages";
import { NAMESPACES, routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const entries = await Promise.all(
    NAMESPACES.map(async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const),
  );
  const base: Record<string, unknown> = Object.fromEntries(entries);
  // One private copy for both layers: the imported JSON modules are shared and must never be mutated.
  const messages = structuredClone(base);

  // Admin copy edits (site_content) layered over the JSON. Any failure keeps the pure JSON.
  try {
    const overrides = await getContentOverrides(locale);
    if (Object.keys(overrides).length > 0) applyOverridesInPlace(messages, overrides);
  } catch (e) {
    console.warn("[i18n] content overrides skipped:", e instanceof Error ? e.message : e);
  }

  // Admin-edited series text (chapters, characters, narration) layered over series.json.
  try {
    applySeriesMessages(messages, await getSeriesContent(), locale);
  } catch (e) {
    console.warn("[i18n] series content skipped:", e instanceof Error ? e.message : e);
  }

  return { locale, messages };
});
