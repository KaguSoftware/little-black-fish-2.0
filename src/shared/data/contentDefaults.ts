import "server-only";

import { NAMESPACES } from "@/i18n/routing";
import { flattenMessages, isEditableKey } from "./contentPaths";
import type { ContentLocale } from "./types";

const memo = new Map<ContentLocale, Promise<Record<string, string>>>();

/** Flattened default copy ({ "ns.path": text }) straight from messages/<locale>/*.json, editable keys only. */
export function getDefaultCopy(locale: ContentLocale): Promise<Record<string, string>> {
  let p = memo.get(locale);
  if (!p) {
    p = (async () => {
      const out: Record<string, string> = {};
      await Promise.all(
        NAMESPACES.map(async (ns) => {
          const json = (await import(`../../../messages/${locale}/${ns}.json`)).default;
          flattenMessages(json, ns, out);
        }),
      );
      for (const k of Object.keys(out)) if (!isEditableKey(k)) delete out[k];
      return out;
    })();
    // Never memoise a rejection: a transient import failure would otherwise stick until restart.
    p.catch(() => memo.delete(locale));
    memo.set(locale, p);
  }
  return p;
}
