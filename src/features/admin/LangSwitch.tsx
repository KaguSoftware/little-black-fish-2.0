"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export type EditLang = "en" | "fa";

/** The language last edited; the next editor opens on it so a Persian pass stays a Persian pass. */
let remembered: EditLang = "en";

export function useEditLang() {
  const [lang, set] = useState<EditLang>(remembered);
  const setLang = (l: EditLang) => {
    remembered = l;
    set(l);
  };
  return [lang, setLang] as const;
}

/**
 * English / Persian switch for bilingual forms. Both languages stay mounted: CSS shows the pairs
 * (`.adm-pair[data-bi]`) for the chosen language only, so nothing typed is lost by switching.
 */
export function LangSwitch({ value, onChange }: { value: EditLang; onChange: (l: EditLang) => void }) {
  const t = useTranslations("admin");
  return (
    <div className="ux-seg adm-langswitch" role="group" aria-label={t("editingLang")}>
      <button type="button" className="ux-seg-btn" aria-pressed={value === "en"} onClick={() => onChange("en")} lang="en">
        {t("langEn")}
      </button>
      <button type="button" className="ux-seg-btn" aria-pressed={value === "fa"} onClick={() => onChange("fa")}>
        {t("langFa")}
      </button>
    </div>
  );
}
